import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
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

// 누적 리스너 추적 (preload용)
let _preloadListeners = [];

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

// preload 리스너 정리 헬퍼
function removePreloadListeners() {
  _preloadListeners.forEach(l => { try { l.remove(); } catch (_) {} });
  _preloadListeners = [];
}

/**
 * 광고 미리 로드 (페이지 진입 시 호출)
 */
export async function preloadInterstitialAd() {
  if (!Capacitor.isNativePlatform()) return;
  if (_adReady || _adLoading) return;

  const ok = await initAdMob();
  if (!ok) return;

  _adLoading = true;
  removePreloadListeners();

  try {
    const loadedListener = await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
      console.log('[AdMob] 광고 프리로드 완료 ✓');
      _adReady = true;
      _adLoading = false;
      removePreloadListeners();
    });
    const failListener = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
      console.warn('[AdMob] 프리로드 실패');
      _adReady = false;
      _adLoading = false;
      removePreloadListeners();
    });
    _preloadListeners = [loadedListener, failListener];

    await AdMob.prepareInterstitial({ adId: AD_UNIT_ID });
  } catch (e) {
    console.warn('[AdMob] 프리로드 오류:', e.message);
    _adLoading = false;
    removePreloadListeners();
  }
}

/**
 * 인터스티셜 광고 표시
 * - 광고가 떠 있는 동안 WebView JS는 일시정지됨 (타임아웃 무효)
 * - App resume 이벤트로 광고 닫힘을 감지해 터치 복구
 */
export async function showInterstitialAd() {
  if (!Capacitor.isNativePlatform()) return;
  if (!_adReady) {
    console.warn('[AdMob] 광고 미준비 상태 → 스킵');
    return;
  }

  removePreloadListeners();

  return new Promise(async (resolve) => {
    let resolved = false;

    function restoreTouch() {
      try { document.body.style.pointerEvents = 'auto'; } catch (_) {}
      try { document.documentElement.style.pointerEvents = 'auto'; } catch (_) {}
      try { document.body.focus(); } catch (_) {}
    }

    function safeResolve() {
      if (resolved) return;
      resolved = true;
      restoreTouch();
      resolve();
    }

    const listeners = [];
    let resumeListener = null;

    function cleanup() {
      listeners.forEach(l => { try { l.remove(); } catch (_) {} });
      if (resumeListener) { try { resumeListener.remove(); } catch (_) {} }
      resumeListener = null;
    }

    function done() {
      cleanup();
      safeResolve();
      preloadInterstitialAd();
    }

    try {
      // ✅ 핵심: App resume 이벤트 감지 — 광고 종료 후 앱이 포그라운드로 돌아올 때 발생
      // (WebView JS가 일시정지 중이어도, 재개 시 이 이벤트가 실행됨)
      resumeListener = await App.addListener('resume', () => {
        console.log('[AdMob] App resume → 광고 닫힘으로 처리');
        _adReady = false;
        done();
      });

      listeners.push(
        await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
          console.log('[AdMob] 광고 닫힘 (Dismissed)');
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
      listeners.push(
        await AdMob.addListener(InterstitialAdPluginEvents.Showed, () => {
          console.log('[AdMob] 광고 노출 시작');
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
