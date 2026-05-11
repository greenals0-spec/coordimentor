import { Capacitor } from '@capacitor/core';

/**
 * base64 data URL(PNG/JPEG) → JPG로 변환 후 저장/공유
 * - 네이티브(Android/iOS): Filesystem에 캐시 저장 후 Share 시트 오픈 → 갤러리 저장 가능
 * - 웹: <a download> 트릭으로 JPG 다운로드
 */
export async function saveImageAsJpg(dataUrl, fileNamePrefix = 'coordimentor_tryon') {
  // ── 1. Canvas로 JPG 변환 ──────────────────────────────────────────────────
  const jpgDataUrl = await convertToJpg(dataUrl);
  const base64Data = jpgDataUrl.split(',')[1];
  const fileName = `${fileNamePrefix}_${Date.now()}.jpg`;

  // ── 2. 플랫폼 분기 ──────────────────────────────────────────────────────
  if (Capacitor.isNativePlatform()) {
    // Capacitor: 캐시 디렉토리에 파일 저장 후 공유 시트
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const writeResult = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    await Share.share({
      title: 'Coordimentor 가상 착장',
      text: 'AI가 생성한 가상 착장 이미지를 저장해보세요!',
      files: [writeResult.uri],
      dialogTitle: '이미지 저장',
    });
  } else {
    // 웹: 앵커 클릭 다운로드
    const a = document.createElement('a');
    a.href = jpgDataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/** PNG/JPEG data URL → JPEG data URL (Canvas 사용, 즉시 변환) */
function convertToJpg(dataUrl, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      // JPG는 투명 배경 미지원 → 흰 배경 채우기
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
