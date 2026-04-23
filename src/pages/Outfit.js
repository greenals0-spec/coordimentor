import React, { useState, useEffect } from 'react';
import { Loader, Sparkles, MapPin, RefreshCw } from 'lucide-react';
import { getItemsOnce } from '../utils/storage';
import { getOutfitRecommendation } from '../utils/api';
import { getWeatherByLocation } from '../utils/weather';
import { useAuth } from '../contexts/AuthContext';
import FlatLay from '../components/FlatLay';


export default function OutfitPage() {
  const { user } = useAuth();
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [outfitLoading, setOutfitLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [outfitError, setOutfitError] = useState('');

  const fetchWeather = async () => {
    setWeatherLoading(true);
    setWeatherError('');
    setResult(null);
    try {
      const w = await getWeatherByLocation();
      setWeather(w);
    } catch (e) {
      setWeatherError(e.message);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => { fetchWeather(); }, []);

  const recommend = async () => {
    if (!weather) return;
    setOutfitError('');
    setResult(null);
    setOutfitLoading(true);
    try {
      const items = await getItemsOnce(user.uid);
      if (items.length === 0) {
        setOutfitError('옷장이 비어있어요. 먼저 옷을 추가해주세요.');
        return;
      }
      const rec = await getOutfitRecommendation(weather, items);
      const keys = ['아우터', '상의', '하의', '신발', '액세서리_얼굴머리', '액세서리_손목팔'];
      const resolved = {};
      for (const key of keys) {
        const id = rec.outfit[key];
        resolved[key] = id ? (items.find(i => i.id === id) || null) : null;
      }
      setResult({ items: resolved, reason: rec.reason });
    } catch (e) {
      setOutfitError(e.message);
    } finally {
      setOutfitLoading(false);
    }
  };

  return (
    <div className="page outfit-page">
      <h2 className="page-title">코디 추천</h2>

      {/* 날씨 카드 */}
      <div className="weather-card">
        {weatherLoading && (
          <div className="weather-loading">
            <Loader size={20} className="spin" />
            <span>현재 날씨 불러오는 중...</span>
          </div>
        )}

        {weatherError && (
          <div className="weather-error">
            <p>{weatherError}</p>
            <button className="btn secondary" onClick={fetchWeather}>
              <RefreshCw size={14} /> 다시 시도
            </button>
          </div>
        )}

        {weather && !weatherLoading && (
          <div className="weather-info">
            <div className="weather-main">
              <span className="weather-emoji">{weather.emoji}</span>
              <div>
                <p className="weather-temp">{weather.temp}°C</p>
                <p className="weather-condition">{weather.condition}</p>
              </div>
            </div>
            <div className="weather-location">
              <MapPin size={13} />
              <span>현재 위치 기준</span>
              <button className="refresh-btn" onClick={fetchWeather}>
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
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
            : <><Sparkles size={18} /><span>오늘 날씨에 맞는 코디 추천</span></>
          }
        </button>
      )}

      {outfitError && <p className="error-msg" style={{ marginTop: 12 }}>{outfitError}</p>}

      {/* 코디 결과 */}
      {result && (
        <div className="outfit-result">
          <p className="result-reason">{result.reason}</p>
          <FlatLay items={result.items} />
        </div>
      )}
    </div>
  );
}
