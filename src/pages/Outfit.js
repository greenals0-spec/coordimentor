import React, { useState, useEffect, useRef } from 'react';
import { Loader, Sparkles, MapPin, RefreshCw, Send, Heart, List, X } from 'lucide-react';
import { getItemsOnce, saveOutfit, deleteSavedOutfit } from '../utils/storage';
import { getOutfitRecommendation, adjustOutfit } from '../utils/api';
import { getWeatherByLocation, getWeatherByLocationName, extractLocationFromText } from '../utils/weather';
import { useAuth } from '../contexts/AuthContext';
import FlatLay from '../components/FlatLay';


export default function OutfitPage() {
  const { user } = useAuth();
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [locationLabel, setLocationLabel] = useState('현재 위치');
  const [outfitLoading, setOutfitLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [adjustingIndex, setAdjustingIndex] = useState(-1);
  const [chatInputs, setChatInputs] = useState({});
  const [outfitError, setOutfitError] = useState('');
  const [savedMap, setSavedMap] = useState({}); // { index: outfitId }
  const [detailIndex, setDetailIndex] = useState(-1);

  // TPO States
  const today = new Date().toLocaleDateString('en-CA');
  const [targetDate, setTargetDate] = useState(today);
  const [targetHour, setTargetHour] = useState(new Date().getHours());
  const [eventType, setEventType] = useState('');

  // 디바운스용 타이머 ref
  const debounceRef = useRef(null);

  // ─── 날씨 로딩 (지명 감지 포함) ────────────────────────────────────────────
  const fetchWeather = async (eventText = eventType) => {
    setWeatherLoading(true);
    setWeatherError('');
    setResults([]);

    const detectedLocation = extractLocationFromText(eventText);

    try {
      if (detectedLocation) {
        // 텍스트에서 지명이 감지된 경우 → 해당 지역 날씨
        try {
          const w = await getWeatherByLocationName(detectedLocation, targetDate, targetHour);
          setWeather(w);
          setLocationLabel(w.locationLabel || detectedLocation);
        } catch (geoErr) {
          // 지오코딩 실패 시 현재 위치로 폴백 (조용히)
          console.warn('Geocoding failed, falling back to current location:', geoErr.message);
          const w = await getWeatherByLocation(targetDate, targetHour);
          setWeather(w);
          setLocationLabel('현재 위치');
        }
      } else {
        // 지명 없음 → 현재 위치 날씨
        const w = await getWeatherByLocation(targetDate, targetHour);
        setWeather(w);
        setLocationLabel('현재 위치');
      }
    } catch (e) {
      setWeatherError(e.message);
    } finally {
      setWeatherLoading(false);
    }
  };

  // 날짜/시간 변경 → 즉시 날씨 재로딩
  useEffect(() => {
    fetchWeather(eventType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, targetHour]);

  // 상황 텍스트 변경 → 1초 디바운스 후 날씨 재로딩 (지명 감지)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchWeather(eventType);
    }, 1000);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);

  // ─── 입력 필터링 ─────────────────────────────────────────────────────────
  const BLOCKED_KEYWORDS = [
    '강도', '강간', '살인', '절도', '폭행', '마약', '도박', '성범죄', '사기',
    '납치', '협박', '테러', '폭탄', '스토킹', '몰카', '불법', '범죄', '밀수',
    '매춘', '성매매', '원조교제', '아동', '청소년', '미성년', '야동', '포르노',
    '섹스', '성인', '유흥', '클럽', '원나잇', '헌팅', '조폭', '깡패', '폭력',
    '도둑', '침입', '공격',
  ];

  const isBlockedInput = (text) => {
    if (!text) return false;
    return BLOCKED_KEYWORDS.some(keyword => text.includes(keyword));
  };

  // ─── 코디 추천 ───────────────────────────────────────────────────────────
  const recommend = async () => {
    if (!weather) return;
    setOutfitError('');

    if (isBlockedInput(eventType)) {
      setOutfitError('적절하지 않은 내용이 포함되어 있어요. 다른 일정을 입력해주세요.');
      return;
    }
    setResults([]);
    setOutfitLoading(true);
    setChatInputs({});
    setAdjustingIndex(-1);
    setSavedMap({});
    try {
      const items = await getItemsOnce(user.uid);
      if (items.length === 0) {
        setOutfitError('옷장이 비어있어요. 먼저 옷을 추가해주세요.');
        return;
      }

      const tpoInfo = {
        date: targetDate,
        time: targetHour,
        event: eventType,
        location: locationLabel !== '현재 위치' ? locationLabel : null,
      };
      const rec = await getOutfitRecommendation(weather, items, tpoInfo);

      const keys = ['아우터', '상의', '하의', '신발', '액세서리_얼굴머리', '액세서리_손목팔', '액세서리_기타'];
      const newResults = rec.outfits.map(o => {
        const resolved = {};
        for (const key of keys) {
          const id = o.outfit[key];
          resolved[key] = id ? (items.find(i => i.id === id) || null) : null;
        }
        return { items: resolved, reason: o.reason, raw: o.outfit };
      });
      setResults(newResults);
    } catch (e) {
      setOutfitError(e.message);
    } finally {
      setOutfitLoading(false);
    }
  };

  // ─── 코디 수정 ───────────────────────────────────────────────────────────
  const handleAdjust = async (index) => {
    const text = chatInputs[index]?.trim();
    if (!text) return;

    setAdjustingIndex(index);
    setOutfitError('');
    try {
      const items = await getItemsOnce(user.uid);
      const tpoInfo = {
        date: targetDate,
        time: targetHour,
        event: eventType,
        location: locationLabel !== '현재 위치' ? locationLabel : null,
      };
      const currentOutfitRaw = results[index].raw;

      const newRec = await adjustOutfit(weather, items, tpoInfo, currentOutfitRaw, text);

      const keys = ['아우터', '상의', '하의', '신발', '액세서리_얼굴머리', '액세서리_손목팔', '액세서리_기타'];
      const resolved = {};
      for (const key of keys) {
        const id = newRec.outfit[key];
        resolved[key] = id ? (items.find(i => i.id === id) || null) : null;
      }

      const updatedResults = [...results];
      updatedResults[index] = { items: resolved, reason: newRec.reason, raw: newRec.outfit };
      setResults(updatedResults);
      setChatInputs(prev => ({ ...prev, [index]: '' }));
    } catch (e) {
      setOutfitError(`수정 실패: ${e.message}`);
    } finally {
      setAdjustingIndex(-1);
    }
  };

  // ─── 코디 저장 / 취소 토글 ───────────────────────────────────────────────
  const handleSaveOutfit = async (index) => {
    if (savedMap[index]) {
      // 이미 저장됨 → 취소
      try {
        await deleteSavedOutfit(user.uid, savedMap[index]);
        setSavedMap(prev => { const next = { ...prev }; delete next[index]; return next; });
      } catch (e) {
        alert(`저장 취소 실패: ${e.message}`);
      }
    } else {
      // 저장
      try {
        const outfitData = {
          items: results[index].items,
          reason: results[index].reason,
          raw: results[index].raw,
          weather: weather,
          tpoInfo: {
            date: targetDate,
            time: targetHour,
            event: eventType,
            location: locationLabel !== '현재 위치' ? locationLabel : null,
          },
        };
        const outfitId = await saveOutfit(user.uid, outfitData);
        setSavedMap(prev => ({ ...prev, [index]: outfitId }));
      } catch (e) {
        alert(`저장 실패: ${e.message}`);
      }
    }
  };

  // ─── 렌더 ────────────────────────────────────────────────────────────────
  return (
    <div className="page outfit-page">
      <h2 className="page-title">코디 추천</h2>

      {/* TPO 입력 폼 */}
      <div className="tpo-card">
        <h3 className="tpo-title">언제, 어디서, 어떤 일정인가요?</h3>
        <div className="tpo-form">
          <div className="tpo-group row">
            <input
              type="date"
              className="tpo-input flex-2"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              min={today}
            />
            <select
              className="tpo-input flex-1"
              value={targetHour}
              onChange={e => setTargetHour(parseInt(e.target.value))}
            >
              {[...Array(24)].map((_, i) => (
                <option key={i} value={i}>{i}시</option>
              ))}
            </select>
          </div>
          <div className="tpo-group">
            <input
              type="text"
              className="tpo-input"
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              placeholder="예: 부산에서 결혼식, 제주도 여행, 강남 미팅 등"
            />
          </div>
        </div>
      </div>

      {/* 날씨 카드 */}
      <div className="weather-card">
        {weatherLoading && (
          <div className="weather-loading" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.8)' }}>
            <Loader size={20} className="spin" />
            <span style={{ fontSize: 14 }}>날씨 데이터 분석 중...</span>
          </div>
        )}

        {weatherError && (
          <div className="weather-error">
            <p>날씨를 불러올 수 없습니다</p>
            <button className="btn secondary" onClick={() => fetchWeather()} style={{ padding: '8px 16px', fontSize: 13, marginTop: 8 }}>
              <RefreshCw size={14} /> 다시 시도
            </button>
          </div>
        )}

        {weather && !weatherLoading && (
          <>
            <div className="weather-main">
              <div className="weather-temp-group" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="weather-emoji" style={{ marginRight: 12 }}>{weather.emoji}</span>
                <span className="weather-temp">{weather.temp}°C</span>
              </div>
              <div className="weather-info" style={{ textAlign: 'right' }}>
                <p className="weather-desc">{weather.condition}</p>
                <p className="weather-loc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                  <MapPin size={10} />
                  {locationLabel}
                </p>
              </div>
            </div>
            {/* 강수확률 / 풍속 */}
            {(weather.precipProb != null || weather.windSpeed > 0) && (
              <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                {weather.precipProb != null && (
                  <span>💧 강수 {weather.precipProb}%</span>
                )}
                {weather.windSpeed > 0 && (
                  <span>💨 풍속 {weather.windSpeed}km/h</span>
                )}
                {weather.apparentTemp != null && weather.apparentTemp !== weather.temp && (
                  <span>🌡 체감 {weather.apparentTemp}°C</span>
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{targetDate} {targetHour}시 기준 예보</span>
              <button
                onClick={() => fetchWeather(eventType)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <RefreshCw size={11} /> 새로고침
              </button>
            </div>
          </>
        )}
      </div>

      {/* 추천 버튼 */}
      {weather && !weatherLoading && (
        <button
          className="btn primary full-width"
          onClick={recommend}
          disabled={outfitLoading}
          style={{ marginTop: 16 }}
        >
          {outfitLoading
            ? <><Loader size={18} className="spin" /><span>AI 추천 중...</span></>
            : <><Sparkles size={18} /><span>이 일정에 맞는 코디 추천받기</span></>
          }
        </button>
      )}

      {outfitError && <p className="error-msg" style={{ marginTop: 12 }}>{outfitError}</p>}

      {/* 코디 결과 리스트 */}
      {results.length > 0 && (
        <div className="outfit-results-list" style={{ marginTop: 24 }}>
          {results.map((res, index) => {
            const isSaved = !!savedMap[index];
            return (
              <div key={index} className="outfit-result-card">
                <div className="outfit-card-header">
                  <h4 className="outfit-title">코디 제안 {index + 1}</h4>
                  <button
                    onClick={() => setDetailIndex(index)}
                    title="아이템 목록 보기"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                  >
                    <List size={18} />
                  </button>
                </div>
                <p className="result-reason">{res.reason}</p>

                <div className="flatlay-wrapper">
                  {adjustingIndex === index && (
                    <div className="adjusting-overlay">
                      <Loader size={30} className="spin" color="var(--primary)" />
                      <p>코디 수정 중...</p>
                    </div>
                  )}
                  <FlatLay items={res.items} />
                </div>

                <div className="outfit-chat-form">
                  <input
                    type="text"
                    className="outfit-chat-input"
                    placeholder="예: 바지만 다른 걸로 변경해줘"
                    value={chatInputs[index] || ''}
                    onChange={e => setChatInputs(prev => ({ ...prev, [index]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAdjust(index)}
                    disabled={adjustingIndex !== -1}
                  />
                  <button
                    className="outfit-chat-send"
                    onClick={() => handleAdjust(index)}
                    disabled={adjustingIndex !== -1 || !chatInputs[index]?.trim()}
                  >
                    <Send size={16} />
                  </button>
                </div>

                <button
                  className={`btn full-width ${isSaved ? 'secondary' : 'primary'}`}
                  onClick={() => handleSaveOutfit(index)}
                  style={{ marginTop: 12 }}
                >
                  <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
                  <span>{isSaved ? '저장 취소' : '이 코디 저장하기'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 아이템 목록 모달 ── */}
      {detailIndex !== -1 && results[detailIndex] && (() => {
        const isSaved = !!savedMap[detailIndex];
        const LABEL = {
          '아우터': '아우터',
          '상의': '상의',
          '하의': '하의',
          '신발': '신발',
          '액세서리_얼굴머리': '얼굴/머리',
          '액세서리_손목팔': '손목/팔',
          '액세서리_기타': '가방/벨트 등',
        };
        const itemsMap = results[detailIndex].items;
        const sortedKeys = [
          '액세서리_얼굴머리',
          'SCARF_PLACEHOLDER', // 목도리인 경우 아우터 위에 배치
          '아우터',
          '상의',
          '액세서리_손목팔',
          'BELT_PLACEHOLDER', 
          '하의',
          '신발',
          'OTHER_PLACEHOLDER'
        ];

        const outfitItems = [];
        const miscItem = itemsMap['액세서리_기타'];
        
        // 벨트 판별
        const isBelt = miscItem && (
          (miscItem.name?.includes('벨트') || miscItem.name?.toLowerCase().includes('belt')) &&
          !(miscItem.name?.includes('백') || miscItem.name?.toLowerCase().includes('bag'))
        );

        // 목도리 판별
        const isScarf = miscItem && (
          miscItem.name?.includes('목도리') || 
          miscItem.name?.toLowerCase().includes('scarf') ||
          miscItem.name?.includes('머플러') ||
          miscItem.name?.toLowerCase().includes('muffler')
        );

        sortedKeys.forEach(key => {
          if (key === 'BELT_PLACEHOLDER') {
            if (isBelt) outfitItems.push(['액세서리_기타', miscItem]);
          } else if (key === 'SCARF_PLACEHOLDER') {
            if (isScarf) outfitItems.push(['액세서리_기타', miscItem]);
          } else if (key === 'OTHER_PLACEHOLDER') {
            if (miscItem && !isBelt && !isScarf) outfitItems.push(['액세서리_기타', miscItem]);
          } else {
            if (itemsMap[key]) outfitItems.push([key, itemsMap[key]]);
          }
        });

        return (
          <div
            onClick={() => setDetailIndex(-1)}
            style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 430, background: 'var(--surface)', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', height: '80vh', maxHeight: '80vh' }}
            >
              {/* 드래그 핸들 */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', flexShrink: 0 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
              </div>

              {/* 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 2px', fontFamily: "'DM Sans', sans-serif" }}>
                    코디 아이템
                  </p>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--primary)' }}>
                    코디 제안 {detailIndex + 1}
                  </h3>
                </div>
                <button onClick={() => setDetailIndex(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'flex' }}>
                  <X size={22} />
                </button>
              </div>

              {/* 아이템 목록 */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '12px 20px 0' }}>
                {outfitItems.map(([key, item]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 64, height: 64, flexShrink: 0, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 3px', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {LABEL[key] || key}
                      </p>
                      <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </p>
                      {item.color && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: "'DM Sans', sans-serif" }}>{item.color}</p>
                      )}
                    </div>
                  </div>
                ))}

                <div style={{ padding: '8px 0 100px' }} />
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
