import { LocalNotifications } from '@capacitor/local-notifications';

export const scheduleMorningNotification = async (timeStr, enabled) => {
  try {
    // 1. 기존 알림 삭제 및 채널 생성 (안드로이드 필수)
    await LocalNotifications.createChannel({
      id: 'morning_recommendation',
      name: '아침 코디 추천',
      importance: 5,
      description: '아침 알람 시간에 맞춰 추천 코디를 알려줍니다.',
      sound: 'default',
      visibility: 1,
      vibration: true,
    });

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    if (!enabled) return;

    // 2. 권한 확인
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const request = await LocalNotifications.requestPermissions();
      if (request.display !== 'granted') return;
    }

    // 3. 시간 계산 (HH:mm)
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    let scheduleDate = new Date();
    scheduleDate.setHours(hours, minutes, 0, 0);

    // 이미 지난 시간이면 내일로 설정
    if (scheduleDate <= now) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    // 4. 알림 등록
    await LocalNotifications.schedule({
      notifications: [
        {
          title: '👗 오늘의 추천 코디',
          body: '날씨에 맞는 옷차림을 준비했어요. 지금 확인해보세요!',
          id: 1,
          schedule: { at: scheduleDate, repeats: true, every: 'day' },
          sound: 'default',
          channelId: 'morning_recommendation',
          extra: {
            type: 'morning_recommendation'
          }
        }
      ]
    });

    console.log('Notification scheduled for:', scheduleDate);
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
};

export const testNotification = async () => {
  await LocalNotifications.schedule({
    notifications: [
      {
        title: '👗 테스트 추천 코디',
        body: '테스트 알림입니다. 클릭하면 팝업이 뜹니다!',
        id: 99,
        schedule: { at: new Date(Date.now() + 5000) }, // 5초 후
        channelId: 'morning_recommendation',
        extra: { type: 'morning_recommendation' }
      }
    ]
  });
};
