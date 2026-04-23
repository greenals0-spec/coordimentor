export const removeBackground = async (imageFile) => {
  const apiKey = process.env.REACT_APP_REMOVEBG_API_KEY;
  if (!apiKey) throw new Error('REACT_APP_REMOVEBG_API_KEY is not set');

  const formData = new FormData();
  formData.append('image_file', imageFile);
  formData.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.title || 'remove.bg API 오류');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const analyzeClothing = async (imageDataUrl) => {
  const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('REACT_APP_ANTHROPIC_API_KEY is not set');

  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.match(/data:(.*);base64/)?.[1] || 'image/png';

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
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
        ],
      },
    ],
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Claude API 오류');
  }

  const data = await response.json();
  const text = data.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude 응답 파싱 실패');
  return JSON.parse(jsonMatch[0]);
};

export const getOutfitRecommendation = async (weather, items) => {
  const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('REACT_APP_ANTHROPIC_API_KEY is not set');

  const closetSummary = items.map(i => ({
    id: i.id,
    name: i.name,
    category: i.category,
    subcategory: i.subcategory || null,
    color: i.color,
    tags: i.tags,
  }));

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `내 옷장 목록: ${JSON.stringify(closetSummary)}

날씨: ${weather.condition}, 기온 ${weather.temp}°C

위 옷장에서 날씨에 맞는 코디를 추천해줘. 없는 항목은 null로. JSON만 응답해.
{
  "outfit": {
    "아우터": <id 또는 null>,
    "상의": <id 또는 null>,
    "하의": <id 또는 null>,
    "신발": <id 또는 null>,
    "액세서리_얼굴머리": <id 또는 null>,
    "액세서리_손목팔": <id 또는 null>
  },
  "reason": "추천 이유 2~3문장"
}`,
      },
    ],
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Claude API 오류');
  }

  const data = await response.json();
  const text = data.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude 응답 파싱 실패');
  return JSON.parse(jsonMatch[0]);
};
