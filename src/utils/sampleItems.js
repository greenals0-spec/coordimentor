import { collection, addDoc, getDocs, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ── 남성 샘플 의상 ────────────────────────────────────────────────────────────
export const SAMPLE_ITEMS_MALE = [
  {
    category: '상의',
    name: '화이트 베이직 티셔츠',
    color: '화이트',
    tags: ['베이직', '캐주얼', '데일리'],
    brand: '샘플',
    imageUrl: '/assets/samples/top.webp',
    imagePath: '',
    isSample: true,
  },
  {
    category: '하의',
    name: '그레이 슬림 팬츠',
    color: '그레이',
    tags: ['슬랙스', '포멀', '데일리'],
    brand: '샘플',
    imageUrl: '/assets/samples/bottom.webp',
    imagePath: '',
    isSample: true,
  },
  {
    category: '아우터',
    name: '그레이 수트 재킷',
    color: '그레이',
    tags: ['재킷', '포멀', '비즈니스'],
    brand: '샘플',
    imageUrl: '/assets/samples/outer.webp',
    imagePath: '',
    isSample: true,
  },
  {
    category: '신발',
    name: '블랙 호스빗 로퍼',
    color: '블랙',
    tags: ['로퍼', '포멀', '데일리'],
    brand: '샘플',
    imageUrl: '/assets/samples/shoes.webp',
    imagePath: '',
    isSample: true,
  },
  {
    category: '액세서리',
    name: '브라운 레더 브리프케이스',
    color: '브라운',
    tags: ['가방', '포멀', '비즈니스'],
    brand: '샘플',
    imageUrl: '/assets/samples/bag.webp',
    imagePath: '',
    isSample: true,
  },
];

// ── 여성 샘플 의상 ────────────────────────────────────────────────────────────
export const SAMPLE_ITEMS_FEMALE = [
  {
    category: '상의',
    name: '화이트 블라우스',
    color: '화이트',
    tags: ['블라우스', '페미닌', '데일리'],
    brand: '샘플',
    imageUrl: '/assets/samples/female/top.webp',
    imagePath: '',
    isSample: true,
  },
  {
    category: '하의',
    name: '베이지 와이드 팬츠',
    color: '베이지',
    tags: ['와이드', '캐주얼', '데일리'],
    brand: '샘플',
    imageUrl: '/assets/samples/female/bottom.webp',
    imagePath: '',
    isSample: true,
  },
  {
    category: '아우터',
    name: '크림 오버핏 코트',
    color: '크림',
    tags: ['코트', '캐주얼', '데일리'],
    brand: '샘플',
    imageUrl: '/assets/samples/female/outer.webp',
    imagePath: '',
    isSample: true,
  },
  {
    category: '신발',
    name: '베이지 플랫 슈즈',
    color: '베이지',
    tags: ['플랫', '캐주얼', '데일리'],
    brand: '샘플',
    imageUrl: '/assets/samples/female/shoes.webp',
    imagePath: '',
    isSample: true,
  },
  {
    category: '액세서리',
    name: '브라운 버킷백',
    color: '브라운',
    tags: ['가방', '미니멀', '데일리'],
    brand: '샘플',
    imageUrl: '/assets/samples/female/bag.webp',
    imagePath: '',
    isSample: true,
  },
];

// 성별에 따라 샘플 목록 반환
export const getSampleItems = (gender) => {
  if (gender === '여성') return SAMPLE_ITEMS_FEMALE;
  return SAMPLE_ITEMS_MALE; // 남성 또는 기타
};

// ── 신규 가입자에게 샘플 아이템 지급 ─────────────────────────────────────────
// - 최초 1회만 지급 (sampleItemsGiven 플래그로 관리)
// - 이용자가 삭제한 경우 재지급하지 않음
// - gender: '남성' | '여성' | '기타' | undefined (프로필에서 읽어옴)
export async function initSampleItems(uid, gender) {
  const profileRef = doc(db, 'users', uid, 'profile', 'info');
  const profileSnap = await getDoc(profileRef);
  const profileData = profileSnap.data() || {};

  // 이미 한 번 지급한 적 있으면 스킵 (삭제해도 다시 지급하지 않음)
  if (profileData.sampleItemsGiven) return;

  // gender 파라미터 없으면 프로필에서 읽기
  const resolvedGender = gender || profileData.gender;
  const sampleItems = getSampleItems(resolvedGender);

  const itemsRef = collection(db, 'users', uid, 'items');
  const snap = await getDocs(itemsRef);
  const sampleDocs = snap.docs.filter(d => d.data().isSample);

  // 기존 샘플(구버전) 있으면 삭제 후 최신으로 교체
  if (sampleDocs.length > 0) {
    const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');
    const { db: firestoreDb } = await import('../firebase');
    for (const d of sampleDocs) {
      await deleteDoc(firestoreDoc(firestoreDb, 'users', uid, 'items', d.id));
    }
  }

  // 샘플 지급
  for (const item of sampleItems) {
    await addDoc(itemsRef, {
      ...item,
      createdAt: serverTimestamp(),
    });
  }

  // 지급 완료 플래그 저장 (이후 재지급 방지)
  await setDoc(profileRef, { sampleItemsGiven: true }, { merge: true });
}
