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
 * 1. avoid 태그가 있는 아이템 제외 (가능한 경우)
 * 2. 상황 키워드 매칭 우선
 * 3. 온도 prefer 점수 우선
 * 4. 최후의 수단: 전체 랜덤
 */
function pickItem(list, keywords, tempRules) {
  if (!list || list.length === 0) return null;

  // avoid 아이템 제거 (남은 게 있을 때만)
  const notAvoided = list.filter(item => tempScore(item, tempRules) >= 0);
  const pool = notAvoided.length > 0 ? notAvoided : list;

  // 상황 키워드 AND 온도 prefer 모두 고려한 종합 점수
  const scored = pool.map(item => ({
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
    겨울: ['롱패딩', '두꺼운 코트', '퍼 자켓'],
    봄:   ['봄 자켓', '트렌치코트', '봄 가디건'],
    여름: ['얇은 가디건', '여름 자켓'],
    가을: ['가을 자켓', '트렌치코트', '데님 자켓'],
  },
  신발: {
    겨울: ['겨울 부츠', '방한 스니커즈'],
    봄:   ['봄 스니커즈', '로퍼', '봄 단화'],
    여름: ['여름 샌들', '슬리퍼', '캔버스화'],
    가을: ['가을 로퍼', '가을 스니커즈', '첼시부츠'],
  },
  액세서리: {
    겨울: ['겨울 목도리', '비니', '장갑'],
    봄:   ['봄 모자', '경량 스카프'],
    여름: ['여름 모자', '선글라스'],
    가을: ['가을 모자', '스카프'],
  },
};

function generateShoppingLinks(category, season) {
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
    .map(cat => generateShoppingLinks(cat, currentSeason))
    .filter(Boolean);

  return recommendation;
}
