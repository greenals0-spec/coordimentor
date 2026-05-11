const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

// 요일 키 매핑
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// PRE_GENERATE_MINUTES 분 전에 추천 코디 미리 생성
const PRE_GENERATE_MINUTES = 5;

// 시간 문자열에 분 더하기 / 빼기 ("07:30" + (-5) → "07:25")
function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  let total = h * 60 + m + minutes;
  total = ((total % 1440) + 1440) % 1440; // 음수/24시 넘김 처리
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// 상황별 알림 메시지
const SITUATION_MESSAGES = {
  '출근': { title: '💼 출근 코디 추천', body: '오늘 날씨에 맞는 출근 코디를 확인해보세요!' },
  '운동': { title: '🏃 운동 코디 추천', body: '오늘 날씨에 딱 맞는 운동복을 준비해보세요!' },
  '등교': { title: '📚 등교 코디 추천', body: '오늘 날씨에 어울리는 등교 코디예요!' },
  '데이트': { title: '💑 데이트 코디 추천', body: '오늘 날씨에 맞는 데이트 코디를 확인해보세요!' },
  '여행': { title: '✈️ 여행 코디 추천', body: '여행 날씨에 맞게 챙겨가세요!' },
  '등산': { title: '🏔️ 등산 코디 추천', body: '오늘 날씨에 맞는 등산 복장을 확인해보세요!' },
  '모임': { title: '🎉 모임 코디 추천', body: '오늘 날씨에 어울리는 모임 코디예요!' },
  '기타': { title: '👗 코디 추천', body: '오늘 날씨에 맞는 코디를 확인해보세요!' },
};

// ── Open-Meteo WMO 코드 → 날씨 표현 ───────────────────────────────────────────
const WMO_MAP = {
  0:  { condition: '맑음',       emoji: '☀️' },
  1:  { condition: '맑음',       emoji: '🌤️' },
  2:  { condition: '구름조금',   emoji: '⛅' },
  3:  { condition: '흐림',       emoji: '☁️' },
  45: { condition: '안개',       emoji: '🌫️' },
  48: { condition: '안개',       emoji: '🌫️' },
  51: { condition: '이슬비',     emoji: '🌦️' },
  53: { condition: '이슬비',     emoji: '🌦️' },
  55: { condition: '이슬비',     emoji: '🌦️' },
  61: { condition: '비',         emoji: '🌧️' },
  63: { condition: '비',         emoji: '🌧️' },
  65: { condition: '강한 비',    emoji: '🌧️' },
  71: { condition: '눈',         emoji: '❄️' },
  73: { condition: '눈',         emoji: '❄️' },
  75: { condition: '강한 눈',    emoji: '❄️' },
  80: { condition: '소나기',     emoji: '🌦️' },
  81: { condition: '소나기',     emoji: '🌧️' },
  82: { condition: '강한 소나기',emoji: '🌧️' },
  95: { condition: '뇌우',       emoji: '⛈️' },
  99: { condition: '뇌우',       emoji: '⛈️' },
};

// Open-Meteo로 현재 날씨 가져오기 (API 키 불필요)
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,weather_code`
    + `&timezone=Asia%2FSeoul`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();
  const temp = Math.round(data.current.temperature_2m);
  const code = data.current.weather_code;
  const { condition, emoji } = WMO_MAP[code] ?? { condition: '흐림', emoji: '⛅' };
  return { temp, condition, emoji };
}

// ── 추천 알고리즘 (recommendation.js 포팅) ────────────────────────────────────
const TEMP_GUIDE = [
  { max: 4,   label: '패딩, 두꺼운 코트, 목도리, 기모 제품이 필요한 날씨예요.' },
  { max: 8,   label: '코트, 가죽 자켓, 히트텍, 니트를 입어야 할 것 같아요.' },
  { max: 11,  label: '자켓이나 트렌치코트에 두꺼운 하의가 필요해요.' },
  { max: 16,  label: '자켓이나 가디건을 챙기면 딱 좋을 날씨예요.' },
  { max: 19,  label: '맨투맨이나 후드티 정도면 충분해요.' },
  { max: 22,  label: '긴팔 티셔츠나 얇은 셔츠가 어울리는 날씨예요.' },
  { max: 27,  label: '반팔 티셔츠나 얇은 셔츠로 가볍게 입어요.' },
  { max: 100, label: '민소매, 반팔, 린넨 소재로 시원하게 입어요.' },
];

const SITUATION_KEYWORDS = {
  '출근': ['정장','슬랙스','셔츠','블라우스','재킷','구두','로퍼','오피스','비즈니스','포멀'],
  '운동': ['스포츠','운동','레깅스','트레이닝','러닝','짐','스니커즈','반바지','운동화','액티브'],
  '등교': ['캐주얼','청바지','후드','맨투맨','스니커즈','백팩','편한','학교'],
  '데이트': ['원피스','스커트','블라우스','로맨틱','페미닌','힐','드레스','데이트','세련'],
  '여행': ['편한','캐주얼','스니커즈','가디건','레이어드','여행','실용적'],
  '등산': ['아웃도어','등산','트레킹','방수','기능성','바람막이','등산화','레깅스'],
  '모임': ['세미캐주얼','니트','슬랙스','로퍼','모임','깔끔','깔끔한','반정장'],
  '기타': [],
};

const SITUATION_MSG_TEXT = {
  '출근': '오늘도 프로답게! 날씨에 맞는 출근 코디를 골랐어요.',
  '운동': '오늘 운동 파이팅! 활동하기 편한 코디로 준비했어요.',
  '등교': '등교 준비 완료! 날씨에 맞게 가볍고 편한 코디예요.',
  '데이트': '설레는 데이트! 날씨에 어울리는 로맨틱한 코디를 골랐어요.',
  '여행': '즐거운 여행! 편하면서도 스타일리시한 코디를 준비했어요.',
  '등산': '산에서도 멋지게! 기능성과 스타일을 모두 잡은 코디예요.',
  '모임': '모임 준비 완료! 날씨에 맞는 깔끔한 코디를 골랐어요.',
  '기타': null,
};

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

function pickBySituation(list, keywords) {
  if (!list || list.length === 0) return null;
  if (keywords && keywords.length > 0) {
    const matched = list.filter(item => situationScore(item, keywords) > 0);
    if (matched.length > 0) return matched[Math.floor(Math.random() * matched.length)];
  }
  const basicKeywords = ['기본','베이직','무지','심플','평상시','데일리'];
  const basicItems = list.filter(item => situationScore(item, basicKeywords) > 0);
  if (basicItems.length > 0) return basicItems[Math.floor(Math.random() * basicItems.length)];
  return list[Math.floor(Math.random() * list.length)];
}

function recommendOutfit(weather, items, situation) {
  if (!items || items.length === 0) return null;
  const { temp, condition } = weather;
  const isRaining = condition.includes('비');
  const isSnowing = condition.includes('눈');
  const keywords = situation ? (SITUATION_KEYWORDS[situation] || []) : [];

  const categories = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const rec = {
    top:       pickBySituation(categories['상의'],    keywords),
    bottom:    pickBySituation(categories['하의'],    keywords),
    outer:     temp < 23 ? pickBySituation(categories['아우터'],  keywords) : null,
    shoes:     pickBySituation(categories['신발'],    keywords),
    accessory: pickBySituation(categories['액세서리'], keywords),
    message:   '',
    situation: situation || null,
    weather,
  };

  const guide     = TEMP_GUIDE.find(g => temp <= g.max);
  const weatherMsg = guide ? guide.label : '날씨에 맞는 옷차림을 준비하세요.';
  const situMsg    = situation ? SITUATION_MSG_TEXT[situation] : null;

  rec.message = situMsg ? `${situMsg}\n${weatherMsg}` : weatherMsg;
  if (isRaining) rec.message += '\n☂️ 비가 오니 우산과 방수 신발을 챙기세요!';
  if (isSnowing) rec.message += '\n❄️ 눈이 오니 미끄럽지 않은 신발을 신으세요!';

  return rec;
}

// ── 공통: 유저 아이템 로드 + 날씨 조회 + 추천 생성 + Firestore 저장 ─────────
async function generateAndSavePendingRecommendation(db, uid, situation) {
  try {
    // 유저 위치 (없으면 서울 기본값)
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() || {};
    const lat = userData.lastKnownLat ?? 37.5665;
    const lon = userData.lastKnownLon ?? 126.9780;

    // 날씨 조회
    const weather = await fetchWeather(lat, lon);

    // 아이템 목록 로드
    const itemsSnap = await db.collection('users').doc(uid).collection('items').get();
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (items.length === 0) {
      console.log(`[Recommendation] No items for user ${uid}, skipping`);
      return false;
    }

    // 추천 생성
    const rec = recommendOutfit(weather, items, situation);
    if (!rec) return false;

    // Firestore에 pendingRecommendation 저장
    // imageUrl 등 데이터는 item 객체 내에 포함됨
    await db.collection('users').doc(uid).update({
      pendingRecommendation: {
        ...rec,
        generatedAt: Date.now(),
      },
    });

    console.log(`[Recommendation] Saved pendingRecommendation for user ${uid}`);
    return true;
  } catch (e) {
    console.error(`[Recommendation] Failed for user ${uid}:`, e.message);
    return false;
  }
}

// ── 매 분 실행: 아침 알람 발송 ────────────────────────────────────────────────
exports.sendMorningAlarms = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'Asia/Seoul', region: 'asia-northeast3' },
  async () => {
    const db = getFirestore();
    const messaging = getMessaging();

    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const hours   = String(koreaTime.getHours()).padStart(2, '0');
    const minutes = String(koreaTime.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    const todayStr = koreaTime.toISOString().slice(0, 10);

    // ── Phase 1: N분 전 → 추천 미리 생성 ──
    const prepTargetTime = addMinutesToTime(currentTime, PRE_GENERATE_MINUTES); // 현재+5 = 알람시각
    const prepSnapshot = await db.collection('users')
      .where('alarmEnabled', '==', true)
      .where('alarmTime', '==', prepTargetTime)
      .get();

    for (const docSnap of prepSnapshot.docs) {
      const user = docSnap.data();
      const uid  = docSnap.id;
      if (user.lastAlarmSentDate === todayStr) continue; // 오늘 이미 발송 완료
      console.log(`[MorningAlarm] PRE-GENERATING for uid=${uid}, alarm=${prepTargetTime}`);
      await generateAndSavePendingRecommendation(db, uid, null);
    }

    // ── Phase 2: 알람 시각 → 알림 발송 ──
    const sendSnapshot = await db.collection('users')
      .where('alarmEnabled', '==', true)
      .where('alarmTime', '==', currentTime)
      .get();

    if (sendSnapshot.empty) return;

    const messages = [];
    const docsToUpdate = [];

    for (const docSnap of sendSnapshot.docs) {
      const user = docSnap.data();
      const uid  = docSnap.id;
      if (user.lastAlarmSentDate === todayStr) continue;
      if (!user.fcmToken) continue;

      // pendingRecommendation이 아직 없으면 지금 생성 (혹시 모를 fallback)
      const userSnap = await db.collection('users').doc(uid).get();
      if (!userSnap.data()?.pendingRecommendation) {
        console.log(`[MorningAlarm] Fallback generating for uid=${uid}`);
        await generateAndSavePendingRecommendation(db, uid, null);
      }

      messages.push({
        token: user.fcmToken,
        notification: {
          title: '👗 오늘의 추천 코디',
          body: '날씨에 맞는 코디가 준비됐어요! 확인해보세요.',
        },
        data: { type: 'morning_recommendation' },
        android: {
          priority: 'high',
          notification: {
            channelId: 'morning_recommendation',
            priority: 'max',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });
      docsToUpdate.push(uid);
    }

    if (messages.length === 0) return;

    const response = await messaging.sendEach(messages);
    console.log(`[MorningAlarm] Sent ${response.successCount} / ${messages.length}`);

    const updatePromises = [];
    response.responses.forEach((res, idx) => {
      const uid = docsToUpdate[idx];
      if (res.success) {
        updatePromises.push(db.collection('users').doc(uid).update({ lastAlarmSentDate: todayStr }));
      } else if (res.error?.code === 'messaging/registration-token-not-registered') {
        updatePromises.push(db.collection('users').doc(uid).update({ fcmToken: FieldValue.delete() }));
      }
    });
    await Promise.all(updatePromises);
  }
);

// ── 매 분 실행: 루틴 코디 알람 발송 ──────────────────────────────────────────
exports.sendRoutineAlarms = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'Asia/Seoul', region: 'asia-northeast3' },
  async () => {
    const db = getFirestore();
    const messaging = getMessaging();

    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const hours      = String(koreaTime.getHours()).padStart(2, '0');
    const minutes    = String(koreaTime.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    const currentDay  = DAY_KEYS[koreaTime.getDay()];
    const todayStr    = koreaTime.toISOString().slice(0, 10);

    // 5분 후 알람 시각 (= 지금 pre-generate 해야 할 알람)
    const prepTargetTime = addMinutesToTime(currentTime, PRE_GENERATE_MINUTES);

    console.log(`[RoutineAlarm] ${currentDay} ${currentTime} | prep target: ${prepTargetTime}`);

    const snapshot = await db.collection('users')
      .where('routineAlarms', '!=', null)
      .get();

    if (snapshot.empty) return;

    const messages  = [];
    const updateMap = {};

    for (const docSnap of snapshot.docs) {
      const user = docSnap.data();
      const uid  = docSnap.id;
      if (!Array.isArray(user.routineAlarms)) continue;

      for (const alarm of user.routineAlarms) {
        if (!alarm.enabled) continue;
        if (!alarm.days?.includes(currentDay)) continue;

        const sentKey = `routineSent_${alarm.id}_${todayStr}`;
        if (user[sentKey]) continue;

        // ── Phase 1: 알람 5분 전 → 추천 미리 생성 (알림 발송 안 함) ──
        if (alarm.time === prepTargetTime) {
          console.log(`[RoutineAlarm] PRE-GENERATING for uid=${uid}, alarm=${alarm.time}, situation=${alarm.situation}`);
          await generateAndSavePendingRecommendation(db, uid, alarm.situation);
          continue; // 알림은 발송하지 않음
        }

        // ── Phase 2: 정확한 알람 시각 → 알림 발송 ──
        if (alarm.time === currentTime) {
          if (!user.fcmToken) continue;

          // pendingRecommendation 없으면 지금 생성 (fallback)
          const freshSnap = await db.collection('users').doc(uid).get();
          if (!freshSnap.data()?.pendingRecommendation) {
            console.log(`[RoutineAlarm] Fallback generating for uid=${uid}`);
            await generateAndSavePendingRecommendation(db, uid, alarm.situation);
          }

          const msg = SITUATION_MESSAGES[alarm.situation] || SITUATION_MESSAGES['기타'];
          messages.push({
            token: user.fcmToken,
            notification: { title: msg.title, body: msg.body },
            data: { type: 'routine_alarm', situation: alarm.situation },
            android: {
              priority: 'high',
              notification: {
                channelId: 'morning_recommendation',
                priority: 'max',
                defaultSound: true,
                defaultVibrateTimings: true,
              },
            },
            apns: {
              payload: { aps: { sound: 'default', badge: 1 } },
            },
          });

          if (!updateMap[uid]) updateMap[uid] = [];
          updateMap[uid].push(alarm.id);
        }
      }
    }

    if (messages.length === 0) {
      console.log('[RoutineAlarm] No alarms to send this minute');
      return;
    }

    const response = await messaging.sendEach(messages);
    console.log(`[RoutineAlarm] Sent ${response.successCount} / ${messages.length}`);

    let msgIdx = 0;
    const updatePromises = [];
    for (const uid of Object.keys(updateMap)) {
      const alarmIds = updateMap[uid];
      const res = response.responses[msgIdx++];
      if (res.success) {
        const updates = {};
        alarmIds.forEach(id => { updates[`routineSent_${id}_${todayStr}`] = true; });
        updatePromises.push(db.collection('users').doc(uid).update(updates));
      }
    }
    await Promise.all(updatePromises);
  }
);
