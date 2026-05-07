import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

const itemsCol = (uid) => collection(db, 'users', uid, 'items');
const savedOutfitsCol = (uid) => collection(db, 'users', uid, 'saved_outfits');

const withTimeout = (promise, ms, msg) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);

// ─── 업로드 전 이미지 압축 (WebP, maxSize px, 품질 0.82) ──────────────────────
export const compressImage = (blob, maxSize = 600) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      // WebP 지원 여부 확인 후 포맷 결정
      const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
      const fmt = supportsWebP ? 'image/webp' : 'image/jpeg';
      canvas.toBlob((compressed) => resolve(compressed || blob), fmt, 0.82);
    };
    img.onerror = () => resolve(blob); // 실패 시 원본 사용
    img.src = URL.createObjectURL(blob);
  });

export const uploadImage = async (uid, blob) => {
  // 압축 후 업로드
  const compressed = await compressImage(blob);
  const ext = compressed.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `users/${uid}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await withTimeout(
    uploadBytes(storageRef, compressed, {
      contentType: compressed.type,
      cacheControl: 'public, max-age=31536000', // 1년 캐시
    }),
    15000,
    'Firebase Storage 업로드 시간 초과 — Storage가 콘솔에서 활성화됐는지 확인해주세요.'
  );
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

export const updateItem = async (uid, itemId, newData) => {
  await updateDoc(doc(db, 'users', uid, 'items', itemId), newData);
};

// ─── 이미지 프리로드 캐시 (앱 실행 중 메모리 유지) ───────────────────────────
const _imgCache = new Set();

export const isImageCached = (url) => _imgCache.has(url);
export const markImageCached = (url) => url && _imgCache.add(url);

const preloadImages = (items) => {
  items.forEach(item => {
    if (!item.imageUrl || _imgCache.has(item.imageUrl)) return;
    _imgCache.add(item.imageUrl);
    const img = new Image();
    img.src = item.imageUrl;
  });
};

// callback(items) — returns unsubscribe fn
export const subscribeToItems = (uid, callback) => {
  const q = query(itemsCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    preloadImages(items); // Firestore 데이터 도착 즉시 이미지 프리로드
    callback(items);
  });
};

export const getItemsOnce = (uid) =>
  new Promise((resolve) => {
    const unsub = subscribeToItems(uid, (items) => {
      unsub();
      resolve(items);
    });
  });

// --- Saved Outfits ---
export const saveOutfit = async (uid, outfitData) => {
  const docRef = await withTimeout(
    addDoc(savedOutfitsCol(uid), { ...outfitData, createdAt: serverTimestamp() }),
    10000,
    '코디 저장 시간 초과'
  );
  return docRef.id;
};

export const deleteSavedOutfit = async (uid, outfitId) => {
  await deleteDoc(doc(db, 'users', uid, 'saved_outfits', outfitId));
};

export const subscribeToSavedOutfits = (uid, callback) => {
  const q = query(savedOutfitsCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};
