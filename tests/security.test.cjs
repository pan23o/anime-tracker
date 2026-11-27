const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const { avatarUrl, renderAvatar } = require('../onebase-security.js');
const { switchScope } = require('../onebase-account-scope.js');

test('untrusted avatar content never becomes HTML or a remote request', () => {
  for (const value of ['x" onerror="alert(1)', 'javascript:alert(1)', 'https://example.com/tracker', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PHNjcmlwdD4=']) assert.equal(avatarUrl(value), '');
  const png = 'data:image/png;base64,aGVsbG8=';
  assert.equal(avatarUrl(png), png);
  const el = { replaceChildren() {}, ownerDocument: { createElement() { return { addEventListener() {} }; } }, appendChild(child) { this.child = child; } };
  renderAvatar(el, 'x" onerror="alert(1)', '<script>');
  assert.equal(el.textContent, '<script>');
  assert.equal(el.child, undefined);
  renderAvatar(el, png, 'OB');
  assert.equal(el.child.src, png);
});

test('guest and two signed-in accounts retain separate local libraries and emails', () => {
  const map = new Map();
  const storage = { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) };
  const alice = { anime: [{ anime: 'Alice private' }], screen: [{ id: 1 }], profile: { email: 'alice@example.test' }, extra: {} };
  const bob = switchScope(storage, 'account:alice', 'account:bob', alice);
  assert.deepEqual(bob, { anime: [], screen: [], profile: {}, extra: {} });
  const guest = switchScope(storage, 'account:bob', 'guest', { anime: [{ anime: 'Bob private' }], screen: [], profile: { email: 'bob@example.test' } });
  assert.deepEqual(guest, { anime: [], screen: [], profile: {}, extra: {} });
  const restoredAlice = switchScope(storage, 'guest', 'account:alice', guest);
  assert.deepEqual(restoredAlice, alice);
  assert.equal(switchScope(storage, 'account:alice', 'account:alice', alice), null);
});

function accountFixture(download, rowRead) {
  const values = new Map([
    ['anime_tracker_persistence_v2', JSON.stringify({ owner: 'account:alice', deviceId: 'test-device' })],
    ['anime_tracker_profile_v1', JSON.stringify({ name: 'Alice', email: 'alice@example.test' })],
    ['onebase_screen_library_v1', JSON.stringify([{ id: 1, type: 'movie', title: 'Alice movie' }])]
  ]);
  let writes = 0;
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const client = {
    auth: { onAuthStateChange() {} },
    storage: { from: () => ({ download, upload: async () => { writes++; return {}; } }) },
    from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: rowRead,
      upsert: async () => { writes++; return {}; } })
  };
  const window = { supabase: { createClient: () => client }, OneBaseAccountScope: { switchScope },
    OneBaseSecurity: { avatarUrl, renderAvatar }, addEventListener() {}, dispatchEvent() {} };
  const context = { window, localStorage: storage, data: [{ anime: 'Alice private' }], profile: {},
    document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } },
    crypto: { randomUUID: () => 'test-device' }, CustomEvent: class {}, Event: class {},
    console, Date, Number, Math, String, Array, JSON, setTimeout, clearTimeout, Blob };
  Object.defineProperty(window, '__ONEBASE_DATA__', { get: () => context.data });
  let source = fs.readFileSync('profile-enhancer.js', 'utf8');
  const end = source.lastIndexOf('})();');
  source = source.slice(0, end) + 'window.testAccount={activateAccountScope,restoreScreenLibrary,saveCloudTable,saveLibraryNow,setUser(value,transition=false){user=value;accountTransition=transition}};\n' + source.slice(end);
  vm.createContext(context); vm.runInContext(source, context);
  return { context, api: window.testAccount, writes: () => writes };
}

test('a delayed account restore cannot overwrite the next account', async () => {
  let resolveDownload;
  const fixture = accountFixture(() => new Promise(resolve => { resolveDownload = resolve; }), async () => ({ data: null }));
  fixture.api.setUser({ id: 'alice' });
  const pending = fixture.api.restoreScreenLibrary();
  fixture.api.setUser({ id: 'bob' }, true);
  fixture.api.activateAccountScope({ id: 'bob' });
  resolveDownload({ data: { text: async () => JSON.stringify([{ id: 10, type: 'movie', title: 'Alice remote' }]) } });
  assert.equal(await pending, false);
  assert.equal(fixture.context.data.length, 0);
  assert.equal(fixture.writes(), 0);
  assert.equal(JSON.parse(fixture.context.localStorage.getItem('anime_tracker_profile_v1')).email, '');
});

test('an in-flight cloud read cannot upload the previous library into the next account', async () => {
  let resolveRow;
  const fixture = accountFixture(async () => ({ error: new Error('not found') }), () => new Promise(resolve => { resolveRow = resolve; }));
  fixture.api.setUser({ id: 'alice' });
  const pending = fixture.api.saveCloudTable([{ anime: 'Alice private' }]);
  fixture.api.setUser({ id: 'bob' }, true);
  fixture.api.activateAccountScope({ id: 'bob' });
  resolveRow({ data: { state: {} } });
  assert.equal(await pending, false);
  assert.equal(fixture.writes(), 0);
});

test('the complete save pipeline stops when the active account changes', async () => {
  let resolveRow;
  const fixture = accountFixture(async () => ({ error: new Error('not found') }), () => new Promise(resolve => { resolveRow = resolve; }));
  fixture.api.setUser({ id: 'alice' });
  const pending = fixture.api.saveLibraryNow();
  fixture.api.setUser({ id: 'bob' }, true);
  fixture.api.activateAccountScope({ id: 'bob' });
  fixture.api.setUser({ id: 'bob' }, false);
  resolveRow({ data: { state: {} } });
  assert.equal(await pending, false);
  assert.equal(fixture.writes(), 0);
});

function networkFixture({ redirect, oversized = false } = {}) {
  const connections = []; let lookups = 0;
  const transport = { request(url, options, callback) {
    const request = new EventEmitter(); request.destroy = error => { if (error) request.emit('error', error); };
    request.end = () => queueMicrotask(() => {
      options.lookup(url.hostname, {}, (_error, address) => connections.push(address));
      const incoming = Readable.from([oversized ? Buffer.alloc(2200001) : Buffer.from('<html>ok</html>')]);
      incoming.statusCode = redirect ? 302 : 200;
      incoming.headers = redirect ? { location: redirect } : { 'content-type': 'text/html' };
      callback(incoming);
    });
    return request;
  } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('lib/safe-fetch.cjs', 'utf8'), {
    module, Buffer, Headers, Response, URL, require(name) {
      if (name === 'node:dns') return { promises: { lookup: async () => { lookups++; return [{ address: '93.184.216.34', family: 4 }]; } } };
      if (name === 'node:http' || name === 'node:https') return transport;
      return require(name);
    }
  });
  return { ...module.exports, connections, lookups: () => lookups };
}

test('external fetch rejects private, encoded, mapped and non-HTTP targets', async () => {
  const fixture = networkFixture();
  for (const url of ['http://127.0.0.1', 'http://2130706433', 'http://10.0.0.1', 'http://169.254.169.254', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'http://[2001:0000::1]', 'https://example.test:8080', 'https://user:pass@example.test', 'file:///etc/passwd']) await assert.rejects(fixture.resolveTarget(url));
  assert.equal(fixture.connections.length, 0);
});

test('connection uses the already validated DNS address', async () => {
  const fixture = networkFixture();
  const { response } = await fixture.safeFetch('https://example.test');
  assert.equal(await response.text(), '<html>ok</html>');
  assert.equal(fixture.lookups(), 1);
  assert.equal(fixture.connections[0], '93.184.216.34');
});

test('redirect to an internal host and oversized responses are refused', async () => {
  const fixture = networkFixture({ redirect: 'http://169.254.169.254/' });
  await assert.rejects(fixture.safeFetch('https://example.test'));
  assert.equal(fixture.connections.length, 1);
  const large = networkFixture({ oversized: true });
  await assert.rejects(large.safeFetch('https://example.test'), /demasiado grande/);
});

test('CSP hashes match the emitted code and event-handler attributes are disabled', async () => {
  const { protectHtml } = await import('../security-policy.mjs');
  const html = protectHtml('<html><head></head><body><script>\r\nwindow.test=1;\r\n</script></body></html>');
  const digest = createHash('sha256').update('\nwindow.test=1;\n').digest('base64');
  assert.ok(html.includes("'sha256-" + digest + "'"));
  assert.ok(html.includes("script-src-attr 'none'"));
  assert.ok(!html.match(/script-src [^;]*'unsafe-inline'/));
});

test('analytics never collect URL fragments, tokens or profile properties', () => {
  const events = [], deleted = [];
  const window = { dispatchEvent: event => events.push(event) };
  vm.runInNewContext(fs.readFileSync('onebase-integrations.js', 'utf8'), {
    window, document: { readyState: 'complete' },
    localStorage: { removeItem: key => deleted.push(key) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    fetch() { throw new Error('Analytics must not use the network'); },
    location: { hash: '#access_token=secret', pathname: '/' }
  });
  window.OneBaseIntegrations.track('example', { email: 'private@example.test', access_token: 'secret' });
  assert.equal(JSON.stringify(events).includes('secret'), false);
  assert.equal(JSON.stringify(events).includes('private@example.test'), false);
  assert.equal(deleted.includes('onebase_telemetry_queue_v1'), true);
  assert.equal(window.OneBaseIntegrations.status().disabled, true);
});
