/**
 * UpscalerJS (ESRGAN-Slim) 기반 AI 이미지 업스케일 유틸
 * 모델은 처음 호출 시 lazy-load 되어 이후 재사용됨
 */

let upscalerInstance = null;

/**
 * 이미지 업스케일 (2x AI 초해상도)
 * @param {string} dataUrl  입력 이미지 data URL
 * @param {function} onProgress  진행 콜백 (0~1)
 * @returns {Promise<string>}  업스케일된 data URL (PNG)
 */
export async function upscaleImage(dataUrl, onProgress) {
  // 1. UpscalerJS 인스턴스 lazy-load
  if (!upscalerInstance) {
    onProgress?.(0.1);
    const { default: Upscaler } = await import('upscaler');
    const { default: model }   = await import('@upscalerjs/esrgan-slim');
    upscalerInstance = new Upscaler({ model });
    onProgress?.(0.3);
  }

  // 2. 이미지 로드
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload  = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  onProgress?.(0.5);

  // 3. 업스케일
  const result = await upscalerInstance.upscale(img, {
    output: 'base64',
    progressCallback: ({ percent }) => {
      onProgress?.(0.5 + percent * 0.5);
    },
  });
  onProgress?.(1.0);

  // upscaler returns base64 string → prefix 추가
  if (result.startsWith('data:')) return result;
  return `data:image/png;base64,${result}`;
}
