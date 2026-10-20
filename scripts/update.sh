#!/bin/bash
# 凿星图 · 一键更新
# 用法: bash scripts/update.sh [message]
# 1) 构建并验证 web/ 中的正式网页
# 2) 提交公开网站文件
# 3) 推送 → GitHub 自动部署
# 星图重建是独立手动流程，见 docs/更新指南.md；普通发布不处理私人语料。
set -euo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-更新}"

echo "▶ 1/3 构建并验证网页（正式入口：web/index.html）"
npm --prefix web run build
npm --prefix web test

echo "▶ 2/3 提交公开网站文件"
git add -- web index.html .github/workflows docs scripts/update.sh
if git diff --cached --quiet; then
  echo "  (无变更可提交)"
else
  git commit -m "$MSG"
fi

echo "▶ 3/3 推送 → GitHub Actions 自动部署"
git push

echo "✅ 已推送，请在 GitHub Actions 查看部署结果：https://nyxbyb.github.io/web/"
