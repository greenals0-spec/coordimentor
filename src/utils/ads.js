import { Capacitor } from '@capacitor/core';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';

// ── 광고 유닛 ID ──────────────────────────────────────────────────────────────
// TODO: 실제 AdMob ID 발급 후 아래를 true로 변경
const IS_PROD = false;

const AD_UNIT_ID = IS_PROD
  ? 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'  // ← 실제 ID로 교체
  : 'ca-app-pub-3940256099942544/1033173712'; // Google 테스트 ID

let _initialized = false;
let _adReady = false;      // 광고 로드 완료 여부
let _adLoading = false;    // 현재 로드 중 여부

async function initAdMob() {
  if (!Capacitor.isNativePlatform()) return false;
  if (_initialized) return true;
  try {
    await AdMob.initialize({ initializeForTesting: !IS_PROD });
    _initialized = true;
    console.log('[AdMob] 초기화 성공');
    return true;
  } catch (e) {
    console.warn('[AdMob] 초기화 실패:', e.message);
    return false;
  }
}

/**
 * 광고 미리 로드 (페이지 진입 시 호출)
 * 버튼 누를 때 바로 광고가 뜰 수 있도록 사전 준비
 */
export async function preloadInterstitialAd() {
  if (!Capacitor.isNativePlatform()) return;
  if (_adReady || _adLoading) return;

  const ok = await initAdMob();
  if (!ok) return;

  _adLoading = true;
  try {
    // Loaded 리스너 등록 후 prepareInterstitial
    await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
      console.log('[AdMob] 광고 프리로드 완료 ✓');
      _adReady = true;
      _adLoading = false;
    });
    await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
      console.warn('[AdMob] 프리로드 실패');
      _adReady = false;
      _adLoading = false;
    });
    await AdMob.prepareInterstitial({ adId: AD_UNIT_ID });
  } catch (e) {
    console.warn('[AdMob] 프리로드 오류:', e.message);
    _adLoading = false;
  }
}

/**
 * 인터스티셜 광고 표시
 * - preloadInterstitialAd()로 미리 로드된 경우 즉시 표시
 * - 미리 로드 안 됐으면 그냥 스킵
 * - 광고 닫히면 다음 광고 자동 프리로드
 */
export async function showInterstitialAd() {
  if (!Capacitor.isNativePlatform()) return;
  if (!_adReady) {
    console.warn('[AdMob] 광고 미준비 상태 → 스킵');
    return;
  }

  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      console.warn('[AdMob] 30초 타임아웃 → 스킵');
      cleanup();
      resolve();
      preloadInterstitialAd(); // 다음 광고 준비
    }, 30000);

    const listeners = [];
    function cleanup() {
      clearTimeout(timer);
      listeners.forEach(l => { try { l.remove(); } catch (_) {} });
    }
    function done() { cleanup(); resolve(); preloadInterstitialAd(); } // 닫히면 다음 광고 준비

    try {
      listeners.push(
        await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
          console.log('[AdMob] 광고 닫힘');
          _adReady = false;
          done();
        })
      );
      listeners.push(
        await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (err) => {
          console.warn('[AdMob] 표시 실패:', JSON.stringify(err));
          _adReady = false;
          done();
        })
      );

      console.log('[AdMob] 광고 표시');
      await AdMob.showInterstitial();
    } catch (e) {
      console.warn('[AdMob] show 오류:', e.message);
      _adReady = false;
      done();
    }
  });
}
