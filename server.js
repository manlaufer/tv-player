'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { execFile, spawn } = require('child_process');
const zlib = require('zlib');

const PORT = Number(process.env.PORT || 8765);
const HOST = '127.0.0.1';
const ROOT_DIR = path.resolve(__dirname);
const SHARES_FILE = path.join(ROOT_DIR, 'network_shares.json');
const DVR_SCHEDULES_FILE = path.join(ROOT_DIR, 'dvr_schedules.json');
const FFMPEG_BIN = path.join(ROOT_DIR, 'bin', 'ffmpeg.exe');
const TG_BRIDGE_ORIGIN = 'http://127.0.0.1:8766';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.m3u': 'audio/x-mpegurl; charset=utf-8',
  '.m3u8': 'application/vnd.apple.mpegurl; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t'
};

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts', '.m2ts', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv']);

const staticCache = new Map();
const activeProxyRequests = new Map();
const proxyHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 16 });
const proxyHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 16, rejectUnauthorized: false });
let activeStream = null;
let streamSeq = 0;

function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
}

function sendJson(res, statusCode, data) {
  addCorsHeaders(res);
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const buf = Buffer.from(body, 'utf8');
  if (!res.headersSent) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store'
    });
  }
  res.end(buf);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function abortTelegramBridgeStream() {
  try {
    const req = http.request(`${TG_BRIDGE_ORIGIN}/tg/abort`, { method: 'POST', timeout: 1000 }, (r) => {
      r.resume();
    });
    req.on('error', () => {});
    req.end();
  } catch (_) {}
}

let activeProxyFfmpeg = null;

function killActiveProxyFfmpeg() {
  if (activeProxyFfmpeg) {
    const ff = activeProxyFfmpeg;
    activeProxyFfmpeg = null;
    try { ff.kill('SIGKILL'); } catch (_) {}
  }
}

function stopActiveStream(onlyId = null) {
  if (activeStream && (onlyId === null || activeStream.id === onlyId)) {
    const cur = activeStream;
    activeStream = null;
    try {
      if (cur.cleanup) cur.cleanup();
    } catch (_) {}
  }
  if (onlyId === null) {
    for (const upstreamReq of activeProxyRequests.values()) {
      try { upstreamReq.destroy(); } catch (_) {}
    }
    activeProxyRequests.clear();
    killActiveProxyFfmpeg();
    abortTelegramBridgeStream();
  }
}

function registerActiveStream(cleanup) {
  stopActiveStream();
  streamSeq += 1;
  const id = streamSeq;
  activeStream = { id, cleanup };
  return id;
}

function prewarmStaticCache() {
  for (const rel of ['index.html', 'style.css', 'app.js', 'worker.js']) {
    const full = path.join(ROOT_DIR, rel);
    try {
      if (fs.existsSync(full)) {
        const st = fs.statSync(full);
        if (st.isFile()) {
          staticCache.set(full, {
            mtimeMs: st.mtimeMs,
            bytes: fs.readFileSync(full)
          });
        }
      }
    } catch (_) {}
  }
}

function rewriteM3u8Manifest(content, baseUri) {
  const lines = content.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    if (trimmed.startsWith('#')) {
      const rewrittenTag = line.replace(/URI="([^"]+)"/g, (_, rawUri) => {
        try {
          const abs = new URL(rawUri, baseUri).toString();
          return `URI="/proxy?url=${encodeURIComponent(abs)}"`;
        } catch (_) {
          return `URI="${rawUri}"`;
        }
      });
      out.push(rewrittenTag);
      continue;
    }
    try {
      const abs = new URL(trimmed, baseUri).toString();
      out.push(`/proxy?url=${encodeURIComponent(abs)}`);
    } catch (_) {
      out.push(line);
    }
  }
  return out.join('\r\n');
}

function extractProxyTargetUrl(rawReqUrl, parsedUrl) {
  const paramUrl = parsedUrl.searchParams.get('url');
  if (!rawReqUrl) return paramUrl;
  const qIdx = rawReqUrl.indexOf('?');
  if (qIdx < 0) return paramUrl;
  const rawQuery = rawReqUrl.slice(qIdx + 1);
  const match = rawQuery.match(/(?:^|&)url=(https?:\/\/.+)$/i);
  if (!match) return paramUrl;
  const tail = match[1];
  const proxyParamMatch = tail.match(/&(raw|remux|transcode|ua)=/i);
  return proxyParamMatch ? tail.slice(0, proxyParamMatch.index) : tail;
}

function fetchUpstreamWithRedirects(targetUrl, reqHeaders, method = 'GET', maxHops = 5) {
  return new Promise((resolve, reject) => {
    let currentUrl = targetUrl;
    let hops = 0;

    const doRequest = () => {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch (_) {
        reject(new Error('Invalid URL'));
        return;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        reject(new Error('Only HTTP/HTTPS URLs are supported'));
        return;
      }

      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;
      const agent = isHttps ? proxyHttpsAgent : proxyHttpAgent;
      const headers = {
        'User-Agent': reqHeaders['user-agent'] || 'VLC/3.0.20 LibVLC/3.0.20',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
      };
      if (reqHeaders.range) headers.Range = reqHeaders.range;

      const reqKey = ++streamSeq;
      const upstreamReq = lib.request(
        parsed,
        { method, headers, timeout: 15000, agent, rejectUnauthorized: false },
        (upstreamRes) => {
          const code = upstreamRes.statusCode || 502;
          if ([301, 302, 303, 307, 308].includes(code) && upstreamRes.headers.location && hops < maxHops) {
            hops += 1;
            activeProxyRequests.delete(reqKey);
            const nextUrl = new URL(upstreamRes.headers.location, parsed).toString();
            upstreamRes.resume();
            currentUrl = nextUrl;
            doRequest();
            return;
          }
          resolve({ upstreamReq, upstreamRes, reqKey, finalUrl: parsed.toString() });
        }
      );
      activeProxyRequests.set(reqKey, upstreamReq);

      upstreamReq.on('timeout', () => {
        activeProxyRequests.delete(reqKey);
        upstreamReq.destroy(new Error('Upstream timeout'));
      });
      upstreamReq.on('error', (err) => {
        activeProxyRequests.delete(reqKey);
        reject(err);
      });
      upstreamReq.end();
    };

    doRequest();
  });
}

async function handleProxy(req, res, parsedUrl) {
  const targetUrl = extractProxyTargetUrl(req.url, parsedUrl);
  if (!targetUrl) {
    sendJson(res, 400, { error: 'Missing url query parameter' });
    return;
  }

  let targetParsed;
  try {
    targetParsed = new URL(targetUrl);
  } catch (_) {
    sendJson(res, 400, { error: 'Invalid target URL' });
    return;
  }
  if (targetParsed.protocol !== 'http:' && targetParsed.protocol !== 'https:') {
    sendJson(res, 400, { error: 'Only HTTP/HTTPS URLs are supported' });
    return;
  }

  const rawPlaylistFlag = parsedUrl.searchParams.get('raw') === '1';
  const wantsProxyRemux = parsedUrl.searchParams.get('remux') === '1';
  const wantsProxyTranscode = parsedUrl.searchParams.get('transcode') === '1';
  const customUa = (parsedUrl.searchParams.get('ua') || '').trim();
  const isPlaylistOrMeta = rawPlaylistFlag || /\.(m3u8?|xml|txt|json)(\?|$)/i.test(targetUrl) || /get\.php|[?&]type=m3u/i.test(targetUrl);
  const isStreamCandidate = !isPlaylistOrMeta;
  let streamId = null;

  if (isStreamCandidate) {
    stopActiveStream();
  }
  if (res.socket) {
    try { res.socket.setNoDelay(true); } catch (_) {}
  }

  try {
    const incomingUa = String(req.headers['user-agent'] || '');
    const effectiveUa = customUa || (/Mozilla\//i.test(incomingUa) || !incomingUa ? 'VLC/3.0.20 LibVLC/3.0.20' : incomingUa);
    const upstreamHeaders = Object.assign({}, req.headers, { 'user-agent': effectiveUa });
    const { upstreamReq, upstreamRes, reqKey, finalUrl } = await fetchUpstreamWithRedirects(
      targetUrl,
      upstreamHeaders,
      req.method === 'HEAD' ? 'HEAD' : 'GET'
    );

    const cleanupUpstream = () => {
      activeProxyRequests.delete(reqKey);
      try { upstreamRes.destroy(); } catch (_) {}
      try { upstreamReq.destroy(); } catch (_) {}
    };

    if (isStreamCandidate) {
      streamId = registerActiveStream(cleanupUpstream);
    }

    const contentType = String(upstreamRes.headers['content-type'] || 'application/octet-stream');
    const isM3u8 = !rawPlaylistFlag && (/mpegurl/i.test(contentType) || /\.m3u8(\?|$)/i.test(finalUrl));

    if (isM3u8) {
      const chunks = [];
      upstreamRes.on('data', (c) => chunks.push(c));
      upstreamRes.on('end', () => {
        activeProxyRequests.delete(reqKey);
        const raw = Buffer.concat(chunks).toString('utf8');
        const rewritten = rewriteM3u8Manifest(raw, finalUrl);
        const out = Buffer.from(rewritten, 'utf8');
        addCorsHeaders(res);
        res.writeHead(upstreamRes.statusCode || 200, {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Content-Length': String(out.length),
          'Cache-Control': 'no-store'
        });
        res.end(out);
      });
      upstreamRes.on('error', () => {
        cleanupUpstream();
        if (!res.headersSent) sendJson(res, 502, { error: 'Upstream manifest read failed' });
        else if (!res.writableEnded) res.end();
      });
      return;
    }

    const isAutoMpegTsLive = !isM3u8 &&
      !isPlaylistOrMeta &&
      !/\.(mp4|m4s|webm|mkv|avi|mov|ts)(\?|$)/i.test(finalUrl) &&
      /video\/mp2t|application\/octet-stream/i.test(contentType);

    if ((wantsProxyRemux || wantsProxyTranscode || isAutoMpegTsLive) && fs.existsSync(FFMPEG_BIN)) {
      addCorsHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store'
      });
      if (req.method === 'HEAD') {
        cleanupUpstream();
        res.end();
        return;
      }
      killActiveProxyFfmpeg();
      const ffmpegArgs = [
        '-hide_banner', '-loglevel', 'error',
        '-fflags', '+genpts+discardcorrupt',
        '-i', 'pipe:0',
        '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
        ...(wantsProxyTranscode
          ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '22', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1']
          : ['-c:v', 'copy']),
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', 'pipe:1'
      ];
      const ff = spawn(FFMPEG_BIN, ffmpegArgs, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      activeProxyFfmpeg = ff;
      const remuxStreamId = registerActiveStream(() => {
        if (activeProxyFfmpeg === ff) activeProxyFfmpeg = null;
        try { ff.kill('SIGKILL'); } catch (_) {}
        cleanupUpstream();
      });
      ff.stdin.on('error', () => {});
      upstreamRes.pipe(ff.stdin);
      ff.stdout.pipe(res);
      const finishRemux = () => {
        if (activeProxyFfmpeg === ff) activeProxyFfmpeg = null;
        stopActiveStream(remuxStreamId);
        if (!res.writableEnded) res.end();
      };
      res.on('close', () => stopActiveStream(remuxStreamId));
      upstreamRes.on('error', finishRemux);
      ff.on('exit', finishRemux);
      ff.on('error', finishRemux);
      return;
    }

    addCorsHeaders(res);
    let outContentType = contentType;
    if (/\.ts(\?|$)/i.test(finalUrl) && /octet-stream/i.test(outContentType)) {
      outContentType = 'video/mp2t';
    } else if (/\.mp4(\?|$)/i.test(finalUrl) && /octet-stream/i.test(outContentType)) {
      outContentType = 'video/mp4';
    }
    const contentEncoding = String(upstreamRes.headers['content-encoding'] || '').toLowerCase();
    const isXmltvOrMeta = isPlaylistOrMeta || /\.xml(\.gz)?(\?|$)|xmltv\.php/i.test(finalUrl) || /\.xml(\.gz)?(\?|$)|xmltv\.php/i.test(targetUrl);
    const isExplicitCompressed = contentEncoding.includes('gzip') || contentEncoding.includes('deflate');

    const buildOutHeaders = (isDecompressed) => {
      const headers = {
        'Content-Type': isDecompressed && /gzip|octet-stream/i.test(outContentType) ? 'application/xml; charset=utf-8' : outContentType,
        'Accept-Ranges': isDecompressed ? 'none' : (upstreamRes.headers['accept-ranges'] || 'bytes'),
        'Cache-Control': 'no-store'
      };
      if (!isDecompressed) {
        if (upstreamRes.headers['content-length']) headers['Content-Length'] = upstreamRes.headers['content-length'];
        if (upstreamRes.headers['content-range']) headers['Content-Range'] = upstreamRes.headers['content-range'];
      }
      return headers;
    };

    if (req.method === 'HEAD') {
      res.writeHead(upstreamRes.statusCode || 200, buildOutHeaders(isExplicitCompressed));
      cleanupUpstream();
      res.end();
      return;
    }

    const wireDecompressedPipe = (decoder, firstChunk) => {
      decoder.on('error', () => {
        cleanupUpstream();
        if (!res.writableEnded) res.end();
      });
      decoder.pipe(res);
      if (firstChunk && firstChunk.length > 0) {
        decoder.write(firstChunk);
      }
      upstreamRes.pipe(decoder);
    };

    if (isExplicitCompressed) {
      res.writeHead(upstreamRes.statusCode || 200, buildOutHeaders(true));
      const decoder = contentEncoding.includes('deflate') ? zlib.createInflate() : zlib.createGunzip();
      wireDecompressedPipe(decoder, null);
    } else if (isXmltvOrMeta) {
      let headerSent = false;
      const onFirstChunk = (chunk) => {
        upstreamRes.removeListener('data', onFirstChunk);
        const isGzipMagic = chunk && chunk.length >= 2 && chunk[0] === 0x1f && chunk[1] === 0x8b;
        headerSent = true;
        res.writeHead(upstreamRes.statusCode || 200, buildOutHeaders(isGzipMagic));
        if (isGzipMagic) {
          wireDecompressedPipe(zlib.createGunzip(), chunk);
        } else {
          if (chunk && chunk.length > 0) res.write(chunk);
          upstreamRes.pipe(res);
        }
      };
      upstreamRes.on('data', onFirstChunk);
      upstreamRes.on('end', () => {
        if (!headerSent && !res.headersSent) {
          res.writeHead(upstreamRes.statusCode || 200, buildOutHeaders(false));
          res.end();
        }
      });
    } else {
      res.writeHead(upstreamRes.statusCode || 200, buildOutHeaders(false));
      upstreamRes.pipe(res);
    }

    res.on('close', () => {
      if (streamId !== null) stopActiveStream(streamId);
      else cleanupUpstream();
    });
    upstreamRes.on('end', () => {
      if (streamId !== null) stopActiveStream(streamId);
      else activeProxyRequests.delete(reqKey);
    });
    upstreamRes.on('error', () => {
      if (streamId !== null) stopActiveStream(streamId);
      else cleanupUpstream();
      if (!res.writableEnded) res.end();
    });
  } catch (err) {
    if (streamId !== null) stopActiveStream(streamId);
    if (!res.headersSent) {
      sendJson(res, 502, { error: 'Upstream request failed', detail: err.message });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}

let tgBridgeProc = null;
let tgBridgeStartPromise = null;

function probeTelegramBridgeReady() {
  return new Promise((resolve) => {
    const req = http.get(`${TG_BRIDGE_ORIGIN}/tg/status`, { timeout: 500 }, (r) => {
      r.resume();
      resolve(r.statusCode >= 200 && r.statusCode < 500);
    });
    req.on('timeout', () => {
      try { req.destroy(); } catch (_) {}
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function stopTelegramBridge() {
  if (tgBridgeProc) {
    const proc = tgBridgeProc;
    tgBridgeProc = null;
    try { proc.kill('SIGKILL'); } catch (_) {}
  }
}

async function ensureTelegramBridge() {
  if (await probeTelegramBridgeReady()) return true;
  if (tgBridgeStartPromise) return tgBridgeStartPromise;

  tgBridgeStartPromise = (async () => {
    const bridgeScript = path.join(ROOT_DIR, 'telegram-bridge.js');
    if (!fs.existsSync(bridgeScript)) return false;

    const bundledNode = path.join(ROOT_DIR, 'bin', 'node.exe');
    const nodeBin = fs.existsSync(bundledNode) ? bundledNode : process.execPath;

    if (!tgBridgeProc || tgBridgeProc.killed) {
      const child = spawn(nodeBin, [bridgeScript], {
        cwd: ROOT_DIR,
        env: Object.assign({}, process.env, { NODE_PATH: path.join(ROOT_DIR, 'node_modules') }),
        windowsHide: true,
        stdio: 'ignore'
      });
      tgBridgeProc = child;
      child.on('exit', () => {
        if (tgBridgeProc === child) tgBridgeProc = null;
      });
    }

    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      if (await probeTelegramBridgeReady()) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  })();

  try {
    return await tgBridgeStartPromise;
  } finally {
    tgBridgeStartPromise = null;
  }
}

function bufferIncomingRequestBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Request body too large'));
        try { req.destroy(); } catch (_) {}
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleTelegramProxy(req, res, parsedUrl) {
  // Buffer non-GET/HEAD body synchronously BEFORE async ensureTelegramBridge() so the stream never drains mid-startup.
  let bufferedBody = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      bufferedBody = await bufferIncomingRequestBody(req);
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err && err.message ? err.message : 'Invalid request body' });
      return;
    }
  }

  const ready = await ensureTelegramBridge();
  if (!ready) {
    sendJson(res, 502, { ok: false, error: 'Telegram bridge unavailable' });
    return;
  }
  const isTgStream = parsedUrl.pathname.toLowerCase().startsWith('/tg/stream/');
  const targetUrl = `${TG_BRIDGE_ORIGIN}${parsedUrl.pathname}${parsedUrl.search}`;

  const headers = {};
  if (req.headers.range) headers.Range = req.headers.range;
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (bufferedBody !== null) {
    headers['Content-Length'] = String(bufferedBody.length);
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  } else if (req.headers['content-length']) {
    headers['Content-Length'] = req.headers['content-length'];
  }

  let streamId = null;
  let activeUpstreamRes = null;
  const cleanup = () => {
    try { if (activeUpstreamRes) activeUpstreamRes.destroy(); } catch (_) {}
    try { tgReq.destroy(); } catch (_) {}
  };
  if (isTgStream && req.method === 'GET') {
    streamId = registerActiveStream(cleanup);
  }

  const tgReq = http.request(targetUrl, { method: req.method, headers, timeout: 60000 }, (tgRes) => {
    activeUpstreamRes = tgRes;
    const disp = String(tgRes.headers['content-disposition'] || '');
    const ctype = String(tgRes.headers['content-type'] || 'application/octet-stream');

    const statusCode = tgRes.statusCode || 200;
    const isHlsRedirect = statusCode === 302 && Boolean(tgRes.headers.location);

    addCorsHeaders(res);
    const outHeaders = {
      'Content-Type': ctype,
      'Cache-Control': 'no-store'
    };
    if (tgRes.headers.location) outHeaders.Location = tgRes.headers.location;
    if (tgRes.headers['content-length']) outHeaders['Content-Length'] = tgRes.headers['content-length'];
    if (tgRes.headers['content-range']) outHeaders['Content-Range'] = tgRes.headers['content-range'];
    if (tgRes.headers['accept-ranges']) outHeaders['Accept-Ranges'] = tgRes.headers['accept-ranges'];
    if (disp) outHeaders['Content-Disposition'] = disp;

    res.writeHead(statusCode, outHeaders);
    if (req.method === 'HEAD') {
      cleanup();
      res.end();
      return;
    }

    tgRes.pipe(res);
    res.on('close', () => {
      if (isHlsRedirect && res.writableEnded) return;
      if (streamId !== null) stopActiveStream(streamId, isHlsRedirect);
      else cleanup();
    });
    tgRes.on('end', () => {
      if (isHlsRedirect) {
        if (streamId !== null && activeStream && activeStream.id === streamId) {
          activeStream = null;
        }
        return;
      }
      if (streamId !== null) stopActiveStream(streamId);
    });
    tgRes.on('error', () => {
      if (streamId !== null) stopActiveStream(streamId);
      else cleanup();
      if (!res.writableEnded) res.end();
    });
  });

  tgReq.on('timeout', () => {
    tgReq.destroy(new Error('Telegram bridge timeout'));
  });
  tgReq.on('error', () => {
    if (streamId !== null) stopActiveStream(streamId);
    if (!res.headersSent) {
      sendJson(res, 502, {
        ok: false,
        error: 'Telegram bridge unavailable'
      });
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  if (bufferedBody !== null) {
    tgReq.end(bufferedBody);
  } else {
    tgReq.end();
  }
}

function readSharesStore() {
  try {
    if (!fs.existsSync(SHARES_FILE)) return [];
    const raw = fs.readFileSync(SHARES_FILE, 'utf8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeSharesStore(items) {
  const tmp = `${SHARES_FILE}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
  fs.renameSync(tmp, SHARES_FILE);
}

function formatPublicShare(s) {
  return {
    id: String(s.id || ''),
    name: String(s.name || ''),
    type: String(s.type || 'local'),
    path: String(s.path || ''),
    username: String(s.username || ''),
    hasPassword: Boolean(s.password || s.encryptedPassword)
  };
}

function normalizeLocalOrUncPath(rawPath) {
  if (!rawPath) return '';
  const p = String(rawPath).trim().replace(/\//g, '\\');
  if (p.startsWith('\\\\')) {
    const body = p.slice(2).replace(/^\\+/, '');
    if (!body) return '\\\\';
    const normBody = path.win32.normalize(body).replace(/^\\+|\\+$/g, '');
    return normBody ? `\\\\${normBody}` : '\\\\';
  }
  if (/^[a-zA-Z]:$/.test(p)) return `${p}\\`;
  if (/^[a-zA-Z]:\\$/.test(p)) return p;
  const resolved = path.win32.resolve(p);
  return /^[a-zA-Z]:\\$/.test(resolved) ? resolved : resolved.replace(/\\+$/, '');
}

function isPathWithinRoot(rootPath, targetPath) {
  const rawTarget = String(targetPath || '');
  if (/(?:^|[\\/])\.\.(?:$|[\\/])/.test(rawTarget)) {
    return false;
  }
  const rootNorm = normalizeLocalOrUncPath(rootPath);
  const targetNorm = normalizeLocalOrUncPath(targetPath);
  if (!rootNorm || !targetNorm) return false;

  const rootLower = rootNorm.toLowerCase();
  const targetLower = targetNorm.toLowerCase();
  const rootPrefix = rootLower.endsWith('\\') ? rootLower : `${rootLower}\\`;
  return targetLower === rootLower || targetLower.startsWith(rootPrefix);
}

function resolveSafeSharePath(shareRoot, subPath) {
  const rootNorm = normalizeLocalOrUncPath(shareRoot);
  if (!rootNorm) return { ok: false, root: '', target: '' };

  const subClean = String(subPath || '').trim().replace(/\//g, '\\').replace(/^\\+|\\+$/g, '');
  if (!subClean) {
    const isServerRoot = /^\\\\[^\\]+$/.test(rootNorm);
    return { ok: true, path: rootNorm, root: rootNorm, target: rootNorm, isServerRoot };
  }

  const segments = subClean.split('\\').filter(Boolean);
  for (const seg of segments) {
    if (seg === '.' || seg === '..') {
      return { ok: false, root: rootNorm, target: subClean };
    }
  }

  const combined = rootNorm.endsWith('\\')
    ? `${rootNorm}${segments.join('\\')}`
    : `${rootNorm}\\${segments.join('\\')}`;
  const fullTarget = normalizeLocalOrUncPath(combined);

  if (!isPathWithinRoot(rootNorm, fullTarget)) {
    return { ok: false, root: rootNorm, target: fullTarget };
  }
  return { ok: true, path: fullTarget, root: rootNorm, target: fullTarget, isServerRoot: false };
}

function ensureShareConnected(share) {
  return new Promise((resolve) => {
    if (!share || share.type !== 'smb' || !share.username || !share.password) {
      resolve();
      return;
    }
    const uncMatch = String(share.path || '').match(/^\\\\[^\\]+\\[^\\]+/);
    if (!uncMatch) {
      resolve();
      return;
    }
    execFile(
      'net',
      ['use', uncMatch[0], share.password, `/user:${share.username}`, '/persistent:no'],
      { windowsHide: true, timeout: 4000 },
      () => resolve()
    );
  });
}

function listServerSmbShares(serverUnc) {
  return new Promise((resolve) => {
    execFile('net', ['view', serverUnc], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) {
        resolve([]);
        return;
      }
      const names = [];
      for (const line of stdout.split(/\r?\n/)) {
        const m = line.match(/^\s*([^\s].*?)\s+Disk\s+/i);
        if (m && m[1]) {
          const shareName = m[1].trim();
          if (shareName && !shareName.endsWith('$') && !names.includes(shareName)) {
            names.push(shareName);
          }
        }
      }
      resolve(names);
    });
  });
}

async function handleNetShare(req, res, parsedUrl) {
  const p = parsedUrl.pathname;

  if (p === '/netshare/list' && req.method === 'GET') {
    const shares = readSharesStore().map(formatPublicShare);
    sendJson(res, 200, { shares });
    return;
  }

  if (p === '/netshare/add' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const rawPath = String(payload.path || '').trim();
      if (!rawPath) {
        sendJson(res, 400, { error: 'Share path is required' });
        return;
      }
      let shareType = String(payload.type || '').trim().toLowerCase();
      if (!shareType) {
        if (/^[\\/]{2}/.test(rawPath)) shareType = 'smb';
        else if (/^https?:\/\//i.test(rawPath)) shareType = 'webdav';
        else shareType = 'local';
      }
      const sharePath = shareType === 'webdav' ? rawPath.replace(/\/+$/, '') : normalizeLocalOrUncPath(rawPath);
      if (shareType === 'smb' && !/^\\\\[^\\]+/.test(sharePath)) {
        sendJson(res, 400, { error: 'UNC path must be of the form \\\\server or \\\\server\\share' });
        return;
      }
      const shareName = String(payload.name || '').trim() || sharePath;
      const newEntry = {
        id: 'ns_' + crypto.randomBytes(6).toString('hex'),
        name: shareName,
        type: shareType,
        path: sharePath,
        username: String(payload.username || '').trim(),
        password: String(payload.password || '')
      };
      const shares = readSharesStore();
      shares.push(newEntry);
      writeSharesStore(shares);
      sendJson(res, 200, { status: 'added', share: formatPublicShare(newEntry) });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (p === '/netshare/remove' && (req.method === 'DELETE' || req.method === 'POST')) {
    let targetId = parsedUrl.searchParams.get('id') || '';
    if (!targetId) {
      try {
        const body = await readJsonBody(req);
        targetId = String(body.id || '');
      } catch (_) {}
    }
    const kept = readSharesStore().filter((s) => String(s.id) !== targetId);
    writeSharesStore(kept);
    sendJson(res, 200, { status: 'removed', id: targetId });
    return;
  }

  if (p === '/netshare/browse' && req.method === 'GET') {
    const targetId = parsedUrl.searchParams.get('id') || '';
    const subpath = parsedUrl.searchParams.get('subpath') || '';
    const share = readSharesStore().find((s) => String(s.id) === targetId);
    if (!share) {
      sendJson(res, 404, { ok: false, error: 'Share not found' });
      return;
    }

    try {
      await ensureShareConnected(share);
      const pathCheck = resolveSafeSharePath(share.path, subpath);
      if (!pathCheck.ok) {
        sendJson(res, 403, {
          ok: false,
          error: `Path traversal forbidden (root=${pathCheck.root}, target=${pathCheck.target})`
        });
        return;
      }

      const folders = [];
      const files = [];

      if (pathCheck.isServerRoot) {
        const names = await listServerSmbShares(pathCheck.path);
        for (const sn of names) {
          folders.push({ name: sn, subpath: sn, isDir: true });
        }
      } else {
        if (!fs.existsSync(pathCheck.path)) {
          sendJson(res, 404, { ok: false, error: 'Directory not found or unreachable' });
          return;
        }
        const entries = fs.readdirSync(pathCheck.path, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.win32.join(pathCheck.path, entry.name);
          const relSub = full.slice(pathCheck.root.length).replace(/^[\\/]+/, '').replace(/\\/g, '/');
          if (entry.isDirectory()) {
            folders.push({ name: entry.name, subpath: relSub, isDir: true });
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (VIDEO_EXTS.has(ext)) {
              let size = 0;
              try { size = fs.statSync(full).size; } catch (_) {}
              files.push({ name: entry.name, subpath: relSub, size, ext });
            }
          }
        }
      }

      sendJson(res, 200, { ok: true, id: targetId, subpath, folders, files });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message });
    }
    return;
  }

  if (p === '/netshare/resolve-path' && req.method === 'GET') {
    const targetId = parsedUrl.searchParams.get('id') || '';
    const subpath = parsedUrl.searchParams.get('subpath') || parsedUrl.searchParams.get('path') || '';
    const share = readSharesStore().find((s) => String(s.id) === targetId);
    if (!share) {
      sendJson(res, 404, { ok: false, error: 'Share not found' });
      return;
    }
    await ensureShareConnected(share);
    const pathCheck = resolveSafeSharePath(share.path, subpath);
    if (!pathCheck.ok || pathCheck.isServerRoot) {
      sendJson(res, 403, { ok: false, error: 'Forbidden path' });
      return;
    }
    sendJson(res, 200, { ok: true, path: pathCheck.path });
    return;
  }

  if (p === '/netshare/stream' && (req.method === 'GET' || req.method === 'HEAD')) {
    const targetId = parsedUrl.searchParams.get('id') || '';
    const subpath = parsedUrl.searchParams.get('subpath') || parsedUrl.searchParams.get('path') || '';

    const share = readSharesStore().find((s) => String(s.id) === targetId);
    if (!share) {
      sendJson(res, 404, { error: 'Share not found' });
      return;
    }

    await ensureShareConnected(share);
    const pathCheck = resolveSafeSharePath(share.path, subpath);
    if (!pathCheck.ok || pathCheck.isServerRoot) {
      sendJson(res, 403, { error: 'Forbidden path' });
      return;
    }

    const filePath = pathCheck.path;
    let stat;
    try {
      stat = fs.statSync(filePath);
      if (!stat.isFile()) throw new Error('Not a file');
    } catch (_) {
      sendJson(res, 404, { error: 'File not found' });
      return;
    }

    const wantsRemux = parsedUrl.searchParams.get('remux') === '1';
    const wantsTranscode = parsedUrl.searchParams.get('transcode') === '1';
    if (wantsRemux || wantsTranscode) {
      if (!fs.existsSync(FFMPEG_BIN)) {
        sendJson(res, 500, { error: 'Missing bin/ffmpeg.exe' });
        return;
      }
      addCorsHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const ffmpegArgs = [
        '-hide_banner', '-loglevel', 'error',
        '-i', filePath,
        '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
        ...(wantsTranscode
          ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '22', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1']
          : ['-c:v', 'copy', '-tag:v', 'hvc1']),
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4', 'pipe:1'
      ];
      const ff = spawn(FFMPEG_BIN, ffmpegArgs, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const streamId = registerActiveStream(() => {
        try { ff.kill('SIGKILL'); } catch (_) {}
      });
      ff.stdout.pipe(res);
      res.on('close', () => stopActiveStream(streamId));
      ff.on('exit', () => {
        stopActiveStream(streamId);
        if (!res.writableEnded) res.end();
      });
      ff.on('error', () => {
        stopActiveStream(streamId);
        if (!res.writableEnded) res.end();
      });
      return;
    }

    const totalSize = Number(stat.size);
    const ext = path.extname(filePath).toLowerCase();
    const rangeHdr = String(req.headers.range || '');

    let start = 0;
    let end = totalSize > 0 ? totalSize - 1 : 0;
    let statusCode = 200;

    if (rangeHdr && totalSize > 0) {
      const m = rangeHdr.match(/^bytes=(\d*)-(\d*)$/i);
      if (m) {
        const s = m[1] ? Number(m[1]) : NaN;
        const e = m[2] ? Number(m[2]) : NaN;
        if (Number.isFinite(s) && Number.isFinite(e)) {
          start = s;
          end = Math.min(e, totalSize - 1);
        } else if (Number.isFinite(s)) {
          start = s;
          end = totalSize - 1;
        } else if (Number.isFinite(e)) {
          start = Math.max(0, totalSize - e);
          end = totalSize - 1;
        }
        if (start < 0 || start >= totalSize || end < start) {
          addCorsHeaders(res);
          res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
          res.end();
          return;
        }
        statusCode = 206;
      }
    }

    const contentLength = totalSize > 0 ? (end - start + 1) : 0;
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    addCorsHeaders(res);
    const headers = {
      'Content-Type': mime,
      'Content-Length': String(contentLength),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store'
    };
    if (statusCode === 206) {
      headers['Content-Range'] = `bytes ${start}-${end}/${totalSize}`;
    }

    res.writeHead(statusCode, headers);
    if (req.method === 'HEAD' || totalSize === 0) {
      res.end();
      return;
    }

    const rs = fs.createReadStream(filePath, { start, end, highWaterMark: 262144 });
    const streamId = registerActiveStream(() => {
      try { rs.destroy(); } catch (_) {}
    });
    rs.pipe(res);
    res.on('close', () => stopActiveStream(streamId));
    rs.on('end', () => stopActiveStream(streamId));
    rs.on('error', () => {
      stopActiveStream(streamId);
      if (!res.writableEnded) res.end();
    });
    return;
  }

  sendJson(res, 404, { error: 'Unknown netshare endpoint' });
}

function handleStatic(req, res, parsedUrl) {
  let rel = decodeURIComponent(parsedUrl.pathname || '/').replace(/^\/+/, '');
  if (!rel) rel = 'index.html';
  const candidate = path.resolve(ROOT_DIR, rel);

  if (candidate !== ROOT_DIR && !candidate.startsWith(ROOT_DIR + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  const baseName = path.basename(candidate).toLowerCase();
  if (baseName === 'network_shares.json' || baseName === 'tg_session.json' || baseName === 'tg_config.json') {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let stat;
  try {
    stat = fs.statSync(candidate);
    if (!stat.isFile()) {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }
  } catch (_) {
    sendJson(res, 404, { error: 'Not Found' });
    return;
  }

  const ext = path.extname(candidate).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  let fileBytes;
  const cached = staticCache.get(candidate);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    fileBytes = cached.bytes;
  } else {
    fileBytes = fs.readFileSync(candidate);
    if (fileBytes.length <= 4 * 1024 * 1024) {
      staticCache.set(candidate, { mtimeMs: stat.mtimeMs, bytes: fileBytes });
    }
  }

  addCorsHeaders(res);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': String(fileBytes.length),
    'Cache-Control': 'no-cache'
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(fileBytes);
}

// Scheduled DVR Recording Engine (FFmpeg + atomic dvr_schedules.json)
const activeDvrProcesses = new Map();

function getDefaultDvrDir() {
  const home = os.homedir();
  const videosDir = path.join(home, 'Videos');
  const downloadsDir = path.join(home, 'Downloads');
  if (home && fs.existsSync(videosDir)) {
    return path.join(videosDir, 'Recordings');
  }
  if (home && fs.existsSync(downloadsDir)) {
    return path.join(downloadsDir, 'Recordings');
  }
  return path.join(ROOT_DIR, 'Recordings');
}

function sanitizeDvrFileName(rawName, fallbackTitle = 'recording') {
  const baseInput = path.basename(String(rawName || fallbackTitle || 'recording').trim());
  let safe = baseInput.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').replace(/\s+/g, ' ').trim();
  if (!safe || safe === '.ts' || safe === '.mp4') safe = `recording_${Date.now()}`;
  const lower = safe.toLowerCase();
  if (!lower.endsWith('.ts') && !lower.endsWith('.mp4')) {
    safe += '.ts';
  }
  return path.basename(safe);
}

function loadDvrSchedules() {
  try {
    if (!fs.existsSync(DVR_SCHEDULES_FILE)) return [];
    const raw = fs.readFileSync(DVR_SCHEDULES_FILE, 'utf8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveDvrSchedules(list) {
  const tmpFile = `${DVR_SCHEDULES_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(Array.isArray(list) ? list : [], null, 2), 'utf8');
  fs.renameSync(tmpFile, DVR_SCHEDULES_FILE);
}

function stopDvrJobProcess(id) {
  const active = activeDvrProcesses.get(id);
  if (!active) return;
  if (active.timer) {
    clearTimeout(active.timer);
  }
  try {
    if (active.proc && !active.proc.killed) {
      active.proc.kill('SIGTERM');
      setTimeout(() => {
        try {
          if (active.proc && !active.proc.killed) active.proc.kill('SIGKILL');
        } catch (_) {}
      }, 1500);
    }
  } catch (_) {}
  activeDvrProcesses.delete(id);
}

function stopAllDvrProcesses() {
  for (const id of Array.from(activeDvrProcesses.keys())) {
    stopDvrJobProcess(id);
  }
}

function recoverDvrSchedulesOnStartup() {
  const schedules = loadDvrSchedules();
  const now = Date.now();
  let changed = false;
  for (const job of schedules) {
    if (job && job.status === 'recording') {
      job.status = job.endTime > now + 5000 ? 'scheduled' : 'interrupted';
      changed = true;
    }
  }
  if (changed) saveDvrSchedules(schedules);
}

function tickDvrScheduler() {
  const schedules = loadDvrSchedules();
  if (!schedules.length) return;
  const now = Date.now();
  let changed = false;

  for (const job of schedules) {
    if (!job || job.status !== 'scheduled') continue;
    const effectiveEnd = job.immediate && job.recordDeadline ? job.recordDeadline : job.endTime;
    const effectiveStart = job.immediate ? 0 : job.startTime;
    if (now >= effectiveEnd) {
      job.status = 'missed';
      changed = true;
      continue;
    }
    if (now >= effectiveStart && !activeDvrProcesses.has(job.id)) {
      if (!fs.existsSync(FFMPEG_BIN)) {
        job.status = 'failed';
        job.error = 'Missing bin/ffmpeg.exe';
        changed = true;
        continue;
      }

      const saveDir = String(job.saveDir || '').trim() || getDefaultDvrDir();
      const fileName = sanitizeDvrFileName(job.fileName, job.programTitle || job.channelName);
      const fullOutputPath = path.join(saveDir, fileName);
      const durationSec = Math.max(5, Math.ceil((effectiveEnd - now) / 1000));

      try {
        fs.mkdirSync(saveDir, { recursive: true });
      } catch (dirErr) {
        job.status = 'failed';
        job.error = `Cannot create directory: ${dirErr.message}`;
        changed = true;
        continue;
      }

      const args = [
        '-y',
        '-hide_banner',
        '-loglevel', 'warning',
        '-i', String(job.streamUrl || ''),
        '-t', String(durationSec),
        '-c', 'copy',
        fullOutputPath
      ];

      const proc = spawn(FFMPEG_BIN, args, {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe']
      });

      let stderrTail = '';
      if (proc.stderr) {
        proc.stderr.on('data', (chunk) => {
          stderrTail = (stderrTail + chunk.toString('utf8')).slice(-1024);
        });
      }

      const hardTimer = setTimeout(() => {
        stopDvrJobProcess(job.id);
      }, Math.max(5000, effectiveEnd - now + 3000));

      activeDvrProcesses.set(job.id, { proc, timer: hardTimer });
      job.status = 'recording';
      job.outputPath = fullOutputPath;
      job.startedAt = now;
      changed = true;

      proc.on('close', (code) => {
        const active = activeDvrProcesses.get(job.id);
        if (active && active.timer) clearTimeout(active.timer);
        activeDvrProcesses.delete(job.id);

        const latest = loadDvrSchedules();
        const target = latest.find((x) => x && x.id === job.id);
        if (target && target.status === 'recording') {
          target.status = code === 0 ? 'completed' : 'failed';
          target.finishedAt = Date.now();
          if (code !== 0 && stderrTail.trim()) {
            target.error = stderrTail.trim().split(/\r?\n/).slice(-3).join(' | ');
          }
          saveDvrSchedules(latest);
        }
      });

      proc.on('error', (err) => {
        const active = activeDvrProcesses.get(job.id);
        if (active && active.timer) clearTimeout(active.timer);
        activeDvrProcesses.delete(job.id);

        const latest = loadDvrSchedules();
        const target = latest.find((x) => x && x.id === job.id);
        if (target && target.status === 'recording') {
          target.status = 'failed';
          target.error = err.message;
          saveDvrSchedules(latest);
        }
      });
    }
  }

  if (changed) {
    saveDvrSchedules(schedules);
  }
}

async function handleDvrRoute(req, res, parsedUrl) {
  const sub = parsedUrl.pathname.toLowerCase();

  if (sub === '/dvr/default-dir' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, dir: getDefaultDvrDir() });
    return;
  }

  if (sub === '/dvr/browse-dir' && req.method === 'GET') {
    const rawDir = (parsedUrl.searchParams.get('dir') || '').trim();
    const targetDir = rawDir ? normalizeLocalOrUncPath(rawDir) : os.homedir();
    try {
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const folders = entries
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => ({ name: d.name, path: path.join(targetDir, d.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const parentDir = path.dirname(targetDir);
      sendJson(res, 200, {
        ok: true,
        dir: targetDir,
        parentDir: parentDir !== targetDir ? parentDir : '',
        folders
      });
    } catch (err) {
      sendJson(res, 400, { error: `Cannot browse directory: ${err.message}` });
    }
    return;
  }

  if (sub === '/dvr/schedules' && req.method === 'GET') {
    const schedules = loadDvrSchedules().sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    sendJson(res, 200, { ok: true, schedules });
    return;
  }

  if (sub === '/dvr/schedule' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const streamUrl = String(body.streamUrl || '').trim();
    const startTime = Number(body.startTime);
    const endTime = Number(body.endTime);
    const immediate = Boolean(body.immediate);
    if (!streamUrl) {
      sendJson(res, 400, { error: 'Missing streamUrl' });
      return;
    }
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
      sendJson(res, 400, { error: 'Invalid startTime or endTime' });
      return;
    }
    if (!immediate && endTime <= Date.now()) {
      sendJson(res, 400, { error: 'Cannot schedule a program that has already ended' });
      return;
    }

    const saveDir = normalizeLocalOrUncPath(String(body.saveDir || '').trim() || getDefaultDvrDir());
    const programTitle = String(body.programTitle || 'Scheduled Recording').trim();
    const channelName = String(body.channelName || 'Channel').trim();
    const fileName = sanitizeDvrFileName(body.fileName, `${channelName}_${programTitle}`);
    const durationMs = Math.max(30000, endTime - startTime);

    const job = {
      id: `dvr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      channelId: String(body.channelId || ''),
      channelName,
      streamUrl,
      programTitle,
      startTime,
      endTime,
      immediate,
      recordDeadline: immediate ? (Date.now() + durationMs) : endTime,
      saveDir,
      fileName,
      status: 'scheduled',
      createdAt: Date.now()
    };

    const schedules = loadDvrSchedules();
    const existingActive = schedules.find((s) =>
      s &&
      (s.status === 'scheduled' || s.status === 'recording') &&
      Math.abs(Number(s.startTime) - startTime) < 60000 &&
      (s.channelId === String(body.channelId || '') || s.channelName === channelName) &&
      s.programTitle === programTitle
    );
    if (existingActive) {
      sendJson(res, 200, { ok: true, schedule: existingActive, duplicate: true });
      return;
    }

    schedules.push(job);
    saveDvrSchedules(schedules);
    tickDvrScheduler();
    const updatedJob = loadDvrSchedules().find((s) => s && s.id === job.id) || job;
    sendJson(res, 201, { ok: true, schedule: updatedJob });
    return;
  }

  if (sub === '/dvr/cancel' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const id = String(body.id || '').trim();
    if (!id) {
      sendJson(res, 400, { error: 'Missing schedule id' });
      return;
    }
    stopDvrJobProcess(id);
    const schedules = loadDvrSchedules();
    const target = schedules.find((s) => s && s.id === id);
    if (!target) {
      sendJson(res, 404, { error: 'Schedule not found' });
      return;
    }
    target.status = 'cancelled';
    target.cancelledAt = Date.now();
    saveDvrSchedules(schedules);
    sendJson(res, 200, { ok: true, id, schedule: target });
    return;
  }

  sendJson(res, 404, { error: 'Unknown DVR endpoint' });
}

function parseServerDateHeaderSec(headers) {
  if (!headers || !headers.date) return null;
  const parsedMs = Date.parse(headers.date);
  return Number.isFinite(parsedMs) && parsedMs > 0 ? Math.floor(parsedMs / 1000) : null;
}

function probeServerClock(liveUrl, userAgent, timeoutMs = 2000) {
  return new Promise((resolve) => {
    if (!liveUrl || !/^https?:\/\//i.test(liveUrl)) {
      resolve(null);
      return;
    }
    let settled = false;
    let activeReq = null;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { if (activeReq) activeReq.destroy(); } catch (_) {}
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      const parsed = new URL(liveUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      activeReq = lib.request(
        parsed,
        {
          method: 'HEAD',
          headers: {
            'User-Agent': (userAgent && String(userAgent).trim()) || 'VLC/3.0.20 LibVLC/3.0.20',
            'Accept': '*/*'
          },
          timeout: timeoutMs,
          rejectUnauthorized: false
        },
        (upstreamRes) => {
          const sec = parseServerDateHeaderSec(upstreamRes.headers);
          try { upstreamRes.destroy(); } catch (_) {}
          finish(sec);
        }
      );
      activeReq.on('timeout', () => finish(null));
      activeReq.on('error', () => finish(null));
      activeReq.end();
    } catch (_) {
      finish(null);
    }
  });
}

function probeCatchupCandidate(targetUrl, userAgent, timeoutMs = 4000, maxHops = 5, abortSignal = null) {
  return new Promise((resolve) => {
    let settled = false;
    let activeReq = null;
    let activeRes = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (abortSignal) {
        abortSignal.removeEventListener('abort', onAbort);
      }
      try { if (activeRes) activeRes.destroy(); } catch (_) {}
      try { if (activeReq) activeReq.destroy(); } catch (_) {}
      resolve(Object.assign({ candidate: targetUrl }, result));
    };

    const onAbort = () => finish({ ok: false, reason: 'Aborted' });
    if (abortSignal) {
      if (abortSignal.aborted) {
        onAbort();
        return;
      }
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }

    const timer = setTimeout(() => {
      finish({ ok: false, reason: `Timeout (${Math.round(timeoutMs / 1000)}s)` });
    }, timeoutMs);

    let currentUrl = targetUrl;
    let hops = 0;

    const doProbe = () => {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch (_) {
        finish({ ok: false, reason: 'Invalid URL' });
        return;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        finish({ ok: false, reason: 'Unsupported protocol' });
        return;
      }

      const lib = parsed.protocol === 'https:' ? https : http;
      const headers = {
        'User-Agent': (userAgent && String(userAgent).trim()) || 'VLC/3.0.20 LibVLC/3.0.20',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Range': 'bytes=0-4095'
      };

      activeReq = lib.request(
        parsed,
        { method: 'GET', headers, timeout: timeoutMs, rejectUnauthorized: false },
        (upstreamRes) => {
          activeRes = upstreamRes;
          const status = upstreamRes.statusCode || 502;
          if ([301, 302, 303, 307, 308].includes(status) && upstreamRes.headers.location && hops < maxHops) {
            hops += 1;
            try {
              currentUrl = new URL(upstreamRes.headers.location, parsed).toString();
            } catch (_) {
              finish({ ok: false, reason: 'Invalid redirect URL' });
              return;
            }
            upstreamRes.resume();
            doProbe();
            return;
          }

          const contentType = String(upstreamRes.headers['content-type'] || 'application/octet-stream');
          const serverNowSec = parseServerDateHeaderSec(upstreamRes.headers);
          if (status !== 200 && status !== 206) {
            finish({ ok: false, reason: `HTTP ${status}`, serverNowSec });
            return;
          }

          const chunks = [];
          let totalBytes = 0;
          upstreamRes.on('data', (chunk) => {
            chunks.push(chunk);
            totalBytes += chunk.length;
            const headText = Buffer.concat(chunks).slice(0, 256).toString('utf8').trimStart();
            if (/text\/html/i.test(contentType) || /^<!doctype\s+html|^<html/i.test(headText)) {
              finish({ ok: false, reason: `HTTP ${status} (HTML response)`, serverNowSec });
              return;
            }
            if (totalBytes > 0) {
              finish({
                ok: true,
                resolvedUrl: parsed.toString(),
                status,
                contentType,
                serverNowSec
              });
            }
          });

          upstreamRes.on('end', () => {
            if (totalBytes > 0) {
              finish({
                ok: true,
                resolvedUrl: parsed.toString(),
                status,
                contentType,
                serverNowSec
              });
            } else {
              finish({ ok: false, reason: `HTTP ${status} (empty body)`, serverNowSec });
            }
          });

          upstreamRes.on('error', (err) => {
            finish({ ok: false, reason: err.message || 'Upstream read error' });
          });
        }
      );

      activeReq.on('timeout', () => {
        finish({ ok: false, reason: 'Timeout (3s)' });
      });
      activeReq.on('error', (err) => {
        finish({ ok: false, reason: err.message || 'Connection error' });
      });
      activeReq.end();
    };

    doProbe();
  });
}

async function handleCatchupResolve(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const body = await readJsonBody(req);
  const rawList = Array.isArray(body.candidates) ? body.candidates : [];
  const liveUrl = typeof body.liveUrl === 'string' ? body.liveUrl.trim() : '';
  const userAgent = typeof body.userAgent === 'string' ? body.userAgent.trim() : '';
  const candidates = [];
  for (const item of rawList) {
    const s = String(item || '').trim();
    if (/^https?:\/\//i.test(s) && !candidates.includes(s)) {
      candidates.push(s);
    }
  }
  if (!candidates.length) {
    sendJson(res, 400, { ok: false, error: 'No valid HTTP/HTTPS Catch-up candidates provided' });
    return;
  }

  const clockPromise = probeServerClock(liveUrl, userAgent, 2000);
  const ac = new AbortController();

  try {
    const winner = await Promise.any(
      candidates.map((candidate) =>
        probeCatchupCandidate(candidate, userAgent, 4000, 5, ac.signal).then((r) => {
          if (r && r.ok) return r;
          throw r;
        })
      )
    );
    ac.abort();
    const clockNowSec = await clockPromise;
    sendJson(res, 200, {
      ok: true,
      resolvedUrl: winner.resolvedUrl,
      status: winner.status,
      contentType: winner.contentType,
      serverNowSec: winner.serverNowSec || clockNowSec || null
    });
  } catch (aggErr) {
    const clockNowSec = await clockPromise;
    const errors = Array.isArray(aggErr && aggErr.errors) ? aggErr.errors : [];
    const summary = errors
      .slice(0, 4)
      .map((r) => `${(r && r.candidate) || 'candidate'} -> ${(r && r.reason) || 'failed'}`)
      .join(' | ') || 'All Catch-up candidates failed';
    sendJson(res, 200, {
      ok: false,
      error: summary,
      serverNowSec: clockNowSec || null
    });
  }
}

prewarmStaticCache();
recoverDvrSchedulesOnStartup();
tickDvrScheduler();
const dvrSchedulerTimer = setInterval(tickDvrScheduler, 5000);
if (dvrSchedulerTimer.unref) dvrSchedulerTimer.unref();

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    addCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  } catch (_) {
    sendJson(res, 400, { error: 'Malformed request URL' });
    return;
  }

  const pathname = parsedUrl.pathname;

  if (pathname === '/health') {
    sendJson(res, 200, { ok: true, port: PORT, runtime: 'node' });
    return;
  }

  if (pathname === '/shutdown') {
    stopActiveStream();
    stopAllDvrProcesses();
    stopTelegramBridge();
    for (const upstreamReq of activeProxyRequests.values()) {
      try { upstreamReq.destroy(); } catch (_) {}
    }
    activeProxyRequests.clear();
    sendJson(res, 200, { ok: true });
    setTimeout(() => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 250);
    }, 30);
    return;
  }

  if (pathname === '/proxy/abort') {
    stopActiveStream();
    for (const upstreamReq of activeProxyRequests.values()) {
      try { upstreamReq.destroy(); } catch (_) {}
    }
    activeProxyRequests.clear();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/tg' || pathname.toLowerCase().startsWith('/tg/')) {
    handleTelegramProxy(req, res, parsedUrl);
    return;
  }

  if (pathname.toLowerCase().startsWith('/netshare/')) {
    handleNetShare(req, res, parsedUrl).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
      else if (!res.writableEnded) res.end();
    });
    return;
  }

  if (pathname.toLowerCase().startsWith('/dvr/')) {
    handleDvrRoute(req, res, parsedUrl).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
      else if (!res.writableEnded) res.end();
    });
    return;
  }

  if (pathname.toLowerCase() === '/catchup/resolve') {
    handleCatchupResolve(req, res).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: err.message });
      else if (!res.writableEnded) res.end();
    });
    return;
  }

function fetchEpgBuffer(targetUrl, maxHops = 6, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    let currentUrl = targetUrl;
    let hops = 0;

    const doRequest = () => {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch (_) {
        reject({ status: 400, message: 'Invalid EPG URL' });
        return;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        reject({ status: 400, message: 'Only HTTP/HTTPS EPG URLs are supported' });
        return;
      }

      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;
      const agent = isHttps ? proxyHttpsAgent : proxyHttpAgent;
      const headers = {
        'User-Agent': 'IPTVSmartersPlayer',
        'Accept': 'application/xml, text/xml, application/gzip, */*',
        'Accept-Encoding': 'gzip, deflate, identity'
      };

      const req = lib.request(
        parsed,
        { method: 'GET', headers, timeout: timeoutMs, agent, rejectUnauthorized: false },
        (upstreamRes) => {
          const code = upstreamRes.statusCode || 502;
          if ([301, 302, 303, 307, 308].includes(code) && upstreamRes.headers.location && hops < maxHops) {
            hops += 1;
            const nextUrl = new URL(upstreamRes.headers.location, parsed).toString();
            upstreamRes.resume();
            currentUrl = nextUrl;
            doRequest();
            return;
          }
          if (code < 200 || code >= 300) {
            upstreamRes.resume();
            reject({ status: code, message: `Upstream HTTP ${code}` });
            return;
          }
          const chunks = [];
          let totalBytes = 0;
          upstreamRes.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > 128 * 1024 * 1024) {
              upstreamRes.destroy(new Error('EPG payload exceeds 128MB limit'));
              return;
            }
            chunks.push(chunk);
          });
          upstreamRes.on('end', () => {
            resolve({
              buffer: Buffer.concat(chunks),
              contentEncoding: String(upstreamRes.headers['content-encoding'] || '').toLowerCase()
            });
          });
          upstreamRes.on('error', (err) => {
            reject({ status: 502, message: err.message || 'Upstream EPG read failed' });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error('EPG fetch timeout (45s)'));
      });
      req.on('error', (err) => {
        reject({ status: 502, message: err.message || 'EPG request failed' });
      });
      req.end();
    };

    doRequest();
  });
}

async function handleEpgFetch(req, res, parsedUrl) {
  const targetUrl = extractProxyTargetUrl(req.url, parsedUrl);
  if (!targetUrl) {
    sendJson(res, 400, { ok: false, status: 400, error: 'Missing url query parameter' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (_) {
    sendJson(res, 400, { ok: false, status: 400, error: 'Invalid EPG URL' });
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    sendJson(res, 400, { ok: false, status: 400, error: 'Only HTTP/HTTPS URLs are supported' });
    return;
  }

  try {
    const { buffer, contentEncoding } = await fetchEpgBuffer(targetUrl, 6, 45000);
    let outBuf = buffer;
    const isGzip = contentEncoding.includes('gzip') || (outBuf.length >= 2 && outBuf[0] === 0x1f && outBuf[1] === 0x8b);
    const isDeflate = !isGzip && contentEncoding.includes('deflate');
    if (isGzip) {
      outBuf = zlib.gunzipSync(outBuf);
    } else if (isDeflate) {
      outBuf = zlib.inflateSync(outBuf);
    }

    addCorsHeaders(res);
    if (res.socket) {
      try { res.socket.setNoDelay(true); } catch (_) {}
    }
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': String(outBuf.length),
      'Cache-Control': 'no-store'
    });
    res.end(outBuf);
  } catch (err) {
    const status = (err && Number.isInteger(err.status) && err.status >= 400) ? err.status : 502;
    const message = (err && (err.message || err.error)) || 'EPG fetch failed';
    sendJson(res, status, { ok: false, status, error: message });
  }
}

  if (pathname.toLowerCase() === '/epg/fetch') {
    handleEpgFetch(req, res, parsedUrl);
    return;
  }

  if (pathname === '/proxy') {
    handleProxy(req, res, parsedUrl);
    return;
  }

  handleStatic(req, res, parsedUrl);
});

server.on('error', (err) => {
  const msg = `[${new Date().toISOString()}] Failed to bind http://${HOST}:${PORT}/: ${err.stack || err.message}\n`;
  try {
    fs.writeFileSync(path.join(ROOT_DIR, 'server_error.log'), msg, 'utf8');
  } catch (_) {}
  console.error(msg);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`IPTV Node Server listening on http://${HOST}:${PORT}/`);
});
