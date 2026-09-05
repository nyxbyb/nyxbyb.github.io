#!/usr/bin/env python3
"""凿星图 · 豆瓣书目爬虫（统一版）
抓取 豆瓣 Top250 + 各分类热门榜，输出前端用 books_raw.json。
兼容两种 HTML 结构：
  - Top250:      <tr class="item"> ... </tr>
  - 分类标签页:  <li class="subject-item"> ... </li>
只抓 title/author/rating/link，去重后合并。礼貌限速。
"""
import json, os, re, sys, time, html as htmlmod, urllib.request, urllib.parse

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
BASE = os.path.expanduser("~/Desktop/Caelum")
OUT = os.path.join(BASE, "corpus/books_raw.json")

TAGS = ["文学", "小说", "哲学", "历史", "科幻", "诗歌", "心理学", "社会学",
        "传记", "艺术", "思想", "随笔", "中国文学", "外国文学"]
TOP250_PAGES = [0, 25, 50, 75, 100, 125, 150, 175, 200, 225]
TAG_PAGES = [0, 20, 40, 60]

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read().decode("utf-8", "ignore")
    except Exception as e:
        print(f"  ✗ {url.split('?')[0]} -> {e}", file=sys.stderr)
        return ""

def clean(s):
    return htmlmod.unescape(s).strip()

def parse_item_html(h):
    """从一段 item 块提取 title/author/rating/link。"""
    m = re.search(r'title="([^"]+)"', h)
    title = clean(m.group(1)) if m else None
    if not title:
        return None
    m = re.search(r'href="(https://book\.douban\.com/subject/\d+/)"', h)
    link = m.group(1) if m else ""
    m = re.search(r'class="pl">([^<]{0,120})<', h) or re.search(r'class="pub">([^<]{0,120})<', h)
    author = clean(m.group(1)).split("/")[0] if m else ""
    m = re.search(r'class="rating_nums">([\d.]+)<', h)
    rating = float(m.group(1)) if m else None
    return {"title": title, "author": author, "rating": rating, "link": link, "source": "douban"}

def parse_top250(h):
    out = []
    for blk in re.findall(r'<tr class="item">.*?</tr>', h, re.S):
        it = parse_item_html(blk)
        if it:
            out.append(it)
    return out

def parse_tag(h):
    out = []
    for blk in re.findall(r'<li class="subject-item">.*?</li>', h, re.S):
        it = parse_item_html(blk)
        if it:
            out.append(it)
    return out

def main():
    books, seen = [], set()

    print("== Top250（10页）==")
    for start in TOP250_PAGES:
        h = fetch(f"https://book.douban.com/top250?start={start}")
        items = parse_top250(h)
        for it in items:
            if it["title"] not in seen:
                seen.add(it["title"]); books.append(it)
        sys.stdout.write(f"  页 {start//25+1}: {len(items)} → 累计 {len(books)}\r")
        sys.stdout.flush()
        time.sleep(1.5)
    print()

    print("== 分类榜（%d 个标签）==" % len(TAGS))
    for tag in TAGS:
        for start in TAG_PAGES:
            h = fetch("https://book.douban.com/tag/%s?start=%d&type=T" % (urllib.parse.quote(tag), start))
            items = parse_tag(h)
            for it in items:
                if it["title"] not in seen:
                    seen.add(it["title"]); books.append(it)
        sys.stdout.write("  %-8s 累计 %d\n" % (tag, len(books)))
        sys.stdout.flush()
        time.sleep(1.5)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(books, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"\n✅ 共 {len(books)} 本（去重后）→ {OUT}")
    # 简要展示
    for b in books[:3]:
        print(f"   {b['title']} / {b['author'][:12]} / {b['rating']}")

if __name__ == "__main__":
    main()