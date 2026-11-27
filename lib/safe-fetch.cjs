'use strict';
const dns = require('node:dns').promises;
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const zlib = require('node:zlib');

function privateAddress(value) {
  const host = String(value || '').toLowerCase().replace(/^\[|\]$/g, '');
  const family = net.isIP(host);
  if (family === 4) {
    const [a, b, c] = host.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168 || b === 88 && c === 99)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
      (a === 203 && b === 0 && c === 113);
  }
  // Limit IPv6 to global unicast, excluding transition and documentation ranges.
  if (family === 6) {
    const parts=host.split(':').map(part=>parseInt(part||'0',16));
    return parts[0]<0x2000 || parts[0]>=0x4000 || parts[0]===0x2002 || parts[0]===0x3fff ||
      (parts[0]===0x2001 && (parts[1]<0x200 || parts[1]===0xdb8));
  }
  return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.includes('%');
}

async function resolveTarget(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.toString().length > 2048)
    throw new Error('URL externa no válida.');
  if (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80')) throw new Error('Puerto externo no permitido.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (privateAddress(hostname)) throw new Error('No se puede acceder a una dirección privada.');
  const addresses = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] :
    await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(record => privateAddress(record.address))) throw new Error('Destino de red no permitido.');
  return { url, addresses };
}

function requestTarget(target, options) {
  const { url, addresses } = target;
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    // Pin the validated address. The connection must not perform a second DNS lookup.
    const lookup = (_hostname, lookupOptions, callback) => {
      const record = addresses[0];
      if (lookupOptions?.all) callback(null, [record]);
      else callback(null, record.address, record.family);
    };
    const request = transport.request(url, { method: 'GET', headers: options.headers, lookup,
      agent: false, signal: options.signal, timeout: 8000 }, incoming => {
      const status = incoming.statusCode || 502;
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      if ([301, 302, 303, 307, 308].includes(status)) { incoming.destroy(); resolve(new Response(null, { status, headers })); return; }
      const encoding = String(incoming.headers['content-encoding'] || '').toLowerCase();
      let stream = incoming;
      if (encoding === 'gzip' || encoding === 'deflate') stream = incoming.pipe(zlib.createUnzip());
      else if (encoding === 'br') stream = incoming.pipe(zlib.createBrotliDecompress());
      else if (encoding && encoding !== 'identity') { incoming.destroy(); reject(new Error('Codificación no admitida.')); return; }
      const chunks = []; let bytes = 0;
      stream.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 2200000) { stream.destroy(); request.destroy(); reject(new Error('La respuesta externa es demasiado grande.')); return; }
        chunks.push(chunk);
      });
      incoming.on('error', reject); stream.on('error', reject);
      stream.on('end', () => { headers.delete('content-encoding'); headers.delete('content-length'); resolve(new Response([204,205,304].includes(status)?null:Buffer.concat(chunks), { status, headers })); });
    });
    request.on('timeout', () => request.destroy(new Error('El servidor externo tardó demasiado.')));
    request.on('error', reject);
    request.end();
  });
}

async function safeFetch(value, options = {}) {
  let target = await resolveTarget(value);
  for (let hop = 0; hop <= 5; hop++) {
    const response = await requestTarget(target, options);
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url: target.url };
    const location = response.headers.get('location');
    if (!location || hop === 5) throw new Error('Redirección externa no permitida.');
    target = await resolveTarget(new URL(location, target.url));
  }
}
module.exports = { safeFetch, resolveTarget, privateAddress };
