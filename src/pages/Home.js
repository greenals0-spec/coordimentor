import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LocalNotifications } from '@capacitor/local-notifications';
import { subscribeToItems, subscribeToSavedOutfits, subscribeToOotdLogs } from '../utils/storage';
import { getWeatherByLocation } from '../utils/weather';
import { ArrowRight, Sparkles } from 'lucide-react';
import SettingsModal from '../components/SettingsModal';
import MorningRecommendation from '../components/MorningRecommendation';
import { recommendOutfit } from '../utils/recommendation';
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { setDoc } from 'firebase/firestore';

const CATEGORY_ORDER = ['상의', '하의', '아우터', '신발', '액세서리'];

// 저장된 코디 items 객체에서 대표 이미지 추출 (상의 → 아우터 → 하의 순 우선)
const HERO_PRIORITY = ['상의', '아우터', '하의', '신발', '액세서리_얼굴머리', '액세서리_손목팔'];
// eslint-disable-next-line no-unused-vars
function getHeroImage(outfitItems) {
  if (!outfitItems) return null;
  for (const key of HERO_PRIORITY) {
    const item = outfitItems[key];
    if (item && item.imageUrl) return item.imageUrl;
  }
  return null;
}

// 저장된 코디 items 객체에서 썸네일 배열 추출 (최대 4개)
function getOutfitThumbs(outfitItems) {
  if (!outfitItems) return [];
  return Object.values(outfitItems)
    .filter(item => item && item.imageUrl)
    .slice(0, 4);
}

export default function HomePage({ onNavigate }) {
  const { user, userProfile, signOut, points } = useAuth();
  const [items, setItems] = useState([]);
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [ootdLogs, setOotdLogs] = useState([]);
  const [weather, setWeather] = useState(null);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [pendingWeather, setPendingWeather] = useState(null); // Cloud Function이 생성한 날씨

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeToItems(user.uid, setItems);
    const unsub2 = subscribeToSavedOutfits(user.uid, setSavedOutfits);
    const unsub3 = subscribeToOotdLogs(user.uid, setOotdLogs);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  useEffect(() => {
    // 날씨 조회 + 위경도 Firestore 저장
    if (!navigator.geolocation) {
      getWeatherByLocation().then(setWeather).catch(() => {});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { fetchWeatherFromCoords } = await import('../utils/weather');
          const w = await fetchWeatherFromCoords(coords.latitude, coords.longitude);
          setWeather(w);
        } catch {
          getWeatherByLocation().then(setWeather).catch(() => {});
        }
        if (user?.uid) {
          setDoc(doc(db, 'users', user.uid), {
            lastKnownLat: coords.latitude,
            lastKnownLon: coords.longitude,
          }, { merge: true }).catch(() => {});
        }
      },
      () => getWeatherByLocation().then(setWeather).catch(() => {}),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 }
    );
  }, [user?.uid]);

  // ── Firestore pendingRecommendation 확인 (Cloud Function이 미리 생성한 추천) ──
  useEffect(() => {
    if (!user?.uid) return;

    const checkPending = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const pending = snap.data()?.pendingRecommendation;
        if (!pending) return;

        // 24시간 이내 생성된 추천만 표시
        const age = Date.now() - (pending.generatedAt ?? 0);
        if (age > 24 * 60 * 60 * 1000) {
          await updateDoc(doc(db, 'users', user.uid), { pendingRecommendation: deleteField() });
          return;
        }

        // 표시 후 즉시 삭제 (중복 표시 방지)
        await updateDoc(doc(db, 'users', user.uid), { pendingRecommendation: deleteField() });
        setRecommendation(pending);
        setPendingWeather(pending.weather ?? null);
        setShowRecommendation(true);
      } catch (e) {
        console.error('[pendingRecommendation]', e);
      }
    };

    checkPending();
  }, [user?.uid]);

  // ── 알람 체크 및 알림 리스너 ──
  useEffect(() => {
    // FCM 푸시 탭 이벤트 (pushNotifications.js → CustomEvent 'morningRecommendation')
    const handlePushRecommendation = (e) => {
      const situation = e.detail?.situation || null;
      if (!weather || !items.length) return;
      const rec = recommendOutfit(weather, items, situation);
      if (rec) {
        setRecommendation(rec);
        setShowRecommendation(true);
      }
    };
    window.addEventListener('morningRecommendation', handlePushRecommendation);

    // 로컬 알림 클릭 처리
    const setupListener = async () => {
      const listener = await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        const type      = notification.notification.extra?.type;
        const situation = notification.notification.extra?.situation || null;
        if (type === 'morning_recommendation' || type === 'routine_alarm') {
          if (!weather || !items.length) return;
          const rec = recommendOutfit(weather, items, situation);
          if (rec) {
            setRecommendation(rec);
            setShowRecommendation(true);
          }
        }
      });
      return listener;
    };

    let notificationListener;
    setupListener().then(l => notificationListener = l);

    return () => {
      window.removeEventListener('morningRecommendation', handlePushRecommendation);
      if (notificationListener) notificationListener.remove();
    };
  }, [weather, items]);

  // ── 콜드스타트: 알림 탭으로 앱이 열린 경우 pending 처리 ──
  useEffect(() => {
    if (!weather || !items.length) return;

    const pending = localStorage.getItem('pending_recommendation');
    if (!pending) return;

    try {
      const { situation, timestamp } = JSON.parse(pending);
      // 3분 이내 pending만 유효 (오래된 건 무시)
      if (Date.now() - timestamp < 3 * 60 * 1000) {
        const rec = recommendOutfit(weather, items, situation);
        if (rec) {
          setRecommendation(rec);
          setShowRecommendation(true);
        }
      }
    } catch (e) {
      console.error('pending_recommendation parse error:', e);
    } finally {
      localStorage.removeItem('pending_recommendation');
    }
  }, [weather, items]);

  // ── 정기 알람 체크 ──
  useEffect(() => {
    if (!weather || !items.length || !userProfile?.alarmEnabled) return;

    const checkAlarm = () => {
      const now = new Date();
      const [alarmH, alarmM] = (userProfile.alarmTime || '07:30').split(':').map(Number);

      const alarmDate = new Date();
      alarmDate.setHours(alarmH, alarmM, 0, 0);

      const todayStr = now.toISOString().split('T')[0];
      const lastShown = localStorage.getItem('last_alarm_shown');

      const diffMs = now - alarmDate;
      if (lastShown !== todayStr && diffMs >= 0 && diffMs < 4 * 60 * 60 * 1000) {
        const rec = recommendOutfit(weather, items, null);
        if (rec) {
          setRecommendation(rec);
          setShowRecommendation(true);
          localStorage.setItem('last_alarm_shown', todayStr);
        }
      }
    };

    checkAlarm();
    const interval = setInterval(checkAlarm, 60000);
    return () => clearInterval(interval);
  }, [weather, items, userProfile]);

  const name = userProfile?.name || user?.displayName || '';
  const hour = new Date().getHours();
  const greeting =
    hour < 6  ? '좋은 새벽이에요' :
    hour < 12 ? '좋은 아침이에요' :
    hour < 18 ? '안녕하세요' : '좋은 저녁이에요';

  // 날씨에 따른 맞춤 메시지 생성
  const getWeatherMessage = () => {
    if (!weather) return '오늘 하루도 멋진 코디로 시작해볼까요?';
    const temp     = weather.temp ?? 20;
    const feels    = weather.apparentTemp ?? temp;
    const wind     = weather.windSpeed ?? 0;
    const precip   = weather.precipProb ?? 0;
    const precipMm = weather.precipMm ?? 0;
    const cond     = weather.condition || '';

    // ── 강수량(mm) 기준 비 강도 분류 ──
    if (precipMm >= 30 || cond.includes('폭우') || cond.includes('호우')) {
      return '폭우가 쏟아지고 있어요. 방수 자켓과 레인부츠로 완벽하게 무장해보세요.';
    }
    if (precipMm >= 7.6 || (precipMm >= 2.5 && precip >= 60)) {
      return '제법 굵은 빗줄기가 내리고 있어요. 방수 아우터와 방수 슈즈가 오늘의 필수템이에요.';
    }
    if (precipMm >= 2.5 || precip >= 70) {
      return '비가 촉촉이 내리고 있어요. 가벼운 방수 재킷 하나면 스타일도 기분도 업!';
    }
    if (precip >= 40 || cond.includes('소나기')) {
      return '갑작스러운 소나기가 올 수도 있어요. 접이식 우산 하나 챙겨두면 마음이 든든할 거예요.';
    }

    // ── 눈 ──
    if (precipMm >= 5 || cond.includes('폭설')) {
      return '많은 눈이 내리고 있어요. 따뜻한 패딩과 방한 부츠로 포근하게 입어주세요.';
    }
    if (cond.includes('눈')) {
      return '눈이 소복이 내리고 있어요. 따뜻한 코트와 목도리로 겨울 감성을 느껴보세요.';
    }

    // ── 기온 기반 ──
    if (temp >= 33) {
      return `${temp}°의 뜨거운 날씨예요. 바람이 통하는 린넨이나 면 소재로 가볍게 입어보세요.`;
    }
    if (temp >= 28) {
      return `${temp}°로 꽤 더운 하루예요. 밝고 시원한 컬러로 기분까지 상쾌하게 만들어봐요.`;
    }
    if (temp >= 23) {
      if (wind >= 20) return `${temp}°로 따뜻하지만 바람이 제법 불어요. 얇은 바람막이 하나를 챙겨두면 딱 좋아요.`;
      return `${temp}°로 쾌적한 날씨예요. 좋아하는 아이템으로 오늘의 코디를 마음껏 표현해보세요.`;
    }
    if (temp >= 17) {
      if (feels <= temp - 4) return `기온은 ${temp}°지만 체감은 ${feels}°로 꽤 서늘해요. 얇은 아우터로 레이어링하면 완벽해요.`;
      return `${temp}°로 포근하고 기분 좋은 날씨예요. 가디건이나 얇은 재킷으로 스타일리시하게 입어봐요.`;
    }
    if (temp >= 12) {
      if (wind >= 15) return `${temp}°인데 바람까지 불어 꽤 쌀쌀하게 느껴져요. 바람막이나 가벼운 코트로 멋스럽게 입어봐요.`;
      return `${temp}°로 선선한 가을 느낌이에요. 포근한 니트나 가벼운 재킷이 딱 어울릴 것 같아요.`;
    }
    if (temp >= 5) {
      return `${temp}°로 꽤 쌀쌀한 날이에요. 따뜻한 아우터로 든든하게 레이어링해보세요.`;
    }
    if (temp >= 0) {
      return `${temp}°로 제법 매서운 추위예요. 두꺼운 코트에 목도리와 장갑으로 따뜻하게 챙겨입어요.`;
    }
    return `영하 ${Math.abs(temp)}°의 혹독한 추위예요. 패딩과 핫팩은 필수, 최대한 따뜻하게 입고 나서요.`;
  };

  // 카테고리별 집계
  const categoryCounts = items.reduce((acc, item) => {
    if (item.category) acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  // 히어로 이미지용 랜덤 상태
  const [heroImageUrl, setHeroImageUrl] = useState(null);
  const [heroSource, setHeroSource] = useState(null); // 'user', 'outfit', 'closet'

  useEffect(() => {
    // 1순위: OOTD 로그 (내 사진)
    const userPhotos = ootdLogs.filter(log => log.photoUrl).map(log => log.photoUrl);
    if (userPhotos.length > 0) {
      // 이미 내 사진이 설정되어 있다면 무시 (무한 루프 방지)
      if (heroSource === 'user') return;
      
      const randomIndex = Math.floor(Math.random() * userPhotos.length);
      setHeroImageUrl(userPhotos[randomIndex]);
      setHeroSource('user');
      return;
    }

    // 2순위: 저장된 코디 아이템 사진 (내 사진이 없을 때만)
    if (heroSource !== 'user' && savedOutfits.length > 0) {
      const allOutfitImages = [];
      savedOutfits.forEach(outfit => {
        if (outfit.items) {
          Object.values(outfit.items).forEach(item => {
            if (item && item.imageUrl) allOutfitImages.push(item.imageUrl);
          });
        }
      });

      if (allOutfitImages.length > 0) {
        if (heroSource === 'outfit') return;
        const randomIndex = Math.floor(Math.random() * allOutfitImages.length);
        setHeroImageUrl(allOutfitImages[randomIndex]);
        setHeroSource('outfit');
        return;
      }
    }

    // 3순위: 일반 옷장 아이템 사진 (위 조건들이 모두 없을 때)
    if (!heroSource && items.length > 0) {
      const allItemImages = items.filter(i => i.imageUrl).map(i => i.imageUrl);
      if (allItemImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * allItemImages.length);
        setHeroImageUrl(allItemImages[randomIndex]);
        setHeroSource('closet');
      }
    }
  }, [items, savedOutfits, ootdLogs, heroSource]);

  // 옷장 카드 썸네일 (imageUrl 있는 옷 최대 4개)
  const closetThumbs = items.filter(i => i.imageUrl).slice(0, 4);

  // 저장됨 카드 썸네일 (최근 코디 아이템)
  const latestOutfit = savedOutfits[0];
  const savedThumbs = getOutfitThumbs(latestOutfit?.items);

  // 썸네일 없을 때 플레이스홀더 색
  const placeholderColors = ['#DDD8CE', '#D0CBC4', '#C4BFB8', '#E8E3DC'];

  return (
    <div className="home-page" style={{ minHeight: '100%', background: '#FAFAF8' }}>

      {/* ── 히어로 섹션 ── */}
      <div style={{ position: 'relative', width: '100%', height: 280, overflow: 'hidden' }}>
        
        {/* 배경 이미지 또는 플레이스홀더 */}
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt="최근 코디"
            className="hero-image-animate"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: '#2A2620',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {savedOutfits.length === 0 && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>
                저장된 코디가 없어요
              </p>
            )}
          </div>
        )}

        {/* 그라디언트 오버레이 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0.08) 100%)',
        }} />

        {/* 오버레이 텍스트 & CTA */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 22px' }}>
          <p style={{
            fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)', margin: '0 0 6px',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {greeting}
          </p>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: 'italic', fontWeight: 400,
            fontSize: 25, color: '#fff',
            margin: '0 0 10px', lineHeight: 1.2,
          }}>
            {name ? `${name}님,` : ''}<br />{getWeatherMessage()}
          </h1>
          <button
            onClick={() => onNavigate('outfit')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.14)',
              border: '0.5px solid rgba(255,255,255,0.38)',
              borderRadius: 20, padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            <span style={{
              fontSize: 11, letterSpacing: '0.1em', color: '#fff',
              textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif",
            }}>
              AI 코디 추천받기
            </span>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>→</span>
          </button>
        </div>
      </div>

      {/* ── 날씨 칩 + 포인트 배지 ── */}
      <div style={{ padding: '14px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {weather ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: '#F0EDE8', borderRadius: 20,
            padding: '6px 14px', fontSize: 12, color: '#6B6260',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            <span>{weather.emoji}</span>
            <span>{weather.condition} {weather.temp}°</span>
          </div>
        ) : (
          <div style={{
            display: 'inline-flex',
            background: '#F0EDE8', borderRadius: 20,
            padding: '6px 14px', fontSize: 12, color: '#B8AFA4',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            날씨 불러오는 중…
          </div>
        )}
        {/* 포인트 배지 */}
        <button
          onClick={() => onNavigate('store')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'linear-gradient(135deg, #5E3D31, #C16654)',
            borderRadius: 20, padding: '6px 14px',
            border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, color: '#fff',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <span style={{ fontSize: 11 }}>P</span>
          <span>{(points ?? 0).toLocaleString()}</span>
        </button>
      </div>

      {/* 가상 피팅 모델 등록 유도 배너 */}
      {!userProfile?.modelPhoto && (
        <div style={{ padding: '0 20px 24px' }}>
          <button
            onClick={() => {
              // App.js의 setShowSettings를 호출해야 함. 
              // 여기서는 onNavigate('settings') 처럼 처리하거나, 전역 이벤트를 사용해야 할 수도 있음.
              // 하지만 가장 쉬운 방법은 Home.js에서 setShowSettings를 유지하거나, App.js의 함수를 props로 받는 것입니다.
              window.dispatchEvent(new CustomEvent('openSettings'));
            }}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #18160F 0%, #3A352F 100%)',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Sparkles size={14} color="#FFD700" />
                <span style={{ fontSize: 10, color: '#ABA298', fontWeight: 600, letterSpacing: '0.05em' }}>NEW FEATURE</span>
              </div>
              <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 500 }}>전신사진 등록하고 가상 피팅하기</p>
              <p style={{ margin: '4px 0 0', color: '#ABA298', fontSize: 11 }}>AI가 나의 체형에 딱 맞는 코디를 보여줘요.</p>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRight size={18} color="#fff" />
            </div>
          </button>
        </div>
      )}

      {/* ── 2열: 옷장 + 저장됨 ── */}
      <div style={{ padding: '0 20px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        {/* 옷장 카드 */}
        <button
          onClick={() => onNavigate('closet')}
          style={{
            background: '#fff', border: '0.5px solid #E2DDD6',
            borderRadius: 12, padding: 0,
            cursor: 'pointer', textAlign: 'left',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* 2×2 썸네일 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, background: '#E2DDD6' }}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  aspectRatio: '1',
                  background: placeholderColors[i],
                  overflow: 'hidden',
                }}
              >
                {closetThumbs[i] && (
                  <img
                    src={closetThumbs[i].imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px 14px' }}>
            <p style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B8AFA4', margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>
              옷장
            </p>
            <div style={{ fontSize: 24, fontWeight: 300, color: '#18160F', lineHeight: 1, fontFamily: "'DM Sans', sans-serif" }}>
              {items.length}
            </div>
            <div style={{ fontSize: 11, color: '#ABA298', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
              벌의 옷
            </div>
            {/* 카테고리별 수량 (숫자만) */}
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              {CATEGORY_ORDER.map(cat => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#B8AFA4', fontFamily: "'DM Sans', sans-serif" }}>{cat}</span>
                  <span style={{ fontSize: 9, fontWeight: 500, color: '#6B6260', fontFamily: "'DM Sans', sans-serif" }}>{categoryCounts[cat] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </button>

        {/* 저장됨 카드 */}
        <button
          onClick={() => onNavigate('saved')}
          style={{
            background: '#fff', border: '0.5px solid #E2DDD6',
            borderRadius: 12, padding: 0,
            cursor: 'pointer', textAlign: 'left',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* 2×2 썸네일 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, background: '#E2DDD6' }}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  aspectRatio: '1',
                  background: placeholderColors[i],
                  overflow: 'hidden',
                }}
              >
                {savedThumbs[i] && (
                  <img
                    src={savedThumbs[i].imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px 14px' }}>
            <p style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B8AFA4', margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>
              저장됨
            </p>
            <div style={{ fontSize: 24, fontWeight: 300, color: '#18160F', lineHeight: 1, fontFamily: "'DM Sans', sans-serif" }}>
              {savedOutfits.length}
            </div>
            <div style={{ fontSize: 11, color: '#ABA298', marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
              개의 코디
            </div>
            {latestOutfit?.tpoInfo?.event && (
              <p style={{ fontSize: 10, color: '#B8AFA4', marginTop: 8, fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                최근: {latestOutfit.tpoInfo.event}
              </p>
            )}
            {latestOutfit?.tpoInfo?.date && !latestOutfit?.tpoInfo?.event && (
              <p style={{ fontSize: 10, color: '#B8AFA4', marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>
                최근: {latestOutfit.tpoInfo.date}
              </p>
            )}
          </div>
        </button>
      </div>

      {/* ── 옷 추가 배너 ── */}
      <div style={{ padding: '0 20px 24px' }}>
        <button
          onClick={() => onNavigate('upload')}
          style={{
            width: '100%', background: '#fff',
            border: '0.5px solid #E2DDD6', borderRadius: 12,
            padding: '18px 20px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B8AFA4', margin: '0 0 5px', fontFamily: "'DM Sans', sans-serif" }}>
              새 옷 추가
            </p>
            <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontWeight: 400, fontSize: 18, color: '#18160F', margin: 0 }}>
              옷장을 채워볼까요?
            </p>
          </div>
          <div style={{ width: 36, height: 36, background: '#18160F', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#FAF9F7', fontSize: 20, fontWeight: 300, lineHeight: 1 }}>+</span>
          </div>
        </button>
      </div>

      {/* ── 하단 푸터 ── */}
      <div style={{ padding: '20px 20px 60px', textAlign: 'center' }}>
        <div style={{ opacity: 0.3 }}>
          <p style={{ 
            fontFamily: "'Cormorant Garamond', serif", 
            fontSize: 14, 
            letterSpacing: '0.2em', 
            color: '#18160F',
            margin: '0 0 4px'
          }}>
            COORDIMENTOR
          </p>
          <p style={{ fontSize: 8, letterSpacing: '0.1em', color: '#ABA298', margin: 0 }}>
            VERSION 1.0.4 • © 2026
          </p>
        </div>
      </div>

      {showRecommendation && recommendation && (
        <MorningRecommendation
          weather={pendingWeather ?? weather}
          recommendation={recommendation}
          onClose={() => { setShowRecommendation(false); setPendingWeather(null); }}
          onNavigate={onNavigate}
        />
      )}

    </div>
  );
}
