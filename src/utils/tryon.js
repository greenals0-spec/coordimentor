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
 * @param {string} category        '상의' | '하의' | '아우터'
 * @returns {Promise<string>}      base64 data URL 결과 이미지
 */
export async function runVirtualTryOn(personImageUrl, garmentImageUrl, category) {
  const personPart  = await toInlinePart(personImageUrl);
  const garmentPart = await toInlinePart(garmentImageUrl);

  const categoryDesc =
    category === '상의'   ? 'top / upper body clothing' :
    category === '하의'   ? 'bottom / lower body clothing (pants, skirt, etc.)' :
    category === '아우터'  ? 'outer layer / jacket / coat worn over the existing outfit' :
    category;

  const prompt = `You are a fashion AI specializing in virtual try-on.
Two images are provided:
1. A person's full-body photo (may already have clothes from a previous step).
2. A single clothing item: ${categoryDesc}.

Task:
- Naturally overlay the clothing onto the person.
- TOP → replace/overlay upper body clothing.
- BOTTOM → replace/overlay lower body clothing.
- OUTER LAYER → drape over the existing outfit.
- Keep the person's exact pose, face, skin tone, and body proportions.
- Add realistic shadows and fabric folds.
- Return ONLY a high-quality, full-body photo-realistic image. No text.`;

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

  // 이미지 파트 우선 반환
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (imagePart) {
    const { mimeType, data } = imagePart.inlineData;
    return `data:${mimeType};base64,${data}`;
  }

  // 이미지가 없으면 상세 로그 후 에러
  const textPart = parts.find(p => p.text);
  console.error('Try-on returned text only:', textPart?.text ?? '(empty)', json);
  throw new Error('모델이 이미지를 반환하지 않았습니다.');
}

/**
 * 전체 코디 순차 Virtual Try-On (상의 → 하의 → 아우터)
 */
export async function runFullOutfitTryOn(modelPhoto, recommendation, onProgress) {
  const steps = [
    { item: recommendation.top,    category: '상의',  label: '상의' },
    { item: recommendation.bottom, category: '하의',  label: '하의' },
    { item: recommendation.outer,  category: '아우터', label: '아우터' },
  ].filter(s => s.item?.imageUrl);

  if (steps.length === 0) throw new Error('입혀볼 아이템이 없습니다.');

  let currentPhoto = modelPhoto;
  for (let i = 0; i < steps.length; i++) {
    const { item, category, label } = steps[i];
    onProgress?.(i + 1, steps.length, label);
    currentPhoto = await runVirtualTryOn(currentPhoto, item.imageUrl, category);
  }
  return currentPhoto;
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
