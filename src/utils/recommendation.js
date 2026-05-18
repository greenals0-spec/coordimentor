/**
 * Weather + Situation based Clothing Recommendation
 */

const TEMP_GUIDE = [
  { max: 4,  label: '패딩, 두꺼운 코트, 목도리, 기모 제품이 필요한 날씨예요.' },
  { max: 8,  label: '코트, 가죽 자켓, 히트텍, 니트를 입어야 할 것 같아요.' },
  { max: 11, label: '자켓이나 트렌치코트에 두꺼운 하의가 필요해요.' },
  { max: 16, label: '자켓이나 가디건을 챙기면 딱 좋을 날씨예요.' },
  { max: 19, label: '맨투맨이나 후드티 정도면 충분해요.' },
  { max: 22, label: '긴팔 티셔츠나 얇은 셔츠가 어울리는 날씨예요.' },
  { max: 27, label: '반팔 티셔츠나 얇은 셔츠로 가볍게 입어요.' },
  { max: 100, label: '민소매, 반팔, 린넨 소재로 시원하게 입어요.' }
];

/**
 * 온도별 선호/회피 태그 정의
 * prefer: 이 키워드가 있는 아이템 우선 선택
 * avoid:  이 키워드가 있는 아이템 최대한 제외
 */
const TEMP_TAG_RULES = [
  {
    minTemp: -999, maxTemp: 4,
    prefer: ['패딩', '기모', '두꺼운', '방한', '울', '플리스', '목도리', '롱패딩', '다운'],
    avoid:  ['반팔', '민소매', '린넨', '얇은', '숏'],
  },
  {
    minTemp: 5, maxTemp: 8,
    prefer: ['코트', '가죽', '니트', '히트텍', '두꺼운', '울'],
    avoid:  ['반팔', '민소매', '린넨', '숏'],
  },
  {
    minTemp: 9, maxTemp: 11,
    prefer: ['자켓', '트렌치', '두꺼운', '청자켓', '가디건'],
    avoid:  ['반팔', '민소매', '린넨'],
  },
  {
    minTemp: 12, maxTemp: 16,
    prefer: ['자켓', '가디건', '니트', '긴팔'],
    avoid:  ['패딩', '롱패딩', '기모', '반팔', '민소매'],
  },
  {
    minTemp: 17, maxTemp: 19,
    prefer: ['맨투맨', '후드', '긴팔', '얇은'],
    avoid:  ['패딩', '기모', '두꺼운', '민소매'],
  },
  {
    minTemp: 20, maxTemp: 22,
    prefer: ['긴팔', '얇은', '셔츠', '면'],
    avoid:  ['패딩', '기모', '두꺼운', '니트', '울', '민소매'],
  },
  {
    minTemp: 23, maxTemp: 27,
    prefer: ['반팔', '얇은', '면', '셔츠', '숏', '반바지'],
    avoid:  ['패딩', '기모', '두꺼운', '니트', '울', '긴팔', '민소매'],
  },
  {
    minTemp: 28, maxTemp: 999,
    prefer: ['민소매', '반팔', '린넨', '얇은', '숏', '반바지', '면'],
    avoid:  ['패딩', '기모', '두꺼운', '니트', '울', '긴팔', '자켓', '코트'],
  },
];

// 상황별 스타일 키워드 (아이템 tags와 매칭)
const SITUATION_KEYWORDS = {
  '출근': ['정장', '슬랙스', '셔츠', '블라우스', '재킷', '구두', '로퍼', '오피스', '비즈니스', '포멀'],
  '운동': ['스포츠', '운동', '레깅스', '트레이닝', '러닝', '짐', '스니커즈', '반바지', '운동화', '액티브'],
  '등교': ['캐주얼', '청바지', '후드', '맨투맨', '스니커즈', '백팩', '편한', '학교'],
  '데이트': ['원피스', '스커트', '블라우스', '로맨틱', '페미닌', '힐', '드레스', '데이트', '세련'],
  '여행': ['편한', '캐주얼', '스니커즈', '가디건', '레이어드', '여행', '실용적'],
  '등산': ['아웃도어', '등산', '트레킹', '방수', '기능성', '바람막이', '등산화', '레깅스'],
  '모임': ['세미캐주얼', '니트', '슬랙스', '로퍼', '모임', '깔끔', '깔끔한', '반정장'],
  '기타': [],
};

// 상황별 추천 메시지
const SITUATION_MESSAGES = {
  '출근': '오늘도 프로답게! 날씨에 맞는 출근 코디를 골랐어요.',
  '운동': '오늘 운동 파이팅! 활동하기 편한 코디로 준비했어요.',
  '등교': '등교 준비 완료! 날씨에 맞게 가볍고 편한 코디예요.',
  '데이트': '설레는 데이트! 날씨에 어울리는 로맨틱한 코디를 골랐어요.',
  '여행': '즐거운 여행! 편하면서도 스타일리시한 코디를 준비했어요.',
  '등산': '산에서도 멋지게! 기능성과 스타일을 모두 잡은 코디예요.',
  '모임': '모임 준비 완료! 날씨에 맞는 깔끔한 코디를 골랐어요.',
  '기타': null,
};

export function getTempDescription(temp) {
  const guide = TEMP_GUIDE.find(g => temp <= g.max);
  return guide ? guide.label : '날씨에 맞는 적절한 옷차림을 준비하세요.';
}

/**
 * 현재 월 → 계절 반환
 */
export function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

/**
 * 아이템을 현재 계절로 필터링.
 * seasons 배열이 없는 기존 아이템은 모든 계절에 포함(하위 호환).
 */
function filterBySeason(items, season) {
  if (!items || items.length === 0) return [];
  const seasonal = items.filter(
    item => !item.seasons || item.seasons.length === 0 || item.seasons.includes(season)
  );
  return seasonal.length > 0 ? seasonal : items;
}

/**
 * 온도에 맞는 태그 규칙 반환
 */
function getTempRules(temp) {
  return TEMP_TAG_RULES.find(r => temp >= r.minTemp && temp <= r.maxTemp) || { prefer: [], avoid: [] };
}

/**
 * 아이템의 텍스트(태그+이름+카테고리) 추출
 */
function itemText(item) {
  return [
    ...(item.tags || []),
    item.name || '',
    item.category || '',
    item.memo || '',
  ].join(' ').toLowerCase();
}

/**
 * 상황 키워드 매칭 점수
 */
function situationScore(item, keywords) {
  if (!keywords || keywords.length === 0) return 0;
  const text = itemText(item);
  return keywords.filter(k => text.includes(k)).length;
}

/**
 * 온도 적합성 점수
 * prefer 키워드 포함 시 +2, avoid 키워드 포함 시 -3
 */
function tempScore(item, rules) {
  const text = itemText(item);
  let score = 0;
  (rules.prefer || []).forEach(k => { if (text.includes(k)) score += 2; });
  (rules.avoid  || []).forEach(k => { if (text.includes(k)) score -= 3; });
  return score;
}

/**
 * 아이템 선택 (온도 적합성 + 상황 키워드 통합 고려)
 * 1. avoid 태그가 있는 아이템 무조건 제외 — 폴백 없음
 *    → 온도에 맞는 아이템이 없으면 null 반환 (쇼핑 추천으로 유도)
 * 2. 남은 아이템 중 상황 키워드 매칭 우선
 * 3. 온도 prefer 점수 보조
 */
function pickItem(list, keywords, tempRules) {
  if (!list || list.length === 0) return null;

  // avoid 아이템 제거 — 온도에 맞지 않으면 null 반환 (텍스트-이미지 불일치 방지)
  const notAvoided = list.filter(item => tempScore(item, tempRules) >= 0);
  if (notAvoided.length === 0) return null;

  // 상황 키워드 AND 온도 prefer 모두 고려한 종합 점수
  const scored = notAvoided.map(item => ({
    item,
    score: situationScore(item, keywords) * 3 + tempScore(item, tempRules),
  }));

  const maxScore = Math.max(...scored.map(s => s.score));

  // 최고 점수 그룹에서 랜덤 선택
  const best = scored.filter(s => s.score === maxScore);
  return best[Math.floor(Math.random() * best.length)].item;
}

/**
 * 카테고리 + 계절 + 온도 → 무신사/네이버 쇼핑 검색 키워드 생성
 */
const SHOPPING_KEYWORDS = {
  상의: {
    겨울: ['기모 맨투맨', '두꺼운 니트', '울 스웨터'],
    봄:   ['봄 셔츠', '봄 가디건', '봄 니트'],
    여름: ['반팔 티셔츠', '린넨 셔츠', '민소매 탑'],
    가을: ['가을 니트', '긴팔 셔츠', '가을 맨투맨'],
  },
  하의: {
    겨울: ['기모 바지', '겨울 슬랙스', '두꺼운 청바지'],
    봄:   ['봄 슬랙스', '봄 청바지', '면 바지'],
    여름: ['여름 반바지', '린넨 팬츠', '숏팬츠'],
    가을: ['가을 청바지', '코듀로이 팬츠', '가을 슬랙스'],
  },
  아우터: {
    겨울: ['롱패딩', '두꺼운 코트', '플리스 자켓'],
    봄:   ['봄 자켓', '트렌치코트', '바람막이'],
    여름: ['얇은 바람막이', '여름 자켓'],
    가을: ['가을 자켓', '트렌치코트', '데님 자켓'],
  },
  신발: {
    겨울: ['겨울 부츠', '방한 스니커즈'],
    봄:   ['봄 스니커즈', '봄 단화', '캔버스화'],
    여름: ['여름 샌들', '슬리퍼', '캔버스화'],
    가을: ['가을 스니커즈', '앵클부츠', '첼시부츠'],
  },
  액세서리: {
    겨울: ['겨울 목도리', '비니', '장갑'],
    봄:   ['봄 모자', '경량 스카프'],
    여름: ['여름 모자', '선글라스'],
    가을: ['가을 모자', '스카프'],
  },
};

/**
 * 상황별 쇼핑 키워드 (상황이 명확할 때 계절 키워드보다 우선 적용)
 * 등산·운동처럼 기능성이 중요한 상황은 반드시 상황 특화 키워드 사용
 */
const SITUATION_SHOPPING_KEYWORDS = {
  '등산': {
    상의: ['등산 긴팔 티셔츠', '아웃도어 기능성 티셔츠', '등산 반팔'],
    하의: ['등산 바지', '트레킹 팬츠', '기능성 등산 레깅스'],
    아우터: ['등산 바람막이', '아웃도어 경량 자켓', '방수 등산 자켓'],
    신발: ['등산화', '트레킹화', '아웃도어 슈즈'],
    액세서리: ['등산 모자', '등산 스틱', '아웃도어 가방'],
  },
  '운동': {
    상의: ['스포츠 반팔 티셔츠', '운동 기능성 티셔츠', '러닝 티셔츠'],
    하의: ['운동 반바지', '트레이닝 팬츠', '스포츠 레깅스'],
    아우터: ['스포츠 집업', '트레이닝 자켓', '러닝 바람막이'],
    신발: ['러닝화', '운동화', '스포츠 스니커즈'],
    액세서리: ['스포츠 모자', '운동 크로스백', '스포츠 양말'],
  },
  '출근': {
    상의: ['오피스 셔츠', '비즈니스 블라우스', '오피스 니트'],
    하의: ['슬랙스', '정장 바지', '오피스 스커트'],
    아우터: ['정장 자켓', '블레이저', '오피스 코트'],
    신발: ['구두', '오피스 로퍼', '힐'],
    액세서리: ['비즈니스 가방', '오피스 벨트'],
  },
  '데이트': {
    상의: ['데이트 블라우스', '페미닌 니트', '데이트 티셔츠'],
    하의: ['플리츠 스커트', '데이트 원피스', '슬림 팬츠'],
    아우터: ['데이트 가디건', '로맨틱 자켓'],
    신발: ['여성 힐', '앵클부츠', '예쁜 플랫슈즈'],
    액세서리: ['미니 크로스백', '데이트 귀걸이'],
  },
  '여행': {
    상의: ['여행 편한 티셔츠', '캐주얼 린넨 셔츠', '여행 맨투맨'],
    하의: ['여행 편한 팬츠', '조거 팬츠', '캐주얼 청바지'],
    아우터: ['여행 가디건', '경량 패딩 조끼', '여행 바람막이'],
    신발: ['여행 스니커즈', '편한 슬립온', '워킹화'],
    액세서리: ['여행 크로스백', '여행 모자', '여행 파우치'],
  },
  '등교': {
    상의: ['캐주얼 맨투맨', '학생 후드티', '캐주얼 티셔츠'],
    하의: ['청바지', '캐주얼 조거팬츠', '트레이닝 바지'],
    아우터: ['캐주얼 자켓', '후드 집업', '봄 가디건'],
    신발: ['캐주얼 스니커즈', '슬립온', '편한 운동화'],
    액세서리: ['학생 백팩', '캔버스 토트백'],
  },
  '모임': {
    상의: ['세미캐주얼 셔츠', '모임 니트', '깔끔한 블라우스'],
    하의: ['세미캐주얼 슬랙스', '깔끔한 팬츠', '미디 스커트'],
    아우터: ['모임 블레이저', '가디건 자켓', '세미캐주얼 코트'],
    신발: ['로퍼', '앵클부츠', '세미캐주얼 단화'],
    액세서리: ['클러치백', '세미캐주얼 크로스백'],
  },
};

function generateShoppingLinks(category, season, situation = null) {
  // 상황이 명확하고 해당 카테고리의 상황별 키워드가 있으면 우선 사용
  if (situation && SITUATION_SHOPPING_KEYWORDS[situation]?.[category]) {
    const situationKws = SITUATION_SHOPPING_KEYWORDS[situation][category];
    const keyword = situationKws[Math.floor(Math.random() * situationKws.length)];
    return {
      category,
      keyword,
      musinsaUrl: `https://www.musinsa.com/search/musinsa/integration?q=${encodeURIComponent(keyword)}`,
      naverUrl:   `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`,
    };
  }

  // 상황 키워드 없으면 계절 기반 폴백
  const keywords = SHOPPING_KEYWORDS[category]?.[season] || [];
  if (keywords.length === 0) return null;
  const keyword = keywords[Math.floor(Math.random() * keywords.length)];
  return {
    category,
    keyword,
    musinsaUrl: `https://www.musinsa.com/search/musinsa/integration?q=${encodeURIComponent(keyword)}`,
    naverUrl:   `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`,
  };
}

/**
 * 날씨 + 상황 기반 코디 추천
 * @param {Object} weather   { temp, condition, emoji }
 * @param {Array}  items     옷장 아이템 배열
 * @param {string} situation '출근'|'운동'|'등교'|'데이트'|'여행'|'등산'|'모임'|'기타'|null
 */
export function recommendOutfit(weather, items, situation = null) {
  if (!items || items.length === 0) return null;

  const { temp, condition } = weather;
  const isRaining = condition.includes('비');
  const isSnowing = condition.includes('눈');

  const keywords  = situation ? (SITUATION_KEYWORDS[situation] || []) : [];
  const tempRules = getTempRules(temp);

  // 샘플 아이템 제외
  const realItems = items.filter(item => !item.isSample);

  // 계절 필터링
  const currentSeason = getCurrentSeason();
  const seasonalItems = filterBySeason(realItems, currentSeason);

  // 카테고리별 그룹화
  const categories = seasonalItems.reduce((acc, item) => {
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
    message: '',
    situation: situation || null,
  };

  // 온도 + 상황 통합 선택
  recommendation.top       = pickItem(categories['상의'],     keywords, tempRules);
  recommendation.bottom    = pickItem(categories['하의'],     keywords, tempRules);
  recommendation.shoes     = pickItem(categories['신발'],     keywords, tempRules);
  recommendation.accessory = pickItem(categories['액세서리'], keywords, tempRules);

  // 아우터: 23도 미만일 때만
  if (temp < 23) {
    recommendation.outer = pickItem(categories['아우터'], keywords, tempRules);
  }

  // 메시지 조합
  const situationMsg = situation ? SITUATION_MESSAGES[situation] : null;
  const weatherMsg   = getTempDescription(temp);

  recommendation.message = situationMsg
    ? `${situationMsg}\n${weatherMsg}`
    : weatherMsg;

  if (isRaining) recommendation.message += '\n☂️ 비가 오니 우산과 방수 신발을 챙기세요!';
  if (isSnowing) recommendation.message += '\n❄️ 눈이 오니 미끄럽지 않은 신발을 신으세요!';

  // 옷장에 없는 카테고리 → 쇼핑 추천 링크 생성
  const missingCategories = [];
  if (!recommendation.top)       missingCategories.push('상의');
  if (!recommendation.bottom)    missingCategories.push('하의');
  if (!recommendation.shoes)     missingCategories.push('신발');
  if (temp < 23 && !recommendation.outer) missingCategories.push('아우터');

  recommendation.shoppingSuggestions = missingCategories
    .map(cat => generateShoppingLinks(cat, currentSeason, situation))
    .filter(Boolean);

  return recommendation;
}
