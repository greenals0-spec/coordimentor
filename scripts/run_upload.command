#!/bin/bash
cd "$(dirname "$0")/.."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎽 coordimentor 샘플 이미지 생성기"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  작업 폴더: $(pwd)"
echo ""
node_version=$(node --version 2>/dev/null)
if [ -z "$node_version" ]; then
  echo "❌ Node.js가 필요합니다. https://nodejs.org 에서 설치해주세요."
  read -p "Enter를 눌러 종료..."
  exit 1
fi
echo "  Node.js: $node_version"
echo ""
echo "🚀 34개 의상 이미지 생성 중... (약 3~5분 소요)"
echo ""
node scripts/upload-sample-images.mjs
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "완료! Enter를 눌러 창을 닫으세요..."
