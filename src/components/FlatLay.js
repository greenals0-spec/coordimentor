import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Item = React.memo(({ item, label, type, scaleX = 1, scaleY = 1, needCors = false }) => {
  const [retryCount, setRetryCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const baseSizes = {
    '얼굴/머리': { w: 120, h: 120 },
    '상의': { w: 180, h: 200 },
    '하의': { w: 150, h: 250 },
    '아우터': { w: 190, h: 210 },
    '신발': { w: 120, h: 120 },
    '손목/팔': { w: 110, h: 110 },
    '기타': { w: 160, h: 160 },
  };

  const base = baseSizes[type] || { w: 100, h: 100 };
  const width = Math.round(base.w * scaleX);
  const height = Math.round(base.h * scaleY);

  if (!item) {
    return <div className="fl-slot fl-slot--empty" style={{ width, height }} />;
  }
  
  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = (e) => {
    if (retryCount < 3) {
      console.warn(`이미지 로딩 재시도 (${retryCount + 1}/3): ${item.name}`);
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        // 캐시 무시를 위해 타임스탬프 추가
        e.target.src = `${item.imageUrl}${item.imageUrl.includes('?') ? '&' : '?'}retry=${retryCount + 1}`;
      }, 500);
    } else {
      setLoading(false);
      setError(true);
      // 마지막 수단으로 crossOrigin 제거 후 재시도
      if (e.target.crossOrigin) {
        e.target.removeAttribute('crossOrigin');
        e.target.src = item.imageUrl;
      }
    }
  };

  return (
    <div className="fl-slot" style={{ width, height, position: 'relative' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', borderRadius: '8px' }}>
          <div className="loader spin" style={{ width: '16px', height: '16px', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} />
        </div>
      )}
      
      {error && !loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', borderRadius: '8px', padding: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>이미지 없음</span>
        </div>
      )}

      <img
        src={item.imageUrl}
        alt={item.name}
        crossOrigin={needCors ? "anonymous" : undefined}
        onLoad={handleLoad}
        onError={handleError}
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain',
          opacity: loading ? 0 : 1,
          transition: 'opacity 0.2s ease-in-out'
        }} 
      />
      <span className="fl-label" style={{ opacity: loading ? 0.3 : 1 }}>{label}</span>
    </div>
  );
});

export default function FlatLay({ items, noBorder = false, style = {}, showWatermark = false, scale = 1 }) {
  const { userProfile } = useAuth();
  
  // Handle both Object and Array formats
  const normalizedItems = Array.isArray(items) 
    ? items.reduce((acc, item) => {
        if (!item) return acc;
        // category를 기반으로 키 매핑
        const cat = item.category || '';
        if (cat.includes('아우터')) acc['아우터'] = item;
        else if (cat.includes('상의')) acc['상의'] = item;
        else if (cat.includes('하의')) acc['하의'] = item;
        else if (cat.includes('신발')) acc['신발'] = item;
        else if (cat.includes('얼굴') || cat.includes('머리')) acc['액세서리_얼굴머리'] = item;
        else if (cat.includes('손목') || cat.includes('팔')) acc['액세서리_손목팔'] = item;
        else acc['액세서리_기타'] = item;
        return acc;
      }, {})
    : items;

  const {
    아우터,
    상의,
    하의,
    신발,
    액세서리_얼굴머리: face,
    액세서리_손목팔: wrist,
    액세서리_기타: etc,
  } = normalizedItems;

  // Calculate scales
  let scaleY = scale;
  let scaleX = scale;

  if (userProfile) {
    if (userProfile.height) {
      scaleY = (userProfile.height / 165) * scale;
    }
    if (userProfile.weight) {
      scaleX = Math.pow(userProfile.weight / 60, 0.5) * scale;
    }
  }

  scaleY = Math.max(0.6, Math.min(1.4, scaleY));
  scaleX = Math.max(0.6, Math.min(1.4, scaleX));

  return (
    <div 
      className={`flatlay-board ${noBorder ? 'no-border' : ''} ${showWatermark ? 'with-watermark' : ''}`} 
      style={{
        ...(noBorder ? { border: 'none', borderRadius: 0, background: 'transparent' } : {}),
        ...style,
        position: 'relative'
      }}
    >
      {/* 얼굴/머리 액세서리 */}
      {face && (
        <div className="fl-row fl-row--center">
          <Item item={face} label="얼굴/머리" type="얼굴/머리" scaleX={scaleX} scaleY={scaleY} needCors={showWatermark} />
        </div>
      )}

      {/* 목도리 */}
      {etc && (
        etc.name?.includes('목도리') || 
        etc.name?.toLowerCase().includes('scarf') ||
        etc.name?.includes('머플러') ||
        etc.name?.toLowerCase().includes('muffler')
      ) && (
        <div className="fl-row fl-row--center">
          <Item item={etc} label="목도리" type="기타" scaleX={scaleX} scaleY={scaleY} needCors={showWatermark} />
        </div>
      )}

      {/* 아우터 */}
      {아우터 && (
        <div className="fl-row fl-row--center">
          <Item item={아우터} label="아우터" type="아우터" scaleX={scaleX} scaleY={scaleY} needCors={showWatermark} />
        </div>
      )}

      {/* 상의 */}
      {상의 && (
        <div className="fl-row fl-row--center">
          <Item item={상의} label="상의" type="상의" scaleX={scaleX} scaleY={scaleY} needCors={showWatermark} />
        </div>
      )}

      {/* 손목/팔 액세서리 */}
      {wrist && (
        <div className="fl-row fl-row--center">
          <Item item={wrist} label="손목/팔" type="손목/팔" scaleX={scaleX} scaleY={scaleY} needCors={showWatermark} />
        </div>
      )}

      {/* 벨트 */}
      {etc && (etc.name?.includes('벨트') || etc.name?.toLowerCase().includes('belt')) && !(etc.name?.includes('백') || etc.name?.toLowerCase().includes('bag')) && (
        <div className="fl-row fl-row--center">
          <Item item={etc} label="벨트" type="기타" scaleX={scaleX} scaleY={scaleY} needCors={showWatermark} />
        </div>
      )}

      {/* 하의 */}
      {하의 && (
        <div className="fl-row fl-row--center">
          <Item item={하의} label="하의" type="하의" scaleX={scaleX} scaleY={scaleY} needCors={showWatermark} />
        </div>
      )}

      {/* 신발 */}
      {신발 && (
        <div className="fl-row fl-row--center">
          <Item item={신발} label="신발" type="신발" scaleX={scaleX} scaleY={scaleY} needCors={showWatermark} />
        </div>
      )}

      {/* 가방 및 기타 액세서리 */}
      {etc && !(
        (etc.name?.includes('벨트') || etc.name?.toLowerCase().includes('belt')) && !(etc.name?.includes('백') || etc.name?.toLowerCase().includes('bag'))
      ) && !(
        etc.name?.includes('목도리') || etc.name?.toLowerCase().includes('scarf') || etc.name?.includes('머플러') || etc.name?.toLowerCase().includes('muffler')
      ) && (
        <div className="fl-row fl-row--center">
          <Item item={etc} label="가방/기타" type="기타" scaleX={scaleX} scaleY={scaleY} needCors={showWatermark} />
        </div>
      )}

      {/* 워터마크 */}
      {showWatermark && (
        <div style={{
          marginTop: '20px',
          padding: '10px 0',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          color: 'var(--primary)',
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          fontSize: '14px',
          letterSpacing: '0.05em'
        }}>
          Coordimentor
          <span style={{ 
            display: 'block', 
            fontSize: '9px', 
            fontStyle: 'normal', 
            textTransform: 'uppercase', 
            letterSpacing: '0.2em',
            marginTop: '2px',
            color: 'var(--text-muted)'
          }}>
            Personal Styling Mentor
          </span>
        </div>
      )}
    </div>
  );
}
