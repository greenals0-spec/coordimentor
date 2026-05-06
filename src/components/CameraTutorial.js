import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';

export default function CameraTutorial({ onConfirm, onClose }) {
  const [card, setCard] = useState(0);
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50 && card === 0) setCard(1);
    if (diff < -50 && card === 1) setCard(0);
    touchStartX.current = null;
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#FFFFFF', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 8px' }}>
        <span style={{ fontSize: 11, color: '#B8AFA4', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          촬영 가이드
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#B8AFA4', display: 'flex' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '6px 0 16px' }}>
        {[0, 1].map(i => (
          <div key={i} style={{
            height: 4,
            borderRadius: 2,
            width: card === i ? 20 : 6,
            background: card === i ? '#18160F' : '#E2DDD6',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      {/* Card area — 이미지+텍스트 고정 위치, 버튼은 하단 고정 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: 120 }}>

        {/* 이미지+텍스트: 항상 같은 위치 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '0 0' }}>

          {/* 이미지 — 두 장 모두 렌더링, 활성 카드만 표시 (전환 시 즉시 표시) */}
          <div style={{
            position: 'relative',
            width: '150%',
            marginLeft: '-25%',
            aspectRatio: '1836 / 1000',
            overflow: 'hidden',
            marginBottom: 28,
            flexShrink: 0,
          }}>
            <img
              src="/images/tutorial-step1.webp"
              alt="옷을 평평하게 펼쳐주세요"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', objectPosition: 'center center', position: 'absolute', inset: 0, opacity: card === 0 ? 1 : 0, transition: 'opacity 0.2s ease' }}
            />
            <img
              src="/images/tutorial-step2.webp"
              alt="화면 가득 채워서 찍어주세요"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0, opacity: card === 1 ? 1 : 0, transition: 'opacity 0.2s ease', transform: 'scale(1.12) translateX(8%)', transformOrigin: 'center center' }}
            />
          </div>

          {/* 텍스트 */}
          <div style={{ textAlign: 'center', padding: '0 20px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 24,
              fontWeight: 400,
              color: '#18160F',
              margin: '0 0 10px',
              lineHeight: 1.3,
            }}>
              {card === 0 ? '옷을 평평하게 펼쳐주세요' : '화면 가득 채워서 찍어주세요'}
            </h3>
            <p style={{ fontSize: 14, color: '#ABA298', lineHeight: 1.75, margin: 0 }}>
              {card === 0 ? (
                <>주름 없이 바닥에 펼친 후 촬영하면<br />AI가 더 정확하게 분석해요.</>
              ) : (
                <>옷이 카메라 화면을 꽉 채우도록<br />가까이서 촬영하면 더 선명하게 저장돼요.</>
              )}
            </p>
          </div>
        </div>

        {/* 버튼 — 카드 2만, 하단 고정 */}
        {card === 1 && (
          <div style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)', left: 20, right: 20 }}>
            <button
              onClick={onConfirm}
              style={{
                width: '100%',
                background: '#18160F',
                color: '#FAF9F7',
                border: 'none',
                borderRadius: 4,
                padding: '15px 0',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              촬영 시작
            </button>
            <button
              onClick={() => setCard(0)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#C4B9AE',
                fontSize: 13,
                marginTop: 12,
                padding: '8px 0',
              }}
            >
              ← 이전으로
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
