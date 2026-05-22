import { Capacitor } from '@capacitor/core';

// ── 광고 유닛 ID ──────────────────────────────────────────────────────────────
// TODO: AdMob 콘솔에서 실제 앱 ID / 광고 유닛 ID 발급 후 교체
const IS_PROD = process.env.NODE_ENV === 'production';

const AD_UNITS = {
  INTERSTITIAL: IS_PROD
    ? 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'   // ← 실제 ID로 교체
    : 'ca-app-pub-3940256099942544/1033173712',  // Google 테스트 ID
};

const AD_TIMEOUT_MS = 8000; // 8초 안에 안 되면 그냥 넘어감

let _initialized = false;

// 타임아웃 래퍼
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(resolve, ms)), // 타임아웃 시 그냥 resolve
  ]);
}

async function getAdMob() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    if (!_initialized) {
      await withTimeout(
        AdMob.initialize({ initializeForTesting: !IS_PROD, testingDevices: [] }),
        3000
      );
      _initialized = true;
    }
    return AdMob;
  } catch (e) {
    console.warn('[AdMob] 초기화 실패:', e.message);
    return null;
  }
}

/**
 * 인터스티셜 광고 표시
 * - 가상착의 로딩 중에 Promise.all로 병렬 실행
 * - 광고 실패 / 타임아웃 시 자동 스킵 (기능은 항상 계속 진행)
 */
export async function showInterstitialAd() {
  const AdMob = await getAdMob();
  if (!AdMob) return; // 웹 환경 or 초기화 실패 → 스킵

  try {
    await withTimeout(
      AdMob.prepareInterstitial({ adId: AD_UNITS.INTERSTITIAL }),
      5000
    );
    await withTimeout(AdMob.showInterstitial(), AD_TIMEOUT_MS);
  } catch (e) {
    console.warn('[AdMob] 인터스티셜 실패 (스킵):', e.message);
  }
}
