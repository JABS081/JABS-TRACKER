#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

REPO_URL="${1:-}"
if [ -z "$REPO_URL" ]; then
  echo "Usage: ./scripts/termux-deploy.sh https://github.com/JABS081/YOUR-REPO.git"
  exit 1
fi

npm install
npm run build

git init -b main
git add .
git commit -m "Build JABS TRACKER production foundation" || true
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git push -u origin main

echo "JABS TRACKER pushed successfully. Configure Vercel environment variables before production deployment."
