#!/usr/bin/env python3
"""抓取公众号文章元数据(标题/摘要/正文预览), 本地运行"""
import re, json, os, time, subprocess, html

base = os.path.expanduser("~/Desktop/Caelum")
src = f"{base}/data/公众号"
out = f"{src}/articles_index.json"
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"

def links(p):
    t = open(p, encoding='utf-8').read()
    return re.findall(r'https://mp\.weixin\.qq\.com/s/[A-Za-z0-9_-]+', t)

def fetch(u):
    r = subprocess.run(["curl","-sL","-m","12","-A",UA,u], capture_output=True, text=True)
    return r.stdout

def parse(h):
    def meta(prop):
        m = re.search(r'property=["\']?%s["\']?\s+content=["\']([^"\']*)"' % prop, h) or \
            re.search(r'content=["\']([^"\']*)["\']\s+property=["\']?%s' % prop, h)
        return html.unescape(m.group(1)).strip() if m else ''
    title = meta('og:title')
    desc = meta('og:description') or meta('description')
    body = ''
    jc = re.search(r'id=["\']js_content["\'][^>]*>(.*?)</div>', h, re.S)
    if jc:
        t = re.sub(r'<[^>]+>', '', jc.group(1))
        body = re.sub(r'\s+', ' ', t).strip()[:150]
    # 发布时间
    pub = ''
    m = re.search(r"createTime\s*=\s*'([\d-]+ \d+:\d+)", h)
    if m: pub = m.group(1)
    if not pub:
        m = re.search(r'og:release_date"[^>]*content="([^"]+)"', h)
        if m: pub = m.group(1)
    return {"title": title, "description": desc, "preview": body, "date": pub}

def main():
    cats = {}
    for fn in ["随笔.md","日记.md","读书笔记.md","社会作用量极值原理.md"]:
        p = os.path.join(src, fn)
        if os.path.exists(p):
            cats[fn.replace('.md','')] = links(p)
    arts, done = [], {}
    if os.path.exists(out):
        for a in json.load(open(out)):
            done[a["url"]] = a
    for cat, ls in cats.items():
        for u in ls:
            if u in done:
                arts.append(done[u]); continue
            h = fetch(u)
            m = parse(h)
            m.update({"category": cat, "url": u, "fetched_at": time.strftime('%Y-%m-%d')})
            arts.append(m)
            time.sleep(0.6)
    # 去重(同url)
    seen = {}; fin = []
    for a in arts:
        if a["url"] not in seen:
            seen[a["url"]] = 1; fin.append(a)
    json.dump(fin, open(out,'w'), ensure_ascii=False, indent=1)
    print(f"✅ {len(fin)} 篇 -> {out}")
    for a in fin[:4]: print(f"   [{a['category']}] {a['title']}")

main()
