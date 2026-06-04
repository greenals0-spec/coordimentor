const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
// 이미지 생성(출력)을 지원하는 모델 목록 (순서대로 시도, 2026년 5월 기준)
const TRYON_MODELS = [
  'gemini-3.1-flash-image-preview', // 최신·빠름 (유료 전환 후 503 거의 없음)
  'gemini-2.5-flash-image',         // 폴백 1
  'gemini-2.0-flash-exp',           // 폴백 2 — 안정적이지만 느림
];
const makeEndpoint = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * 단일 의류 Virtual Try-On (REST API 직접 호출)
 * @param {string} personImageUrl  사람 사진 (URL 또는 base64 data URL)
 * @param {string} garmentImageUrl 의류 이미지 (URL 또는 base64 data URL)
 * @param {string} category        '상의' | '하의' | '아우터' | '신발' | '액세서리'
 * @returns {Promise<string>}      base64 data URL 결과 이미지
 */
export async function runVirtualTryOn(personImageUrl, garmentImageUrl, category) {
  const personPart  = await toInlinePart(personImageUrl);
  const garmentPart = await toInlinePart(garmentImageUrl);

  const categoryDesc =
    category === '상의'    ? 'top / upper body clothing' :
    category === '하의'    ? 'bottom / lower body clothing (pants, skirt, etc.)' :
    category === '아우터'   ? 'outer layer / jacket / coat worn over the existing outfit' :
    category === '신발'    ? 'shoes / footwear — place naturally on the person\'s feet' :
    category === '액세서리' ? 'fashion accessory (bag, belt, hat, scarf, jewelry, etc.) — add naturally to the outfit' :
    category;

  const prompt = `You are a fashion AI specializing in virtual try-on. Your top priority is to preserve the original person's identity exactly.

Two images are provided:
1. A person's full-body REFERENCE photo — this is the GROUND TRUTH for the person's identity.
2. A single clothing/accessory item: ${categoryDesc}.

IDENTITY PRESERVATION (HIGHEST PRIORITY — NON-NEGOTIABLE):
- The person's FACE must be reproduced pixel-perfectly from the reference photo. Same facial features, same expression, same eye shape, same nose, same lips, same hairstyle, same hair color.
- The person's SKIN TONE must match the reference photo exactly.
- The person's BODY PROPORTIONS, HEIGHT, and BUILD must remain identical.
- The person's POSE and POSITION must remain identical.
- NEVER alter or "improve" the person's face or body. Copy them exactly as they appear in the reference.

CLOTHING TASK:
- Naturally overlay or place the item onto the person.
- TOP → replace/overlay upper body clothing.
- BOTTOM → replace/overlay lower body clothing.
- OUTER LAYER → drape over the existing outfit without hiding it completely.
- SHOES → replace the existing footwear or place on bare feet naturally.
- ACCESSORY → add to the appropriate location (bag for hands, hat for head, wrist for watch, etc.) without covering the outfit.
- Add realistic shadows and fabric/material texture to the clothing only.

CRITICAL OUTPUT RULES:
  1. The output MUST be EXACTLY ONE single image containing ONLY ONE person.
  2. ABSOLUTELY NO collages, NO 3-panel layouts, NO grids, NO side-by-side comparisons.
  3. The single image MUST show the COMPLETE FULL BODY from head to toe without any cropping.
  4. Background must remain unchanged from the reference photo.
- Return ONLY the single full-body photo-realistic result image. No text overlay.`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { text: '[IMAGE 1 — PERSON REFERENCE PHOTO: Copy this person\'s face, hair, skin tone, and body exactly]' },
        personPart,
        { text: '[IMAGE 2 — CLOTHING ITEM: Apply this item onto the person above]' },
        garmentPart,
      ],
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  // 모델 목록을 순서대로 시도 (404/400이면 다음 모델로)
  return await callTryOnApi(requestBody);
}

async function callTryOnApi(requestBody) {
  let res = null;
  let usedModel = null;
  let lastErrText = 'No response'; // body를 두 번 읽지 않도록 마지막 에러 저장
  for (const model of TRYON_MODELS) {
    console.log(`[TryOn] Trying model: ${model}`);
    // 60초 타임아웃 설정 (무한 로딩 방지)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      res = await fetch(makeEndpoint(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        console.warn(`[TryOn] ${model} 60초 타임아웃`);
        lastErrText = `${model} 타임아웃`;
        res = null;
        continue; // 다음 모델 시도
      }
      throw e;
    }
    clearTimeout(timeoutId);
    // 200번대 성공이면 사용, 그 외 에러코드면 다음 모델 시도
    if (res.ok) {
      usedModel = model;
      break;
    }
    // body는 한 번만 읽고 저장 (iOS WebKit: "Body is disturbed or locked" 방지)
    lastErrText = await res.text();
    console.warn(`[TryOn] ${model} failed (${res.status}): ${lastErrText.slice(0, 200)}`);
    res = null; // 소비된 response 초기화
  }

  if (!res || !res.ok) {
    console.error('Gemini API error:', lastErrText);
    throw new Error(`Gemini API 오류: ${lastErrText.slice(0, 300)}`);
  }
  console.log(`[TryOn] Success with model: ${usedModel}`);

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts ?? [];

  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (imagePart) {
    const { mimeType, data } = imagePart.inlineData;
    return `data:${mimeType};base64,${data}`;
  }

  const textPart = parts.find(p => p.text);
  console.error('Try-on returned text only:', textPart?.text ?? '(empty)', json);
  throw new Error('모델이 이미지를 반환하지 않았습니다.');
}


async function createFlatlayImage(steps) {
  return new Promise(async (resolve, reject) => {
    try {
      const SIZE = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, SIZE, SIZE);

      const count = steps.length;
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const cellW = SIZE / cols;
      const cellH = SIZE / rows;

      for (let i = 0; i < count; i++) {
        const step = steps[i];
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        await new Promise((res, rej) => {
          img.onload = () => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const pad = 20;
            const targetX = col * cellW + pad;
            const targetY = row * cellH + pad;
            const targetW = cellW - pad * 2;
            const targetH = cellH - pad * 2;
            
            const ratio = Math.min(targetW / img.width, targetH / img.height);
            const drawW = img.width * ratio;
            const drawH = img.height * ratio;
            const drawX = targetX + (targetW - drawW) / 2;
            const drawY = targetY + (targetH - drawH) / 2;
            
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            
            ctx.fillStyle = '#000000';
            ctx.font = '24px sans-serif';
            ctx.fillText(step.category, drawX, drawY + 24);
            res();
          };
          img.onerror = rej;
          img.src = step.item.imageUrl;
        });
      }
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    } catch (e) {
      reject(e);
    }
  });
}

export async function runFlatlayTryOn(modelPhoto, recommendation, onProgress) {
  const steps = [
    { item: recommendation.top,       category: '상의',    label: '상의' },
    { item: recommendation.bottom,    category: '하의',    label: '하의' },
    { item: recommendation.outer,     category: '아우터',   label: '아우터' },
    { item: recommendation.shoes,     category: '신발',    label: '신발' },
    { item: recommendation.accessory, category: '액세서리', label: '액세서리' },
  ].filter(s => s.item?.imageUrl);

  if (steps.length === 0) throw new Error('입혀볼 아이템이 없습니다.');

  onProgress?.(1, 2, '코디 묶음 생성 중');
  const flatlayDataUrl = await createFlatlayImage(steps);

  onProgress?.(2, 2, 'AI 일괄 착장 중');
  
  const personPart  = await toInlinePart(modelPhoto);
  const flatlayPart = await toInlinePart(flatlayDataUrl);

  const categoriesDesc = steps.map(s => s.category).join(', ');

  const prompt = `You are a fashion AI specializing in virtual try-on. Your top priority is to preserve the original person's identity exactly.

Two images are provided:
1. A person's full-body REFERENCE photo — this is the GROUND TRUTH for the person's identity.
2. A single "Flatlay" collage containing multiple clothing/accessory items: ${categoriesDesc}.

IDENTITY PRESERVATION (HIGHEST PRIORITY — NON-NEGOTIABLE):
- The person's FACE must be reproduced pixel-perfectly from the reference photo. Same facial features, same expression, same eye shape, same nose, same lips, same hairstyle, same hair color.
- The person's SKIN TONE must match the reference photo exactly.
- The person's BODY PROPORTIONS, HEIGHT, and BUILD must remain identical.
- The person's POSE and POSITION must remain identical.
- NEVER alter or "improve" the person's face or body. Copy them exactly as they appear in the reference.

CLOTHING TASK:
- You MUST naturally overlay and place EVERY SINGLE ITEM shown in the flatlay onto the person at the same time.
- DO NOT OMIT ANY ITEM. If there are shoes in the flatlay, they MUST be on the person's feet. If there is a top and bottom, BOTH MUST be worn.
- TOP → replace/overlay upper body clothing.
- BOTTOM → replace/overlay lower body clothing.
- OUTER LAYER → drape over the existing outfit.
- SHOES → replace the existing footwear or place on bare feet naturally.
- ACCESSORY → add to the appropriate location (bag for hands, hat for head, etc).
- CRITICAL: Accurately maintain the exact color, texture, and pattern of each item. DO NOT mix the texture of the top with the bottom.
- Add realistic shadows and fabric/material texture to the clothing only.

CRITICAL OUTPUT RULES:
  1. The output MUST be EXACTLY ONE single image containing ONLY ONE person.
  2. ABSOLUTELY NO collages, NO 3-panel layouts, NO grids, NO side-by-side comparisons.
  3. The single image MUST show the COMPLETE FULL BODY from head to toe without any cropping.
  4. Background must remain unchanged from the reference photo.
- Return ONLY the single full-body photo-realistic result image. No text overlay.`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { text: '[IMAGE 1 — PERSON REFERENCE PHOTO: Copy this person\'s face, hair, skin tone, and body exactly]' },
        personPart,
        { text: '[IMAGE 2 — CLOTHING FLATLAY: Apply these clothing items onto the person above]' },
        flatlayPart,
      ],
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  return await callTryOnApi(requestBody);
}

/* ── 유틸: 이미지 리사이즈 (Canvas 사용, 최대 800px) ── */
async function resizeImageToBase64(url, maxSize = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      // JPEG 품질 0.85로 압축
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ── 유틸: URL/base64 → Gemini inlineData part (리사이즈 포함) ── */
async function toInlinePart(url) {
  // 리사이즈 후 base64로 변환
  const resized = await resizeImageToBase64(url, 800);
  const [header, data] = resized.split(',');
  return { inlineData: { data, mimeType: 'image/jpeg' } };
}
