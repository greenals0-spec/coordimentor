import { Capacitor } from '@capacitor/core';

/**
 * base64 data URL → JPG로 변환 후 갤러리 저장 (네이티브) / 파일 다운로드 (웹)
 */
export async function saveImageAsJpg(dataUrl, fileNamePrefix = 'coordimentor_tryon') {
  const jpgDataUrl = await convertToJpg(dataUrl);
  const base64Data = jpgDataUrl.split(',')[1];
  const fileName = `${fileNamePrefix}_${Date.now()}.jpg`;

  if (Capacitor.isNativePlatform()) {
    // ── 네이티브: @capacitor-community/media로 갤러리에 직접 저장 ──
    try {
      const { Media } = await import('@capacitor-community/media');

      // 임시 파일로 캐시에 저장
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      // 갤러리(사진첩)에 저장
      await Media.savePhoto({ path: writeResult.uri });

      alert('갤러리에 저장되었습니다!');
    } catch (e) {
      console.error('갤러리 저장 실패:', e);
      alert(`저장 실패: ${e.message || e}`);
    }
  } else {
    // ── 웹: JPG 파일 직접 다운로드 ──
    const a = document.createElement('a');
    a.href = jpgDataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/** PNG/JPEG data URL → JPEG data URL (Canvas, 즉시 변환) */
function convertToJpg(dataUrl, quality = 0.93) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
