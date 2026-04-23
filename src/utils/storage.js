import {
  collection, addDoc, deleteDoc, doc,
  query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

const itemsCol = (uid) => collection(db, 'users', uid, 'items');

const withTimeout = (promise, ms, msg) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);

export const uploadImage = async (uid, blob) => {
  const path = `users/${uid}/${Date.now()}.png`;
  const storageRef = ref(storage, path);
  await withTimeout(
    uploadBytes(storageRef, blob),
    15000,
    'Firebase Storage 업로드 시간 초과 — Storage가 콘솔에서 활성화됐는지 확인해주세요.'
  );
  // getDownloadURL 대신 URL 직접 생성 (CORS 이슈 회피)
  const bucket = storage.app.options.storageBucket;
  const encoded = encodeURIComponent(path);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media`;
  return { url, path };
};

export const saveItem = async (uid, item) => {
  const docRef = await withTimeout(
    addDoc(itemsCol(uid), { ...item, createdAt: serverTimestamp() }),
    10000,
    'Firestore 저장 시간 초과 — Firestore가 콘솔에서 활성화됐는지 확인해주세요.'
  );
  return docRef.id;
};

export const deleteItem = async (uid, itemId, imagePath) => {
  await deleteDoc(doc(db, 'users', uid, 'items', itemId));
  if (imagePath) {
    try { await deleteObject(ref(storage, imagePath)); } catch {}
  }
};

// callback(items) — returns unsubscribe fn
export const subscribeToItems = (uid, callback) => {
  const q = query(itemsCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

export const getItemsOnce = (uid) =>
  new Promise((resolve) => {
    const unsub = subscribeToItems(uid, (items) => {
      unsub();
      resolve(items);
    });
  });
