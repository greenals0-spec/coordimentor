// Hugging Face RMBG-2.0 API (서버 사이드 배경 제거)
const HF_TOKEN = process.env.REACT_APP_HF_API_KEY || '';
const RMBG_API_URL = 'https://api-inference.huggingface.co/models/briaai/RMBG-2.0';
const RMBG_FALLBACK_URL = 'https://api-inference.huggingface.co/models/briaai/RMBG-1.4';

// ─── Gemini API 공통 설정 ──────────────────────────────────────
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
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
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens,
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
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
  return text.trim();
}

function parseJsonFromText(text) {
  // 1. 마크다운 코드블록 제거
  let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();

  // 2. JSON 블록 추출
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("응답에서 JSON을 찾을 수 없습니다.");
  let jsonStr = cleaned.slice(start, end + 1);

  // 3. 후행 쉼표 제거 (Trailing commas)
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");

  // 4. 1차 시도: 그대로 파싱
  try { return JSON.parse(jsonStr); } catch (_) {}

  // 5. 제어문자 및 이스케이프 수정
  try { 
    const simpleFixed = jsonStr.replace(/[\n\r\t]/g, " ");
    return JSON.parse(simpleFixed); 
  } catch (_) {}

  // 6. 최후 수단: 따옴표 안의 줄바꿈 강제 처리 정규식 사용
  const regexFixedStr = jsonStr.replace(
    /("(?:[^"\\]|\\.)*")\s*:\s*"([\s\S]*?)"\s*(?=[,}\]])/g,
    (match, key, value) => {
      const safeValue = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, ' ')
        .replace(/\t/g, ' ');
      return `${key}: "${safeValue}"`;
    }
  );

  try { return JSON.parse(regexFixedStr); } catch (_) {}

  // 7. 완전 제거
  // eslint-disable-next-line no-control-regex
  const stripped = regexFixedStr.replace(/[\x00-\x1F\x7F-\x9F]/g, " ");
  return JSON.parse(stripped);
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

// 전용 배경 제거 서버 (Render.com 배포용)
const REMBG_SERVER_URL = process.env.REACT_APP_REMBG_SERVER_URL || '';

// ─── 전용 서버 API 호출 헬퍼 ──────────────────────────────────────────────────
const callCustomRembgApi = async (imageFile, timeoutMs = 45000) => {
  if (!REMBG_SERVER_URL) throw new Error('전용 서버 URL이 설정되지 않았습니다.');
  
  const formData = new FormData();
  formData.append('file', imageFile);

  const response = await Promise.race([
    fetch(`${REMBG_SERVER_URL}/remove-bg`, {
      method: 'POST',
      body: formData,
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('전용 서버 응답 시간 초과')), timeoutMs)),
  ]);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `서버 오류 (${response.status})`);
  }

  return await response.blob();
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

// ─── 배경 제거 (전용 서버 → HF RMBG-2.0 → RMBG-1.4 폴백 → 색상 감지 폴백) ───────────
export const removeBackground = async (imageFile, onProgress) => {
  const optimizedFile = await resizeImageForAI(imageFile);

  if (onProgress) onProgress(10, 'upload');

  let blob = null;

  // 1차 시도: 전용 서버 (Render.com)
  try {
    if (REMBG_SERVER_URL) {
      if (onProgress) onProgress(20, 'custom_api');
      console.log('[누끼] 전용 서버 시도 중...');
      blob = await callCustomRembgApi(optimizedFile);
      console.log('[누끼] 전용 서버 성공');
    }
  } catch (err) {
    console.warn('[누끼] 전용 서버 실패, HF API 시도:', err.message);
  }

  // 2차 시도: RMBG-2.0 (Hugging Face)
  if (!blob) {
    try {
      if (onProgress) onProgress(40, 'api');
      blob = await callHfRemoveBg(RMBG_API_URL, optimizedFile);
      console.log('[누끼] RMBG-2.0 성공');
    } catch (err2) {
      console.warn('[누끼] RMBG-2.0 실패, RMBG-1.4 시도:', err2.message);
      // 3차 시도: RMBG-1.4
      try {
        if (onProgress) onProgress(60, 'api');
        blob = await callHfRemoveBg(RMBG_FALLBACK_URL, optimizedFile);
        console.log('[누끼] RMBG-1.4 성공');
      } catch (err1) {
        console.warn('[누끼] RMBG-1.4 실패, 색상 감지 폴백:', err1.message);
      }
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

  // 4차 폴백: 색상 감지 (오프라인 / 모든 API 실패 시)
  try {
    if (onProgress) onProgress(70, 'fallback');
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

// ─── 최근 추천 기록 관리 (localStorage, 최대 15세트 보관) ─────────────────────
const RECENT_KEY = 'recent_recommended_combos';
const MAX_RECENT = 15;

function loadRecentCombos() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function saveRecentCombos(combos) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(combos.slice(-MAX_RECENT))); } catch {}
}

export function recordRecommendedOutfits(outfits) {
  const recent = loadRecentCombos();
  outfits.forEach(o => {
    const key = ['아우터','상의','하의','신발'].map(k => o.outfit?.[k] || 'null').join('|');
    if (!recent.includes(key)) recent.push(key);
  });
  saveRecentCombos(recent);
}

// ─── 코디 추천 ─────────────────────────────────────────────────────────────────
export const getOutfitRecommendation = async (weather, items, tpoInfo, savedOutfits = []) => {
  // 옷장 목록을 랜덤하게 섞어서 AI가 다양한 아이템에 먼저 주목하도록 유도
  const shuffledItems = [...items].sort(() => Math.random() - 0.5);

  const closetSummary = shuffledItems.map(i => ({
    id: i.id, name: i.name, category: i.category,
    subcategory: i.subcategory || null, color: i.color, tags: i.tags,
  }));

  // 최근 저장된 코디 요약 (취향 학습용)
  const savedExamples = savedOutfits.slice(0, 10).map(o => {
    const itemNames = Object.values(o.items || {}).filter(Boolean).map(i => `${i.name}(${i.color})`).join(' + ');
    return { combo: itemNames, reason: o.reason };
  });

  // 최근 추천했던 아이템 ID 조합 (중복 방지용)
  const recentCombos = loadRecentCombos();
  // 최근 조합에서 자주 쓰인 상의/하의 ID 추출 (과사용 방지)
  const recentTopIds    = new Set();
  const recentBottomIds = new Set();
  recentCombos.slice(-6).forEach(combo => {
    const parts = combo.split('|');
    if (parts[1] && parts[1] !== 'null') recentTopIds.add(parts[1]);
    if (parts[2] && parts[2] !== 'null') recentBottomIds.add(parts[2]);
  });
  // 3회 이상 등장한 아이템은 "과사용" 표시
  const overusedItems = shuffledItems.filter(i => {
    const countInRecent = recentCombos.filter(c => c.includes(i.id)).length;
    return countInRecent >= 3;
  }).map(i => i.id);

  const tpoText = tpoInfo
    ? `목표 일시: ${tpoInfo.date} ${tpoInfo.time}시\n상황(TPO): ${tpoInfo.event || '특별한 일정 없음 (일상적인 외출)'}`
    : `상황(TPO): 일상 / 데이트`;

  const prompt = `내 옷장 목록: ${JSON.stringify(closetSummary)}

${savedExamples.length > 0 ? `[사용자의 선호 스타일 (이전에 저장한 코디들)]
${savedExamples.map(ex => `- 조합: ${ex.combo}\n  특징: ${ex.reason}`).join('\n')}
위 코디들은 사용자가 선호하는 스타일이야. 이 취향의 무드 범위 안에서 새로운 조합을 제안해줘.` : ''}

${recentCombos.length > 0 ? `[최근 추천했던 조합 — 반드시 피해야 함]
아래 조합(아우터ID|상의ID|하의ID|신발ID)은 최근에 이미 추천한 것들이야. 동일한 조합은 절대 반복하지 마.
${recentCombos.slice(-10).join('\n')}` : ''}

${overusedItems.length > 0 ? `[과사용 아이템 — 가급적 제외]
아래 ID의 아이템은 최근 추천에서 3회 이상 사용됐어. 가능하면 다른 아이템으로 대체해줘.
${overusedItems.join(', ')}` : ''}

${tpoText}
날씨: ${weather.condition}, 기온 ${weather.temp}°C, 체감 ${weather.apparentTemp ?? weather.temp}°C${weather.precipProb != null ? `, 강수확률 ${weather.precipProb}%` : ''}${weather.windSpeed ? `, 풍속 ${weather.windSpeed}km/h` : ''}

위 옷장 목록에서 [목표 일시], [날씨], [상황(TPO)]를 완벽하게 고려하여 가장 적절한 서로 다른 코디 3가지를 추천해줘.

[지침]
1. 사용자의 선호 스타일 무드를 유지하되, 3가지 추천은 각각 다른 아이템 조합으로 구성해. 상의·하의·아우터 중 최소 1개는 코디마다 달라야 해.
2. 3가지 추천 중 하나는 사용자의 기존 취향과 유사하게, 나머지 둘은 취향 범위 안에서 새로운 조합을 시도해줘.
3. [TPO 절대 금지 규칙 — 이 규칙은 다른 어떤 지침보다 최우선이며 예외 없이 적용]:
   상황에 어울리지 않는 아이템이 단 하나라도 포함되면 그 코디 전체가 실패야. 아래 금지 조합은 절대 추천하지 마.

   ▸ 등산 / 트레킹 / 하이킹:
     - 금지: 구두, 로퍼, 하이힐, 슬리퍼, 정장바지, 슬랙스, 재킷(정장), 드레스, 스커트, 가죽소재
     - 필수: 등산화 또는 트레킹화, 기능성 아웃도어 의류

   ▸ 장례식 / 조문:
     - 금지: 원색(빨강·노랑·주황·핑크 등), 화려한 패턴, 흰옷(상복 제외), 반바지, 슬리퍼, 스니커즈
     - 필수: 블랙 또는 짙은 무채색 계열 전신, 단정한 구두

   ▸ 결혼식 하객:
     - 금지: 흰색·아이보리 계열(신부와 겹침), 지나치게 노출된 옷, 청바지, 운동화, 슬리퍼
     - 권장: 파스텔·네이비·베이지 세미정장

   ▸ 운동 / 헬스 / 조깅:
     - 금지: 구두, 로퍼, 슬랙스, 정장, 드레스, 스커트, 가죽소재
     - 필수: 운동화, 기능성 스포츠웨어

   ▸ 비즈니스 포멀 (계약·발표·면접):
     - 금지: 슬리퍼, 운동화, 반바지, 후드티, 트레이닝복, 원색 상의
     - 필수: 슈트 또는 재킷+슬랙스, 구두

   ▸ 비즈니스 캐주얼:
     - 금지: 슬리퍼, 트레이닝복, 반바지(격식 없는 자리 제외)
     - 허용: 슬랙스+셔츠/니트, 단정한 스니커즈

   ▸ 해수욕장 / 수영:
     - 금지: 정장, 구두, 부츠
     - 필수: 샌들 또는 슬리퍼, 가벼운 소재

   [핵심 원칙] 옷장에 해당 상황에 맞는 아이템이 없더라도, 절대 맞지 않는 아이템을 억지로 끼워 넣지 마. 그 카테고리를 null로 비워두는 것이 훨씬 낫다.
4. [스타일 일관성]: 코디 내 모든 아이템은 하나의 무드로 통일. 언밸런스한 조합 금지.
5. 날씨(기온, 날씨 상태)를 최우선으로 고려해 (추우면 아우터 필수, 비 오면 기능성 신발 등).
6. [중요] 3가지 코디의 핵심 아이템(상의 또는 하의)이 모두 같으면 안 돼. 각 코디마다 최소 상의나 하의 중 하나는 반드시 달라야 해.
7. [의상 규칙] 벨트는 셔츠+슬랙스 조합일 때만 포함. 캐주얼 복장에는 제외.
8. 각 코디의 "reason"은 이 TPO·날씨에 이 테마가 왜 어울리는지 한 문장으로 설명해.
9. 세션 번호: ${Date.now()}

[매우 중요] 반드시 유효한 JSON만 출력해. 모든 문자열 값 안에 줄바꿈·탭·쌍따옴표를 절대 넣지 마. 한 줄 문장만 사용해. 설명 없이 JSON만 응답해.

━━━ 슬롯-카테고리 절대 규칙 (위반 시 전체 응답 무효) ━━━
각 슬롯에는 반드시 해당 category를 가진 아이템 ID만 넣을 수 있다. 예외 없음.
- "아우터"   슬롯 → category가 정확히 "아우터"인 아이템만 허용
- "상의"     슬롯 → category가 정확히 "상의"인 아이템만 허용
- "하의"     슬롯 → category가 정확히 "하의"인 아이템만 허용
- "신발"     슬롯 → category가 정확히 "신발"인 아이템만 허용
- "액세서리_얼굴머리" 슬롯 → category "액세서리" + subcategory "얼굴/머리"인 아이템만 허용
- "액세서리_손목팔"   슬롯 → category "액세서리" + subcategory "손목/팔"인 아이템만 허용
- "액세서리_기타"     슬롯 → category "액세서리" + subcategory "기타"인 아이템만 허용
★ 상의 아이템을 액세서리 슬롯에 넣거나, 신발 아이템을 상의 슬롯에 넣는 등 category 불일치는 절대 금지.
★ 해당 category의 아이템이 옷장에 없으면 반드시 null로 비워야 한다. 다른 category로 대체하는 것은 엄격히 금지.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "outfits": [
    {
      "outfit": {
        "아우터": <category=="아우터"인 id 또는 null>,
        "상의": <category=="상의"인 id 또는 null>,
        "하의": <category=="하의"인 id 또는 null>,
        "신발": <category=="신발"인 id 또는 null>,
        "액세서리_얼굴머리": <category=="액세서리" && subcategory=="얼굴/머리"인 id 또는 null>,
        "액세서리_손목팔": <category=="액세서리" && subcategory=="손목/팔"인 id 또는 null>,
        "액세서리_기타": <category=="액세서리" && subcategory=="기타"인 id 또는 null>
      },
      "reason": "이 조합을 추천하는 이유 (2~3문장)"
    }
  ]
}`;

  const text = await callGemini([{ text: prompt }], 4096);
  const parsed = parseJsonFromText(text);

  // ── 방어 로직: 카테고리 불일치 슬롯 자동 null 처리 ──
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  if (parsed?.outfits) {
    parsed.outfits = parsed.outfits.map(o => {
      const outfit = { ...o.outfit };
      const check = (slot, requiredCat, requiredSub) => {
        const id = outfit[slot];
        if (!id) return;
        const item = itemMap[id];
        if (!item) { outfit[slot] = null; return; }
        if (item.category !== requiredCat) { outfit[slot] = null; return; }
        if (requiredSub && item.subcategory !== requiredSub) { outfit[slot] = null; }
      };
      check('아우터', '아우터');
      check('상의', '상의');
      check('하의', '하의');
      check('신발', '신발');
      check('액세서리_얼굴머리', '액세서리', '얼굴/머리');
      check('액세서리_손목팔',   '액세서리', '손목/팔');
      check('액세서리_기타',     '액세서리', '기타');
      return { ...o, outfit };
    });
  }
  return parsed;
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

[TPO 절대 금지 규칙 — 수정 요청이라도 예외 없이 적용]:
- 등산/트레킹: 구두·로퍼·슬랙스·정장 금지. 등산화·기능성 의류 필수.
- 장례식/조문: 원색·화려한 패턴·흰옷·스니커즈 금지. 블랙 무채색+단정한 구두 필수.
- 결혼식 하객: 흰색·아이보리·청바지·운동화 금지.
- 운동/헬스: 구두·슬랙스·정장 금지. 운동화+스포츠웨어 필수.
- 비즈니스 포멀: 슬리퍼·운동화·후드티·반바지 금지.
사용자가 TPO에 맞지 않는 아이템을 요청해도 거절하고, 상황에 맞는 대안을 reason에 설명해줘.

[매우 중요] 사용자가 특정 부위(예: 바지)만 변경해달라고 한 경우, 변경하지 않은 나머지 부위의 옷(아우터, 상의 등)은 절대 null로 지우지 말고 위의 '현재 제안된 코디'에 적힌 원래 ID를 그대로 똑같이 유지해서 응답해야 해.
만약 사용자의 요청에 맞는 옷이 옷장에 아예 없다면, 원래 코디를 그대로 유지하고 reason에 "해당하는 옷이 없어 기존 코디를 유지했습니다"라고 적어줘.
항상 7개의 모든 카테고리(아우터, 상의, 하의, 신발, 액세서리_얼굴머리, 액세서리_손목팔, 액세서리_기타)를 응답에 포함시켜야 해 (원래부터 null이었던 건 null 유지).

[매우 중요] 반드시 유효한 JSON만 출력해. 모든 문자열 값 안에 줄바꿈·탭·쌍따옴표를 절대 넣지 마. 한 줄 문장만 사용해. 설명 없이 JSON만 응답해.

━━━ 슬롯-카테고리 절대 규칙 (위반 시 전체 응답 무효) ━━━
각 슬롯에는 반드시 해당 category를 가진 아이템 ID만 넣을 수 있다. 예외 없음.
- "아우터"   슬롯 → category가 정확히 "아우터"인 아이템만 허용
- "상의"     슬롯 → category가 정확히 "상의"인 아이템만 허용
- "하의"     슬롯 → category가 정확히 "하의"인 아이템만 허용
- "신발"     슬롯 → category가 정확히 "신발"인 아이템만 허용
- "액세서리_얼굴머리" 슬롯 → category "액세서리" + subcategory "얼굴/머리"인 아이템만 허용
- "액세서리_손목팔"   슬롯 → category "액세서리" + subcategory "손목/팔"인 아이템만 허용
- "액세서리_기타"     슬롯 → category "액세서리" + subcategory "기타"인 아이템만 허용
★ 상의 아이템을 액세서리 슬롯에 넣거나, 신발 아이템을 상의 슬롯에 넣는 등 category 불일치는 절대 금지.
★ 해당 category의 아이템이 옷장에 없으면 반드시 null로 비워야 한다. 다른 category로 대체하는 것은 엄격히 금지.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "outfit": {
    "아우터": <category=="아우터"인 id 또는 null>,
    "상의": <category=="상의"인 id 또는 null>,
    "하의": <category=="하의"인 id 또는 null>,
    "신발": <category=="신발"인 id 또는 null>,
    "액세서리_얼굴머리": <category=="액세서리" && subcategory=="얼굴/머리"인 id 또는 null>,
    "액세서리_손목팔": <category=="액세서리" && subcategory=="손목/팔"인 id 또는 null>,
    "액세서리_기타": <category=="액세서리" && subcategory=="기타"인 id 또는 null>
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
