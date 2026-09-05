#!/bin/bash
# 凿星图 · 豆瓣书单爬虫
# 抓取 豆瓣Top250 + 各分类榜，输出统一 TSV: 标题 \t 作者 \t 评分 \t 豆瓣链接
# 全程 curl + 文本解析，不依赖 Python 库，最稳。

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
OUT_DIR="$(cd "$(dirname "$0")" && pwd)/raw"
mkdir -p "$OUT_DIR"
TSV="$OUT_DIR/douban_all.tsv"
: > "$TSV"   # 清空

fetch () {  # fetch <url> <outfile>
  curl -s -A "$UA" --retry 3 --retry-delay 2 --max-time 30 "$1" -o "$2"
}

# 解析豆瓣 Top250 类页面：提取 <a href="链接" ...> <span class="title">标题</span> 和 <p class="pl">作者</p> 与评分
parse_top () {  # parse_top <htmlfile>
  python3 - "$1" <<'PY'
import sys, re, html
f = sys.argv[1]
try:
    t = open(f, encoding='utf-8', errors='ignore').read()
except Exception as e:
    sys.exit(0)
# 每个格子 <div class="item"> ... </div>
items = re.findall(r'<div class="item">(.*?)</table>', t, re.S)
for it in items:
    mlink = re.search(r'<a href="([^"]+)"[^>]*class="nbg"', it) or re.search(r'<a href="(https://book\.douban\.com/subject/\d+/)"', it)
    mtitle = re.search(r'title="([^"]+)"', it) or re.search(r'<span class="title">([^<]+)</span>', it)
    mauthor = re.search(r'<p class="pl">([^<]+)</p>', it)
    mrate = re.search(r'<span class="rating_nums">([^<]+)</span>', it)
    if not mtitle:
        continue
    title = html.unescape(mtitle.group(1)).strip()
    link = mlink.group(1) if mlink else ''
    author = ''
    if mauthor:
        # 形如 "  [美] 哈珀·李 / 李育超 / 译林出版社 / 2012-9 / 9.2 "
        author = html.unescape(mauthor.group(1)).strip().split('/')[0].strip()
    rate = mrate.group(1).strip() if mrate else ''
    print(f"{title}\t{author}\t{rate}\t{link}")
PY
}

add_url () {  # add_url <url>
  tmp=$(mktemp)
  fetch "$1" "$tmp"
  parse_top "$tmp" >> "$TSV"
  rm -f "$tmp"
  sleep 2   # 礼貌限速，避免被封
}

echo "== 抓豆瓣 Top250 (11页) =="
for start in 0 25 50 75 100 125 150 175 200 225 250; do
  add_url "https://book.douban.com/top250?start=$start"
done

echo "== 抓分类热门榜 =="
# 豆瓣图书标签热门：文学 小说 哲学 历史 科幻 诗歌 心理 社会 等
for tag in 文学 小说 哲学 历史 科幻 诗歌 心理学 社会学 传记 艺术 思想 随笔; do
  for start in 0 20 40 60; do
    add_url "https://book.douban.com/tag/${tag}?start=${start}&type=T"
  done
done

echo "== 去重、排序 =="
awk -F'\t' '!seen[$1]++' "$TSV" > "$OUT_DIR/douban_books.tsv"
echo "共 $(wc -l < "$OUT_DIR/douban_books.tsv") 本（去重后）"
head -5 "$OUT_DIR/douban_books.tsv"
