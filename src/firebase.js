import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
export const db = getFirestore(app);
export const storage = getStorage(app);
