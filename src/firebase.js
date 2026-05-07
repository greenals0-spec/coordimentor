import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyC1NfPHiGqi3__IUYRd-ENjWGy3LTunwmU",
  authDomain: "coordimentor.web.app",
  projectId: "coordimentor",
  storageBucket: "coordimentor.firebasestorage.app",
  messagingSenderId: "591487860438",
  appId: "1:591487860438:web:feb9f38fbcebeb5fba5377",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 오프라인 영구 캐시: 앱 재시작 시 Firestore 데이터 즉시 반환 (네트워크 대기 없음)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);
