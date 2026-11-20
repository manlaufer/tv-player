'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const localNodeModules = path.join(__dirname, 'node_modules');
if (!module.paths.includes(localNodeModules)) {
  module.paths.unshift(localNodeModules);
}
const bigInt = require('big-integer');
const QRCode = require('qrcode');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');

const PORT = Number(process.env.TG_BRIDGE_PORT || 8766);
let USER_DATA_DIR = path.join(process.env.LOCALAPPDATA || __dirname, 'TVPlayer');
try {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
} catch (_) {
  USER_DATA_DIR = __dirname;
}
const SESSION_FILE = path.join(USER_DATA_DIR, 'tg_session.json');
const LEGACY_SESSION_FILE = path.join(__dirname, 'tg_session.json');
const CONFIG_FILE = fs.existsSync(path.join(USER_DATA_DIR, 'tg_config.json'))
  ? path.join(USER_DATA_DIR, 'tg_config.json')
  : path.join(__dirname, 'tg_config.json');
const LOG_FILE = path.join(USER_DATA_DIR, 'tg_bridge.log');
const FFMPEG_BIN = path.join(__dirname, 'bin', 'ffmpeg.exe');

// Official Telegram Desktop API credentials (overridable via request body or optional tg_config.json)
const DEFAULT_API_ID = 2040;
const DEFAULT_API_HASH = 'b18441a1ff607e10a989891a5462e627';

const pendingClients = new Map();
let pendingAuthState = null;
let qrAuthSession = null;

const state = {
  client: null,
  authenticated: false,
  user: null,
  entityCache: new Map(),
  activeStream: null
};

function appendBridgeLog(level, message, details = null) {
  const ts = new Date().toISOString();
  let suffix = '';
  if (details !== null && details !== undefined) {
    if (typeof details === 'string') {
      suffix = ' ' + details;
    } else {
      try {
        suffix = ' ' + JSON.stringify(details);
      } catch (_) {
        suffix = ' [unserializable]';
      }
    }
  }
  const line = `[${ts}] [${level}] ${message}${suffix}`;
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (_) {}
}

function loadClientConfig(overrideApiId = null, overrideApiHash = null) {
  let apiId = DEFAULT_API_ID;
  let apiHash = DEFAULT_API_HASH;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (parsed && Number(parsed.apiId) > 0 && parsed.apiHash) {
        apiId = parseInt(parsed.apiId, 10);
        apiHash = String(parsed.apiHash).trim();
      }
    }
  } catch (err) {
    appendBridgeLog('WARN', 'Failed to read optional tg_config.json:', err.message);
  }
  const reqId = parseInt(overrideApiId, 10);
  const reqHash = typeof overrideApiHash === 'string' ? overrideApiHash.trim() : '';
  if (Number.isInteger(reqId) && reqId > 0 && reqHash) {
    apiId = reqId;
    apiHash = reqHash;
  }
  return { apiId, apiHash };
}

function loadSavedSession() {
  const candidates = SESSION_FILE === LEGACY_SESSION_FILE
    ? [SESSION_FILE]
    : [SESSION_FILE, LEGACY_SESSION_FILE];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && typeof parsed.sessionString === 'string' && parsed.sessionString.length > 0) {
        return parsed;
      }
    } catch (err) {
      appendBridgeLog('WARN', 'Failed to read session file:', err.message);
    }
  }
  return null;
}

function saveSession(sessionString, user, extra = null) {
  const cleanSession = typeof sessionString === 'string' ? sessionString.trim() : '';
  if (!cleanSession) {
    appendBridgeLog('WARN', 'Skipping saveSession: empty sessionString; preserving existing session.');
    return false;
  }
  const payload = Object.assign({
    sessionString: cleanSession,
    user: user || null,
    authenticated: Boolean(user),
    updatedAt: new Date().toISOString()
  }, extra || {});
  const tmpFile = `${SESSION_FILE}.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmpFile, SESSION_FILE);
  return true;
}

function formatUser(me) {
  if (!me) return null;
  return {
    id: me.id ? me.id.toString() : '',
    username: me.username || '',
    firstName: me.firstName || '',
    lastName: me.lastName || '',
    phone: me.phone || ''
  };
}

function createGramClient(sessionStr, apiId, apiHash) {
  const client = new TelegramClient(new StringSession(sessionStr || ''), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false
  });
  client.setLogLevel('warn');
  return client;
}

async function initFromSavedSession() {
  const saved = loadSavedSession();
  if (!saved || saved.authenticated === false || !saved.sessionString) return;
  const { apiId, apiHash } = loadClientConfig();
  try {
    const client = createGramClient(saved.sessionString, apiId, apiHash);
    await client.connect();
    const authorized = await client.checkAuthorization();
    if (!authorized) {
      await client.disconnect();
      return;
    }
    const me = await client.getMe();
    state.client = client;
    state.authenticated = Boolean(me);
    state.user = me ? formatUser(me) : (saved.user || null);
    appendBridgeLog('INFO', 'Restored GramJS session for:', state.user ? (state.user.username || state.user.phone) : 'user');
  } catch (err) {
    appendBridgeLog('WARN', 'Saved session restore failed:', err.message);
    state.authenticated = false;
  }
}

function sendJson(res, statusCode, data) {
  if (res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*'
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function abortActiveStream() {
  if (!state.activeStream) return;
  const prev = state.activeStream;
  state.activeStream = null;
  prev.aborted = true;
  if (prev.ffmpegProc) {
    try { prev.ffmpegProc.kill('SIGKILL'); } catch (_) {}
  }
  if (prev.iter && typeof prev.iter.return === 'function') {
    try {
      Promise.resolve(prev.iter.return()).catch(() => {});
    } catch (_) {}
  }
  if (prev.res && !prev.res.writableEnded) {
    try {
      prev.res.end();
    } catch (_) {}
  }
}

function normalizePhoneNumber(raw) {
  let cleaned = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  if (/^\+?9720\d{7,}$/.test(cleaned)) {
    cleaned = '+972' + cleaned.replace(/^\+?9720/, '');
  } else if (cleaned.startsWith('0') && cleaned.length >= 9 && cleaned.length <= 10) {
    cleaned = '+972' + cleaned.slice(1);
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

async function resolveChannelEntity(channelId) {
  const key = String(channelId);
  if (state.entityCache.has(key)) {
    return state.entityCache.get(key);
  }
  const dialogs = await state.client.getDialogs({ limit: 150 });
  for (const dialog of dialogs) {
    const entity = dialog && dialog.entity;
    if (entity && entity.id !== undefined) {
      state.entityCache.set(entity.id.toString(), entity);
    }
  }
  if (state.entityCache.has(key)) {
    return state.entityCache.get(key);
  }
  throw new Error(`Channel ${channelId} not found in subscribed dialogs`);
}

function extractVideoInfo(msg, channelId) {
  if (!msg || !msg.media || !msg.media.document) {
    return null;
  }
  const doc = msg.media.document;
  const mime = String(doc.mimeType || '');
  let isVideo = mime.startsWith('video/');
  let fileName = '';
  let duration = 0;
  let width = 0;
  let height = 0;

  if (Array.isArray(doc.attributes)) {
    for (const attr of doc.attributes) {
      if (!attr) continue;
      if (attr.className === 'DocumentAttributeVideo') {
        isVideo = true;
        duration = Number(attr.duration || 0);
        width = Number(attr.w || 0);
        height = Number(attr.h || 0);
      } else if (attr.className === 'DocumentAttributeFilename') {
        fileName = String(attr.fileName || '');
      }
    }
  }

  if (!isVideo && /\.(mp4|mkv|webm|mov|avi|m4v|ts|m2ts|flv|wmv|divx|mpg|mpeg)$/i.test(fileName)) {
    isVideo = true;
  }
  if (!isVideo) return null;

  const caption = String(msg.message || '').trim();
  const title = caption
    ? caption.split(/\r?\n/)[0].slice(0, 120)
    : (fileName || `Video #${msg.id}`);

  const totalSize = doc.size ? Number(doc.size.toString()) : 0;

  return {
    channelId: String(channelId),
    messageId: Number(msg.id),
    title,
    fileName: fileName || `video_${msg.id}.mp4`,
    mimeType: mime || 'video/mp4',
    size: totalSize,
    duration,
    width,
    height,
    date: Number(msg.date || 0)
  };
}

async function cleanupQrSession() {
  const prev = qrAuthSession;
  qrAuthSession = null;
  if (!prev) return;
  prev.cancelled = true;
  if (typeof prev.passwordReject === 'function') {
    try { prev.passwordReject(new Error('QR login cancelled')); } catch (_) {}
  }
  prev.passwordResolver = null;
  prev.passwordReject = null;
  if (prev.client && prev.client !== state.client) {
    try { await prev.client.disconnect(); } catch (_) {}
  }
}

async function handleQrStart(req, res) {
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (_) {}
  const { apiId, apiHash } = loadClientConfig(body.apiId, body.apiHash);

  await cleanupQrSession();
  if (state.client) {
    try { await state.client.disconnect(); } catch (_) {}
    state.client = null;
    state.authenticated = false;
    state.user = null;
  }

  let client = null;
  const session = {
    id: `qr_${Date.now()}`,
    client: null,
    status: 'connecting',
    loginUrl: '',
    qrSvg: '',
    expires: 0,
    error: '',
    user: null,
    passwordResolver: null,
    passwordReject: null,
    cancelled: false
  };
  qrAuthSession = session;

  let firstQrSettled = false;
  let resolveFirstQr = null;
  let rejectFirstQr = null;
  const firstQrPromise = new Promise((resolve, reject) => {
    resolveFirstQr = resolve;
    rejectFirstQr = reject;
  });
  const firstQrTimer = setTimeout(() => {
    if (!firstQrSettled) {
      firstQrSettled = true;
      rejectFirstQr(new Error('Timed out generating Telegram QR login token'));
    }
  }, 15000);

  try {
    client = createGramClient('', apiId, apiHash);
    session.client = client;
    await client.connect();

    // Run QR login loop asynchronously so HTTP /qr/start returns the first QR SVG immediately
    client.signInUserWithQrCode(
      { apiId, apiHash },
      {
        qrCode: async ({ token, expires }) => {
          if (session.cancelled || qrAuthSession !== session) return;
          const b64url = Buffer.from(token)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
          const loginUrl = `tg://login?token=${b64url}`;
          const qrSvg = await QRCode.toString(loginUrl, {
            type: 'svg',
            margin: 2,
            color: { dark: '#080A0F', light: '#FFFFFF' }
          });
          session.loginUrl = loginUrl;
          session.qrSvg = qrSvg;
          session.expires = Number(expires || 0);
          session.status = 'waiting_scan';
          appendBridgeLog('INFO', `Generated Telegram QR login token (${session.id}), expires=${session.expires}`);
          if (!firstQrSettled) {
            firstQrSettled = true;
            clearTimeout(firstQrTimer);
            resolveFirstQr();
          }
        },
        password: async () => {
          if (session.cancelled || qrAuthSession !== session) {
            throw new Error('QR login cancelled');
          }
          session.status = 'password_required';
          appendBridgeLog('INFO', `QR login requires 2FA password (${session.id})`);
          return new Promise((resolve, reject) => {
            session.passwordResolver = resolve;
            session.passwordReject = reject;
          });
        },
        onError: (err) => {
          const msg = err && (err.errorMessage || err.message) ? String(err.errorMessage || err.message) : 'QR login failed';
          if (!session.cancelled) {
            appendBridgeLog('WARN', `QR login onError (${session.id}):`, msg);
          }
        }
      }
    ).then(async () => {
      if (session.cancelled || qrAuthSession !== session) {
        try { await client.disconnect(); } catch (_) {}
        return;
      }
      const me = await client.getMe();
      const formattedUser = formatUser(me);
      saveSession(client.session.save(), formattedUser, { authenticated: true });
      state.client = client;
      state.authenticated = true;
      state.user = formattedUser;
      session.user = formattedUser;
      session.status = 'authenticated';
      session.loginUrl = '';
      session.qrSvg = '';
      appendBridgeLog('INFO', `Telegram QR login succeeded (${session.id}):`, formattedUser);
    }).catch(async (err) => {
      if (session.cancelled) return;
      const errMsg = err && (err.errorMessage || err.message)
        ? String(err.errorMessage || err.message)
        : 'Telegram QR login failed';
      session.status = 'error';
      session.error = errMsg;
      appendBridgeLog('ERROR', `Telegram QR login failed (${session.id}):`, errMsg);
      if (!firstQrSettled) {
        firstQrSettled = true;
        clearTimeout(firstQrTimer);
        rejectFirstQr(new Error(errMsg));
      }
      try { await client.disconnect(); } catch (_) {}
    });

    await firstQrPromise;
    sendJson(res, 200, {
      ok: true,
      id: session.id,
      status: session.status,
      loginUrl: session.loginUrl,
      qrSvg: session.qrSvg,
      expires: session.expires
    });
  } catch (err) {
    clearTimeout(firstQrTimer);
    await cleanupQrSession();
    const errMsg = err && (err.errorMessage || err.message)
      ? String(err.errorMessage || err.message)
      : 'Failed to initialize Telegram QR login';
    appendBridgeLog('ERROR', 'handleQrStart error:', errMsg);
    sendJson(res, 400, { ok: false, error: errMsg });
  }
}

function handleQrStatus(res) {
  if (state.authenticated && state.user) {
    sendJson(res, 200, {
      ok: true,
      status: 'authenticated',
      authenticated: true,
      user: state.user
    });
    return;
  }
  if (!qrAuthSession) {
    sendJson(res, 200, {
      ok: true,
      status: 'idle',
      authenticated: false,
      user: null
    });
    return;
  }
  sendJson(res, 200, {
    ok: true,
    id: qrAuthSession.id,
    status: qrAuthSession.status,
    loginUrl: qrAuthSession.loginUrl,
    qrSvg: qrAuthSession.qrSvg,
    expires: qrAuthSession.expires,
    error: qrAuthSession.error || '',
    authenticated: state.authenticated,
    user: state.user
  });
}

async function handleQrPassword(req, res) {
  const body = await readJsonBody(req);
  const password = body.password !== undefined ? String(body.password) : '';
  if (!qrAuthSession || qrAuthSession.status !== 'password_required' || typeof qrAuthSession.passwordResolver !== 'function') {
    sendJson(res, 400, { ok: false, error: 'No pending 2FA password prompt.' });
    return;
  }
  if (!password) {
    sendJson(res, 400, { ok: false, error: '2FA password is required.' });
    return;
  }
  const resolvePw = qrAuthSession.passwordResolver;
  qrAuthSession.passwordResolver = null;
  qrAuthSession.passwordReject = null;
  qrAuthSession.status = 'verifying_password';
  resolvePw(password);
  sendJson(res, 200, { ok: true, status: 'verifying_password' });
}

async function handleQrCancel(res) {
  await cleanupQrSession();
  sendJson(res, 200, { ok: true, status: 'cancelled' });
}

async function handleAuthStart(req, res) {
  const body = await readJsonBody(req);
  const phone = normalizePhoneNumber(body.phone || body.phoneNumber || '');
  if (!phone || !/^\+\d{7,15}$/.test(phone)) {
    sendJson(res, 400, {
      ok: false,
      error: 'Please enter a valid international phone number (e.g. +972543539497).'
    });
    return;
  }

  const { apiId, apiHash } = loadClientConfig(body.apiId, body.apiHash);

  const existingPending = pendingClients.get(phone);
  if (existingPending && existingPending.client) {
    try { await existingPending.client.disconnect(); } catch (_) {}
    pendingClients.delete(phone);
  }
  if (pendingAuthState && pendingAuthState.client && (!existingPending || pendingAuthState.client !== existingPending.client)) {
    try { await pendingAuthState.client.disconnect(); } catch (_) {}
  }
  pendingAuthState = null;

  if (state.client) {
    try { await state.client.disconnect(); } catch (_) {}
    state.client = null;
    state.authenticated = false;
    state.user = null;
  }

  let client = null;
  try {
    client = createGramClient('', apiId, apiHash);
    await client.connect();

    let result = null;
    try {
      result = await client.invoke(new Api.auth.SendCode({
        phoneNumber: phone,
        apiId,
        apiHash,
        settings: new Api.CodeSettings({})
      }));
    } catch (sendErr) {
      const migrateErr = String((sendErr && (sendErr.errorMessage || sendErr.message)) || '');
      const dcMatch = migrateErr.match(/(?:PHONE|NETWORK|USER)_MIGRATE_(\d+)/i);
      if (!dcMatch) throw sendErr;
      const targetDc = Number(dcMatch[1]);
      appendBridgeLog('INFO', `Handling ${migrateErr} for ${phone}, switching to DC ${targetDc}...`);
      if (typeof client._switchDC === 'function') {
        await client._switchDC(targetDc);
      } else {
        await client.disconnect();
        await client.connect();
      }
      result = await client.invoke(new Api.auth.SendCode({
        phoneNumber: phone,
        apiId,
        apiHash,
        settings: new Api.CodeSettings({})
      }));
    }
    appendBridgeLog('INFO', `GramJS SendCode raw response for ${phone}:`, result);

    const hash = result && typeof result.phoneCodeHash === 'string'
      ? result.phoneCodeHash.trim()
      : '';
    if (!hash) {
      throw new Error('Failed to send Telegram code');
    }

    const isCodeViaApp = Boolean(
      (result.type && result.type.className && result.type.className.includes('App')) ||
      result.isCodeViaApp
    );
    const delivery = isCodeViaApp ? 'Telegram App' : 'SMS';
    pendingAuthState = {
      client,
      phoneNumber: phone,
      phoneCodeHash: hash,
      apiId,
      apiHash
    };
    pendingClients.set(phone, {
      client,
      phone,
      phoneCodeHash: hash,
      apiId,
      apiHash,
      createdAt: Date.now()
    });

    const existingSession = loadSavedSession();
    if (!existingSession || existingSession.authenticated === false) {
      saveSession(client.session.save(), null, {
        authenticated: false,
        pendingPhone: phone,
        phoneCodeHash: hash
      });
    }

    sendJson(res, 200, {
      ok: true,
      status: 'code_sent',
      phone,
      normalizedPhone: phone,
      phoneCodeHash: hash,
      isCodeViaApp,
      delivery,
      deliveryType: delivery
    });
  } catch (err) {
    if (client) {
      try { await client.disconnect(); } catch (_) {}
    }
    const errMsg = err && (err.errorMessage || err.message)
      ? String(err.errorMessage || err.message)
      : 'Failed to send Telegram code';
    appendBridgeLog('ERROR', `GramJS sendCode error for ${phone}:`, {
      code: err && err.code ? err.code : null,
      errorMessage: err && err.errorMessage ? err.errorMessage : null,
      message: err && err.message ? err.message : String(err)
    });
    sendJson(res, 400, {
      ok: false,
      error: errMsg,
      rpcCode: err && err.errorMessage ? String(err.errorMessage) : errMsg
    });
  }
}

async function handleAuthVerify(req, res) {
  const body = await readJsonBody(req);
  const code = String(body.code || body.phoneCode || '').trim();
  const password = body.password !== undefined ? String(body.password) : '';
  const requestedPhone = normalizePhoneNumber(body.phone || body.phoneNumber || '');

  let entry = requestedPhone ? pendingClients.get(requestedPhone) : null;
  if (!entry && pendingAuthState && pendingAuthState.client && (!requestedPhone || pendingAuthState.phoneNumber === requestedPhone)) {
    entry = {
      client: pendingAuthState.client,
      phone: pendingAuthState.phoneNumber,
      phoneCodeHash: pendingAuthState.phoneCodeHash,
      apiId: pendingAuthState.apiId,
      apiHash: pendingAuthState.apiHash
    };
  }
  if (!entry && pendingClients.size > 0) {
    entry = Array.from(pendingClients.values())[pendingClients.size - 1];
  }

  const resolvedConfig = loadClientConfig(body.apiId, body.apiHash);
  const apiId = (entry && entry.apiId) || resolvedConfig.apiId;
  const apiHash = (entry && entry.apiHash) || resolvedConfig.apiHash;

  if (!entry || !entry.client) {
    const saved = loadSavedSession();
    const fallbackPhone = requestedPhone || normalizePhoneNumber((saved && saved.pendingPhone) || '');
    const fallbackHash = String(body.phoneCodeHash || (saved && saved.phoneCodeHash) || '').trim();
    if (saved && saved.sessionString && fallbackPhone && fallbackHash) {
      const restoredClient = createGramClient(saved.sessionString, apiId, apiHash);
      await restoredClient.connect();
      entry = {
        client: restoredClient,
        phone: fallbackPhone,
        phoneCodeHash: fallbackHash,
        createdAt: Date.now()
      };
      pendingClients.set(fallbackPhone, entry);
    } else {
      sendJson(res, 400, {
        ok: false,
        error: 'No pending authentication session. Click Send Code first.'
      });
      return;
    }
  }

  const client = entry.client;
  const phone = requestedPhone || entry.phone;
  const phoneCodeHash = String(body.phoneCodeHash || entry.phoneCodeHash || '').trim();

  if (!code && !password) {
    sendJson(res, 400, {
      ok: false,
      error: 'Verification code or 2FA password is required.'
    });
    return;
  }

  try {
    if (code && !entry.codeVerified) {
      try {
        await client.invoke(new Api.auth.SignIn({
          phoneNumber: phone,
          phoneCodeHash,
          phoneCode: code
        }));
      } catch (err) {
        const errMsg = String(err && (err.errorMessage || err.message || ''));
        if (errMsg.includes('SESSION_PASSWORD_NEEDED')) {
          entry.codeVerified = true;
          if (!password) {
            sendJson(res, 401, {
              ok: false,
              status: 'password_required',
              rpcCode: 'SESSION_PASSWORD_NEEDED',
              error: '2FA password required.'
            });
            return;
          }
          await client.signInWithPassword(
            { apiId, apiHash },
            {
              password: async () => password,
              onError: (pwErr) => { throw pwErr; }
            }
          );
        } else {
          throw err;
        }
      }
    } else if (password) {
      await client.signInWithPassword(
        { apiId, apiHash },
        {
          password: async () => password,
          onError: (pwErr) => { throw pwErr; }
        }
      );
    }

    const me = await client.getMe();
    const formattedUser = formatUser(me);
    saveSession(client.session.save(), formattedUser, { authenticated: true });

    state.client = client;
    state.authenticated = true;
    state.user = formattedUser;
    pendingClients.delete(phone);
    pendingAuthState = null;

    appendBridgeLog('INFO', `GramJS signIn succeeded for ${phone}:`, formattedUser);

    sendJson(res, 200, {
      ok: true,
      status: 'authenticated',
      user: state.user
    });
  } catch (err) {
    const errMsg = err && (err.errorMessage || err.message)
      ? String(err.errorMessage || err.message)
      : 'Verification failed.';
    appendBridgeLog('ERROR', `GramJS verify error for ${phone}:`, {
      code: err && err.code ? err.code : null,
      errorMessage: err && err.errorMessage ? err.errorMessage : null,
      message: err && err.message ? err.message : String(err)
    });
    sendJson(res, 400, {
      ok: false,
      error: errMsg,
      rpcCode: err && err.errorMessage ? String(err.errorMessage) : errMsg
    });
  }
}

async function handleAuthResend(req, res) {
  const body = await readJsonBody(req);
  const requestedPhone = normalizePhoneNumber(body.phone || body.phoneNumber || '');
  let entry = requestedPhone ? pendingClients.get(requestedPhone) : null;
  if (!entry && pendingClients.size > 0) {
    entry = Array.from(pendingClients.values())[pendingClients.size - 1];
  }
  if (!entry || !entry.client || !entry.phoneCodeHash) {
    sendJson(res, 400, { ok: false, error: 'No active pending code request to resend.' });
    return;
  }
  try {
    const resCode = await entry.client.invoke(new Api.auth.ResendCode({
      phoneNumber: entry.phone,
      phoneCodeHash: entry.phoneCodeHash
    }));
    const newHash = resCode && typeof (resCode.phoneCodeHash || resCode.phone_code_hash) === 'string'
      ? String(resCode.phoneCodeHash || resCode.phone_code_hash).trim()
      : entry.phoneCodeHash;
    entry.phoneCodeHash = newHash;
    const isCodeViaApp = Boolean(resCode && resCode.type && resCode.type.className === 'auth.SentCodeTypeApp');
    sendJson(res, 200, {
      ok: true,
      phone: entry.phone,
      phoneCodeHash: newHash,
      isCodeViaApp,
      delivery: isCodeViaApp ? 'Telegram App' : 'SMS'
    });
  } catch (err) {
    const errMsg = err && (err.errorMessage || err.message) ? String(err.errorMessage || err.message) : 'Failed to resend verification code';
    appendBridgeLog('ERROR', `GramJS resendCode error for ${entry.phone}:`, errMsg);
    sendJson(res, 400, { ok: false, error: errMsg });
  }
}

async function handleGetChannels(res) {
  if (!state.client || !state.authenticated) {
    sendJson(res, 401, { ok: false, error: 'Not authenticated with Telegram.' });
    return;
  }

  const dialogs = await state.client.getDialogs({ limit: 150 });
  const channels = [];
  const seen = new Set();

  for (const dialog of dialogs) {
    const entity = dialog && dialog.entity;
    if (!entity) continue;
    const isChannelOrChat = entity.className === 'Channel' || entity.className === 'Chat';
    if (!isChannelOrChat) continue;

    const idStr = entity.id ? entity.id.toString() : '';
    if (!idStr || seen.has(idStr)) continue;
    seen.add(idStr);
    state.entityCache.set(idStr, entity);

    channels.push({
      id: idStr,
      title: entity.title || dialog.title || `Channel ${idStr}`,
      username: entity.username || '',
      participantsCount: Number(entity.participantsCount || 0),
      isBroadcast: Boolean(entity.broadcast),
      isMegagroup: Boolean(entity.megagroup)
    });
  }

  sendJson(res, 200, { ok: true, channels });
}

function normalizeSearchQuery(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ').normalize('NFC');
}

function matchesVideoQuery(msg, info, normalizedQuery) {
  if (!normalizedQuery) return true;
  const tokens = normalizedQuery.toLowerCase().split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const haystack = [
    msg && msg.message ? msg.message : '',
    info && info.title ? info.title : '',
    info && info.fileName ? info.fileName : '',
    info && info.channelTitle ? info.channelTitle : ''
  ].join('\n').normalize('NFC').toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

async function handleGetVideos(urlObj, res) {
  if (!state.client || !state.authenticated) {
    sendJson(res, 401, { ok: false, error: 'Not authenticated with Telegram.' });
    return;
  }

  const channelId = (urlObj.searchParams.get('channelId') || '').trim();
  const query = normalizeSearchQuery(urlObj.searchParams.get('q') || '');
  const seenKeys = new Set();

  if (!channelId || channelId === 'all') {
    if (!query) {
      sendJson(res, 200, { ok: true, videos: [] });
      return;
    }
    const globalRes = await state.client.invoke(new Api.messages.SearchGlobal({
      q: query,
      filter: new Api.InputMessagesFilterVideo(),
      minDate: 0,
      maxDate: 0,
      offsetRate: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0,
      limit: 60
    }));
    const chatMap = new Map();
    if (globalRes && Array.isArray(globalRes.chats)) {
      for (const ch of globalRes.chats) {
        if (ch && ch.id !== undefined) {
          const idStr = ch.id.toString();
          state.entityCache.set(idStr, ch);
          chatMap.set(idStr, ch);
        }
      }
    }
    const videos = [];
    const msgs = globalRes && Array.isArray(globalRes.messages) ? globalRes.messages : [];
    for (const msg of msgs) {
      const peer = msg && msg.peerId;
      const peerChannelId = peer && (peer.channelId || peer.chatId);
      if (!peerChannelId) continue;
      const cid = peerChannelId.toString();
      const dedupKey = `${cid}_${msg.id}`;
      if (seenKeys.has(dedupKey)) continue;
      const info = extractVideoInfo(msg, cid);
      if (!info) continue;
      const chatEntity = chatMap.get(cid);
      info.channelTitle = (chatEntity && chatEntity.title) || `Channel ${cid}`;
      if (matchesVideoQuery(msg, info, query)) {
        seenKeys.add(dedupKey);
        videos.push(info);
      }
    }
    sendJson(res, 200, { ok: true, videos });
    return;
  }

  const entity = await resolveChannelEntity(channelId);
  const messages = await state.client.getMessages(entity, {
    search: query || undefined,
    filter: new Api.InputMessagesFilterVideo(),
    limit: query ? 50 : 100
  });

  const videos = [];
  for (const msg of messages) {
    const dedupKey = `${channelId}_${msg.id}`;
    if (seenKeys.has(dedupKey)) continue;
    const info = extractVideoInfo(msg, channelId);
    if (!info) continue;
    info.channelTitle = entity.title || '';
    if (matchesVideoQuery(msg, info, query)) {
      seenKeys.add(dedupKey);
      videos.push(info);
    }
  }

  sendJson(res, 200, { ok: true, videos });
}

function waitForDrain(writable, token) {
  return new Promise((resolve) => {
    if (!writable || token.aborted || writable.destroyed || writable.writableEnded) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      writable.removeListener('drain', finish);
      writable.removeListener('close', finish);
      writable.removeListener('error', finish);
      resolve();
    };
    writable.once('drain', finish);
    writable.once('close', finish);
    writable.once('error', finish);
  });
}

async function pumpGramJsToWritable({ msg, messageId, doc, start, contentLength, writable, token, endOnFinish = true }) {
  const chunkRequestSize = 524288;
  const alignedOffset = Math.floor(start / chunkRequestSize) * chunkRequestSize;
  let skipBytes = start - alignedOffset;
  let bytesSent = 0;
  const maxChunksNeeded = Math.max(1, Math.ceil((contentLength + skipBytes) / chunkRequestSize));

  let iter = null;
  let overrideDcId = doc && doc.dcId ? Number(doc.dcId) : undefined;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      skipBytes = start - alignedOffset;
      const dlOpts = {
        file: msg.media,
        offset: bigInt(alignedOffset),
        limit: maxChunksNeeded,
        requestSize: chunkRequestSize
      };
      if (overrideDcId && Number.isFinite(overrideDcId)) {
        dlOpts.dcId = overrideDcId;
      }

      try {
        const rawIter = state.client.iterDownload(dlOpts);
        iter = typeof rawIter.next === 'function' ? rawIter : rawIter[Symbol.asyncIterator]();
        token.iter = iter;

        let nextChunkPromise = iter.next();
        while (!token.aborted && !writable.writableEnded && !writable.destroyed && bytesSent < contentLength) {
          const step = await nextChunkPromise;
          if (!step || step.done) {
            break;
          }
          if (token.aborted || writable.writableEnded || writable.destroyed) {
            break;
          }

          let buf = Buffer.isBuffer(step.value) ? step.value : Buffer.from(step.value);
          const effectiveLen = skipBytes > 0 ? Math.max(0, buf.length - skipBytes) : buf.length;
          const willNeedMore = (bytesSent + effectiveLen) < contentLength;
          nextChunkPromise = willNeedMore ? iter.next() : Promise.resolve({ done: true });

          if (skipBytes > 0) {
            if (skipBytes >= buf.length) {
              skipBytes -= buf.length;
              continue;
            }
            buf = buf.subarray(skipBytes);
            skipBytes = 0;
          }

          const remaining = contentLength - bytesSent;
          if (buf.length > remaining) {
            buf = buf.subarray(0, remaining);
          }

          if (token.aborted || writable.writableEnded || writable.destroyed) {
            break;
          }
          if (!writable.write(buf)) {
            await waitForDrain(writable, token);
          }
          bytesSent += buf.length;
        }
        break;
      } catch (innerErr) {
        const errText = String((innerErr && (innerErr.errorMessage || innerErr.message)) || '');
        const dcMatch = errText.match(/FILE_MIGRATE_(\d+)/i);
        if (attempt === 0 && bytesSent === 0 && dcMatch && !token.aborted) {
          overrideDcId = Number(dcMatch[1]);
          appendBridgeLog('INFO', `Telegram FILE_MIGRATE redirect to DC ${overrideDcId} for msg ${messageId}`);
          if (iter && typeof iter.return === 'function') {
            try { await Promise.resolve(iter.return()).catch(() => {}); } catch (_) {}
          }
          iter = null;
          token.iter = null;
          continue;
        }
        throw innerErr;
      }
    }
  } catch (err) {
    if (!token.aborted) {
      appendBridgeLog('ERROR', 'GramJS stream error:', err.message);
    }
  } finally {
    if (iter && typeof iter.return === 'function') {
      try {
        await Promise.resolve(iter.return()).catch(() => {});
      } catch (_) {}
    }
    if (token.iter === iter) {
      token.iter = null;
    }
    if (endOnFinish && writable && !writable.writableEnded && !writable.destroyed) {
      try {
        writable.end();
      } catch (_) {}
    }
  }
}

async function handleStreamVideo(req, res, channelId, messageId) {
  if (!state.client || !state.authenticated) {
    sendJson(res, 401, { ok: false, error: 'Not authenticated with Telegram.' });
    return;
  }

  abortActiveStream();

  const streamToken = { res, aborted: false, iter: null, ffmpegProc: null };
  state.activeStream = streamToken;

  req.on('close', () => {
    streamToken.aborted = true;
    if (streamToken.ffmpegProc) {
      try { streamToken.ffmpegProc.kill('SIGKILL'); } catch (_) {}
    }
    if (streamToken.iter && typeof streamToken.iter.return === 'function') {
      try {
        Promise.resolve(streamToken.iter.return()).catch(() => {});
      } catch (_) {}
    }
    if (state.activeStream === streamToken) {
      state.activeStream = null;
    }
  });

  const entity = await resolveChannelEntity(channelId);
  if (streamToken.aborted) return;
  const messages = await state.client.getMessages(entity, { ids: [Number(messageId)] });
  if (streamToken.aborted) return;
  const msg = Array.isArray(messages) ? messages[0] : null;

  if (!msg || !msg.media || !msg.media.document) {
    sendJson(res, 404, { ok: false, error: 'Video message not found.' });
    return;
  }

  const doc = msg.media.document;
  const info = extractVideoInfo(msg, channelId);
  const totalSize = info ? info.size : (doc.size ? Number(doc.size.toString()) : 0);
  const fileName = info ? info.fileName : `video_${msg.id}.mp4`;
  const safeAsciiName = String(fileName || `video_${msg.id}.mp4`).replace(/["\\\r\n;]/g, '_').replace(/[^\x20-\x7E]/g, '_');
  const rawMime = info ? info.mimeType : (doc.mimeType || 'video/mp4');
  const mimeType = (!rawMime || rawMime === 'application/octet-stream') ? 'video/mp4' : rawMime;

  if (!totalSize) {
    sendJson(res, 404, { ok: false, error: 'Video size unavailable.' });
    return;
  }

  const reqUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const wantsRemux = reqUrl.searchParams.get('remux') === '1';
  const wantsTranscode = reqUrl.searchParams.get('transcode') === '1';
  if (wantsRemux || wantsTranscode) {
    if (!fs.existsSync(FFMPEG_BIN)) {
      sendJson(res, 500, { ok: false, error: 'Missing bin/ffmpeg.exe' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': '*'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const ffmpegArgs = [
      '-hide_banner', '-loglevel', 'error',
      '-probesize', '16M', '-analyzeduration', '16M',
      '-i', 'pipe:0',
      '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
      ...(wantsTranscode
        ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '22', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1']
        : ['-c:v', 'copy', '-tag:v', 'hvc1']),
      '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4', 'pipe:1'
    ];
    const ff = spawn(FFMPEG_BIN, ffmpegArgs, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    streamToken.ffmpegProc = ff;
    ff.stdin.on('error', () => {});
    ff.stdout.pipe(res);
    const cleanupFf = () => {
      streamToken.aborted = true;
      if (streamToken.iter && typeof streamToken.iter.return === 'function') {
        try { Promise.resolve(streamToken.iter.return()).catch(() => {}); } catch (_) {}
      }
      if (!res.writableEnded) res.end();
      if (state.activeStream === streamToken) {
        state.activeStream = null;
      }
    };
    ff.on('exit', cleanupFf);
    ff.on('error', cleanupFf);
    try {
      await pumpGramJsToWritable({
        msg,
        messageId,
        doc,
        start: 0,
        contentLength: totalSize,
        writable: ff.stdin,
        token: streamToken,
        endOnFinish: true
      });
    } finally {
      if (state.activeStream === streamToken) {
        state.activeStream = null;
      }
    }
    return;
  }

  const MAX_RANGE_SLICE = 2 * 1024 * 1024;
  const rangeHeader = req.headers.range;
  let start = 0;
  let end = Math.min(MAX_RANGE_SLICE - 1, totalSize - 1);
  let statusCode = 206;

  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
    if (!match) {
      res.writeHead(416, {
        'Content-Range': `bytes */${totalSize}`,
        'Access-Control-Allow-Origin': '*'
      });
      res.end();
      return;
    }
    start = Number(match[1]);
    end = match[2]
      ? Math.min(Number(match[2]), start + MAX_RANGE_SLICE - 1, totalSize - 1)
      : Math.min(start + MAX_RANGE_SLICE - 1, totalSize - 1);
    if (start >= totalSize || start > end) {
      res.writeHead(416, {
        'Content-Range': `bytes */${totalSize}`,
        'Access-Control-Allow-Origin': '*'
      });
      res.end();
      return;
    }
    statusCode = 206;
  }

  const contentLength = end - start + 1;
  const headers = {
    'Content-Type': mimeType,
    'Content-Length': String(contentLength),
    'Content-Disposition': `inline; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(fileName || `video_${msg.id}.mp4`)}`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*'
  };
  if (statusCode === 206) {
    headers['Content-Range'] = `bytes ${start}-${end}/${totalSize}`;
  }

  res.writeHead(statusCode, headers);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  try {
    await pumpGramJsToWritable({
      msg,
      messageId,
      doc,
      start,
      contentLength,
      writable: res,
      token: streamToken,
      endOnFinish: true
    });
  } finally {
    if (state.activeStream === streamToken) {
      state.activeStream = null;
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': '*'
    });
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const rawPathname = urlObj.pathname;
  const pathname = rawPathname.replace(/^\/tg(?=\/|$)/, '') || '/';

  try {
    if (pathname === '/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, status: 'ok', port: PORT });
      return;
    }

    if (pathname === '/abort' && (req.method === 'POST' || req.method === 'GET')) {
      abortActiveStream();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === '/shutdown' && (req.method === 'POST' || req.method === 'GET')) {
      abortActiveStream();
      await cleanupQrSession();
      for (const item of pendingClients.values()) {
        if (item && item.client) {
          try { await item.client.disconnect(); } catch (_) {}
        }
      }
      pendingClients.clear();
      pendingAuthState = null;
      if (state.client) {
        try { await state.client.disconnect(); } catch (_) {}
      }
      sendJson(res, 200, { ok: true, status: 'shutting_down' });
      setTimeout(() => {
        server.close(() => process.exit(0));
      }, 100);
      return;
    }

    if (pathname === '/status' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        authenticated: state.authenticated,
        hasSession: Boolean(loadSavedSession()),
        user: state.user
      });
      return;
    }

    if (pathname === '/qr/start' && req.method === 'POST') {
      await handleQrStart(req, res);
      return;
    }

    if (pathname === '/qr/status' && req.method === 'GET') {
      handleQrStatus(res);
      return;
    }

    if (pathname === '/qr/password' && req.method === 'POST') {
      await handleQrPassword(req, res);
      return;
    }

    if (pathname === '/qr/cancel' && req.method === 'POST') {
      await handleQrCancel(res);
      return;
    }

    if ((pathname === '/auth/start' || pathname === '/send-code' || pathname === '/login') && req.method === 'POST') {
      await handleAuthStart(req, res);
      return;
    }

    if (pathname === '/resend-code' && req.method === 'POST') {
      await handleAuthResend(req, res);
      return;
    }

    if ((pathname === '/auth/verify' || pathname === '/verify-code' || pathname === '/sign-in') && req.method === 'POST') {
      await handleAuthVerify(req, res);
      return;
    }

    if ((pathname === '/auth/logout' || pathname === '/logout') && req.method === 'POST') {
      abortActiveStream();
      await cleanupQrSession();
      if (state.client) {
        try {
          await state.client.invoke(new Api.auth.LogOut());
        } catch (_) {}
        try { await state.client.disconnect(); } catch (_) {}
      }
      state.client = null;
      state.authenticated = false;
      state.user = null;
      pendingClients.clear();
      pendingAuthState = null;
      state.entityCache.clear();
      try {
        if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
        if (LEGACY_SESSION_FILE !== SESSION_FILE && fs.existsSync(LEGACY_SESSION_FILE)) {
          fs.unlinkSync(LEGACY_SESSION_FILE);
        }
      } catch (_) {}
      sendJson(res, 200, { ok: true, status: 'logged_out' });
      return;
    }

    if (pathname === '/channels' && req.method === 'GET') {
      await handleGetChannels(res);
      return;
    }

    if (pathname === '/videos' && req.method === 'GET') {
      await handleGetVideos(urlObj, res);
      return;
    }

    const streamMatch = /^\/stream\/([^/]+)\/(\d+)$/.exec(pathname);
    if (streamMatch && (req.method === 'GET' || req.method === 'HEAD')) {
      await handleStreamVideo(req, res, decodeURIComponent(streamMatch[1]), streamMatch[2]);
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Not Found' });
  } catch (err) {
    appendBridgeLog('ERROR', 'Request error:', err && err.message ? err.message : String(err));
    sendJson(res, 500, {
      ok: false,
      error: err && (err.errorMessage || err.message) ? String(err.errorMessage || err.message) : 'Internal server error'
    });
  }
});

initFromSavedSession().finally(() => {
  server.listen(PORT, '127.0.0.1', () => {
    appendBridgeLog('INFO', `GramJS TelegramBridge listening on http://127.0.0.1:${PORT}`);
  });
});
