import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { Capacitor } from '@capacitor/core';
import { initSampleItems } from '../utils/sampleItems';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [userProfile, setUserProfile] = useState(undefined);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(db, 'users', currentUser.uid, 'profile', 'info');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            setIsPremium(data.isPremium ?? false);
            // 로그인할 때마다 샘플 의상 체크 (최초 1회, 성별 맞춤 지급)
            initSampleItems(currentUser.uid, data.gender).catch(() => {});
          } else {
            setUserProfile(null);
            setIsPremium(false);
          }
        } catch (e) {
          console.warn('프로필 조회 실패, 온보딩으로 이동:', e);
          setUserProfile(null);
          setIsPremium(false);
        }
      } else {
        setUserProfile(undefined);
        setIsPremium(false);
      }
    });
  }, []);

  const signInWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      // 네이티브 앱: @capacitor-firebase/authentication 사용
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithGoogle();
      const credential = GoogleAuthProvider.credential(result.credential?.idToken);
      return signInWithCredential(auth, credential);
    } else {
      // 웹: 팝업 방식
      return signInWithPopup(auth, googleProvider);
    }
  };

  const signInWithEmail = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const signUpWithEmail = async (email, password, name) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    setUser({ ...cred.user, displayName: name });
  };

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  const signOut = () => firebaseSignOut(auth);

  const updateUserProfile = async (uid, data) => {
    const docRef = doc(db, 'users', uid, 'profile', 'info');
    await setDoc(docRef, data, { merge: true });
    setUserProfile(prev => ({ ...prev, ...data }));
    // 샘플 의상 지급 (신규 가입 시, 성별 맞춤 1회 지급)
    await initSampleItems(uid, data.gender);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, isPremium, updateUserProfile, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
