import { preserveFace } from './facePreserve';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
// 이미지 생성(출력)을 지원하는 모델 목록 (순서대로 시도, 2026년 5월 기준)
const TRYON_MODELS = [
  'gemini-3.1-flash-image-preview', // Nano Banana 2 — 최신, 기존 대비 속도↑ 가격↓
  'gemini-2.5-flash-image',         // Nano Banana 1 — 폴백
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

  const prompt = `You are a fashion AI specializing in virtual try-on.
Two images are provided:
1. A person's full-body photo (may already have clothes from a previous step).
2. A single clothing/accessory item: ${categoryDesc}.

Task:
- Naturally overlay or place the item onto the person.
- TOP → replace/overlay upper body clothing.
- BOTTOM → replace/overlay lower body clothing.
- OUTER LAYER → drape over the existing outfit without hiding it completely.
- SHOES → replace the existing footwear or place on bare feet naturally.
- ACCESSORY → add to the appropriate location (bag for hands, hat for head, wrist for watch, etc.) without covering the outfit.
- Keep the person's exact pose, face, skin tone, and body proportions unchanged.
- Add realistic shadows and fabric/material texture.
- CRITICAL OUTPUT RULES:
  1. The output MUST be EXACTLY ONE single image containing ONLY ONE person.
  2. ABSOLUTELY NO collages, NO 3-panel layouts, NO grids, NO side-by-side comparisons. 
  3. The single image MUST show the COMPLETE FULL BODY from head to toe without any cropping.
- Return ONLY the single full-body photo-realistic result image. No text overlay, no background change.`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        personPart,
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
  for (const model of TRYON_MODELS) {
    console.log(`[TryOn] Trying model: ${model}`);
    res = await fetch(makeEndpoint(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (res.status !== 404 && res.status !== 400) {
      usedModel = model;
      break;
    }
    const errText = await res.text();
    console.warn(`[TryOn] ${model} failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  if (!res || !res.ok) {
    const errText = await res?.text() ?? 'No response';
    console.error('Gemini API error:', res?.status, errText);
    throw new Error(`Gemini API ${res?.status}: ${errText.slice(0, 300)}`);
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

/**
 * 전체 코디 순차 Virtual Try-On (상의 → 하의 → 아우터 → 신발 → 액세서리)
 */
export async function runFullOutfitTryOn(modelPhoto, recommendation, onProgress) {
  const steps = [
    { item: recommendation.top,       category: '상의',    label: '상의' },
    { item: recommendation.bottom,    category: '하의',    label: '하의' },
    { item: recommendation.outer,     category: '아우터',   label: '아우터' },
    { item: recommendation.shoes,     category: '신발',    label: '신발' },
    { item: recommendation.accessory, category: '액세서리', label: '액세서리' },
  ].filter(s => s.item?.imageUrl);

  if (steps.length === 0) throw new Error('입혀볼 아이템이 없습니다.');

  let currentPhoto = modelPhoto;
  for (let i = 0; i < steps.length; i++) {
    const { item, category, label } = steps[i];
    onProgress?.(i + 1, steps.length, label);
    currentPhoto = await runVirtualTryOn(currentPhoto, item.imageUrl, category);
  }
  // 얼굴 영역 원본 보존 (마지막 결과에만 적용)
  try {
    currentPhoto = await preserveFace(modelPhoto, currentPhoto);
  } catch (e) {
    console.warn('[FacePreserve] 얼굴 보존 실패, 원본 결과 사용:', e);
  }
  return currentPhoto;
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

  const prompt = `You are a fashion AI specializing in virtual try-on.
Two images are provided:
1. A person's full-body photo.
2. A single "Flatlay" collage containing multiple clothing/accessory items: ${categoriesDesc}.

Task:
- You MUST naturally overlay and place EVERY SINGLE ITEM shown in the flatlay onto the person at the same time.
- DO NOT OMIT ANY ITEM. If there are shoes in the flatlay, they MUST be on the person's feet. If there is a top and bottom, BOTH MUST be worn.
- TOP → replace/overlay upper body clothing.
- BOTTOM → replace/overlay lower body clothing.
- OUTER LAYER → drape over the existing outfit.
- SHOES → replace the existing footwear or place on bare feet naturally.
- ACCESSORY → add to the appropriate location (bag for hands, hat for head, etc).
- CRITICAL: Accurately maintain the exact color, texture, and pattern of each item. DO NOT mix the texture of the top with the bottom.
- Keep the person's exact pose, face, skin tone, and body proportions unchanged.
- Add realistic shadows and fabric/material texture.
- CRITICAL OUTPUT RULES:
  1. The output MUST be EXACTLY ONE single image containing ONLY ONE person.
  2. ABSOLUTELY NO collages, NO 3-panel layouts, NO grids, NO side-by-side comparisons. 
  3. The single image MUST show the COMPLETE FULL BODY from head to toe without any cropping.
- Return ONLY the single full-body photo-realistic result image. No text overlay, no background change.`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        personPart,
        flatlayPart,
      ],
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const result = await callTryOnApi(requestBody);

  // 얼굴 영역 원본 보존
  try {
    return await preserveFace(modelPhoto, result);
  } catch (e) {
    console.warn('[FacePreserve] 얼굴 보존 실패, 원본 결과 사용:', e);
    return result;
  }
}

/* ── 유틸: URL/base64 → Gemini inlineData part ── */
async function toInlinePart(url) {
  if (url.startsWith('data:')) {
    const [header, data] = url.split(',');
    return { inlineData: { data, mimeType: header.split(':')[1].split(';')[0] } };
  }
  // 원격 URL → fetch → base64
  const res  = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const [header, data] = reader.result.split(',');
      resolve({ inlineData: { data, mimeType: blob.type } });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
