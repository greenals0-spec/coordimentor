import { Capacitor } from '@capacitor/core';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';

// ── 광고 유닛 ID ──────────────────────────────────────────────────────────────
// TODO: 실제 AdMob ID 발급 후 아래를 true로 변경
const IS_PROD = false;

const AD_UNIT_ID = IS_PROD
  ? 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'  // ← 실제 ID로 교체
  : 'ca-app-pub-3940256099942544/1033173712'; // Google 테스트 ID

let _initialized = false;

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
 * 인터스티셜 광고 표시
 * - 광고 닫힘 또는 실패/타임아웃 시 resolve (기능은 항상 계속)
 */
export async function showInterstitialAd() {
  const ok = await initAdMob();
  if (!ok) return;

  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      console.warn('[AdMob] 30초 타임아웃 → 스킵');
      cleanup();
      resolve();
    }, 30000);

    const listeners = [];

    function cleanup() {
      clearTimeout(timer);
      listeners.forEach(l => { try { l.remove(); } catch (_) {} });
    }

    function done() { cleanup(); resolve(); }

    try {
      listeners.push(
        await AdMob.addListener(InterstitialAdPluginEvents.Loaded, async () => {
          console.log('[AdMob] 광고 로드 완료 → 표시');
          try { await AdMob.showInterstitial(); } catch (e) { console.warn('[AdMob] show 실패:', e.message); done(); }
        })
      );
      listeners.push(
        await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
          console.log('[AdMob] 광고 닫힘');
          done();
        })
      );
      listeners.push(
        await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
          console.warn('[AdMob] 로드 실패:', JSON.stringify(err));
          done();
        })
      );
      listeners.push(
        await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (err) => {
          console.warn('[AdMob] 표시 실패:', JSON.stringify(err));
          done();
        })
      );

      console.log('[AdMob] prepareInterstitial 요청:', AD_UNIT_ID);
      await AdMob.prepareInterstitial({ adId: AD_UNIT_ID });

    } catch (e) {
      console.warn('[AdMob] 오류 → 스킵:', e.message);
      done();
    }
  });
}
