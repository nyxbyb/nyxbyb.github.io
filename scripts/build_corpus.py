#!/usr/bin/env python3
"""把 books_raw.json 转成标准语料库：每本书一个 markdown 文件（带 front-matter）。
默认全部标为 unread，等你之后在网站上勾选'已读'。"""
import json, os, re

RAW = os.path.expanduser("~/Desktop/Caelum/corpus/books_raw.json")
OUTDIR = os.path.expanduser("~/Desktop/Caelum/corpus/books")

def slug(s):
    # 用书名做文件名，去掉非法字符
    s = re.sub(r'[\\/:*?"<>|\s]+', "_", s)
    return s[:60]

def main():
    books = json.load(open(RAW))
    os.makedirs(OUTDIR, exist_ok=True)
    n = 0
    for i, b in enumerate(books, 1):
        title, author, rating = b["title"], b.get("author", ""), b.get("rating")
        fn = os.path.join(OUTDIR, f"{slug(title)}.md")
        rating_line = f"rating_douban: {rating}" if rating else ""
        body = f"《{title}》 作者：{author}。豆瓣评分 {rating}。" if rating else f"《{title}》 作者：{author}。"
        md = f"""---
id: book_{i:04d}
type: book
title: {title}
author: {author}
status: unread
rating:
read_date:
tags: []
link:
{rating_line}
---

{body}
"""
        with open(fn, "w") as f:
            f.write(md)
        n += 1
    print(f"✅ 生成 {n} 个书目文件 -> {OUTDIR}")

if __name__ == "__main__":
    main()
