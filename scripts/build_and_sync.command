#!/bin/bash
cd "$(dirname "$0")/.."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔨 coordimentor 빌드 & Android 동기화"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📦 1/2  React 앱 빌드 중..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ 빌드 실패!"
  read -p "Enter를 눌러 종료..."
  exit 1
fi
echo ""

echo "📱 2/2  Android에 웹 에셋 동기화 중..."
npx cap sync android
if [ $? -ne 0 ]; then
  echo "❌ cap sync 실패!"
  read -p "Enter를 눌러 종료..."
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 완료! Android Studio에서 Run 버튼을 누르세요."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "Enter를 눌러 창을 닫으세요..."
