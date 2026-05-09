/**
 * Weather-based Clothing Recommendation Logic
 */

const TEMP_GUIDE = [
  { max: 4,  label: '겨울 패딩, 두꺼운 코트, 목도리, 기모 제품' },
  { max: 8,  label: '코트, 가죽 자켓, 히트텍, 니트, 레깅스' },
  { max: 11, label: '자켓, 트렌치코트, 야상, 니트, 청바지, 스타킹' },
  { max: 16, label: '자켓, 가디건, 야상, 맨투맨, 니트, 청바지, 면바지' },
  { max: 19, label: '맨투맨, 후드티, 얇은 가디건, 청바지, 면바지, 슬랙스' },
  { max: 22, label: '긴팔 티셔츠, 셔츠, 가디건, 면바지, 슬랙스, 청바지' },
  { max: 27, label: '반팔 티셔츠, 얇은 셔츠, 반바지, 면바지' },
  { max: 100, label: '민소매, 반팔, 반바지, 원피스, 린넨 소재' }
];

export function getTempDescription(temp) {
  const guide = TEMP_GUIDE.find(g => temp <= g.max);
  return guide ? guide.label : '날씨에 맞는 적절한 옷차림을 준비하세요.';
}

/**
 * Recommends one item for each necessary category based on weather.
 * @param {Object} weather { temp, condition, emoji }
 * @param {Array} items Array of closet items
 */
export function recommendOutfit(weather, items) {
  if (!items || items.length === 0) return null;

  const { temp, condition } = weather;
  const isRaining = condition.includes('비');
  const isSnowing = condition.includes('눈');

  // Group items by category
  const categories = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const recommendation = {
    top: null,
    bottom: null,
    outer: null,
    shoes: null,
    accessory: null,
    message: getTempDescription(temp)
  };

  // Helper to pick a random item from a category
  const pickRandom = (list) => list && list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null;

  // Basic selection logic
  recommendation.top = pickRandom(categories['상의']);
  recommendation.bottom = pickRandom(categories['하의']);
  recommendation.shoes = pickRandom(categories['신발']);
  recommendation.accessory = pickRandom(categories['액세서리']);

  // Outer logic: only recommend if temp is below 23
  if (temp < 23) {
    recommendation.outer = pickRandom(categories['아우터']);
  }

  // Refine selection based on tags (if tags exist and match temp keywords)
  // This is a simple version; real AI could be used here.
  
  if (isRaining) {
    recommendation.message += ' (비가 오니 우산이나 방수 신발을 추천해요!)';
  } else if (isSnowing) {
    recommendation.message += ' (눈이 오니 미끄럽지 않은 신발을 신으세요!)';
  }

  return recommendation;
}
