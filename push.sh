#!/usr/bin/env bash
set -e
MSG=${1:-"update: sync site changes"}
echo "Committing and pushing with message: $MSG"
git add -A
git commit -m "$MSG" || echo "No changes to commit"
git push origin main
echo "Pushed to origin/main"
