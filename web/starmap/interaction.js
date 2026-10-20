import './interaction.css';

const searchText = new WeakMap();
let previousQuery = '', previousTerms = [];
function queryTerms(query) {
  const normalized = typeof query === 'string' ? query.normalize('NFKC').toLocaleLowerCase().trim() : '';
  if (normalized !== previousQuery) {
    previousQuery = normalized;
    previousTerms = normalized.split(/\s+/u).filter(Boolean);
  }
  return previousTerms;
}

export function matchesBookQuery(node, query) {
  if (!node || typeof node !== 'object') return false;
  const title = typeof node.title === 'string' ? node.title : '';
  const author = typeof node.author === 'string' ? node.author : '';
  let cached = searchText.get(node);
  if (!cached || cached.title !== title || cached.author !== author) {
    cached = { title, author, text: `${title} ${author}`.normalize('NFKC').toLocaleLowerCase() };
    searchText.set(node, cached);
  }
  return queryTerms(query).every(term => cached.text.includes(term));
}

export function searchBooks(nodes, query, allowedIndices) {
  const allowed = allowedIndices ? new Set(allowedIndices) : null;
  return nodes.flatMap((node, index) =>
    (!allowed || allowed.has(index)) && matchesBookQuery(node, query) ? [{ node, index }] : []);
}

export const INITIAL_VIEW = Object.freeze({ rotX: -0.35, rotY: 0.6, zoom: 1, focusX: 0, focusY: 0, focusZ: 0 });
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// The transpose of the camera rotation maps screen pan back into 3D focus.
// Unlike dividing by cos(rotY), this remains stable at side-on camera angles.
export function panAndZoom(view, { width, height, fromX, fromY, toX, toY, scale = 1 }) {
  const oldZoom = clamp(view.zoom || 1, 0.1, 30);
  const zoom = clamp(oldZoom * scale, 0.1, 30);
  const half = Math.max(40, Math.min(width, height) / 2 - 80);
  const tx = ((fromX - width / 2) / oldZoom - (toX - width / 2) / zoom) / half;
  const ty = ((fromY - height / 2) / oldZoom - (toY - height / 2) / zoom) / half;
  const cy = Math.cos(view.rotY), sy = Math.sin(view.rotY);
  const cx = Math.cos(view.rotX), sx = Math.sin(view.rotX);
  return {
    ...view, zoom,
    focusX: (view.focusX || 0) + cy * tx + sy * sx * ty,
    focusY: (view.focusY || 0) + cx * ty,
    focusZ: (view.focusZ || 0) + sy * tx - cy * sx * ty,
  };
}

export function createPointerGesture({ getView, setView, viewport, onTap, onHover = () => {}, mode = 'immersive' }) {
  const pointers = new Map();
  let dragged = false;
  const pair = () => {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  return {
    down(point) {
      if (!pointers.size) dragged = false;
      pointers.set(point.id, { ...point, startX: point.x, startY: point.y });
      if (pointers.size > 1) dragged = true;
    },
    move(point) {
      const old = pointers.get(point.id);
      if (!old) { if (!pointers.size) onHover(point); return; }
      const before = pointers.size >= 2 ? pair() : null;
      pointers.set(point.id, { ...old, x: point.x, y: point.y });
      const view = getView();
      if (before && mode === 'immersive') {
        const after = pair();
        setView(panAndZoom(view, {
          ...viewport(), fromX: before.x, fromY: before.y, toX: after.x, toY: after.y,
          scale: before.distance > 1 ? after.distance / before.distance : 1,
        }));
        return;
      }
      if (before) return;
      const wasDragged = dragged;
      dragged ||= Math.hypot(point.x - old.startX, point.y - old.startY) >= 6;
      if (!dragged) return;
      const fromX = wasDragged ? old.x : old.startX, fromY = wasDragged ? old.y : old.startY;
      if (mode === 'immersive' && (view.zoom > 1.2 || point.pan)) {
        setView(panAndZoom(view, { ...viewport(), fromX, fromY, toX: point.x, toY: point.y }));
      } else {
        setView({ ...view, rotY: view.rotY + (point.x - fromX) * 0.008, rotX: clamp(view.rotX + (point.y - fromY) * 0.008, -1.4, 1.4) });
      }
    },
    up(point) {
      if (!pointers.has(point.id)) return;
      const old = pointers.get(point.id);
      dragged ||= Math.hypot(point.x - old.startX, point.y - old.startY) >= 6;
      pointers.delete(point.id);
      if (!pointers.size && !dragged) onTap(point);
    },
    cancel() { pointers.clear(); dragged = true; },
    hasPointer: id => pointers.has(id),
  };
}

const COPY = {
  zh: {
    open: '进入星图 ↗', pause: '暂停自转', resume: '继续自转', reset: '还原视角', arrangement: '还原排列',
    search: '按书名或作者查找', placeholder: '书名、作者…', expand: '展开探索', collapse: '收起面板',
    clear: '关闭书目详情', results: '可用方向键选择的书目', empty: '没有匹配书目，试试其他书名或作者。',
    hint: '拖拽旋转 · 放大后拖拽平移 · 双指缩放', keyboard: '方向键调整视角，＋／−缩放，Home还原，Escape返回。',
    count: (total, shown) => `${total} 本${total > shown ? ` · 显示前 ${shown} 本，请继续输入缩小范围` : ''}`,
  },
  en: {
    open: 'Explore the map ↗', pause: 'Pause rotation', resume: 'Resume rotation', reset: 'Reset view', arrangement: 'Reset arrangement',
    search: 'Find a title or author', placeholder: 'Title or author…', expand: 'Explore', collapse: 'Collapse panel',
    clear: 'Close book details', results: 'Books; use arrow keys to choose', empty: 'No matching books. Try another title or author.',
    hint: 'Drag to rotate · Drag when zoomed to pan · Pinch to zoom', keyboard: 'Arrow keys adjust the view; +/− zoom; Home resets; Escape returns.',
    count: (total, shown) => `${total} books${total > shown ? ` · First ${shown} shown; type more to narrow results` : ''}`,
  },
};

/** Adapter owns the existing graph/camera; this module owns input and accessible UI. */
export function mountStarmapInteractions(adapter, doc = document) {
  const dialog = doc.getElementById('immerse'), panel = doc.getElementById('immPanel');
  const search = doc.getElementById('immSearch'), detail = doc.getElementById('immStar');
  const mainCanvas = doc.getElementById('map-canvas'), immersiveCanvas = doc.getElementById('imm-canvas');
  if (!dialog || !panel || !search || !detail || !mainCanvas || !immersiveCanvas) return null;
  const listeners = [], observers = [], pauseButtons = [];
  const activePointers = new Set();
  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  };
  const create = (tag, className) => { const element = doc.createElement(tag); element.className = className; return element; };
  const words = () => COPY[adapter.getLanguage() === 'en' ? 'en' : 'zh'];
  let paused = false, lastOpen = false, previousFocus = null, previousOverflow = '', selected = -1;
  const button = (parent, callback, className = '') => {
    const element = create('button', className); element.type = 'button';
    parent.append(element); listen(element, 'click', callback); return element;
  };
  const mainControls = create('div', 'starmap-main-controls');
  mainCanvas.parentElement.after(mainControls);
  const openButton = button(mainControls, () => adapter.open());
  const togglePause = () => { paused = !paused; adapter.stopMotion?.(); refreshView(); };
  const mainPause = button(mainControls, togglePause);
  pauseButtons.push(mainPause);
  const reset = () => { adapter.clearSelection(); adapter.setView({ ...INITIAL_VIEW }); refresh(); };
  const mainReset = button(mainControls, reset);
  const tools = create('div', 'starmap-tools');
  const pause = button(tools, togglePause);
  pauseButtons.push(pause);
  const resetButton = button(tools, reset);
  const sheetButton = button(tools, () => setSheet(panel.dataset.sheetOpen !== 'true'), 'starmap-sheet-toggle');
  panel.prepend(tools);
  const arrangementReset = panel.querySelector('.imm-ax-reset');
  if (arrangementReset) {
    arrangementReset.setAttribute('role', 'button'); arrangementReset.tabIndex = 0;
    listen(arrangementReset, 'keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); arrangementReset.click(); } });
  }
  panel.classList.add('starmap-enhanced'); panel.dataset.sheetOpen = 'false';
  const searchBlock = create('div', 'starmap-search');
  const label = create('label', 'starmap-search-label'); label.htmlFor = search.id;
  const resultCount = create('p', 'starmap-result-count'); resultCount.setAttribute('role', 'status');
  const results = create('ul', 'starmap-results'); results.id = 'starmap-results';
  searchBlock.append(label, search, resultCount, results);
  tools.after(detail, searchBlock);
  search.removeAttribute('oninput'); search.oninput = null;
  search.type = 'search'; search.autocomplete = 'off'; search.setAttribute('aria-controls', results.id);
  const ring = create('div', 'starmap-selection-ring'); ring.hidden = true; ring.setAttribute('aria-hidden', 'true');
  dialog.append(ring);
  const hint = create('p', 'starmap-gesture-hint'); hint.id = 'starmap-gesture-hint'; dialog.append(hint);
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'immTitle');
  for (const canvas of [mainCanvas, immersiveCanvas]) {
    canvas.tabIndex = 0; canvas.setAttribute('role', 'group');
    canvas.setAttribute('aria-describedby', hint.id);
  }
  mainCanvas.parentElement.setAttribute('role', 'group');
  mainCanvas.parentElement.tabIndex = -1; mainCanvas.parentElement.removeAttribute('onkeydown');

  function setSheet(open) {
    panel.dataset.sheetOpen = String(open); sheetButton.setAttribute('aria-expanded', String(open));
    sheetButton.textContent = open ? words().collapse : words().expand;
  }
  function refreshView() {
    for (const element of pauseButtons) {
      element.textContent = paused ? words().resume : words().pause;
      element.setAttribute('aria-pressed', String(paused));
    }
    const index = adapter.getSelectedIndex();
    if (index !== selected) {
      selected = index;
      for (const element of results.querySelectorAll('button')) element.setAttribute('aria-pressed', String(Number(element.dataset.index) === selected));
    }
    const point = selected >= 0 && adapter.isOpen() ? adapter.project(selected) : null;
    ring.hidden = !point || !(adapter.isNodeVisible ? adapter.isNodeVisible(selected) : adapter.getVisibleIndices().includes(selected));
    if (point) { ring.style.left = `${point.sx}px`; ring.style.top = `${point.sy}px`; }
    const close = detail.querySelector('.imm-star-x');
    if (close && !close.dataset.enhanced) {
      close.dataset.enhanced = 'true'; close.setAttribute('role', 'button'); close.tabIndex = 0;
      close.removeAttribute('onclick'); close.onclick = () => { adapter.clearSelection(); refreshView(); search.focus(); };
      close.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); close.click(); } };
    }
    if (close) close.setAttribute('aria-label', words().clear);
  }
  function choose(index) {
    paused = true; adapter.select(index); setSheet(true); refreshView();
    const point = adapter.project(index), rect = immersiveCanvas.getBoundingClientRect(), panelRect = panel.getBoundingClientRect();
    const mobile = rect.width <= 700, view = adapter.getView();
    const targetX = mobile ? rect.width / 2 : Math.max(120, panelRect.left / 2);
    const targetY = mobile ? Math.max(100, panelRect.top / 2) : rect.height / 2;
    adapter.setView(panAndZoom(view, {
      width: rect.width, height: rect.height, fromX: point.sx, fromY: point.sy,
      toX: targetX, toY: targetY, scale: view.zoom < 1.8 ? 1.8 / view.zoom : 1,
    }));
    refreshView();
    const heading = detail.querySelector('.imm-star-t');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    detail.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function renderResults() {
    const matches = searchBooks(adapter.getNodes(), search.value, adapter.getVisibleIndices());
    const shown = matches.slice(0, search.value.trim() ? 30 : 12);
    results.replaceChildren();
    for (const { node, index } of shown) {
      const item = create('li', '');
      const element = create('button', 'starmap-result'); element.type = 'button';
      element.onclick = () => choose(index); item.append(element);
      element.dataset.index = String(index);
      element.textContent = `${node.title}${node.author ? ` · ${node.author}` : ''}`;
      element.setAttribute('aria-pressed', String(index === adapter.getSelectedIndex()));
      results.append(item);
    }
    resultCount.textContent = matches.length ? words().count(matches.length, shown.length) : words().empty;
  }
  function refresh() {
    openButton.textContent = words().open; mainReset.textContent = resetButton.textContent = words().reset;
    if (arrangementReset) arrangementReset.textContent = words().arrangement;
    label.textContent = words().search; search.placeholder = words().placeholder; search.setAttribute('aria-label', words().search);
    results.setAttribute('aria-label', words().results);
    hint.textContent = `${words().hint} · ${words().keyboard}`;
    mainCanvas.setAttribute('aria-label', words().open); immersiveCanvas.setAttribute('aria-label', words().keyboard);
    setSheet(panel.dataset.sheetOpen === 'true'); renderResults(); refreshView();
  }
  listen(search, 'input', () => { adapter.applyQuery(search.value); setSheet(true); });
  listen(search, 'keydown', event => {
    const buttons = [...results.querySelectorAll('button')];
    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key) && buttons.length) {
      event.preventDefault();
      if (event.key === 'Enter') buttons[0].click();
      else buttons[event.key === 'ArrowDown' ? 0 : buttons.length - 1].focus();
    }
  });
  listen(results, 'keydown', event => {
    const buttons = [...results.querySelectorAll('button')], index = buttons.indexOf(doc.activeElement);
    if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[target].focus();
  });
  function hit(point, surface = 'immersive') {
    let index = -1, best = 26;
    for (const candidate of adapter.getVisibleIndices(surface)) {
      const projected = adapter.project(candidate, surface);
      const distance = Math.hypot(projected.sx - point.x, projected.sy - point.y) * (1 + Math.abs(projected.depth || 0) * 0.5);
      if (distance < best) { best = distance; index = candidate; }
    }
    return index;
  }
  for (const [canvas, mode] of [[mainCanvas, 'main'], [immersiveCanvas, 'immersive']]) {
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top, pan: event.shiftKey };
    };
    const gesture = createPointerGesture({
      mode, getView: adapter.getView, setView: view => { adapter.setView(view); refreshView(); },
      viewport: () => ({ width: canvas.clientWidth, height: canvas.clientHeight }),
      onHover: p => adapter.hover?.(hit(p, mode), mode),
      onTap: p => { if (mode === 'main') adapter.open(); else { const index = hit(p); if (index >= 0) choose(index); else { adapter.clearSelection(); refreshView(); } } },
    });
    listen(canvas, 'pointerdown', event => {
      if (event.button > 0) return;
      event.preventDefault(); event.stopImmediatePropagation();
      activePointers.add(event.pointerId); adapter.stopMotion?.();
      try { canvas.setPointerCapture(event.pointerId); } catch {}
      gesture.down(point(event)); canvas.classList.add('starmap-grabbing');
    }, true);
    listen(canvas, 'pointermove', event => { event.stopImmediatePropagation(); gesture.move(point(event)); }, true);
    listen(canvas, 'pointerup', event => { event.stopImmediatePropagation(); gesture.up(point(event)); activePointers.delete(event.pointerId); canvas.classList.remove('starmap-grabbing'); }, true);
    listen(canvas, 'pointercancel', event => { event.stopImmediatePropagation(); gesture.cancel(); activePointers.clear(); canvas.classList.remove('starmap-grabbing'); }, true);
    listen(canvas, 'lostpointercapture', event => { if (gesture.hasPointer(event.pointerId)) gesture.cancel(); activePointers.delete(event.pointerId); canvas.classList.remove('starmap-grabbing'); });
    listen(canvas, 'pointerleave', () => adapter.hover?.(-1, mode));
    if (mode === 'immersive') listen(canvas, 'wheel', event => {
      event.preventDefault(); event.stopImmediatePropagation(); const p = point(event);
      adapter.setView(panAndZoom(adapter.getView(), { width: canvas.clientWidth, height: canvas.clientHeight, fromX: p.x, fromY: p.y, toX: p.x, toY: p.y, scale: event.deltaY < 0 ? 1.15 : 1 / 1.15 })); refreshView();
    }, { capture: true, passive: false });
    listen(canvas, 'keydown', event => {
      const view = adapter.getView();
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); mode === 'main' ? adapter.open() : search.focus(); return; }
      if (event.key === 'Home') { event.preventDefault(); reset(); return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        adapter.setView({ ...view, rotY: view.rotY + (event.key === 'ArrowLeft' ? -0.08 : event.key === 'ArrowRight' ? 0.08 : 0), rotX: clamp(view.rotX + (event.key === 'ArrowUp' ? -0.08 : event.key === 'ArrowDown' ? 0.08 : 0), -1.4, 1.4) }); refreshView();
      } else if (mode === 'immersive' && ['+', '=', '-', '−'].includes(event.key)) {
        event.preventDefault(); adapter.setView({ ...view, zoom: clamp(view.zoom * (['+', '='].includes(event.key) ? 1.25 : 0.8), 0.1, 30) }); refreshView();
      }
    });
  }
  const stackedPanelOpen = () => doc.querySelector('.rec-panel.open, .batch-panel.open, .leaf-page.open, .set-panel.open, .add-panel.open');
  listen(doc, 'keydown', event => {
    if (!adapter.isOpen() || stackedPanelOpen()) return;
    if (event.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll('button, input, select, [tabindex]')]
        .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (first && ((!event.shiftKey && doc.activeElement === last) || (event.shiftKey && doc.activeElement === first) || !dialog.contains(doc.activeElement))) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
      return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (adapter.getSelectedIndex() >= 0) { adapter.clearSelection(); refreshView(); search.focus(); }
    else adapter.close();
  }, true);
  const observer = new MutationObserver(() => {
    const open = adapter.isOpen();
    if (open !== lastOpen) {
      lastOpen = open;
      if (open) {
        previousFocus = doc.activeElement; previousOverflow = doc.body.style.overflow;
        doc.body.style.overflow = 'hidden'; refresh(); search.focus({ preventScroll: true });
      } else {
        doc.body.style.overflow = previousOverflow;
        (previousFocus?.isConnected && previousFocus.tabIndex >= 0 ? previousFocus : openButton).focus({ preventScroll: true });
      }
    }
    refreshView();
  });
  observer.observe(dialog, { attributes: true, attributeFilter: ['class'] });
  observer.observe(detail, { attributes: true, attributeFilter: ['style'], childList: true }); observers.push(observer);
  refresh();
  return { isPaused: () => paused || activePointers.size > 0, ownsPointerEvents: true, refresh, refreshView,
    destroy() { listeners.forEach(remove => remove()); observers.forEach(item => item.disconnect()); } };
}
