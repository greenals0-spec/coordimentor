import React from 'react';
import { X, Sparkles, Wind, Droplets, Thermometer } from 'lucide-react';

export default function MorningRecommendation({ weather, recommendation, onClose }) {
  if (!weather || !recommendation) return null;

  const items = [
    { label: '상의', item: recommendation.top },
    { label: '하의', item: recommendation.bottom },
    { label: '아우터', item: recommendation.outer },
    { label: '신발', item: recommendation.shoes },
    { label: '액세서리', item: recommendation.accessory },
  ].filter(i => i.item);

  return (
    <div className="modal-overlay" style={{ zIndex: 3000, background: 'rgba(24, 22, 15, 0.92)' }}>
      <div className="morning-modal" style={{
        width: '90%',
        maxWidth: 400,
        background: '#FAF9F7',
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        animation: 'modalSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,0,0,0.05)', border: 'none',
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10
          }}
        >
          <X size={18} color="#18160F" />
        </button>

        {/* Header/Weather Section */}
        <div style={{
          padding: '40px 24px 24px',
          background: 'linear-gradient(135deg, #F0EDE8 0%, #E2DDD6 100%)',
          textAlign: 'center'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Sparkles size={16} color="#B8AFA4" />
            <span style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#B8AFA4', fontFamily: "'DM Sans', sans-serif" }}>
              Good Morning
            </span>
          </div>
          
          <h2 style={{ 
            fontFamily: "'Cormorant Garamond', serif", 
            fontStyle: 'italic', 
            fontSize: 32, 
            margin: '0 0 16px',
            color: '#18160F',
            lineHeight: 1.2
          }}>
            오늘의 코디 추천
          </h2>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{weather.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#18160F' }}>{weather.condition}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(0,0,0,0.1)', alignSelf: 'stretch' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 300, color: '#18160F', marginBottom: 4 }}>{weather.temp}°</div>
              <div style={{ fontSize: 11, color: '#B8AFA4' }}>현재 기온</div>
            </div>
          </div>
        </div>

        {/* Message Section */}
        <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
          <p style={{ 
            fontSize: 14, 
            lineHeight: 1.6, 
            color: '#6B6260', 
            margin: 0,
            fontFamily: "'DM Sans', sans-serif"
          }}>
            {recommendation.message}
          </p>
        </div>

        {/* Items Grid */}
        <div style={{ 
          padding: '0 24px 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12
        }}>
          {items.map(({ label, item }) => (
            <div key={label} style={{
              background: '#fff',
              border: '1px solid #F0EDE8',
              borderRadius: 16,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ 
                aspectRatio: '1', 
                background: '#F8F6F3', 
                borderRadius: 10,
                overflow: 'hidden'
              }}>
                <img 
                  src={item.imageUrl} 
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div>
                <span style={{ fontSize: 9, color: '#B8AFA4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <p style={{ 
                  margin: '2px 0 0', 
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#18160F',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {item.name}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div style={{ padding: '0 24px 32px' }}>
          <button 
            onClick={onClose}
            style={{
              width: '100%',
              background: '#18160F',
              color: '#FAF9F7',
              border: 'none',
              padding: '16px',
              borderRadius: 16,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(0,0,0,0.1)'
            }}
          >
            확인했어요
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
