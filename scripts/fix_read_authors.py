#!/usr/bin/env python3
"""给已读书目补真实作者：微信读书/高中/读书笔记合并进来的 133 本书，
author 字段是 "微信读书 · X月读完" 占位。用豆瓣搜索接口按书名反查真实作者。
结果写回 corpus/books_raw.json（书名规范化匹配），供 embed_map.py 下次合并用。
"""
import json, re, sys, time, urllib.request, html as htmlmod

BASE = "/Users/bao/Desktop/Caelum"
RAW = f"{BASE}/corpus/books_raw.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

def norm(t):
    t = re.sub(r'[（(【\[].*?[)）\]】]', '', t or '')
    t = re.sub(r'[\s：:·—\-_,.、！!？?·~～]', '', t)
    return t

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read().decode("utf-8", "ignore")
    except Exception as e:
        print(f"  ✗ {e}", file=sys.stderr)
        return ""

def search_author(title):
    """豆瓣搜索页第一本书 → (title, author)。"""
    h = fetch(f"https://www.douban.com/search?cat=1001&q={urllib.parse.quote(title)}")
    if not h:
        return None
    m = re.search(r'<h3>\s*<a[^>]*>([^<]+)</a>', h)
    # 豆瓣 search 结果: subject/author 在 span.grey 或 h3 后的 pi
    blocks = re.findall(r'<div class="result">.*?</div>\s*</div>', h, re.S)
    for blk in blocks[:3]:
        mt = re.search(r'<h3[^>]*>\s*<a[^>]*>([^<]+)</a>', blk)
        if not mt:
            continue
        t = htmlmod.unescape(mt.group(1)).strip()
        ma = re.search(r'class="subject-callee">([^/]+)<', blk) or re.search(r'<p[^>]*>([^<]+)/', blk)
        if not ma:
            ma = re.search(r'>\s*([^<>／/]+)\s*/', blk)
        author = htmlmod.unescape(ma.group(1)).strip() if ma else ""
        return (t, author)
    return None

def main():
    # 1. 找出当前 graph.json 里伪作者的已读书
    g = json.load(open(f"{BASE}/web/public/data/graph.json"))
    bad = [n["title"] for n in g["nodes"]
           if (n["author"] or "").startswith(("微信读书", "高中", "读书笔记"))]
    print(f"伪作者已读: {len(bad)} 本")

    # 2. raw 里建规范化索引
    raw = json.load(open(RAW))
    idx = {}
    for b in raw:
        t = b.get("title", "").strip()
        if t:
            idx.setdefault(norm(t), []).append(b)

    # 3. 缓存（本地，防重复搜）
    CACHE = f"{BASE}/data/公众号/_backup/author_cache.json"
    cache = json.load(open(CACHE)) if __import__("os").path.exists(CACHE) else {}

    # 4. 逐本补
    fixed = 0
    for title in bad:
        key = norm(title)
        if key in idx:
            continue  # 已在 raw 里，embed 合并时会自然接上
        if title in cache:
            author = cache[title]
        else:
            r = search_author(title)
            author = r[1] if r else ""
            cache[title] = author
            time.sleep(1.5)
        if author:
            raw.append({"title": title, "author": author, "rating": None,
                        "link": "", "source": "read-authors"})
            idx[key] = [{"title": title, "author": author}]
            fixed += 1
            print(f"  ✓ {title[:22]} → {author}")
        else:
            print(f"  ? {title[:22]} → 查无")
    json.dump(cache, open(CACHE, "w"), ensure_ascii=False, indent=1)
    json.dump(raw, open(RAW, "w"), ensure_ascii=False)
    print(f"补全 {fixed}/{len(bad)}，raw 现 {len(raw)} 本 → 重跑 embed_map.py 生效")

if __name__ == "__main__":
    main()
