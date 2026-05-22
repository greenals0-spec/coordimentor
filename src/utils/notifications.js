import { LocalNotifications } from '@capacitor/local-notifications';

// 요일 키 → Capacitor weekday (일=1, 월=2, ... 토=7)
const DAY_TO_WEEKDAY = {
  sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7,
};
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const SITUATION_EMOJI = {
  '출근': '💼', '운동': '🏃', '등교': '📚',
};

// ── 채널 생성 ──────────────────────────────────────────────
async function ensureChannel() {
  await LocalNotifications.createChannel({
    id: 'routine_alarm',
    name: '루틴 코디 알람',
    importance: 5,
    description: '설정한 요일·시간에 코디 알림을 보내드립니다.',
    sound: 'default',
    visibility: 1,
    vibration: true,
  });
}

// ── 알람별 notifId 생성 ────────────────────────────────────
// alarmId(Date.now 문자열) + dayKey → 고유 정수 ID
// 범위: 1_000_000 ~ 9_999_999 (7자리, 기타 ID와 충돌 없음)
function makeNotifId(alarmId, dayKey) {
  const digits = alarmId.replace(/\D/g, '');
  const base = digits.length >= 4
    ? parseInt(digits.slice(-4), 10)   // 마지막 4자리 (0~9999)
    : parseInt(digits, 10) % 10000;
  const dayIdx = DAY_KEYS.indexOf(dayKey);
  // 1000000 + base * 10 + dayIdx  → 절대 다른 ID 범위와 겹치지 않음
  return 1000000 + (base * 10) + (dayIdx >= 0 ? dayIdx : 0);
}

// 알람 하나에 대한 notifId 목록 생성 (days 배열 기반)
export function generateNotifIds(alarmId, days) {
  return days.map(day => makeNotifId(alarmId, day));
}

// ── 특정 알람 1개 취소 ─────────────────────────────────────
export const cancelAlarm = async (alarm) => {
  if (!alarm) return;
  const ids = alarm.notifIds && alarm.notifIds.length > 0
    ? alarm.notifIds
    : generateNotifIds(alarm.id, alarm.days || []);
  if (ids.length === 0) return;
  await LocalNotifications.cancel({
    notifications: ids.map(id => ({ id })),
  }).catch(() => {});
};

// ── 모든 알람 취소 ─────────────────────────────────────────
export const cancelAllNotifications = async (routineAlarms = []) => {
  try {
    // 1. Firestore 알람 목록 기반으로 정확히 취소
    const knownIds = [];
    for (const alarm of routineAlarms) {
      const ids = alarm.notifIds && alarm.notifIds.length > 0
        ? alarm.notifIds
        : generateNotifIds(alarm.id, alarm.days || []);
      knownIds.push(...ids);
    }
    if (knownIds.length > 0) {
      await LocalNotifications.cancel({
        notifications: knownIds.map(id => ({ id })),
      }).catch(() => {});
    }

    // 2. pending 목록도 전부 취소 (혹시 남은 것 처리)
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    // 3. 레거시 ID 범위 강제 취소 (이전 버전 알람 완전 제거)
    //    이전 makeNotifId 범위: 0~99996, 테스트용 99
    const legacyIds = [];
    for (let i = 0; i <= 100; i++) legacyIds.push(i);       // 0~100
    for (let i = 0; i < 500; i++) legacyIds.push(i * 10);  // 0~4990 (10단위)
    await LocalNotifications.cancel({
      notifications: legacyIds.map(id => ({ id })),
    }).catch(() => {});

  } catch (e) {
    console.error('cancelAllNotifications error:', e);
  }
};

// ── 루틴 알람 전체 재동기화 ───────────────────────────────
/**
 * Firestore routineAlarms 배열을 기준으로 로컬 알림을 완전히 재동기화.
 * @param {Array} routineAlarms  각 alarm에 notifIds 필드 포함 권장
 */
export const scheduleRoutineAlarms = async (routineAlarms = []) => {
  try {
    await ensureChannel();

    // 1. 기존 알람 전부 취소
    await cancelAllNotifications(routineAlarms);

    // 2. enabled=true 인 알람만 필터
    const activeAlarms = routineAlarms.filter(
      a => a.enabled && Array.isArray(a.days) && a.days.length > 0 && a.time
    );
    if (activeAlarms.length === 0) {
      console.log('[Alarm] No active alarms — all cleared.');
      return;
    }

    // 3. 권한 확인
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') {
        console.warn('[Alarm] Notification permission denied.');
        return;
      }
    }

    // 4. 알람 등록
    const notifications = [];

    for (const alarm of activeAlarms) {
      const timeParts = alarm.time.split(':');
      const hour   = parseInt(timeParts[0], 10);  // 0~23 (24시간제)
      const minute = parseInt(timeParts[1], 10);
      const emoji  = SITUATION_EMOJI[alarm.situation] || '👗';
      const ampm   = hour < 12 ? '오전' : '오후';
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

      for (const day of alarm.days) {
        const weekday = DAY_TO_WEEKDAY[day];
        if (!weekday) continue;

        // notifIds가 저장돼있으면 사용, 없으면 생성
        const notifId = makeNotifId(alarm.id, day);

        notifications.push({
          id: notifId,
          title: `${emoji} ${alarm.situation} 코디 추천`,
          body: `${ampm} ${hour12}:${String(minute).padStart(2, '0')} · 날씨에 맞는 옷차림을 확인해보세요!`,
          schedule: {
            on: { weekday, hour, minute },  // 24시간제 → 정확한 오전/오후 보장
            repeats: true,
          },
          sound: 'default',
          channelId: 'routine_alarm',
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
      console.log(`[Alarm] Scheduled ${notifications.length} notification(s).`,
        notifications.map(n => `id:${n.id} ${n.title} weekday:${n.schedule.on.weekday} ${n.schedule.on.hour}:${String(n.schedule.on.minute).padStart(2,'0')}`));
    }
  } catch (error) {
    console.error('[Alarm] scheduleRoutineAlarms error:', error);
  }
};

/** 테스트용: 5초 후 즉시 알림 */
export const testNotification = async () => {
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: [{
      title: '👗 테스트 코디 알림',
      body: '테스트 알림입니다!',
      id: 9999999,  // 루틴 알람 범위(1000000~) 밖의 고정 ID
      schedule: { at: new Date(Date.now() + 5000) },
      channelId: 'routine_alarm',
      extra: { type: 'test' },
    }],
  });
};
