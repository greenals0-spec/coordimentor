import { doc, getDoc, updateDoc, increment, setDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';

// ── 관리자 계정 (포인트 차감 면제) ───────────────────────
const ADMIN_EMAILS = ['greenals0@gmail.com'];
export const isAdminUser = () => {
  const email = auth.currentUser?.email;
  return email ? ADMIN_EMAILS.includes(email) : false;
};

// ── 포인트 비용 상수 ──────────────────────────────────────
export const POINT_COSTS = {
  ITEM_REGISTER: 50,    // 옷 1벌 등록
  TRY_ON:       100,    // 가상 입어보기
  OUTFIT_REC:   100,    // 코디 추천
  ROUTINE_ALARM: 100,   // 루틴 알람 설정
};

export const INITIAL_POINTS = 1000;

// ── 포인트 조회 ───────────────────────────────────────────
export async function getPoints(uid) {
  if (isAdminUser()) return 999999; // 관리자는 항상 충분한 포인트
  const ref = doc(db, 'users', uid, 'profile', 'info');
  const snap = await getDoc(ref);
  if (!snap.exists()) return 0;
  return snap.data().points ?? 0;
}

// ── 포인트 차감 (부족 시 false 반환) ─────────────────────
export async function deductPoints(uid, amount, reason = '') {
  if (isAdminUser()) return true; // 관리자 계정은 차감 없이 통과

  const ref = doc(db, 'users', uid, 'profile', 'info');
  const snap = await getDoc(ref);
  const current = snap.data()?.points ?? 0;
  if (current < amount) return false;

  await updateDoc(ref, {
    points: increment(-amount),
    pointHistory: arrayUnion({
      type: 'deduct',
      amount,
      reason,
      ts: new Date().toISOString(),
    }),
  });
  return true;
}

// ── 포인트 충전 ───────────────────────────────────────────
export async function addPoints(uid, amount, reason = '충전') {
  const ref = doc(db, 'users', uid, 'profile', 'info');
  await updateDoc(ref, {
    points: increment(amount),
    pointHistory: arrayUnion({
      type: 'add',
      amount,
      reason,
      ts: new Date().toISOString(),
    }),
  });
}

// ── 신규 가입 포인트 지급 ─────────────────────────────────
export async function initPoints(uid) {
  const ref = doc(db, 'users', uid, 'profile', 'info');
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().points != null) return; // 이미 있으면 스킵
  await setDoc(ref, {
    points: INITIAL_POINTS,
    pointHistory: [{
      type: 'add',
      amount: INITIAL_POINTS,
      reason: '회원가입 축하 포인트',
      ts: new Date().toISOString(),
    }],
  }, { merge: true });
}
