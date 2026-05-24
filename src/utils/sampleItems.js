import { collection, addDoc, getDocs, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ── 남성 샘플 의상 ────────────────────────────────────────────────────────────
export const SAMPLE_ITEMS_MALE = [
  // 캐주얼
  { category: '상의',     name: '화이트 베이직 티셔츠',    color: '화이트', tags: ['베이직', '캐주얼', '데일리'],       brand: '샘플', imageUrl: '/assets/samples/male/casual/top.jpg',    imagePath: '', isSample: true },
  { category: '하의',     name: '블루 슬림 청바지',        color: '블루',   tags: ['청바지', '캐주얼', '데일리'],       brand: '샘플', imageUrl: '/assets/samples/male/casual/bottom.jpg', imagePath: '', isSample: true },
  { category: '신발',     name: '화이트 캔버스 스니커즈',  color: '화이트', tags: ['스니커즈', '캐주얼', '데일리'],     brand: '샘플', imageUrl: '/assets/samples/male/casual/shoes.jpg',  imagePath: '', isSample: true },
  { category: '액세서리', name: '베이지 캔버스 토트백',    color: '베이지', tags: ['가방', '캐주얼', '토트백'],         brand: '샘플', imageUrl: '/assets/samples/male/casual/bag.jpg',    imagePath: '', isSample: true },
  // 스트리트
  { category: '상의',     name: '블랙 오버핏 후드티',      color: '블랙',   tags: ['후드티', '스트리트', '오버핏'],     brand: '샘플', imageUrl: '/assets/samples/male/street/top.jpg',    imagePath: '', isSample: true },
  { category: '하의',     name: '블랙 카고 팬츠',          color: '블랙',   tags: ['카고팬츠', '스트리트', '데일리'],   brand: '샘플', imageUrl: '/assets/samples/male/street/bottom.jpg', imagePath: '', isSample: true },
  { category: '신발',     name: '블랙 청키 하이탑',        color: '블랙',   tags: ['스니커즈', '스트리트', '하이탑'],   brand: '샘플', imageUrl: '/assets/samples/male/street/shoes.jpg',  imagePath: '', isSample: true },
  { category: '액세서리', name: '블랙 크로스백',            color: '블랙',   tags: ['가방', '스트리트', '크로스백'],     brand: '샘플', imageUrl: '/assets/samples/male/street/bag.jpg',    imagePath: '', isSample: true },
  // 세미정장
  { category: '상의',     name: '하늘색 드레스 셔츠',      color: '하늘색', tags: ['셔츠', '세미정장', '비즈니스'],     brand: '샘플', imageUrl: '/assets/samples/male/semi/top.jpg',      imagePath: '', isSample: true },
  { category: '하의',     name: '차콜 슬림 치노',          color: '차콜',   tags: ['슬랙스', '세미정장', '비즈니스'],   brand: '샘플', imageUrl: '/assets/samples/male/semi/bottom.jpg',   imagePath: '', isSample: true },
  { category: '신발',     name: '탄 브라운 더비 구두',      color: '브라운', tags: ['구두', '세미정장', '포멀'],         brand: '샘플', imageUrl: '/assets/samples/male/semi/shoes.jpg',    imagePath: '', isSample: true },
  { category: '액세서리', name: '다크브라운 레더 브리프케이스', color: '브라운', tags: ['가방', '세미정장', '비즈니스'], brand: '샘플', imageUrl: '/assets/samples/male/semi/bag.jpg',      imagePath: '', isSample: true },
  // 스포츠
  { category: '상의',     name: '그레이 스포츠 티셔츠',    color: '그레이', tags: ['티셔츠', '스포츠', '운동'],         brand: '샘플', imageUrl: '/assets/samples/male/sports/top.jpg',    imagePath: '', isSample: true },
  { category: '하의',     name: '블랙 조거 팬츠',          color: '블랙',   tags: ['조거팬츠', '스포츠', '운동'],       brand: '샘플', imageUrl: '/assets/samples/male/sports/bottom.jpg', imagePath: '', isSample: true },
  { category: '신발',     name: '그레이 러닝화',            color: '그레이', tags: ['운동화', '스포츠', '러닝'],         brand: '샘플', imageUrl: '/assets/samples/male/sports/shoes.jpg',  imagePath: '', isSample: true },
  { category: '액세서리', name: '블랙 짐 더플백',           color: '블랙',   tags: ['가방', '스포츠', '운동'],           brand: '샘플', imageUrl: '/assets/samples/male/sports/bag.jpg',    imagePath: '', isSample: true },
  { category: '액세서리', name: '블랙 스포츠 캡',           color: '블랙',   tags: ['모자', '스포츠', '캡'],             brand: '샘플', imageUrl: '/assets/samples/male/sports/hat.jpg',    imagePath: '', isSample: true },
];

// ── 여성 샘플 의상 ────────────────────────────────────────────────────────────
export const SAMPLE_ITEMS_FEMALE = [
  // 캐주얼
  { category: '상의',     name: '화이트 리브드 크롭 탱크탑', color: '화이트', tags: ['탱크탑', '캐주얼', '크롭'],     brand: '샘플', imageUrl: '/assets/samples/female/casual/top.jpg',    imagePath: '', isSample: true },
  { category: '하의',     name: '연청 하이웨이스트 청바지',  color: '연청',   tags: ['청바지', '캐주얼', '하이웨이스트'], brand: '샘플', imageUrl: '/assets/samples/female/casual/bottom.jpg', imagePath: '', isSample: true },
  { category: '신발',     name: '화이트 캔버스 스니커즈',    color: '화이트', tags: ['스니커즈', '캐주얼', '데일리'],   brand: '샘플', imageUrl: '/assets/samples/female/casual/shoes.jpg',  imagePath: '', isSample: true },
  { category: '액세서리', name: '화이트 미니 숄더백',        color: '화이트', tags: ['가방', '캐주얼', '미니백'],       brand: '샘플', imageUrl: '/assets/samples/female/casual/bag.jpg',    imagePath: '', isSample: true },
  // 스트리트
  { category: '상의',     name: '오버핏 그래픽 크롭 맨투맨', color: '화이트', tags: ['맨투맨', '스트리트', '크롭'],    brand: '샘플', imageUrl: '/assets/samples/female/street/top.jpg',    imagePath: '', isSample: true },
  { category: '하의',     name: '블랙 와이드 카고 팬츠',     color: '블랙',   tags: ['카고팬츠', '스트리트', '와이드'],  brand: '샘플', imageUrl: '/assets/samples/female/street/bottom.jpg', imagePath: '', isSample: true },
  { category: '신발',     name: '블랙 플랫폼 청키 스니커즈', color: '블랙',   tags: ['스니커즈', '스트리트', '플랫폼'], brand: '샘플', imageUrl: '/assets/samples/female/street/shoes.jpg',  imagePath: '', isSample: true },
  { category: '액세서리', name: '블랙 체인 크로스백',        color: '블랙',   tags: ['가방', '스트리트', '크로스백'],   brand: '샘플', imageUrl: '/assets/samples/female/street/bag.jpg',    imagePath: '', isSample: true },
  // 세미정장
  { category: '상의',     name: '화이트 페미닌 칼라 블라우스', color: '화이트', tags: ['블라우스', '세미정장', '오피스'], brand: '샘플', imageUrl: '/assets/samples/female/semi/top.jpg',      imagePath: '', isSample: true },
  { category: '하의',     name: '베이지 와이드 테일러드 슬랙스', color: '베이지', tags: ['슬랙스', '세미정장', '와이드'], brand: '샘플', imageUrl: '/assets/samples/female/semi/bottom.jpg',   imagePath: '', isSample: true },
  { category: '신발',     name: '베이지 키튼힐 뮬',          color: '베이지', tags: ['뮬', '세미정장', '힐'],           brand: '샘플', imageUrl: '/assets/samples/female/semi/shoes.jpg',    imagePath: '', isSample: true },
  { category: '액세서리', name: '베이지 구조형 토트백',       color: '베이지', tags: ['가방', '세미정장', '오피스'],     brand: '샘플', imageUrl: '/assets/samples/female/semi/bag.jpg',      imagePath: '', isSample: true },
  // 스포츠
  { category: '상의',     name: '핑크 스포츠 브라탑',        color: '핑크',   tags: ['브라탑', '스포츠', '운동'],       brand: '샘플', imageUrl: '/assets/samples/female/sports/top.jpg',    imagePath: '', isSample: true },
  { category: '하의',     name: '블랙 하이웨이스트 레깅스',  color: '블랙',   tags: ['레깅스', '스포츠', '운동'],       brand: '샘플', imageUrl: '/assets/samples/female/sports/bottom.jpg', imagePath: '', isSample: true },
  { category: '신발',     name: '핑크 여성 러닝화',           color: '핑크',   tags: ['운동화', '스포츠', '러닝'],       brand: '샘플', imageUrl: '/assets/samples/female/sports/shoes.jpg',  imagePath: '', isSample: true },
  { category: '액세서리', name: '라일락 드로스트링 백팩',    color: '라일락', tags: ['가방', '스포츠', '백팩'],         brand: '샘플', imageUrl: '/assets/samples/female/sports/bag.jpg',    imagePath: '', isSample: true },
  { category: '액세서리', name: '화이트 스포츠 캡',           color: '화이트', tags: ['모자', '스포츠', '캡'],           brand: '샘플', imageUrl: '/assets/samples/female/sports/hat.jpg',    imagePath: '', isSample: true },
];

// 성별에 따라 샘플 목록 반환
export const getSampleItems = (gender) => {
  if (gender === '여성') return SAMPLE_ITEMS_FEMALE;
  return SAMPLE_ITEMS_MALE;
};

// ── 신규 가입자에게 샘플 아이템 지급 ─────────────────────────────────────────
export async function initSampleItems(uid, gender) {
  const profileRef = doc(db, 'users', uid, 'profile', 'info');
  const profileSnap = await getDoc(profileRef);
  const profileData = profileSnap.data() || {};

  if (profileData.sampleItemsGiven) return;

  const resolvedGender = gender || profileData.gender;
  const sampleItems = getSampleItems(resolvedGender);

  const itemsRef = collection(db, 'users', uid, 'items');
  const snap = await getDocs(itemsRef);
  const sampleDocs = snap.docs.filter(d => d.data().isSample);

  if (sampleDocs.length > 0) {
    const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');
    const { db: firestoreDb } = await import('../firebase');
    for (const d of sampleDocs) {
      await deleteDoc(firestoreDoc(firestoreDb, 'users', uid, 'items', d.id));
    }
  }

  for (const item of sampleItems) {
    await addDoc(itemsRef, { ...item, createdAt: serverTimestamp() });
  }

  await setDoc(profileRef, { sampleItemsGiven: true }, { merge: true });
}
