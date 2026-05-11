import { X, Sparkles, Shirt } from 'lucide-react';
import { runFlatlayTryOn } from '../utils/tryon';
import { useAuth } from '../contexts/AuthContext';
import { useState, useRef } from 'react';
import { saveImageAsJpg } from '../utils/saveImage';


// ── Modern Warm & Cozy palette ──────────────────────────
const C = {
  oatmeal:    '#FDF4EB',
  ivory:      '#FFFFFF',
  ivoryDeep:  '#FEF9F3',
  brown:      '#5E3D31',
  brownLight: '#7A4F3E',
  terracotta: '#C16654',
  terracottaLight: 'rgba(193,102,84,0.12)',
  border:     '#EDE0D0',
  muted:      '#9E7B6A',
  faint:      '#C9A98F',
};

const SITUATION_EMOJI = {
  '출근': '💼', '운동': '🏃', '등교': '📚', '데이트': '💑',
  '여행': '✈️', '등산': '🏔️', '모임': '🎉', '기타': '📌',
};

export default function MorningRecommendation({ weather, recommendation, onClose }) {
  const { userProfile } = useAuth();
  const [tryingOn, setTryingOn]     = useState(false);
  const [tryOnResult, setTryOnResult] = useState(null);
  const [tryOnProgress, setTryOnProgress] = useState({ step: 0, total: 0, label: '' });
  const [progressPct, setProgressPct]     = useState(0);
  const progressTimerRef  = useRef(null);
  const progressTargetRef = useRef(0);

  if (!weather || !recommendation) return null;

  const situation = recommendation.situation;

  // 부드러운 % 애니메이션
  const animateToTarget = (target) => {
    progressTargetRef.current = target;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgressPct(prev => {
        const diff = progressTargetRef.current - prev;
        if (Math.abs(diff) < 0.5) {
          clearInterval(progressTimerRef.current);
          return progressTargetRef.current;
        }
        return prev + diff * 0.08;
      });
    }, 30);
  };

  const handleTryOn = async () => {
    if (!userProfile?.modelPhoto) {
      alert('설정에서 "나의 모델(전신사진)"을 먼저 등록해주세요!');
      return;
    }
    const hasItems = recommendation.top || recommendation.bottom || recommendation.outer
                  || recommendation.shoes || recommendation.accessory;
    if (!hasItems) {
      alert('입혀볼 옷이 없어요. 옷장에 아이템을 추가해주세요!');
      return;
    }

    setTryingOn(true);
    setProgressPct(0);
    setTryOnProgress({ step: 0, total: 0, label: '' });

    try {
      const result = await runFlatlayTryOn(
        userProfile.modelPhoto,
        recommendation,
        (step, total, label) => {
          setTryOnProgress({ step, total, label });
          // flatlay: step1=코디묶음생성(50%), step2=AI착장(100%)
          animateToTarget(step === 1 ? 50 : 100);
        }
      );
      animateToTarget(100);
      setTryOnResult(result);
    } catch (err) {
      console.error('TryOn error:', err);
      alert(`가상 입어보기 오류: ${err.message}`);
    } finally {
      setTryingOn(false);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
  };

  const items = [
    { label: '상의',    item: recommendation.top },
    { label: '하의',    item: recommendation.bottom },
    { label: '아우터',  item: recommendation.outer },
    { label: '신발',    item: recommendation.shoes },
    { label: '액세서리', item: recommendation.accessory },
  ].filter(i => i.item);

  return (
    <div className="modal-overlay" style={{ zIndex: 3000, background: 'rgba(45, 28, 20, 0.88)', alignItems: 'center', padding: '16px 0 90px' }}>
      <div style={{
        width: '92%',
        maxWidth: 400,
        background: C.oatmeal,
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        maxHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'modalSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(94,61,49,0.08)', border: 'none',
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10,
          }}
        >
          <X size={18} color={C.brown} />
        </button>

        {/* 스크롤 영역 */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

        {/* 헤더: 날씨 + 상황 */}
        <div style={{
          padding: '40px 24px 24px',
          background: 'linear-gradient(135deg, #5E3D31 0%, #7A4F3E 55%, #C16654 100%)',
          textAlign: 'center',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Sparkles size={14} color="rgba(255,255,255,0.7)" />
            <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', fontFamily: "'Pretendard', sans-serif" }}>
              {situation ? `${SITUATION_EMOJI[situation] || ''} ${situation} 코디 추천` : 'Good Morning'}
            </span>
          </div>

          <h2 style={{ fontFamily: "'Pretendard', sans-serif", fontStyle: 'normal', fontWeight: 700, fontSize: 24, margin: '0 0 14px', color: '#fff', lineHeight: 1.3 }}>
            오늘의 코디 추천
          </h2>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 4 }}>{weather.emoji}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{weather.condition}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', alignSelf: 'stretch' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 300, color: '#fff', marginBottom: 4 }}>{weather.temp}°</div>
              <div style={{ fontSize: 11, color: '#B8AFA4' }}>현재 기온</div>
            </div>
          </div>
        </div>

        {/* 메시지 */}
        <div style={{ padding: '16px 24px 10px', textAlign: 'center' }}>
          {recommendation.message.split('\n').map((line, i) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.6, color: i === 0 ? C.brown : C.muted, margin: '0 0 4px', fontFamily: "'Pretendard', sans-serif", fontWeight: i === 0 ? 600 : 400 }}>
              {line}
            </p>
          ))}
        </div>

        {/* 아이템 그리드 */}
        <div style={{ padding: '8px 24px 20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {items.map(({ label, item }) => (
            <div key={label} style={{ background: C.ivory, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ aspectRatio: '1', background: C.ivoryDeep, borderRadius: 10, overflow: 'hidden' }}>
                <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <span style={{ fontSize: 9, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</span>
                <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 600, color: C.brown, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </p>
              </div>
            </div>
          ))}
        </div>

        </div>{/* 스크롤 영역 끝 */}

        {/* Try-On + 확인 버튼 — 항상 하단 고정 */}
        <div style={{ padding: '12px 24px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10, background: C.oatmeal, flexShrink: 0 }}>

          {/* 결과 이미지 */}
          {tryOnResult && (
            <div style={{ animation: 'fadeUp 0.5s ease' }}>
              <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 10 }}>✨ AI가 생성한 전체 코디 착장 결과입니다</p>
              <div style={{ width: '100%', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.15)', marginBottom: 10 }}>
                <img src={tryOnResult} alt="Try-On Result" style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }} />
              </div>
              {/* 저장 버튼 */}
              <button
                onClick={() => saveImageAsJpg(tryOnResult, 'coordimentor_morning')}
                style={{ width: '100%', background: C.brown, color: '#fff', border: 'none', padding: '12px', borderRadius: 12, fontSize: 13, cursor: 'pointer', marginBottom: 4, fontFamily: "'Pretendard', sans-serif", fontWeight: 600 }}
              >
                📥 이미지 저장
              </button>
              <button
                onClick={() => { setTryOnResult(null); setProgressPct(0); }}
                style={{ width: '100%', background: C.ivoryDeep, color: C.brown, border: `1px solid ${C.border}`, padding: '12px', borderRadius: 12, fontSize: 13, cursor: 'pointer', fontFamily: "'Pretendard', sans-serif", fontWeight: 500 }}
              >
                다시 코디 보기
              </button>
            </div>
          )}

          {/* 입어보기 버튼 / 프로그레스 바 */}
          {!tryOnResult && (
            tryingOn ? (
              <div style={{ borderRadius: 16, background: 'rgba(193,102,84,0.08)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: C.brown, fontWeight: 600 }}>
                    {tryOnProgress.label || '준비 중...'}
                  </span>
                  <span style={{ fontSize: 13, color: C.terracotta, fontWeight: 700 }}>
                    {Math.round(progressPct)}%
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 100, background: 'rgba(193,102,84,0.15)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 100,
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #C16654, #E8A070)',
                    transition: 'width 0.08s linear',
                  }} />
                </div>
                {tryOnProgress.total > 0 && (
                  <span style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
                    {tryOnProgress.step} / {tryOnProgress.total} 단계 진행 중
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={handleTryOn}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #C16654 0%, #D4845E 60%, #E8A070 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '16px',
                  borderRadius: 16,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 8px 24px rgba(193,102,84,0.30)',
                  transition: 'all 0.3s',
                }}
              >
                <Shirt size={18} />
                나의 모델에 전체 코디 입혀보기
              </button>
            )
          )}

          <button
            onClick={onClose}
            style={{ width: '100%', background: C.brown, color: '#fff', border: 'none', padding: '16px', borderRadius: 16, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Pretendard', sans-serif", letterSpacing: '0.02em' }}
          >
            확인했어요
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
