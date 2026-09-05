<script>
  import { onMount } from "svelte";

  let canvas;
  let ctx;
  let nodes = []; // {id,title,author,rating,status,x,y}
  let loading = true;
  let error = null;

  // 视图状态
  let view = { scale: 1, tx: 0, ty: 0 };
  let dragging = false;
  let moved = false;
  let lastX = 0,
    lastY = 0;
  let hover = null; // 悬停节点
  let selected = null; // 点击节点

  // 画笔状态：从 localStorage 读，刷新也能保留
  let readSet = new Set(JSON.parse(localStorage.getItem("caelum_read") || "[]"));

  const COLOR_READ = "#f5d58a";
  const COLOR_UNREAD = "#3a4257";
  const COLOR_HOVER = "#fff3c4";
  const COLOR_READ_GLOW = "rgba(245,213,138,0.25)";

  function saveRead() {
    localStorage.setItem("caelum_read", JSON.stringify([...readSet]));
  }

  async function loadData() {
    try {
      const res = await fetch(import.meta.env.BASE_URL + "data/graph.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      nodes = data.nodes;
      // 载入时若已从 localStorage 标记过，则应用
      nodes.forEach((n) => {
        if (readSet.has(n.title)) n.status = "read";
      });
      fitView();
      render(); // 数据就绪后立刻绘制，否则 canvas 是空的
    } catch (e) {
      error = String(e);
    }
    loading = false;
  }

  function fitView() {
    if (!nodes.length) return;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    nodes.forEach((n) => {
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x);
      y1 = Math.max(y1, n.y);
    });
    const W = canvas.width,
      H = canvas.height;
    const pad = 80;
    const sx = (W - pad * 2) / Math.max(1, x1 - x0);
    const sy = (H - pad * 2) / Math.max(1, y1 - y0);
    view.scale = Math.min(sx, sy);
    view.tx = W / 2 - ((x0 + x1) / 2) * view.scale;
    view.ty = H / 2 - ((y0 + y1) / 2) * view.scale;
  }

  function worldToScreen(n) {
    return {
      x: n.x * view.scale + view.tx,
      y: n.y * view.scale + view.ty,
    };
  }

  function screenToWorld(px, py) {
    return {
      x: (px - view.tx) / view.scale,
      y: (py - view.ty) / view.scale,
    };
  }

  function nodeAt(px, py) {
    const R = 16 / view.scale; // 屏幕命中半径逆映射
    let best = null,
      bestD = R;
    for (const n of nodes) {
      const s = worldToScreen(n);
      const d = Math.hypot(s.x - px, s.y - py) / view.scale;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  function render() {
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 背景星尘
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, W, H);
    drawDust();

    if (!nodes.length) return;

    // 已读节点先画光晕
    for (const n of nodes) {
      if (n.status === "read") {
        const s = worldToScreen(n);
        if (s.x < -50 || s.x > W + 50 || s.y < -50 || s.y > H + 50) continue;
        const r = 18;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        g.addColorStop(0, COLOR_READ_GLOW);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 画节点
    for (const n of nodes) {
      const s = worldToScreen(n);
      if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) continue;
      const r = n.status === "read" ? 6.5 : 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      if (n === hover) {
        ctx.fillStyle = COLOR_HOVER;
        ctx.strokeStyle = COLOR_HOVER;
        ctx.lineWidth = 1.5;
      } else if (n === selected) {
        ctx.fillStyle = COLOR_HOVER;
        ctx.strokeStyle = "rgba(255,243,196,0.6)";
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = n.status === "read" ? COLOR_READ : COLOR_UNREAD;
      }
      ctx.fill();
      if (n === hover || n === selected) ctx.stroke();
    }

    // 质心（已读节点的平均 = 精神质心）
    const reads = nodes.filter((n) => n.status === "read");
    if (reads.length) {
      const cx =
        reads.reduce((a, n) => a + n.x, 0) / reads.length;
      const cy =
        reads.reduce((a, n) => a + n.y, 0) / reads.length;
      const s = { x: cx * view.scale + view.tx, y: cy * view.scale + view.ty };
      drawCentroid(s.x, s.y);
    }

    // 悬停标签
    if (hover) {
      const s = worldToScreen(hover);
      drawLabel(s.x, s.y + 14, hover.title + (hover.author ? " · " + hover.author : ""));
    }
  }

  function drawDust() {
    // 固定伪随机星点，加重夜空氛围
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 200; i++) {
      const x = (i * 137.5) % canvas.width;
      const y = (i * 89.3) % canvas.height;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function drawCentroid(x, y) {
    ctx.strokeStyle = "rgba(245,213,138,0.9)";
    ctx.fillStyle = "rgba(245,213,138,0.9)";
    ctx.lineWidth = 1.5;
    const r = 9;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const inner = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * inner;
      const py = y + Math.sin(a) * inner;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawLabel(x, y, text) {
    ctx.font = "12px 'Noto Serif SC','Songti SC',serif";
    const w = ctx.measureText(text).width + 16;
    const h = 26;
    ctx.fillStyle = "rgba(10,14,22,0.92)";
    ctx.strokeStyle = "rgba(255,243,196,0.5)";
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff3c4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 1);
  }

  function onResize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const rect = canvas.getBoundingClientRect();
    const ox = e.clientX - rect.left,
      oy = e.clientY - rect.top;
    const w = screenToWorld(ox, oy);
    view.scale = Math.min(200, Math.max(0.1, view.scale * factor));
    view.tx = ox - w.x * view.scale;
    view.ty = oy - w.y * view.scale;
    render();
  }

  function onDown(e) {
    dragging = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left,
      py = e.clientY - rect.top;
    if (dragging) {
      const dx = e.clientX - lastX,
        dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      view.tx += dx;
      view.ty += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      render();
    } else {
      const hit = nodeAt(px, py);
      if (hit !== hover) {
        hover = hit;
        render();
      }
    }
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    if (!moved) {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left,
        py = e.clientY - rect.top;
      const hit = nodeAt(px, py);
      selected = hit;
      render();
    }
  }

  function toggleRead(node) {
    if (node.status === "read") {
      node.status = "unread";
      readSet.delete(node.title);
    } else {
      node.status = "read";
      readSet.add(node.title);
    }
    saveRead();
    render();
  }

  onMount(() => {
    canvas = document.getElementById("star-canvas");
    onResize();
    window.addEventListener("resize", onResize);
    loadData();
    render();
    // 轻量 rAF 防抖渲染用不到（每次事件直接 render）
  });
</script>

<svelte:head>
  <title>凿星图 · Caelum</title>
</svelte:head>

<main class="wrap">
  <canvas
    id="star-canvas"
    bind:this={canvas}
    onwheel={onWheel}
    onmousedown={onDown}
    onmousemove={onMove}
    onmouseup={onUp}
    onmouseleave={() => {
      hover = null;
      render();
    }}
  ></canvas>

  {#if loading}
    <div class="hint center">正在为星穹入场加载…</div>
  {:else if error}
    <div class="hint center error">无法加载数据：{error}</div>
  {:else}
    <div class="hint">拖拽移动 · 滚轮缩放 · 点击节点查看 · 已读=暖色银光</div>
  {/if}

  {#if selected}
    <div class="card">
      <div class="card-close" onclick={() => (selected = null)}>×</div>
      <h2>{selected.title}</h2>
      <p class="meta">{selected.author || ""}</p>
      <p class="meta">
        {selected.status === "read" ? "已读" : "未读"}
        {selected.rating ? " · 豆瓣 " + selected.rating : ""}
      </p>
      <button
        class="btn {selected.status === 'read' ? 'active' : ''}"
        onclick={() => toggleRead(selected)}
      >{selected.status === "read" ? "标为未读" : "标记为已读"}</button>
    </div>
  {/if}
</main>

<style>
  .wrap {
    position: relative;
    height: 100%;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }
  .hint {
    position: absolute;
    left: 16px;
    bottom: 14px;
    color: rgba(214, 216, 224, 0.5);
    font-size: 13px;
    letter-spacing: 0.05em;
    user-select: none;
  }
  .hint.center {
    left: 50%;
    transform: translateX(-50%);
    top: 20px;
    bottom: auto;
    color: rgba(214, 216, 224, 0.65);
  }
  .hint.error {
    color: #e08585;
  }
  .card {
    position: absolute;
    right: 20px;
    top: 20px;
    width: 260px;
    background: rgba(14, 18, 28, 0.94);
    border: 1px solid rgba(245, 213, 138, 0.28);
    border-radius: 12px;
    padding: 18px 20px 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    color: #d6d8e0;
  }
  .card h2 {
    margin: 0 0 6px;
    font-size: 19px;
    color: #f5d58a;
    font-weight: 600;
  }
  .card .meta {
    margin: 3px 0;
    font-size: 13px;
    color: rgba(214, 216, 224, 0.7);
  }
  .card-close {
    position: absolute;
    right: 12px;
    top: 8px;
    cursor: pointer;
    color: rgba(214, 216, 224, 0.5);
    font-size: 20px;
    line-height: 1;
  }
  .card-close:hover {
    color: #fff;
  }
  .btn {
    margin-top: 12px;
    width: 100%;
    padding: 8px 0;
    background: rgba(245, 213, 138, 0.12);
    border: 1px solid rgba(245, 213, 138, 0.45);
    color: #f5d58a;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn:hover {
    background: rgba(245, 213, 138, 0.22);
  }
  .btn.active {
    background: rgba(245, 213, 138, 0.28);
  }
</style>