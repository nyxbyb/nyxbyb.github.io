#!/usr/bin/env bash
# 凿星图 · 豆瓣书单爬虫
# 抓取豆瓣 Top250 + 各分类榜,输出原始 HTML 到 raw/,解析出的书名到 books_raw.tsv
set -u
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
mkdir -p raw
OUT=books_raw.tsv
: > "$OUT"

fetch () {  # $1=url  $2=outfile
  curl -s -A "$UA" --retry 3 --retry-delay 2 --max-time 30 "$1" -o "$2"
  sleep 1.5   # 礼貌限速,别把豆瓣打挂
}

parse_top () { # 解析 top250 页里的书名
  grep -oE 'title="[^"]+"' "$1" | sed -E 's/title="//; s/"$//' \
    | grep -vE '可试读|试读|详情|豆瓣|购书单'
}

echo "== 1) 豆瓣 Top250 (11 页) =="
for start in 0 25 50 75 100 125 150 175 200 225 250; do
  f="raw/top250_$start.html"
  fetch "https://book.douban.com/top250?start=$start" "$f"
  parse_top "$f" >> "$OUT"
  echo "  top250 start=$start -> $(parse_top "$f" | wc -l | tr -d ' ') 本"
done

echo "== 2) 豆瓣分类热门榜 =="
# 小说 文学 哲学 历史 科幻 悬疑 社科 心理 经济 艺术
for tag in 小说 文学 哲学 历史 科幻 悬疑 社科 心理 经济 艺术; do
  for start in 0 20 40 60 80; do
    f="raw/tag_${tag}_$start.html"
    fetch "https://book.douban.com/tag/$tag?start=$start&type=T" "$f"
    parse_top "$f" >> "$OUT"
  done
  echo "  分类 $tag 完成"
done

echo "== 完成,去重前 $(wc -l < "$OUT" | tr -d ' ') 行 =="
