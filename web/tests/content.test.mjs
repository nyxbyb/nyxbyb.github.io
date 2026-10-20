import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('function renderDomains('));
const tree = JSON.parse(readFileSync(new URL('../public/tree.json', import.meta.url)));
const archive = JSON.parse(readFileSync(new URL('../public/data/domains-archive.json', import.meta.url)));
const articles = JSON.parse(readFileSync(new URL('../public/data/articles.json', import.meta.url)));

function flatten(nodes, parents = []) {
  return nodes.flatMap(node => [{ node, path: [...parents, node.id].join('>') }, ...flatten(node.children || [], [...parents, node.id])]);
}
function withoutStorage(node) {
  const clone = structuredClone(node);
  delete clone.storagePath;
  if (clone.children) clone.children = clone.children.map(withoutStorage);
  return clone;
}
function app() {
  const elements = new Map();
  function el(tag = 'div') {
    const classes = new Set();
    const attrs = new Map();
    return {
      tagName: tag.toUpperCase(), value: '', textContent: '', innerHTML: '', style: {}, children: [], hidden: false,
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, on) { on ? classes.add(c) : classes.delete(c); } },
      get childElementCount() { return this.children.length; },
      getBoundingClientRect: () => ({width: 900, height: 500, top: 0, bottom: 500, left: 0}),
      parentElement: {getBoundingClientRect: () => ({width: 900, height: 500})},
      addEventListener() {}, getContext: () => ({setTransform() {}}),
      setAttribute(key, value) { attrs.set(key, value); }, getAttribute(key) { return attrs.get(key); }, removeAttribute(key) { attrs.delete(key); },
      querySelectorAll: () => [], querySelector: () => null,
      appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
      scrollIntoView() { this.scrolled = true; },
    };
  }
  const ids = [...html.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]);
  const document = {
    baseURI:'https://nyxbyb.github.io/web/',hidden:false,documentElement:el('html'),
    getElementById(id) { if (!elements.has(id)) elements.set(id, el()); return elements.get(id); },
    querySelectorAll(selector) { return selector === 'section' ? ids.map(id => this.getElementById(id)) : []; },
    createElement: el, addEventListener() {},
  };
  ids.forEach(id => {document.getElementById(id).id = id;});
  const context2d = new Proxy({}, {get: () => () => {}});
  document.getElementById('map-canvas').getContext = () => context2d;
  const location = {hash: ''};
  const ctx = vm.createContext({document, URL, TextEncoder, performance:{now:()=>100},
    IntersectionObserver:class {observe() {}}, requestAnimationFrame() {},setTimeout() {},clearTimeout() {},
    innerWidth:1200,innerHeight:800,window:{location,matchMedia:()=>({matches:true}),addEventListener() {},devicePixelRatio:1},
    localStorage:{getItem:()=>null,setItem() {},removeItem() {}},fetch:()=>new Promise(()=>{}),
  });
  vm.runInContext(script,ctx);
  ctx.treeFixture = tree;
  return {ctx,location,run: code => vm.runInContext(code,ctx),get:id => document.getElementById(id)};
}

test('the active domains are only computing, TCM, and psychoanalysis; prior domains remain archived', () => {
  assert.deepEqual(tree.domains.map(n => n.id), ['computing','tcm','psy-psychoanalysis']);
  assert.deepEqual(archive.domains.map(n => n.id), ['formal','natural','humanities','applied']);
  assert.ok(flatten(archive.domains).length > 150);
  const original = new Map(flatten(archive.domains).map(entry => [entry.node.id, entry]));
  const preserved = flatten(tree.domains).filter(({node}) => node.storagePath);
  for (const {node} of preserved) {
    assert.equal(node.storagePath, original.get(node.id).path, node.id);
    assert.deepEqual(withoutStorage(node), original.get(node.id).node, node.id);
  }
  assert.ok(tree.domains[0].children.some(n => n.id === 'cstheory'));
  assert.ok(tree.domains[0].children.some(n => n.id === 'eng-cs'));
});

test('promoted subjects keep reading their original browser notes and marks', () => {
  const a=app();
  a.run('treeData = treeFixture;');
  const leaves=flatten(tree.domains).filter(({node}) => node.storagePath && !node.children?.length);
  for (const {node} of leaves) {
    a.ctx.nodeFixture=node;
    a.run(`domainPath = [{id:'computing'}]; domainMarks[nodeFixture.storagePath]='know'; domainNotes[nodeFixture.storagePath+'.distill']='original note'; openLeafPage(nodeFixture);`);
    assert.equal(a.run('domainKey(nodeFixture)'),node.storagePath);
    assert.ok(a.get('lpBody').innerHTML.includes('original note'),node.id);
    assert.ok(a.get('lpBody').innerHTML.includes('data-lm="know" class="on"'),node.id);
  }
});

test('the old research anchor opens computing/research and root navigation returns to three topics', () => {
  const a=app();a.run('treeData = treeFixture;');
  a.location.hash='#sec-frontier';a.run('routeDomainHash()');
  assert.equal(a.run("domainPath.map(n=>n.id).join('>')"),'computing>research');
  assert.equal(a.get('domainResearch').hidden,false);
  assert.equal(a.get('domainView').hidden,true);
  assert.equal(a.get('sec-domain').scrolled,true);
  a.run('showDomainRoot()');
  assert.equal(a.get('domainResearch').hidden,true);
  assert.equal(a.get('domainView').children.length,3);
  assert.ok(a.get('domainView').children.every(n => n.tagName==='BUTTON'));
  assert.equal(a.get('domainCrumb').children[0].tagName,'BUTTON');
});

test('research papers retain their titles and metadata within the computing view', () => {
  assert.ok(!html.includes('<section id="sec-frontier">'));
  assert.match(html,/<div class="domain-research" id="domainResearch" hidden>/);
  const titles=[...html.matchAll(/<div class="fi-title">([^<]+)<\/div>/g)].map(m=>m[1]);
  assert.deepEqual(titles,[
    'TPipe: Efficient Spiking Transformer Training with Time Parallelism and Asynchronous Pipeline',
    'BMapper: A Scalable and Efficient Framework for Brain-Simulation Acceleration on Supercomputers',
    'The Effect of Domain Terms on Password Security',
    'Simulation and Assimilation of the Digital Human Brain',
  ]);
  for (const venue of ['IEEE INFOCOM 2026','ICPP 2025','ACM TOPS 28(1), 2024','Nature Computational Science 4(12), 2024']) assert.ok(html.includes(venue));
});

test('each writing category starts with two articles and expansion retains every link', async () => {
  const a=app();a.ctx.fetch=async()=>({ok:true,json:async()=>articles});
  await a.run('loadEssays()');
  let retained=0;
  for (const column of a.get('essaysWrap').children) {
    const visible=column.children[0].children;
    assert.ok(visible.length<=2);
    retained+=visible.length;
    if (column.children.length>1) {
      assert.equal(visible.length,2);
      const hidden=column.children[1],button=column.children[2];
      retained+=hidden.children.length;
      assert.equal(button.tagName,'BUTTON');
      assert.equal(hidden.hidden,true);button.onclick();
      assert.equal(hidden.hidden,false);
      assert.equal(button.getAttribute('aria-expanded'),'true');
      button.onclick();assert.equal(hidden.hidden,true);
      assert.equal(button.getAttribute('aria-expanded'),'false');
    }
  }
  assert.equal(retained,articles.length);
});

test('six navigation dots map to the actual scroll pages; cover stays minimal and profile is accessible', () => {
  const sections=[...html.matchAll(/<section id="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(sections,['sec-intro','sec-map','sec-domain','sec-essays','sec-vision','sec-about']);
  assert.deepEqual([...html.matchAll(/class="nav-dot[^\n]+onclick="goTo\((\d+)\)"/g)].map(m=>Number(m[1])),[0,1,2,3,4,5]);
  assert.ok(!html.includes('class="intro-paths"'));
  assert.match(html,/href="\.\/docs\/profile\.md"[^>]+data-i18n="personalProfile"/);
  assert.ok(existsSync(new URL('../public/docs/profile.md',import.meta.url)));
});
