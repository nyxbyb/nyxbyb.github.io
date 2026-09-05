#!/usr/bin/env python3
"""爬取豆瓣读书榜单，生成标准书目底图。仅用标准库。"""
import urllib.request, re, time, json, os, sys

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
BASE = os.path.expanduser("~/Desktop/Caelum")
OUT = os.path.join(BASE, "corpus", "books_raw.json")

def fetch(url):
    try:
        req = urllib.request.Request(url, headers=UA)
        return urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
    except Exception as e:
        print("  x %s -> %s" % (url, e), file=sys.stderr)
        return ""

def parse_top250(html):
    items = []
    for block in re.findall(r'<tr class="item">.*?</tr>', html, re.S):
        t = re.search(r'title="([^"]+)"', block)
        a = re.search(r'<p class="pl">(.*?)</p>', block, re.S)
        r = re.search(r'<span class="rating_nums">([\d.]+)</span>', block)
        if t:
            author = ""
            if a:
                parts = a.group(1).strip().split("/")
                author = re.sub(r'<[^>]+>', '', parts[0]).strip() if parts else ""
            items.append({
                "title": t.group(1),
                "author": author,
                "rating": float(r.group(1)) if r else None,
                "source": "douban_top250",
            })
    return items

def main():
    books, seen = [], set()
    for start in range(0, 250, 25):
        print("Top250 page %d ..." % (start // 25 + 1))
        html = fetch("https://book.douban.com/top250?start=%d" % start)
        for b in parse_top250(html):
            if b["title"] not in seen:
                seen.add(b["title"])
                books.append(b)
        time.sleep(2)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(books, open(OUT, "w"), ensure_ascii=False, indent=2)
    print("\nDONE: %d books -> %s" % (len(books), OUT))

if __name__ == "__main__":
    main()
