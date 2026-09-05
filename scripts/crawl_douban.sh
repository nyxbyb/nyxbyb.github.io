#!/bin/bash
# 凿星图 · 豆瓣书单爬虫
# 抓取豆瓣 Top250 + 各分类高分榜，输出原始 HTML 供后续解析
set -e
mkdir -p /Users/bao/Desktop/Caelum/data/raw
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

fetch() {
  local url="$1" out="$2"
  curl -s -A "$UA" -H "Accept-Language: zh-CN,zh;q=0.9" "$url" -o "$out" -w "HTTP %{http_code}  $out  (%{size_download}B)\n"
  sleep 2   # 礼貌限速，避免被豆瓣封
}

echo "===== 1. 豆瓣 Top250 (11页 × 25本) ====="
for i in 0 25 50 75 100 125 150 175 200 225 250; do
  fetch "https://book.douban.com/top250?start=$i" "/Users/bao/Desktop/Caelum/data/raw/top250_$i.html"
done

echo "===== 2. 豆瓣分类高分榜 (tag页, 按评分排序) ====="
# 文学 / 小说 / 哲学 / 历史 / 科幻 / 社科 / 心理学 / 散文 / 诗歌
for tag in 文学 小说 哲学 历史 科幻 社科 心理学 散文 诗歌 随笔; do
  for start in 0 20 40; do
    fetch "https://book.douban.com/tag/${tag}?start=${start}&type=S" "/Users/bao/Desktop/Caelum/data/raw/tag_${tag}_${start}.html"
  done
done

echo "===== 完成 ====="
ls -la /Users/bao/Desktop/Caelum/data/raw/ | wc -l
