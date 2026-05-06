// Hugging Face RMBG-2.0 API (서버 사이드 배경 제거 — WASM/SharedArrayBuffer 불필요)
const HF_TOKEN = process.env.REACT_APP_HF_API_KEY || '';
const RMBG_API_URL = 'https://api-inference.huggingface.co/models/briaai/RMBG-2.0';
const RMBG_FALLBACK_URL = 'https://api-inference.huggingface.co/models/briaai/RMBG-1.4';

// ─── Gemini 2.0 Flash API 공통 호출 함수 ──────────────────────────────────────
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(parts, maxOutputTokens = 2048) {
  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
  if (!apiKey) throw new Error('REACT_APP_GEMINI_API_KEY is not set');

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Gemini API Error:', data);
    throw new Error(data.error?.message || `Gemini API 오류 (${response.status})`);
  }

  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error('AI 안전 정책에 의해 차단됐습니다.');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('[Gemini RAW Response]', JSON.stringify(data).slice(0, 500));
  console.log('[Gemini TEXT]', text);
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
  return text.trim();
}

function parseJsonFromText(text) {
  let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('응답에서 JSON을 찾을 수 없습니다.');
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    const fixed = jsonMatch[0].replace(/"reason"\s*:\s*"([\s\S]*?)"\s*([,}])/g, (_, body, end) =>
      `"reason": "${body.replace(/\r?\n/g, ' ').replace(/\t/g, ' ')}"${end}`
    );
    return JSON.parse(fixed);
  }
}

// ─── 투명 여백 크롭 헬퍼 ──────────────────────────────────────────────────────
const cropTransparentImage = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 10) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (minX > maxX || minY > maxY) { resolve(imageUrl); return; }

      const padding = 10;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(canvas.width - 1, maxX + padding);
      maxY = Math.min(canvas.height - 1, maxY + padding);

      const croppedWidth = maxX - minX + 1;
      const croppedHeight = maxY - minY + 1;
      const MAX_DIMENSION = 1024;
      let finalWidth = croppedWidth;
      let finalHeight = croppedHeight;
      if (croppedWidth > MAX_DIMENSION || croppedHeight > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / croppedWidth, MAX_DIMENSION / croppedHeight);
        finalWidth = Math.floor(croppedWidth * ratio);
        finalHeight = Math.floor(croppedHeight * ratio);
      }

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = finalWidth;
      croppedCanvas.height = finalHeight;
      croppedCanvas.getContext('2d').drawImage(canvas, minX, minY, croppedWidth, croppedHeight, 0, 0, finalWidth, finalHeight);
      croppedCanvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/png');
    };
    img.onerror = () => reject(new Error('Crop 실패'));
    img.src = imageUrl;
  });
};

// ─── 이미지 경량화 헬퍼 (API 전송 전 리사이즈) ────────────────────────────────
const resizeImageForAI = (file, maxDimension = 1024) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) { height = Math.round(height * maxDimension / width); width = maxDimension; }
          else { width = Math.round(width * maxDimension / height); height = maxDimension; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// ─── AI 실패 시 폴백: 모서리 색상 기반 배경 제거 ──────────────────────────────
const smartAutoNukki = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const corners = [[0,0],[canvas.width-1,0],[0,canvas.height-1],[canvas.width-1,canvas.height-1]];
        let r = 0, g = 0, b = 0;
        corners.forEach(([x, y]) => {
          const idx = (y * canvas.width + x) * 4;
          r += data[idx]; g += data[idx+1]; b += data[idx+2];
        });
        const bgR = r/4, bgG = g/4, bgB = b/4;

        const threshold = 30;
        for (let i = 0; i < data.length; i += 4) {
          const diff = Math.abs(data[i]-bgR) + Math.abs(data[i+1]-bgG) + Math.abs(data[i+2]-bgB);
          if (diff < threshold) data[i+3] = 0;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// ─── HF API 단일 호출 헬퍼 ───────────────────────────────────────────────────
const callHfRemoveBg = async (apiUrl, imageFile, timeoutMs = 35000) => {
  const headers = { 'Content-Type': 'application/octet-stream' };
  if (HF_TOKEN) headers['Authorization'] = `Bearer ${HF_TOKEN}`;

  const response = await Promise.race([
    fetch(apiUrl, { method: 'POST', headers, body: imageFile }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('서버 응답 시간 초과')), timeoutMs)),
  ]);

  if (!response.ok) {
    const msg = await response.text().catch(() => `HTTP ${response.status}`);
    throw new Error(msg);
  }

  return await response.blob();
};

// ─── 배경 제거 (HF RMBG-2.0 → RMBG-1.4 폴백 → 색상 감지 폴백) ───────────────
export const removeBackground = async (imageFile, onProgress) => {
  const optimizedFile = await resizeImageForAI(imageFile);

  if (onProgress) onProgress(10, 'upload');

  // 1차 시도: RMBG-2.0
  let blob = null;
  try {
    if (onProgress) onProgress(25, 'api');
    blob = await callHfRemoveBg(RMBG_API_URL, optimizedFile);
    console.log('[누끼] RMBG-2.0 성공');
  } catch (err2) {
    console.warn('[누끼] RMBG-2.0 실패, RMBG-1.4 시도:', err2.message);
    // 2차 시도: RMBG-1.4
    try {
      if (onProgress) onProgress(50, 'api');
      blob = await callHfRemoveBg(RMBG_FALLBACK_URL, optimizedFile);
      console.log('[누끼] RMBG-1.4 성공');
    } catch (err1) {
      console.warn('[누끼] RMBG-1.4 실패, 색상 감지 폴백:', err1.message);
    }
  }

  if (blob) {
    if (onProgress) onProgress(85, 'finishing');
    const objectUrl = URL.createObjectURL(blob);
    try {
      const croppedUrl = await cropTransparentImage(objectUrl);
      if (onProgress) onProgress(100, 'done');
      return croppedUrl;
    } catch {
      if (onProgress) onProgress(100, 'done');
      return objectUrl;
    }
  }

  // 3차 폴백: 색상 감지 (오프라인 / 모든 API 실패 시)
  try {
    if (onProgress) onProgress(60, 'fallback');
    const result = await smartAutoNukki(optimizedFile);
    if (onProgress) onProgress(100, 'done');
    return result;
  } catch {
    throw new Error('배경 제거에 실패했습니다. 수동 편집을 이용해주세요.');
  }
};

// ─── 옷 사진 분석 ──────────────────────────────────────────────────────────────
export const analyzeClothing = async (imageDataUrl) => {
  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.match(/data:(.*);base64/)?.[1] || 'image/png';

  const text = await callGemini([
    { inline_data: { mime_type: mediaType, data: base64 } },
    {
      text: `이 이미지를 분석해서 아래 JSON 형식으로만 응답해. 설명 없이 JSON만.

액세서리인 경우 subcategory:
- "얼굴/머리": 모자, 안경, 선글라스, 귀걸이, 헤어핀 등
- "손목/팔": 시계, 팔찌, 반지 등
- "기타": 목걸이, 벨트, 가방 등
액세서리가 아니면 subcategory는 null.

{
  "category": "아우터|상의|하의|신발|액세서리",
  "subcategory": "얼굴/머리|손목/팔|기타|null",
  "color": "대표 색상 한국어로",
  "tags": ["태그1", "태그2", "태그3"],
  "name": "아이템 이름 (예: 흰색 오버핏 티셔츠)"
}`,
    },
  ], 512);

  return parseJsonFromText(text);
};

// ─── 코디 추천 ─────────────────────────────────────────────────────────────────
export const getOutfitRecommendation = async (weather, items, tpoInfo) => {
  const closetSummary = items.map(i => ({
    id: i.id, name: i.name, category: i.category,
    subcategory: i.subcategory || null, color: i.color, tags: i.tags,
  }));

  const tpoText = tpoInfo
    ? `목표 일시: ${tpoInfo.date} ${tpoInfo.time}시\n상황(TPO): ${tpoInfo.event || '특별한 일정 없음 (일상적인 외출)'}`
    : `상황(TPO): 일상 / 데이트`;

  const prompt = `내 옷장 목록: ${JSON.stringify(closetSummary)}

${tpoText}
날씨: ${weather.condition}, 기온 ${weather.temp}°C, 체감 ${weather.apparentTemp ?? weather.temp}°C${weather.precipProb != null ? `, 강수확률 ${weather.precipProb}%` : ''}${weather.windSpeed ? `, 풍속 ${weather.windSpeed}km/h` : ''}

위 옷장 목록에서 [목표 일시], [날씨], [상황(TPO)]를 완벽하게 고려하여 가장 적절한 서로 다른 코디 3가지를 추천해줘.

[지침]
1. 상황(TPO)에 딱 맞는 드레스코드를 준수해 (예: 결혼식은 격식 있게, 등산은 기능성 위주로).
2. 날씨(기온, 날씨 상태)를 최우선으로 고려해 (추우면 아우터 필수, 비 오면 기능성 신발 등).
3. 3가지 코디는 각각 스타일(캐주얼, 포멀, 힙스터 등)이나 분위기가 서로 겹치지 않게 다양하게 제안해줘.
4. 각 코디의 "reason"에는 왜 이 상황(TPO)과 날씨에 이 조합이 베스트인지 구체적으로 설명해줘.

[중요] JSON의 "reason" 필드 안에 쌍따옴표(")를 써야 할 경우 반드시 역슬래시(\\")로 이스케이프해줘. 설명 없이 JSON만 응답해.

액세서리 슬롯 안내:
- 액세서리_얼굴머리: subcategory가 "얼굴/머리"인 아이템 (모자, 안경 등)
- 액세서리_손목팔: subcategory가 "손목/팔"인 아이템 (시계, 팔찌 등)
- 액세서리_기타: subcategory가 "기타"인 아이템 (가방, 벨트, 목걸이 등)

{
  "outfits": [
    {
      "outfit": {
        "아우터": <id 또는 null>,
        "상의": <id 또는 null>,
        "하의": <id 또는 null>,
        "신발": <id 또는 null>,
        "액세서리_얼굴머리": <id 또는 null>,
        "액세서리_손목팔": <id 또는 null>,
        "액세서리_기타": <id 또는 null>
      },
      "reason": "이 조합을 추천하는 이유 (2~3문장)"
    }
  ]
}`;

  const text = await callGemini([{ text: prompt }], 4096);
  return parseJsonFromText(text);
};

// ─── 코디 수정 ─────────────────────────────────────────────────────────────────
export const adjustOutfit = async (weather, items, tpoInfo, currentOutfitItems, userRequest) => {
  const closetSummary = items.map(i => ({
    id: i.id, name: i.name, category: i.category,
    subcategory: i.subcategory || null, color: i.color, tags: i.tags,
  }));

  const currentOutfitSummary = {
    "아우터": currentOutfitItems['아우터'] || null,
    "상의": currentOutfitItems['상의'] || null,
    "하의": currentOutfitItems['하의'] || null,
    "신발": currentOutfitItems['신발'] || null,
    "액세서리_얼굴머리": currentOutfitItems['액세서리_얼굴머리'] || null,
    "액세서리_손목팔": currentOutfitItems['액세서리_손목팔'] || null,
    "액세서리_기타": currentOutfitItems['액세서리_기타'] || null,
  };

  const tpoText = tpoInfo
    ? `목표 일시: ${tpoInfo.date} ${tpoInfo.time}시\n상황(TPO): ${tpoInfo.event || '특별한 일정 없음 (일상적인 외출)'}`
    : `상황(TPO): 일상 / 데이트`;

  const prompt = `내 옷장 목록: ${JSON.stringify(closetSummary)}

${tpoText}
날씨: ${weather.condition}, 기온 ${weather.temp}°C

현재 제안된 코디:
${JSON.stringify(currentOutfitSummary, null, 2)}

사용자의 수정 요청: "${userRequest}"

[매우 중요] 사용자가 특정 부위(예: 바지)만 변경해달라고 한 경우, 변경하지 않은 나머지 부위의 옷(아우터, 상의 등)은 절대 null로 지우지 말고 위의 '현재 제안된 코디'에 적힌 원래 ID를 그대로 똑같이 유지해서 응답해야 해.
만약 사용자의 요청에 맞는 옷이 옷장에 아예 없다면, 원래 코디를 그대로 유지하고 reason에 "해당하는 옷이 없어 기존 코디를 유지했습니다"라고 적어줘.
항상 7개의 모든 카테고리(아우터, 상의, 하의, 신발, 액세서리_얼굴머리, 액세서리_손목팔, 액세서리_기타)를 응답에 포함시켜야 해 (원래부터 null이었던 건 null 유지).

[중요] JSON의 "reason" 필드 안에 쌍따옴표(")를 써야 할 경우 반드시 역슬래시(\\")로 이스케이프해줘. 설명 없이 JSON만 응답해.

액세서리 슬롯 안내:
- 액세서리_얼굴머리: subcategory가 "얼굴/머리"인 아이템
- 액세서리_손목팔: subcategory가 "손목/팔"인 아이템
- 액세서리_기타: subcategory가 "기타"인 아이템 (가방, 벨트 등)

{
  "outfit": {
    "아우터": <id 또는 null>,
    "상의": <id 또는 null>,
    "하의": <id 또는 null>,
    "신발": <id 또는 null>,
    "액세서리_얼굴머리": <id 또는 null>,
    "액세서리_손목팔": <id 또는 null>,
    "액세서리_기타": <id 또는 null>
  },
  "reason": "어떤 부분이 변경되었는지, 혹은 왜 유지되었는지 설명 (1~2문장)"
}`;

  const text = await callGemini([{ text: prompt }], 4096);
  return parseJsonFromText(text);
};

// ─── 세탁 라벨 분석 ────────────────────────────────────────────────────────────
export const analyzeTag = async (imageDataUrl) => {
  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.match(/data:(.*);base64/)?.[1] || 'image/jpeg';

  const text = await callGemini([
    { inline_data: { mime_type: mediaType, data: base64 } },
    {
      text: `이 이미지는 의류의 세탁 라벨(케어라벨) 또는 종이 택입니다.
이미지가 다소 흐리거나 글씨가 작더라도 최대한 꼼꼼하게 텍스트를 판독해줘.
이미지 속 텍스트를 분석해서 아래 JSON 형식으로만 응답해. 설명 없이 JSON만 출력해.

{
  "brand": "브랜드명 (예: NIKE, ZARA, 무신사 스탠다드)",
  "name": "상품명 또는 품번(Style No)",
  "category": "아우터|상의|하의|신발|액세서리 중 가장 적합한 것 하나",
  "color": "태그에 적힌 색상 정보 (예: BLK, 09 BLACK 등)",
  "tags": ["소재(예: 면 100%)", "사이즈(예: L, 100)"]
}`,
    },
  ], 512);

  return parseJsonFromText(text);
};
