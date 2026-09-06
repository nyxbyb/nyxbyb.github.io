#!/bin/bash
# 凿星图 · 一键更新
# 用法: bash scripts/update.sh [message]
# 1) 重新生成星图数据(若有微信读书新记录)
# 2) 同步网页
# 3) 提交并推送 → GitHub 自动部署
set -e
cd "$(dirname "$0")/.."

MSG="${1:-更新}"

echo "▶ 1/4 重新嵌入+降维(若有新书/新读书记录)"
if [ -f corpus/books_raw.json ] || [ -f data/微信读书/reading_records_full.json ]; then
  .venv/bin/python scripts/embed_map.py 2>/dev/null || echo "  (跳过: 嵌入环境未就绪, 用已有 graph.json)"
fi

echo "▶ 2/4 同步网页入口"
cp caelum.html web/index.html

echo "▶ 3/4 提交"
git add -A
git commit -m "$MSG" || echo "  (无变更可提交)"

echo "▶ 4/4 推送 → GitHub Actions 自动部署"
git push

echo "✅ 已推送, 约 1 分钟后 https://nyxbyb.github.io 更新"