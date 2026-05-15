import { LocalNotifications } from '@capacitor/local-notifications';

// 요일 키 → Capacitor weekday (일=1, 월=2, ... 토=7)
const DAY_TO_WEEKDAY = {
  sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7,
};

const SITUATION_EMOJI = {
  '출근': '💼', '운동': '🏃', '등교': '📚', '데이트': '💑',
  '여행': '✈️', '등산': '🏔️', '모임': '🎉', '기타': '📌',
};

// alarmId(string) + dayKey → 고유한 숫자 ID
function makeNotifId(alarmId, dayKey) {
  const base = parseInt(alarmId.slice(-7), 10) % 100000;
  const dayIdx = Object.keys(DAY_TO_WEEKDAY).indexOf(dayKey);
  return base * 10 + dayIdx;
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

/** 모든 대기 중인 로컬 알림을 취소 */
export const cancelAllNotifications = async () => {
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }
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
    const notifications = [];
    for (const alarm of activeAlarms) {
      const [hours, minutes] = alarm.time.split(':').map(Number);
      const emoji = SITUATION_EMOJI[alarm.situation] || '👗';

      for (const day of alarm.days) {
        const weekday = DAY_TO_WEEKDAY[day];
        if (!weekday) continue;

        notifications.push({
          id: makeNotifId(alarm.id, day),
          title: `${emoji} ${alarm.situation} 코디 추천`,
          body: '날씨에 맞는 옷차림을 준비했어요. 지금 확인해보세요!',
          schedule: {
            on: { weekday, hour: hours, minute: minutes },
          },
          sound: 'default',
          channelId: 'morning_recommendation',
          extra: {
            type: 'routine_alarm',
            situation: alarm.situation,
            alarmId: alarm.id,
          },
        });
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      console.log(`Scheduled ${notifications.length} routine notification(s).`);
    }
  } catch (error) {
    console.error('scheduleRoutineAlarms error:', error);
  }
};

/** 하위 호환: 단일 시간 매일 알림 (기존 코드에서 호출 시 대응) */
export const scheduleMorningNotification = async (timeStr, enabled) => {
  if (!enabled) {
    await cancelAllNotifications();
    return;
  }
  await scheduleRoutineAlarms([
    {
      id: 'legacy_morning',
      enabled: true,
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      time: timeStr,
      situation: '기타',
    },
  ]);
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
