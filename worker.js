'use strict';

const utf8Decoder = new TextDecoder('utf-8');

function decodeUtf8(input) {
  if (!input) return '';
  let str = '';
  if (typeof input === 'string') {
    str = input;
  } else if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    str = utf8Decoder.decode(input);
  } else {
    str = String(input);
  }
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
}

function normalizeKey(str) {
  return (str || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function decodeXmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => {
      const cp = Number(num);
      return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : '';
    });
}

function extractM3uHeaderEpgUrls(line) {
  const urls = [];
  const attrRegex = /(x-tvg-url|url-tvg|tvg-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/gi;
  let m;
  while ((m = attrRegex.exec(line)) !== null) {
    const rawVal = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] || ''));
    const parts = rawVal.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (/^https?:\/\//i.test(part) && !urls.includes(part)) {
        urls.push(part);
      }
    }
  }
  return urls;
}

function extractAttrMap(headerText) {
  const attrs = {};
  const attrRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = attrRegex.exec(headerText)) !== null) {
    attrs[match[1].toLowerCase()] = (match[2] !== undefined ? match[2] : (match[3] || '')).trim();
  }
  return attrs;
}

function parseM3u(rawText, sourceId = '') {
  const text = decodeUtf8(rawText);
  const lines = text.split(/\r?\n/);
  const channels = [];
  const epgUrls = [];
  let pending = null;
  let pendingGroup = '';
  let headerCatchupType = '';
  let headerCatchupDays = 0;
  let headerCatchupSource = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U') || (i < 10 && /(?:x-tvg-url|url-tvg|tvg-url)\s*=/i.test(line))) {
      const found = extractM3uHeaderEpgUrls(line);
      for (const u of found) {
        if (!epgUrls.includes(u)) epgUrls.push(u);
      }
      if (line.startsWith('#EXTM3U')) {
        const hAttrs = extractAttrMap(line);
        headerCatchupType = (hAttrs['catchup'] || hAttrs['catchup-type'] || '').toLowerCase();
        headerCatchupDays = Number(hAttrs['catchup-days'] || hAttrs['tvg-rec'] || hAttrs['timeshift'] || 0) || 0;
        headerCatchupSource = hAttrs['catchup-source'] || '';
        continue;
      }
    }

    if (line.startsWith('#EXTINF:')) {
      let quoteChar = null;
      let lastComma = -1;
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (quoteChar) {
          if (ch === quoteChar && line[c - 1] !== '\\') quoteChar = null;
        } else if (ch === '"' || ch === '\'') {
          quoteChar = ch;
        } else if (ch === ',') {
          lastComma = c;
        }
      }

      const headerPart = lastComma >= 0 ? line.slice(0, lastComma) : line;
      const attrs = extractAttrMap(headerPart);

      let rawTitle = lastComma >= 0 ? line.slice(lastComma + 1).trim() : '';
      rawTitle = rawTitle
        .replace(/\b(?:tvg-id|tvg-name|tvg-logo|tvg-chno|tvg-shift|tvg-rec|group-title|http-user-agent|http-referrer|catchup|catchup-type|catchup-days|catchup-source|timeshift)=(?:"[^"]*"|'[^']*'|[^\s,]+)/gi, '')
        .trim();
      const name = rawTitle || attrs['tvg-name'] || 'Channel ' + (channels.length + 1);
      const catchupType = (attrs['catchup'] || attrs['catchup-type'] || headerCatchupType || '').toLowerCase();
      const rawDays = Number(attrs['catchup-days'] || attrs['tvg-rec'] || attrs['timeshift'] || headerCatchupDays || 0);
      const catchupSource = attrs['catchup-source'] || headerCatchupSource || '';
      const catchupDays = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : ((catchupType || catchupSource) ? 7 : 0);

      pending = {
        name,
        tvgId: attrs['tvg-id'] || '',
        tvgName: attrs['tvg-name'] || name,
        logo: attrs['tvg-logo'] || '',
        group: attrs['group-title'] || pendingGroup || 'Uncategorized',
        catchupType,
        catchupDays,
        catchupSource
      };
    } else if (line.startsWith('#EXTGRP:')) {
      const grp = line.slice(8).trim();
      if (pending) pending.group = grp || pending.group;
      else pendingGroup = grp;
    } else if (!line.startsWith('#')) {
      if (/^https?:\/\//i.test(line)) {
        const num = channels.length + 1;
        const info = pending || {
          name: 'Channel ' + num,
          tvgId: '',
          tvgName: 'Channel ' + num,
          logo: '',
          group: pendingGroup || 'Uncategorized',
          catchupType: headerCatchupType,
          catchupDays: headerCatchupDays || ((headerCatchupType || headerCatchupSource) ? 7 : 0),
          catchupSource: headerCatchupSource
        };
        channels.push({
          id: (sourceId ? sourceId + '::' : '') + (info.tvgId ? info.tvgId + '::' + num : 'ch_' + num + '_' + normalizeKey(info.name)),
          sourceId: sourceId || '',
          number: num,
          name: info.name,
          tvgId: info.tvgId,
          tvgName: info.tvgName,
          logo: info.logo,
          group: info.group || 'Uncategorized',
          url: line,
          contentType: 'live',
          catchupType: info.catchupType || '',
          catchupDays: info.catchupDays || 0,
          catchupSource: info.catchupSource || ''
        });
        if (channels.length === 1) {
          const xtMatch = line.match(/^(https?:\/\/[^/]+)\/(?:live\/)?([^/]+)\/([^/]+)\/\d+(?:\.(?:ts|m3u8))?(?:\?.*)?$/i);
          if (xtMatch) {
            const derivedXmltv = `${xtMatch[1]}/xmltv.php?username=${xtMatch[2]}&password=${xtMatch[3]}`;
            if (!epgUrls.includes(derivedXmltv)) {
              epgUrls.push(derivedXmltv);
            }
          }
        }
      }
      pending = null;
      pendingGroup = '';
    }
  }

  return {
    channels,
    epgUrl: epgUrls[0] || '',
    epgUrls
  };
}

function parseXmltvTimestamp(raw) {
  if (!raw) return 0;
  const cleaned = raw.trim();
  const m = cleaned.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*(Z|[+-]\d{2}:?\d{2}))?/i);
  if (!m) return 0;

  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const min = Number(m[5]);
  const sec = Number(m[6]);

  if (m[7]) {
    const tz = m[7].toUpperCase();
    if (tz === 'Z') {
      return Date.UTC(year, month, day, hour, min, sec);
    }
    const sign = tz[0] === '-' ? -1 : 1;
    const digits = tz.slice(1).replace(':', '');
    const offH = Number(digits.slice(0, 2));
    const offM = Number(digits.slice(2, 4));
    const offsetMinutes = sign * (offH * 60 + offM);
    return Date.UTC(year, month, day, hour, min, sec) - offsetMinutes * 60000;
  }

  return new Date(year, month, day, hour, min, sec).getTime();
}

function getAttr(attrText, attrName) {
  const re = new RegExp(attrName + '\\s*=\\s*["\']([^"\']*)["\']', 'i');
  const m = re.exec(attrText);
  return m ? decodeXmlEntities(m[1].trim()) : '';
}

function extractTagContent(raw) {
  return decodeXmlEntities(
    raw
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .trim()
  );
}

function getTagText(body, tagName) {
  const re = new RegExp('<' + tagName + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tagName + '>', 'i');
  const m = re.exec(body);
  return m ? extractTagContent(m[1]) : '';
}

function getAllTagTexts(body, tagName) {
  const re = new RegExp('<' + tagName + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tagName + '>', 'gi');
  const results = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    const val = extractTagContent(m[1]);
    if (val) results.push(val);
  }
  return results;
}

function parseXmltv(rawXmlText) {
  const xmlText = decodeUtf8(rawXmlText)
    .replace(/^\uFEFF/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(\/?)[a-zA-Z0-9_-]+:([a-zA-Z0-9_-]+)/g, '<$1$2');
  if (!xmlText || (xmlText.indexOf('<tv') === -1 && xmlText.indexOf('<programme') === -1)) {
    throw new Error('Invalid XMLTV document');
  }

  const epgMap = Object.create(null);
  const channelAliases = Object.create(null);
  const channelNames = Object.create(null);

  const chRegex = /<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi;
  let chMatch;
  while ((chMatch = chRegex.exec(xmlText)) !== null) {
    const id = getAttr(chMatch[1], 'id');
    if (!id) continue;
    const exactId = id.trim();
    const idKey = exactId.toLowerCase();
    if (exactId && exactId !== idKey) channelAliases[exactId] = idKey;
    channelAliases[idKey] = idKey;
    const normId = normalizeKey(id);
    if (normId) channelAliases[normId] = idKey;

    const dispNames = getAllTagTexts(chMatch[2], 'display-name');
    if (dispNames.length) {
      channelNames[idKey] = dispNames;
    }
    for (let i = 0; i < dispNames.length; i++) {
      const dn = dispNames[i];
      if (dn && !channelAliases[dn]) channelAliases[dn] = idKey;
      const dnLower = dn.toLowerCase();
      if (dnLower && !channelAliases[dnLower]) channelAliases[dnLower] = idKey;
      const normDn = normalizeKey(dn);
      if (normDn && !channelAliases[normDn]) channelAliases[normDn] = idKey;
    }
  }

  const minRetentionMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const progRegex = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
  let progMatch;
  let progCount = 0;

  while ((progMatch = progRegex.exec(xmlText)) !== null) {
    const attrs = progMatch[1];
    const body = progMatch[2];
    const chRaw = getAttr(attrs, 'channel');
    if (!chRaw) continue;

    const start = parseXmltvTimestamp(getAttr(attrs, 'start'));
    let stop = parseXmltvTimestamp(getAttr(attrs, 'stop'));
    if (!start) continue;
    if (!stop) stop = start + 30 * 60 * 1000;
    if (stop <= start) continue;
    // Retain 7 days of past archive programs and all future scheduled programs
    if (stop < minRetentionMs) continue;

    const title = getTagText(body, 'title') || 'Untitled Program';
    const desc = getTagText(body, 'desc');

    const exactCh = chRaw.trim();
    const key = exactCh.toLowerCase();
    if (!epgMap[key]) epgMap[key] = [];
    epgMap[key].push({ start, stop, title, desc });
    if (exactCh && exactCh !== key && !channelAliases[exactCh]) {
      channelAliases[exactCh] = key;
    }
    const normCh = normalizeKey(chRaw);
    if (normCh && !channelAliases[normCh]) {
      channelAliases[normCh] = key;
    }
    progCount++;
  }

  const keys = Object.keys(epgMap);
  for (let i = 0; i < keys.length; i++) {
    epgMap[keys[i]].sort((a, b) => a.start - b.start);
  }

  const aliasKeys = Object.keys(channelAliases);
  for (let i = 0; i < aliasKeys.length; i++) {
    const alias = aliasKeys[i];
    const target = channelAliases[alias];
    if (!epgMap[alias] && epgMap[target]) {
      epgMap[alias] = epgMap[target];
    }
  }

  return {
    epgMap,
    channelNames,
    channelDisplayNames: channelNames,
    channelCount: keys.length,
    programCount: progCount
  };
}

function mapXtreamPayload(payload) {
  const {
    sourceId = '',
    baseUrl = '',
    user = '',
    pass = '',
    fmt = 'm3u8',
    catJson = [],
    streamJson = [],
    vodCatJson = [],
    vodJson = [],
    serCatJson = [],
    serJson = []
  } = payload || {};

  const mapCats = (arr) => {
    const m = Object.create(null);
    if (Array.isArray(arr)) {
      for (let i = 0; i < arr.length; i++) {
        m[String(arr[i].category_id)] = arr[i].category_name;
      }
    }
    return m;
  };

  const catMap = mapCats(catJson);
  const vodCatMap = mapCats(vodCatJson);
  const serCatMap = mapCats(serCatJson);
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(pass);

  const channels = Array.isArray(streamJson)
    ? streamJson.map((s, idx) => ({
        id: (sourceId ? `${sourceId}::` : '') + (s.epg_channel_id ? `${s.epg_channel_id}::${s.stream_id}` : `xt_${s.stream_id}`),
        sourceId: sourceId || '',
        streamId: String(s.stream_id),
        number: idx + 1,
        name: s.name || `Channel ${idx + 1}`,
        tvgId: s.epg_channel_id || '',
        epg_channel_id: s.epg_channel_id || '',
        tvgName: s.name || '',
        logo: s.stream_icon || '',
        group: catMap[String(s.category_id)] || 'Live TV',
        url: `${baseUrl}/live/${encUser}/${encPass}/${s.stream_id}.${fmt}`,
        contentType: 'live',
        catchupDays: Number(s.tv_archive_duration || (s.tv_archive ? 7 : 0))
      }))
    : [];

  const vodItems = Array.isArray(vodJson)
    ? vodJson.map((v, idx) => {
        const ext = v.container_extension || 'mp4';
        return {
          id: `vod_${v.stream_id}`,
          number: idx + 1,
          name: v.name || `Movie ${idx + 1}`,
          logo: v.stream_icon || '',
          group: vodCatMap[String(v.category_id)] || 'Movies',
          url: `${baseUrl}/movie/${encUser}/${encPass}/${v.stream_id}.${ext}`,
          contentType: 'vod',
          rating: v.rating || ''
        };
      })
    : [];

  const seriesItems = Array.isArray(serJson)
    ? serJson.map((sr, idx) => ({
        id: `series_${sr.series_id}`,
        seriesId: String(sr.series_id),
        number: idx + 1,
        name: sr.name || `Series ${idx + 1}`,
        logo: sr.cover || '',
        group: serCatMap[String(sr.category_id)] || 'Series',
        plot: sr.plot || '',
        contentType: 'series'
      }))
    : [];

  return { channels, vodItems, seriesItems };
}

self.onmessage = (event) => {
  const { id, type, text, xmlText, reminders, nowMs } = event.data || {};
  try {
    if (type === 'parseM3u') {
      const parsed = parseM3u(text || '', event.data.sourceId || '');
      self.postMessage({
        id,
        ok: true,
        channels: parsed.channels,
        epgUrl: parsed.epgUrl,
        epgUrls: parsed.epgUrls
      });
    } else if (type === 'parseXmltv') {
      const result = parseXmltv(xmlText || '');
      self.postMessage({ id, ok: true, ...result });
    } else if (type === 'mapXtreamPayload') {
      const result = mapXtreamPayload(event.data);
      self.postMessage({ id, ok: true, ...result });
    } else if (type === 'partitionReminders') {
      const ts = Number(nowMs) || Date.now();
      const due = [];
      const upcoming = [];
      const list = Array.isArray(reminders) ? reminders : [];
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        if (!r || !r.start) continue;
        if (r.start <= ts && r.stop > ts) {
          due.push(r);
        } else if (r.start > ts) {
          upcoming.push(r);
        }
      }
      upcoming.sort((a, b) => a.start - b.start);
      self.postMessage({ id, ok: true, due, upcoming });
    } else {
      self.postMessage({ id, ok: false, error: 'Unknown worker task type' });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) });
  }
};
