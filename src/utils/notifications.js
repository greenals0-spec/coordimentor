import { LocalNotifications } from '@capacitor/local-notifications';

// 요일 키 → Capacitor weekday (일=1, 월=2, ... 토=7)
const DAY_TO_WEEKDAY = {
  sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7,
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const SITUATION_EMOJI = {
  '출근': '💼', '운동': '🏃', '등교': '📚', '데이트': '💑',
  '여행': '✈️', '등산': '🏔️', '모임': '🎉', '기타': '📌',
};

// localStorage 키: 현재 등록된 알림 ID 목록 추적
const NOTIF_IDS_KEY = 'coordimentor_notif_ids';

function getSavedNotifIds() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_IDS_KEY) || '[]');
  } catch { return []; }
}

function saveNotifIds(ids) {
  localStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(ids));
}

// alarmId(string) + dayKey → 고유한 숫자 ID (NaN 방지)
function makeNotifId(alarmId, dayKey) {
  // alarmId는 Date.now().toString() 형식 → 마지막 6자리 사용
  const digits = alarmId.replace(/\D/g, '');
  const base = digits.length > 0 ? (parseInt(digits.slice(-6), 10) % 10000) : 0;
  const dayIdx = DAY_KEYS.indexOf(dayKey);
  return base * 10 + (dayIdx >= 0 ? dayIdx : 0);
}


async function ensureChannel() {
  await LocalNotifications.createChannel({
    id: 'morning_recommendation',
    name: '아침 코디 추천',
    importance: 5,
    description: '아침 알람 시간에 맞춰 추천 코디를 알려줍니다.',
    sound: 'default',
    visibility: 1,
    vibration: true,
  });
}

/** 모든 대기 중인 로컬 알림을 취소 (pending + 저장된 ID 목록 모두) */
export const cancelAllNotifications = async () => {
  try {
    // 1. Capacitor pending 목록으로 취소
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }
    // 2. 로컬에 저장된 ID 목록으로도 취소 (repeating 알림이 pending에 안 잡히는 경우 대비)
    const savedIds = getSavedNotifIds();
    if (savedIds.length > 0) {
      await LocalNotifications.cancel({
        notifications: savedIds.map(id => ({ id })),
      }).catch(() => {});
    }
    saveNotifIds([]);
  } catch (e) {
    console.error('cancelAllNotifications error:', e);
  }
};

/**
 * routineAlarms 배열을 기준으로 로컬 알림을 완전히 재동기화.
 * - 기존 대기 알림 전체 취소 후
 * - enabled=true 이고 days가 있는 알람만 요일별로 재등록
 *
 * @param {Array} routineAlarms  Firestore의 routineAlarms 배열
 */
export const scheduleRoutineAlarms = async (routineAlarms = []) => {
  try {
    await ensureChannel();

    // 1. 기존 예약 알림 전부 취소
    await cancelAllNotifications();

    const activeAlarms = routineAlarms.filter(
      a => a.enabled && Array.isArray(a.days) && a.days.length > 0 && a.time
    );
    if (activeAlarms.length === 0) {
      console.log('No active alarms — all notifications cleared.');
      return;
    }

    // 2. 권한 확인
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }

    // 3. 각 알람 × 각 요일 → 알림 생성
    // on: { weekday, hour, minute } + repeats: true 방식 사용
    // → Capacitor 공식 권장 방식, 매주 지정 요일·시간에 1번만 반복 발동
    const notifications = [];
    const registeredIds = [];

    for (const alarm of activeAlarms) {
      const [hours, minutes] = alarm.time.split(':').map(Number);
      const emoji = SITUATION_EMOJI[alarm.situation] || '👗';

      for (const day of alarm.days) {
        const weekday = DAY_TO_WEEKDAY[day];
        if (!weekday) continue;

        const notifId = makeNotifId(alarm.id, day);

        notifications.push({
          id: notifId,
          title: `${emoji} ${alarm.situation} 코디 추천`,
          body: '날씨에 맞는 옷차림을 준비했어요. 지금 확인해보세요!',
          schedule: {
            on: { weekday, hour: hours, minute: minutes },
            repeats: true,   // 매주 동일 요일·시간 반복 (1회 → 자동 재등록)
          },
          sound: 'default',
          channelId: 'morning_recommendation',
          extra: {
            type: 'routine_alarm',
            situation: alarm.situation,
            alarmId: alarm.id,
          },
        });
        registeredIds.push(notifId);
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      saveNotifIds(registeredIds); // 취소용 ID 목록 저장
      console.log(`Scheduled ${notifications.length} routine notification(s).`, registeredIds);
    }
  } catch (error) {
    console.error('scheduleRoutineAlarms error:', error);
  }
};

/** 테스트용: 5초 후 즉시 알림 */
export const testNotification = async () => {
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        title: '👗 테스트 추천 코디',
        body: '테스트 알림입니다. 클릭하면 팝업이 뜹니다!',
        id: 99,
        schedule: { at: new Date(Date.now() + 5000) },
        channelId: 'morning_recommendation',
        extra: { type: 'morning_recommendation' },
      },
    ],
  });
};
