/**
 * 샘플 의상 이미지 생성 스크립트 (로컬 저장)
 *
 * 사용법: node scripts/upload-sample-images.mjs
 * 필요: Node 18+ (fetch 내장)
 *
 * 이미지를 public/assets/samples/ 에 저장하고 sampleItems.js 를 업데이트합니다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const GEMINI_API_KEY = 'AIzaSyDK4wIhaWD4bQTZei9kLo8SxNQai4dZeeM';
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${GEMINI_API_KEY}`;
const OUT_DIR = path.join(ROOT, 'public/assets/samples');

const ITEMS = [
  // 남성 캐주얼
  { key: 'male_casual_top',    file: 'male/casual/top.jpg',    prompt: "Single clothing item: plain white basic cotton t-shirt, folded flat on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'male_casual_bottom', file: 'male/casual/bottom.jpg', prompt: "Single clothing item: medium wash blue slim fit denim jeans, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'male_casual_shoes',  file: 'male/casual/shoes.jpg',  prompt: "Single shoe item: white low-top canvas sneakers for men, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'male_casual_bag',    file: 'male/casual/bag.jpg',    prompt: "Single bag item: beige canvas tote bag for men casual, isolated on pure white background. Professional product photography, no model, no person." },
  // 남성 스트리트
  { key: 'male_street_top',    file: 'male/street/top.jpg',    prompt: "Single clothing item: black oversized graphic hoodie streetwear, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'male_street_bottom', file: 'male/street/bottom.jpg', prompt: "Single clothing item: black cargo pants with pockets, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'male_street_shoes',  file: 'male/street/shoes.jpg',  prompt: "Single shoe item: black chunky high-top sneakers streetwear style for men, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'male_street_bag',    file: 'male/street/bag.jpg',    prompt: "Single bag item: black crossbody messenger bag streetwear style, isolated on pure white background. Professional product photography, no model, no person." },
  // 남성 세미정장
  { key: 'male_semi_top',      file: 'male/semi/top.jpg',      prompt: "Single clothing item: light blue slim fit dress shirt button-down, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'male_semi_bottom',   file: 'male/semi/bottom.jpg',   prompt: "Single clothing item: charcoal grey slim fit chinos dress pants, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'male_semi_shoes',    file: 'male/semi/shoes.jpg',    prompt: "Single shoe item: tan brown leather derby oxford dress shoes for men, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'male_semi_bag',      file: 'male/semi/bag.jpg',      prompt: "Single bag item: dark brown leather briefcase for men, isolated on pure white background. Professional product photography, no model, no person." },
  // 남성 스포츠
  { key: 'male_sports_top',    file: 'male/sports/top.jpg',    prompt: "Single clothing item: grey moisture-wicking athletic t-shirt sportswear, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'male_sports_bottom', file: 'male/sports/bottom.jpg', prompt: "Single clothing item: black athletic jogger pants with elastic waistband, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'male_sports_shoes',  file: 'male/sports/shoes.jpg',  prompt: "Single shoe item: grey and white running athletic sneakers for men, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'male_sports_bag',    file: 'male/sports/bag.jpg',    prompt: "Single bag item: black gym duffel sports bag for men, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'male_sports_hat',    file: 'male/sports/hat.jpg',    prompt: "Single hat item: black sports baseball cap with curved brim for men, isolated on pure white background. Professional product photography, no model, no person." },
  // 여성 캐주얼
  { key: 'female_casual_top',    file: 'female/casual/top.jpg',    prompt: "Single clothing item: white ribbed crop tank top for women, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'female_casual_bottom', file: 'female/casual/bottom.jpg', prompt: "Single clothing item: light wash high-waist mom jeans for women, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'female_casual_shoes',  file: 'female/casual/shoes.jpg',  prompt: "Single shoe item: white canvas low-top sneakers for women, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'female_casual_bag',    file: 'female/casual/bag.jpg',    prompt: "Single bag item: mini white shoulder bag for women casual, isolated on pure white background. Professional product photography, no model, no person." },
  // 여성 스트리트
  { key: 'female_street_top',    file: 'female/street/top.jpg',    prompt: "Single clothing item: oversized white graphic crop sweatshirt for women streetwear, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'female_street_bottom', file: 'female/street/bottom.jpg', prompt: "Single clothing item: black wide-leg cargo pants for women streetwear, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'female_street_shoes',  file: 'female/street/shoes.jpg',  prompt: "Single shoe item: black platform chunky sneakers for women streetwear, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'female_street_bag',    file: 'female/street/bag.jpg',    prompt: "Single bag item: black chain crossbody bag for women streetwear, isolated on pure white background. Professional product photography, no model, no person." },
  // 여성 세미정장
  { key: 'female_semi_top',      file: 'female/semi/top.jpg',      prompt: "Single clothing item: white feminine blouse with collar for women office wear, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'female_semi_bottom',   file: 'female/semi/bottom.jpg',   prompt: "Single clothing item: beige tailored wide-leg trousers for women semi-formal, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'female_semi_shoes',    file: 'female/semi/shoes.jpg',    prompt: "Single shoe item: beige pointed toe kitten heel mules for women, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'female_semi_bag',      file: 'female/semi/bag.jpg',      prompt: "Single bag item: structured beige tote handbag for women office, isolated on pure white background. Professional product photography, no model, no person." },
  // 여성 스포츠
  { key: 'female_sports_top',    file: 'female/sports/top.jpg',    prompt: "Single clothing item: light pink sports bra crop top for women athletic wear, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'female_sports_bottom', file: 'female/sports/bottom.jpg', prompt: "Single clothing item: black high-waist athletic leggings for women sportswear, flat lay on pure white background. Professional product photography, no model, no person, no mannequin, isolated item only." },
  { key: 'female_sports_shoes',  file: 'female/sports/shoes.jpg',  prompt: "Single shoe item: pink and white women's running athletic shoes, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'female_sports_bag',    file: 'female/sports/bag.jpg',    prompt: "Single bag item: lilac purple drawstring gym backpack for women sports, isolated on pure white background. Professional product photography, no model, no person." },
  { key: 'female_sports_hat',    file: 'female/sports/hat.jpg',    prompt: "Single hat item: white sports baseball cap for women, isolated on pure white background. Professional product photography, no model, no person." },
];

// Imagen API 호출
async function generateImage(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(IMAGEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' },
        }),
      });
      const data = await resp.json();
      if (data.predictions?.[0]?.bytesBase64Encoded) {
        return Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
      }
      if (data.error?.code === 429) {
        console.log(`    ⏳ Rate limited, 30초 대기... (${i+1}/${retries})`);
        await new Promise(r => setTimeout(r, 30000));
        continue;
      }
      throw new Error(JSON.stringify(data).substring(0, 150));
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function main() {
  console.log('🎽 샘플 의상 이미지 생성 시작');
  console.log(`   총 ${ITEMS.length}개 아이템 | 저장 위치: public/assets/samples/\n`);

  // 저장 폴더 생성
  const dirs = [...new Set(ITEMS.map(i => path.dirname(path.join(OUT_DIR, i.file))))];
  dirs.forEach(d => mkdirSync(d, { recursive: true }));

  const savedFiles = {};
  let success = 0, fail = 0, skipped = 0;

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const outPath = path.join(OUT_DIR, item.file);
    const prefix = `[${String(i+1).padStart(2,'0')}/${ITEMS.length}]`;

    // 이미 파일이 있으면 스킵
    if (existsSync(outPath)) {
      console.log(`${prefix} ⏭️  스킵 (기존 파일): ${item.file}`);
      savedFiles[item.key] = `/assets/samples/${item.file}`;
      skipped++;
      continue;
    }

    process.stdout.write(`${prefix} ${item.key}... `);
    try {
      const imgBuffer = await generateImage(item.prompt);
      writeFileSync(outPath, imgBuffer);
      savedFiles[item.key] = `/assets/samples/${item.file}`;
      success++;
      console.log('✅');
    } catch (e) {
      fail++;
      console.log(`❌ ${e.message?.substring(0, 80)}`);
    }

    if (i < ITEMS.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n완료: ✅ ${success}개 생성, ⏭️  ${skipped}개 스킵, ❌ ${fail}개 실패`);

  if (success + skipped === 0) {
    console.error('저장된 파일이 없습니다.');
    process.exit(1);
  }

  // sampleItems.js 업데이트
  console.log('\n📝 sampleItems.js 업데이트 중...');
  const u = (key) => savedFiles[key] || '';

  const newContent = `import { collection, addDoc, getDocs, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ── 남성 샘플 의상 ────────────────────────────────────────────────────────────
export const SAMPLE_ITEMS_MALE = [
  // 캐주얼
  { category: '상의',     name: '화이트 베이직 티셔츠',    color: '화이트', tags: ['베이직', '캐주얼', '데일리'],       brand: '샘플', imageUrl: '${u('male_casual_top')}',    imagePath: '', isSample: true },
  { category: '하의',     name: '블루 슬림 청바지',        color: '블루',   tags: ['청바지', '캐주얼', '데일리'],       brand: '샘플', imageUrl: '${u('male_casual_bottom')}', imagePath: '', isSample: true },
  { category: '신발',     name: '화이트 캔버스 스니커즈',  color: '화이트', tags: ['스니커즈', '캐주얼', '데일리'],     brand: '샘플', imageUrl: '${u('male_casual_shoes')}',  imagePath: '', isSample: true },
  { category: '액세서리', name: '베이지 캔버스 토트백',    color: '베이지', tags: ['가방', '캐주얼', '토트백'],         brand: '샘플', imageUrl: '${u('male_casual_bag')}',    imagePath: '', isSample: true },
  // 스트리트
  { category: '상의',     name: '블랙 오버핏 후드티',      color: '블랙',   tags: ['후드티', '스트리트', '오버핏'],     brand: '샘플', imageUrl: '${u('male_street_top')}',    imagePath: '', isSample: true },
  { category: '하의',     name: '블랙 카고 팬츠',          color: '블랙',   tags: ['카고팬츠', '스트리트', '데일리'],   brand: '샘플', imageUrl: '${u('male_street_bottom')}', imagePath: '', isSample: true },
  { category: '신발',     name: '블랙 청키 하이탑',        color: '블랙',   tags: ['스니커즈', '스트리트', '하이탑'],   brand: '샘플', imageUrl: '${u('male_street_shoes')}',  imagePath: '', isSample: true },
  { category: '액세서리', name: '블랙 크로스백',            color: '블랙',   tags: ['가방', '스트리트', '크로스백'],     brand: '샘플', imageUrl: '${u('male_street_bag')}',    imagePath: '', isSample: true },
  // 세미정장
  { category: '상의',     name: '하늘색 드레스 셔츠',      color: '하늘색', tags: ['셔츠', '세미정장', '비즈니스'],     brand: '샘플', imageUrl: '${u('male_semi_top')}',      imagePath: '', isSample: true },
  { category: '하의',     name: '차콜 슬림 치노',          color: '차콜',   tags: ['슬랙스', '세미정장', '비즈니스'],   brand: '샘플', imageUrl: '${u('male_semi_bottom')}',   imagePath: '', isSample: true },
  { category: '신발',     name: '탄 브라운 더비 구두',      color: '브라운', tags: ['구두', '세미정장', '포멀'],         brand: '샘플', imageUrl: '${u('male_semi_shoes')}',    imagePath: '', isSample: true },
  { category: '액세서리', name: '다크브라운 레더 브리프케이스', color: '브라운', tags: ['가방', '세미정장', '비즈니스'], brand: '샘플', imageUrl: '${u('male_semi_bag')}',      imagePath: '', isSample: true },
  // 스포츠
  { category: '상의',     name: '그레이 스포츠 티셔츠',    color: '그레이', tags: ['티셔츠', '스포츠', '운동'],         brand: '샘플', imageUrl: '${u('male_sports_top')}',    imagePath: '', isSample: true },
  { category: '하의',     name: '블랙 조거 팬츠',          color: '블랙',   tags: ['조거팬츠', '스포츠', '운동'],       brand: '샘플', imageUrl: '${u('male_sports_bottom')}', imagePath: '', isSample: true },
  { category: '신발',     name: '그레이 러닝화',            color: '그레이', tags: ['운동화', '스포츠', '러닝'],         brand: '샘플', imageUrl: '${u('male_sports_shoes')}',  imagePath: '', isSample: true },
  { category: '액세서리', name: '블랙 짐 더플백',           color: '블랙',   tags: ['가방', '스포츠', '운동'],           brand: '샘플', imageUrl: '${u('male_sports_bag')}',    imagePath: '', isSample: true },
  { category: '액세서리', name: '블랙 스포츠 캡',           color: '블랙',   tags: ['모자', '스포츠', '캡'],             brand: '샘플', imageUrl: '${u('male_sports_hat')}',    imagePath: '', isSample: true },
];

// ── 여성 샘플 의상 ────────────────────────────────────────────────────────────
export const SAMPLE_ITEMS_FEMALE = [
  // 캐주얼
  { category: '상의',     name: '화이트 리브드 크롭 탱크탑', color: '화이트', tags: ['탱크탑', '캐주얼', '크롭'],     brand: '샘플', imageUrl: '${u('female_casual_top')}',    imagePath: '', isSample: true },
  { category: '하의',     name: '연청 하이웨이스트 청바지',  color: '연청',   tags: ['청바지', '캐주얼', '하이웨이스트'], brand: '샘플', imageUrl: '${u('female_casual_bottom')}', imagePath: '', isSample: true },
  { category: '신발',     name: '화이트 캔버스 스니커즈',    color: '화이트', tags: ['스니커즈', '캐주얼', '데일리'],   brand: '샘플', imageUrl: '${u('female_casual_shoes')}',  imagePath: '', isSample: true },
  { category: '액세서리', name: '화이트 미니 숄더백',        color: '화이트', tags: ['가방', '캐주얼', '미니백'],       brand: '샘플', imageUrl: '${u('female_casual_bag')}',    imagePath: '', isSample: true },
  // 스트리트
  { category: '상의',     name: '오버핏 그래픽 크롭 맨투맨', color: '화이트', tags: ['맨투맨', '스트리트', '크롭'],    brand: '샘플', imageUrl: '${u('female_street_top')}',    imagePath: '', isSample: true },
  { category: '하의',     name: '블랙 와이드 카고 팬츠',     color: '블랙',   tags: ['카고팬츠', '스트리트', '와이드'],  brand: '샘플', imageUrl: '${u('female_street_bottom')}', imagePath: '', isSample: true },
  { category: '신발',     name: '블랙 플랫폼 청키 스니커즈', color: '블랙',   tags: ['스니커즈', '스트리트', '플랫폼'], brand: '샘플', imageUrl: '${u('female_street_shoes')}',  imagePath: '', isSample: true },
  { category: '액세서리', name: '블랙 체인 크로스백',        color: '블랙',   tags: ['가방', '스트리트', '크로스백'],   brand: '샘플', imageUrl: '${u('female_street_bag')}',    imagePath: '', isSample: true },
  // 세미정장
  { category: '상의',     name: '화이트 페미닌 칼라 블라우스', color: '화이트', tags: ['블라우스', '세미정장', '오피스'], brand: '샘플', imageUrl: '${u('female_semi_top')}',      imagePath: '', isSample: true },
  { category: '하의',     name: '베이지 와이드 테일러드 슬랙스', color: '베이지', tags: ['슬랙스', '세미정장', '와이드'], brand: '샘플', imageUrl: '${u('female_semi_bottom')}',   imagePath: '', isSample: true },
  { category: '신발',     name: '베이지 키튼힐 뮬',          color: '베이지', tags: ['뮬', '세미정장', '힐'],           brand: '샘플', imageUrl: '${u('female_semi_shoes')}',    imagePath: '', isSample: true },
  { category: '액세서리', name: '베이지 구조형 토트백',       color: '베이지', tags: ['가방', '세미정장', '오피스'],     brand: '샘플', imageUrl: '${u('female_semi_bag')}',      imagePath: '', isSample: true },
  // 스포츠
  { category: '상의',     name: '핑크 스포츠 브라탑',        color: '핑크',   tags: ['브라탑', '스포츠', '운동'],       brand: '샘플', imageUrl: '${u('female_sports_top')}',    imagePath: '', isSample: true },
  { category: '하의',     name: '블랙 하이웨이스트 레깅스',  color: '블랙',   tags: ['레깅스', '스포츠', '운동'],       brand: '샘플', imageUrl: '${u('female_sports_bottom')}', imagePath: '', isSample: true },
  { category: '신발',     name: '핑크 여성 러닝화',           color: '핑크',   tags: ['운동화', '스포츠', '러닝'],       brand: '샘플', imageUrl: '${u('female_sports_shoes')}',  imagePath: '', isSample: true },
  { category: '액세서리', name: '라일락 드로스트링 백팩',    color: '라일락', tags: ['가방', '스포츠', '백팩'],         brand: '샘플', imageUrl: '${u('female_sports_bag')}',    imagePath: '', isSample: true },
  { category: '액세서리', name: '화이트 스포츠 캡',           color: '화이트', tags: ['모자', '스포츠', '캡'],           brand: '샘플', imageUrl: '${u('female_sports_hat')}',    imagePath: '', isSample: true },
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
`;

  writeFileSync(path.join(ROOT, 'src/utils/sampleItems.js'), newContent, 'utf8');
  console.log('✅ src/utils/sampleItems.js 업데이트 완료!');
  console.log('\n🎉 완료! 앱을 빌드하면 새 샘플 이미지가 적용됩니다.');
}

main().catch(e => {
  console.error('오류:', e);
  process.exit(1);
});
