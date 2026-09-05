#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
凿星图 · 书单底图爬虫
抓取豆瓣读书各类 Top 榜单,输出结构化书目(JSON),供后续嵌入/建图使用。
全程本地运行,礼貌限速,缓存原始 HTML 避免重复请求。
"""
import json
import os
import re
import time
import random
import urllib.request
import urllib.parse
from html import unescape

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cache")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def fetch(url: str) -> str:
    """带缓存的礼貌抓取。"""
    key = re.sub(r"[^A-Za-z0-9]+", "_", url)[:120] + ".html"
    path = os.path.join(CACHE_DIR, key)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode("utf-8", "ignore")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    time.sleep(random.uniform(1.5, 3.0))  # 礼貌限速
    return html


def parse_top250_page(html: str):
    """解析豆瓣 top250 单页,返回 [(title, author, rating, link, quote)]。"""
    items = []
    # 每本书在一个 <tr class="item"> 块里
    for block in re.findall(r'<tr class="item">(.*?)</tr>', html, re.S):
        m_title = re.search(r'title="([^"]+)"', block)
        m_link = re.search(r'href="(https://book\.douban\.com/subject/\d+/)"', block)
        m_rating = re.search(r'<span class="rating_nums">([\d.]+)</span>', block)
        m_pl = re.search(r'<p class="pl">(.*?)</p>', block, re.S)
        m_quote = re.search(r'<span class="inq">(.*?)</span>', block, re.S)
        if not m_title:
            continue
        author = ""
        if m_pl:
            parts = unescape(m_pl.group(1)).strip().split("/")
            if parts:
                author = parts[0].strip()
        items.append({
            "title": unescape(m_title.group(1)).strip(),
            "author": author,
            "rating": float(m_rating.group(1)) if m_rating else None,
            "link": m_link.group(1) if m_link else "",
            "quote": unescape(m_quote.group(1)).strip() if m_quote else "",
        })
    return items


def crawl_top250():
    """豆瓣读书 Top250,共 10 页 x 25 本。"""
    books = []
    for start in range(0, 250, 25):
        url = f"https://book.douban.com/top250?start={start}"
        print(f"  Top250 start={start}")
        books += parse_top250_page(fetch(url))
    return books


def crawl_tag(tag: str, pages: int = 2):
    """豆瓣某个标签下的高分书(按评分排序)。"""
    books = []
    for p in range(pages):
        start = p * 20
        url = f"https://book.douban.com/tag/{urllib.parse.quote(tag)}?start={start}&type=R"
        print(f"  tag={tag} start={start}")
        html = fetch(url)
        for block in re.findall(r'<li class="subject-item">(.*?)</li>', html, re.S):
            m_title = re.search(r'title="([^"]+)"', block)
            m_link = re.search(r'href="(https://book\.douban\.com/subject/\d+/)"', block)
            m_rating = re.search(r'<span class="rating_nums">([\d.]+)</span>', block)
            m_pub = re.search(r'<div class="pub">(.*?)</div>', block, re.S)
            if not m_title:
                continue
            author = ""
            if m_pub:
                parts = unescape(m_pub.group(1)).strip().split("/")
                if parts:
                    author = parts[0].strip()
            books.append({
                "title": unescape(m_title.group(1)).strip(),
                "author": author,
                "rating": float(m_rating.group(1)) if m_rating else None,
                "link": m_link.group(1) if m_link else "",
                "quote": "",
            })
    return books


# 中文世界主流好书的重点分类(豆瓣标签)
TAGS = [
    "小说", "外国文学", "文学", "中国文学", "经典", "哲学", "随笔",
    "历史", "心理学", "社会", "诗歌", "散文", "传记", "科幻",
    "魔幻", "推理", "思想", "政治", "经济", "艺术",
]


def main():
    all_books = {}

    print("== 抓取豆瓣 Top250 ==")
    for b in crawl_top250():
        all_books[b["title"] + "|" + b["author"]] = b

    print("== 抓取分类榜单 ==")
    for tag in TAGS:
        try:
            for b in crawl_tag(tag, pages=2):
                key = b["title"] + "|" + b["author"]
                # 保留评分更高/信息更全的那条
                if key not in all_books or (b.get("rating") or 0) > (all_books[key].get("rating") or 0):
                    all_books[key] = b
        except Exception as e:
            print(f"  [warn] tag={tag} 失败: {e}")

    books = sorted(all_books.values(), key=lambda x: -(x.get("rating") or 0))
    out = os.path.join(OUT_DIR, "books_raw.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 共 {len(books)} 本书 → {out}")


if __name__ == "__main__":
    main()
