import { Capacitor } from '@capacitor/core';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const initPushNotifications = async (userId) => {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // 권한 요청
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // FCM 등록
    await PushNotifications.register();

    // 토큰 수신 → Firestore 저장
    // (pushNotificationReceived / pushNotificationActionPerformed 리스너는
    //  App.js 에서 앱 마운트 즉시 등록하므로 여기서는 등록하지 않음)
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', async (token) => {
        console.log('FCM Token:', token.value);
        try {
          await setDoc(doc(db, 'users', userId), {
            fcmToken: token.value,
            fcmUpdatedAt: new Date(),
          }, { merge: true });
        } catch (e) {
          console.error('FCM token save error:', e);
        }
        resolve(token.value);
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('FCM registration error:', err);
        resolve(null);
      });
    });
  } catch (e) {
    console.error('Push notification init error:', e);
    return null;
  }
};
