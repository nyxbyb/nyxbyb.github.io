#!/bin/bash
cd ~/Desktop/Caelum
echo "▶ 第一步：环境检查"
bash scripts/env_check.sh
echo ""
echo "▶ 第二步：爬豆瓣 Top250"
python3 scripts/fetch_douban.py
echo ""
echo "✅ 全部完成"
