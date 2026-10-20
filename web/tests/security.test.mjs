import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('function ghPut('));
const graph = JSON.parse(readFileSync(new URL('../public/data/graph.json', import.meta.url)));

function app({ blockedStorage = false } = {}) {
  const elements = new Map();
  const saved = new Map([['caelum_admin_token', 'old-saved-credential'], ['caelum_admin_key', 'old-key']]);
  const writes = [];
  const eventHandlers = new Map();
  const context2d = new Proxy({}, { get: (_, key) => key === 'measureText' ? (() => ({ width: 20 })) : key === 'createRadialGradient' ? (() => ({ addColorStop() {} })) : (() => {}) });
  function element() {
    const classes = new Set();
    return {
      value: '', textContent: '', innerHTML: '', style: {}, children: [],
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, active) { active ? classes.add(c) : classes.delete(c); } },
      getBoundingClientRect: () => ({ width: 900, height: 500, top: 0, bottom: 500, left: 0 }),
      parentElement: { getBoundingClientRect: () => ({ width: 900, height: 500 }) },
      addEventListener(name, fn) { eventHandlers.set(name, fn); },
      getContext: () => context2d,
      setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
      querySelectorAll: () => [], querySelector: () => null,
      appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
      setPointerCapture() {}, click() {},
    };
  }
  const document = {
    baseURI: 'https://nyxbyb.github.io/web/', hidden: false,
    documentElement: element(),
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    querySelectorAll: () => [], createElement: element, addEventListener() {},
  };
  const ctx = vm.createContext({
    document, URL, TextEncoder, IntersectionObserver: class { observe() {} }, performance: { now: () => 100 },
    requestAnimationFrame() {}, setTimeout() {}, clearTimeout() {},
    innerWidth: 1200, innerHeight: 800,
    window: { devicePixelRatio: 1, matchMedia: () => ({ matches: true }), addEventListener() {}, open() {} },
    localStorage: {
      getItem(key) { if (blockedStorage) throw new Error('Blocked storage'); return saved.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw new Error('Blocked storage'); saved.set(key, value); writes.push([key, value]); },
      removeItem(key) { if (blockedStorage) throw new Error('Blocked storage'); saved.delete(key); },
    },
    fetch: () => new Promise(() => {}),
    btoa: str => Buffer.from(str, 'binary').toString('base64'),
    atob: str => Buffer.from(str, 'base64').toString('binary'),
    confirm: () => true,
  });
  vm.runInContext(script, ctx);
  return { ctx, document, saved, writes, run: expression => vm.runInContext(expression, ctx), get: id => document.getElementById(id) };
}

test('initialization survives blocked storage and rejects invalid saved language', () => {
  assert.doesNotThrow(() => app({ blockedStorage: true }));
  const a = app();
  a.run("setLang('invalid')");
  assert.equal(a.run('lang'), 'zh');
  assert.equal(a.saved.has('caelum_admin_token'), false);
  assert.equal(a.saved.has('caelum_admin_key'), false);
});

test('content escapes markup while retaining explicit line breaks and safe URLs', () => {
  const a = app();
  assert.equal(a.run(`textHTML('hello<br><img src=x onerror=alert(1)>')`), 'hello<br>&lt;img src=x onerror=alert(1)&gt;');
  for (const value of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:msgbox(1)']) {
    a.ctx.value = value;
    assert.equal(a.run('safeURL(value)'), '');
  }
  assert.equal(a.run("safeURL('./docs/profile.md')"), 'https://nyxbyb.github.io/web/docs/profile.md');
});

test('text rendering and editor contain injected HTML and textarea terminators', () => {
  const a = app();
  a.ctx.payload = '</textarea><img src=x onerror=alert(1)>';
  a.run(`textData = { intro: {tagline: {zh: payload}}, vision: [{id: '" onclick="alert(1)', zh: payload}], coda: {quote: {zh: payload}} }; renderText(); textRenderEditor();`);
  assert.ok(!a.get('introTagline').innerHTML.includes('<img'));
  assert.ok(!a.get('visionStars').innerHTML.includes('data-vid="" onclick='));
  assert.ok(!a.get('textFields').innerHTML.includes('</textarea><img'));
});

test('unread overrides a read source node across reload without deleting other marks', async () => {
  const a = app();
  a.ctx.fetch = async () => ({ ok: true, json: async () => ({ nodes: [{title:'book', x:0.3, y:0.3, z:0.5, status:'read'}] }) });
  await a.run('loadStars()');
  a.run("markNode(nodes[0], 'unread')");
  assert.equal(JSON.parse(a.saved.get('caelum_marks')).book, 'unread');
  await a.run('loadStars()');
  assert.equal(a.run('nodes[0].status'), 'unread');
});

test('neighbors use Euclidean distance, valid indexes and escaped titles', () => {
  const a = app();
  a.run(`nodes = [{title:'origin', x:0,y:0,z:0}, {title:'<img src=x>',x:.9,y:0,z:0}, {title:'diagonal',x:.65,y:.65,z:0}]; immSelect(0);`);
  const result = a.get('immStar').innerHTML;
  assert.ok(result.indexOf('immSelect(1)') < result.indexOf('immSelect(2)'));
  assert.ok(!result.includes('undefined'));
  assert.ok(result.includes('&lt;img src=x&gt;'));
});

test('clearing author search restores all books', () => {
  const a = app();
  a.run("immRender = () => {}; immFilter = 'author'; immAuthor = 'missing';");
  a.get('immSearch').value = '';
  a.run('immApply()');
  assert.equal(a.run('immFilter'), 'all');
});

test('GitHub writes require source path and revision, include SHA and hide response bodies', async () => {
  const a = app();
  const calls = [];
  a.ctx.fetch = async (url, options) => { calls.push({url, options}); return { ok: true, json: async () => ({}) }; };
  await assert.rejects(a.run("ghPut('data/text.json', 'body', 'edit', 'test-credential', 'abc')"));
  await assert.rejects(a.run("ghPut('web/public/data/text.json', 'body', 'edit', 'test-credential')"));
  await a.run("ghPut('web/public/data/text.json', 'body', 'edit', 'test-credential', 'abc')");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/contents/web/public/data/text.json'));
  assert.equal(JSON.parse(calls[0].options.body).sha, 'abc');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-credential');
  a.ctx.fetch = async () => ({ok:false,status:409,text() { throw new Error('response body must not be displayed'); }});
  await assert.rejects(a.run("ghPut('web/public/data/text.json', 'body', 'edit', 'test-credential', 'abc')"), /版本已变化/);
  assert.ok(a.writes.every(([key]) => !key.includes('token') && !key.includes('key')));
});

test('inbox submission preserves queued data and legacy hash, clears token and uses source SHA', async () => {
  const a = app();
  const calls = [];
  const original = { _key_hash: 'legacy-hash', items: [{title:'existing',type:'book'}] };
  a.ctx.fetch = async (url, options) => {
    calls.push({url, options});
    return {ok:true,json:async () => options.method === 'PUT' ? {} : {sha:'inbox-revision', content:Buffer.from(JSON.stringify(original)).toString('base64')}};
  };
  a.get('addToken').value = 'test-credential';
  a.get('afTitle').value = 'new book';
  await a.run('addSubmit()');
  assert.equal(a.get('addToken').value, '');
  assert.equal(calls.length, 2);
  const write = JSON.parse(calls[1].options.body);
  const result = JSON.parse(Buffer.from(write.content, 'base64').toString('utf8'));
  assert.equal(write.sha, 'inbox-revision');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].title, 'existing');
  assert.equal(result._key_hash, 'legacy-hash');
  assert.ok(a.writes.every(([key]) => !key.includes('token')));
});

test('remote text changes stop writes and preserve downloadable local draft', async () => {
  const a = app();
  a.ctx.fetch = async () => ({ ok:true, json:async () => ({sha:'new-sha',content:Buffer.from(JSON.stringify({taglines:{map:{zh:'remote'}}})).toString('base64')}) });
  a.run(`textData = {taglines:{map:{zh:'old',en:'old'}}}; textLoadedSnapshot = JSON.stringify(textData);`);
  a.get('tf_taglines_map_zh').value = 'local draft';
  a.get('textToken').value = 'test-credential';
  await a.run('textPush()');
  assert.match(a.get('textStatus').textContent, /仓库文案已更新/);
  assert.equal(a.run('textData.taglines.map.zh'), 'local draft');
  assert.equal(a.get('textToken').value, '');
});

test('existing graph remains finite and nonempty', () => {
  assert.ok(graph.nodes.length > 1000);
  assert.ok(graph.nodes.every(n => typeof n.title === 'string' && Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)));
});
