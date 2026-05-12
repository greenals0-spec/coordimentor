/**
 * 가상 피팅 결과에 원본 사진의 얼굴 영역을 Canvas로 덮어씌워
 * 얼굴 변형을 방지하는 유틸리티
 *
 * 원리:
 *  1. 원본 사진에서 얼굴 영역(상단 25%, 가로 중앙 70%)을 추출
 *  2. 하단 경계를 그라디언트 페이딩으로 자연스럽게 블렌딩
 *  3. 피팅 결과 이미지 위에 덮어씌움
 */

/**
 * @param {string} originalDataUrl  원본 모델 사진 (data URL 또는 http URL)
 * @param {string} tryOnDataUrl     가상 피팅 결과 이미지 (data URL)
 * @returns {Promise<string>}       얼굴 보존된 결과 data URL (JPEG)
 */
export async function preserveFace(originalDataUrl, tryOnDataUrl) {
  const [origImg, tryOnImg] = await Promise.all([
    loadImage(originalDataUrl),
    loadImage(tryOnDataUrl),
  ]);

  const W = tryOnImg.naturalWidth;
  const H = tryOnImg.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 1. 피팅 결과를 베이스로 그리기
  ctx.drawImage(tryOnImg, 0, 0, W, H);

  // 2. 얼굴 영역 파라미터 (전신 사진 기준)
  //    - 세로: 상단 25%
  //    - 가로: 중앙 70%
  const faceHeightRatio = 0.25;
  const faceWidthRatio  = 0.70;

  const faceH = Math.round(H * faceHeightRatio);
  const faceW = Math.round(W * faceWidthRatio);
  const faceX = Math.round((W - faceW) / 2);

  const origW = origImg.naturalWidth;
  const origH = origImg.naturalHeight;
  const origFaceH = Math.round(origH * faceHeightRatio);
  const origFaceW = Math.round(origW * faceWidthRatio);
  const origFaceX = Math.round((origW - origFaceW) / 2);

  // 3. 오프스크린 캔버스에 원본 얼굴 영역 추출
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width  = faceW;
  faceCanvas.height = faceH;
  const faceCtx = faceCanvas.getContext('2d');

  faceCtx.drawImage(
    origImg,
    origFaceX, 0, origFaceW, origFaceH,  // 원본 소스 영역
    0,         0, faceW,     faceH,       // 타겟 영역
  );

  // 4. 하단 그라디언트 페이딩 (자연스러운 블렌딩)
  //    위 60% → 완전 불투명, 아래 40% → 투명
  const fadeStartY = faceH * 0.60;
  const gradient = faceCtx.createLinearGradient(0, fadeStartY, 0, faceH);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  faceCtx.globalCompositeOperation = 'destination-in';
  faceCtx.fillStyle = gradient;
  faceCtx.fillRect(0, 0, faceW, faceH);

  // 5. 얼굴 영역을 피팅 결과 위에 합성
  ctx.drawImage(faceCanvas, faceX, 0, faceW, faceH);

  return canvas.toDataURL('image/jpeg', 0.93);
}

/** URL/dataURL → HTMLImageElement 로드 헬퍼 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
