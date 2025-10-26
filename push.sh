#!/bin/bash
# =======================================
# Git 一键推送脚本 for awealy/xiaoshuo
# 作用：快速提交并推送所有修改到 GitHub
# =======================================

# 设置颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # 无色

# 输出开始信息
echo -e "${YELLOW}🚀 开始推送项目到 GitHub Pages...${NC}"

# 显示当前路径
echo -e "📂 当前目录: $(pwd)"

# 拉取最新版本，避免冲突
git pull origin main

# 添加所有修改
git add .

# 自动生成提交信息（含时间）
commit_message="更新网站内容: $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$commit_message"

# 推送到 GitHub
git push origin main

# 输出完成信息
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ 推送成功！请稍等几分钟后访问：${NC}"
  echo -e "${YELLOW}👉 https://awealy.github.io/xiaoshuo${NC}"
else
  echo -e "${YELLOW}❌ 推送失败，请检查网络或 Git 配置。${NC}"
fi
