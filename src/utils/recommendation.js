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
  '기타': null, // 기타는 날씨 메시지 사용
};

export function getTempDescription(temp) {
  const guide = TEMP_GUIDE.find(g => temp <= g.max);
  return guide ? guide.label : '날씨에 맞는 적절한 옷차림을 준비하세요.';
}

/**
 * 상황 키워드와 아이템 tags를 매칭해 점수 계산
 */
function situationScore(item, keywords) {
  if (!keywords || keywords.length === 0) return 0;
  const tags = [
    ...(item.tags || []),
    item.name || '',
    item.category || '',
    item.memo || '',
  ].join(' ').toLowerCase();
  return keywords.filter(k => tags.includes(k)).length;
}

/**
 * 상황 선호도를 고려해 카테고리에서 아이템 선택
 * 매칭 점수가 높은 아이템을 우선 선택, 없으면 랜덤
 */
/**
 * 상황 선호도를 고려해 카테고리에서 아이템 선택
 * 1. 상황 키워드와 매칭되는 아이템이 있다면 그 중에서만 랜덤 선택 (엄격한 필터링)
 * 2. 매칭되는 아이템이 없다면 '기본/베이직' 키워드가 포함된 아이템 선택
 * 3. 그것도 없다면 전체에서 랜덤 선택 (최후의 수단)
 */
function pickBySituation(list, keywords) {
  if (!list || list.length === 0) return null;
  
  // 1. 상황 키워드 매칭 필터링
  if (keywords && keywords.length > 0) {
    const matched = list.filter(item => situationScore(item, keywords) > 0);
    if (matched.length > 0) {
      return matched[Math.floor(Math.random() * matched.length)];
    }
  }

  // 2. 기본템 필터링 (상황에 맞는게 없을 때 안전한 선택)
  const basicKeywords = ['기본', '베이직', '무지', '심플', '평상시', '데일리'];
  const basicItems = list.filter(item => situationScore(item, basicKeywords) > 0);
  if (basicItems.length > 0) {
    return basicItems[Math.floor(Math.random() * basicItems.length)];
  }

  // 3. 최후의 수단 (랜덤)
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 날씨 + 상황 기반 코디 추천
 * @param {Object} weather { temp, condition, emoji }
 * @param {Array}  items   옷장 아이템 배열
 * @param {string} situation '출근'|'운동'|'등교'|'데이트'|'여행'|'등산'|'모임'|'기타'|null
 */
export function recommendOutfit(weather, items, situation = null) {
  if (!items || items.length === 0) return null;

  const { temp, condition } = weather;
  const isRaining = condition.includes('비');
  const isSnowing = condition.includes('눈');

  const keywords = situation ? (SITUATION_KEYWORDS[situation] || []) : [];

  // 카테고리별 그룹화
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
    message: '',
    situation: situation || null,
  };

  // 상황 기반 아이템 선택
  recommendation.top      = pickBySituation(categories['상의'], keywords);
  recommendation.bottom   = pickBySituation(categories['하의'], keywords);
  recommendation.shoes    = pickBySituation(categories['신발'], keywords);
  recommendation.accessory = pickBySituation(categories['액세서리'], keywords);

  // 아우터: 23도 미만일 때만
  if (temp < 23) {
    recommendation.outer = pickBySituation(categories['아우터'], keywords);
  }

  // 메시지 조합: 상황 메시지 + 날씨 설명
  const situationMsg = situation ? SITUATION_MESSAGES[situation] : null;
  const weatherMsg   = getTempDescription(temp);

  if (situationMsg) {
    recommendation.message = `${situationMsg}\n${weatherMsg}`;
  } else {
    recommendation.message = weatherMsg;
  }

  if (isRaining)  recommendation.message += '\n☂️ 비가 오니 우산과 방수 신발을 챙기세요!';
  if (isSnowing)  recommendation.message += '\n❄️ 눈이 오니 미끄럽지 않은 신발을 신으세요!';

  return recommendation;
}
