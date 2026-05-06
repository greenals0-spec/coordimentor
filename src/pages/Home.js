import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToItems, subscribeToSavedOutfits } from '../utils/storage';
import { getWeatherByLocation } from '../utils/weather';

const CATEGORY_ORDER = ['상의', '하의', '아우터', '신발', '액세서리'];

// 저장된 코디 items 객체에서 대표 이미지 추출 (상의 → 아우터 → 하의 순 우선)
const HERO_PRIORITY = ['상의', '아우터', '하의', '신발', '액세서리_얼굴머리', '액세서리_손목팔'];
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
  const { user, userProfile } = useAuth();
  const [items, setItems] = useState([]);
  const [savedOutfits, setSavedOutfits] = useState([]);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeToItems(user.uid, setItems);
    const unsub2 = subscribeToSavedOutfits(user.uid, setSavedOutfits);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  useEffect(() => {
    getWeatherByLocation().then(setWeather).catch(() => {});
  }, []);

  const name = userProfile?.name || user?.displayName || '';
  const hour = new Date().getHours();
  const greeting =
    hour < 6  ? '좋은 새벽이에요' :
    hour < 12 ? '좋은 아침이에요' :
    hour < 18 ? '안녕하세요' : '좋은 저녁이에요';

  // 카테고리별 집계
  const categoryCounts = items.reduce((acc, item) => {
    if (item.category) acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  // 히어로 이미지용 랜덤 아이템 상태
  const [heroItem, setHeroItem] = useState(null);

  useEffect(() => {
    if (items.length > 0 && !heroItem) {
      const randomIndex = Math.floor(Math.random() * items.length);
      setHeroItem(items[randomIndex]);
    }
  }, [items, heroItem]);

  const heroImageUrl = heroItem?.imageUrl;

  // 옷장 카드 썸네일 (imageUrl 있는 옷 최대 4개)
  const closetThumbs = items.filter(i => i.imageUrl).slice(0, 4);

  // 저장됨 카드 썸네일 (최근 코디 아이템)
  const latestOutfit = savedOutfits[0];
  const savedThumbs = getOutfitThumbs(latestOutfit?.items);

  // 썸네일 없을 때 플레이스홀더 색
  const placeholderColors = ['#DDD8CE', '#D0CBC4', '#C4BFB8', '#E8E3DC'];

  return (
    <div style={{ minHeight: '100%', background: '#FAFAF8' }}>

      {/* ── 히어로 섹션 ── */}
      <div style={{ position: 'relative', width: '100%', height: 280, overflow: 'hidden' }}>

        {/* 배경 이미지 또는 플레이스홀더 */}
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt="최근 코디"
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
            margin: '0 0 14px', lineHeight: 1.2,
          }}>
            {name ? `${name}님,` : ''}<br />오늘은 뭘 입을까요?
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

    </div>
  );
}
