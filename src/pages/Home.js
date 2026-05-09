import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LocalNotifications } from '@capacitor/local-notifications';
import { subscribeToItems, subscribeToSavedOutfits, subscribeToOotdLogs } from '../utils/storage';
import { getWeatherByLocation } from '../utils/weather';
import { Bell } from 'lucide-react';
import SettingsModal from '../components/SettingsModal';
import MorningRecommendation from '../components/MorningRecommendation';
import { recommendOutfit } from '../utils/recommendation';

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
  const { user, userProfile, signOut } = useAuth();
  const [items, setItems] = useState([]);
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [ootdLogs, setOotdLogs] = useState([]);
  const [weather, setWeather] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeToItems(user.uid, setItems);
    const unsub2 = subscribeToSavedOutfits(user.uid, setSavedOutfits);
    const unsub3 = subscribeToOotdLogs(user.uid, setOotdLogs);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  useEffect(() => {
    getWeatherByLocation().then(setWeather).catch(() => {});
  }, []);

  // ── 알람 체크 및 알림 리스너 ──
  useEffect(() => {
    // 앱 실행 중 알림 클릭 시 처리
    const setupListener = async () => {
      const listener = await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        if (notification.notification.extra?.type === 'morning_recommendation') {
          // 알림 클릭 시 즉시 추천 생성
          const rec = recommendOutfit(weather, items);
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

    if (!weather || !items.length || !userProfile?.alarmEnabled) return;

    const checkAlarm = () => {
      const now = new Date();
      const [alarmH, alarmM] = (userProfile.alarmTime || '07:30').split(':').map(Number);
      
      const alarmDate = new Date();
      alarmDate.setHours(alarmH, alarmM, 0, 0);

      const todayStr = now.toISOString().split('T')[0];
      const lastShown = localStorage.getItem('last_alarm_shown');

      // 알람 시간 이후이고, 오늘 아직 보여주지 않았을 때 (알람 시간으로부터 4시간 이내인 경우만)
      const diffMs = now - alarmDate;
      if (lastShown !== todayStr && diffMs >= 0 && diffMs < 4 * 60 * 60 * 1000) {
        const rec = recommendOutfit(weather, items);
        if (rec) {
          setRecommendation(rec);
          setShowRecommendation(true);
          localStorage.setItem('last_alarm_shown', todayStr);
        }
      }
    };

    checkAlarm();
    const interval = setInterval(checkAlarm, 60000);

    return () => {
      clearInterval(interval);
      if (notificationListener) notificationListener.remove();
    };
  }, [weather, items, userProfile]);

  const name = userProfile?.name || user?.displayName || '';
  const hour = new Date().getHours();
  const greeting =
    hour < 6  ? '좋은 새벽이에요' :
    hour < 12 ? '좋은 아침이에요' :
    hour < 18 ? '안녕하세요' : '좋은 저녁이에요';

  // 날씨에 따른 맞춤 메시지 생성
  const getWeatherMessage = () => {
    if (!weather) return '오늘의 코디를 준비해드릴까요?';
    const cond = weather.condition.toLowerCase();
    if (cond.includes('비')) return '비가 오네요, 레인부츠나 방수 자켓 어때요?';
    if (cond.includes('눈')) return '눈이 내려요! 따뜻한 코트와 목도리를 챙기세요.';
    if (weather.temp >= 28) return '무더운 날씨예요. 시원한 리넨 소재를 추천해요.';
    if (weather.temp <= 5) return '꽤 쌀쌀하네요. 든든한 레이어링이 필요해요.';
    return '외출하기 좋은 날씨네요. 멋진 코디를 제안할게요!';
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
        
        {/* 알람 설정 버튼 */}
        <button 
          onClick={() => setShowSettings(true)}
          style={{
            position: 'absolute', top: 16, right: 16,
            zIndex: 10, background: '#fff',
            border: 'none', width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
          }}
        >
          <Bell size={18} color="#18160F" fill="#18160F" />
        </button>

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
            fontSize: 28, color: '#fff',
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

      {/* ── 날씨 칩 ── */}
      <div style={{ padding: '14px 20px 16px' }}>
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
      </div>

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
        <button
          onClick={signOut}
          style={{
            background: 'none', border: 'none', color: '#ABA298',
            fontSize: 10, letterSpacing: '0.05em', cursor: 'pointer',
            textDecoration: 'underline', marginBottom: 24,
            fontFamily: "'DM Sans', sans-serif"
          }}
        >
          로그아웃
        </button>
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

      {/* ── 모달/오버레이 ── */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showRecommendation && recommendation && (
        <MorningRecommendation 
          weather={weather} 
          recommendation={recommendation} 
          onClose={() => setShowRecommendation(false)} 
        />
      )}

    </div>
  );
}
