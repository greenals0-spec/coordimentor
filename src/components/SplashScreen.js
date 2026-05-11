import React from 'react';

export default function SplashScreen({ fadingOut }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      overflow: 'hidden',
      transition: 'opacity 0.6s ease',
      opacity: fadingOut ? 0 : 1,
      background: '#FDF4EB',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <style>{`
        @keyframes splashBreathe {
          0%, 100% { opacity: 0.95; transform: scale(1.02); }
          50%       { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .splash-img-container {
          width: 280px;
          height: 280px;
          border-radius: 140px;
          overflow: hidden;
          box-shadow: 0 15px 45px rgba(94,61,49,0.12);
          margin-bottom: 40px;
          animation: splashBreathe 6s ease-in-out infinite;
        }
        .splash-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .brand-fade {
          animation: fadeSlideUp 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
        }
        .sub-fade {
          animation: fadeSlideUp 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.8s both;
        }
        .line-fade {
          width: 40px;
          height: 1px;
          background: #C8B8A8;
          margin: 12px 0 16px;
          animation: fadeSlideUp 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both;
        }
      `}</style>

      {/* ── Premium Image ── */}
      <div className="splash-img-container">
        <img 
          src="/assets/splash_image.webp" 
          alt="Coordimentor" 
          className="splash-img"
        />
      </div>

      {/* ── Brand name ── */}
      <h1
        className="brand-fade"
        style={{
          fontFamily: "'Pretendard', sans-serif",
          fontSize: '32px',
          fontStyle: 'normal',
          fontWeight: '700',
          color: '#5E3D31',
          letterSpacing: '1px',
          margin: 0
        }}
      >
        Coordimentor
      </h1>

      {/* ── Thin rule ── */}
      <div className="line-fade" />

      {/* ── Tagline ── */}
      <p
        className="sub-fade"
        style={{
          fontFamily: "'Pretendard', sans-serif",
          fontSize: '10px',
          fontWeight: '500',
          color: '#C16654',
          letterSpacing: '5px',
          margin: 0,
          textTransform: 'uppercase'
        }}
      >
        AI OUTFIT STYLIST
      </p>
    </div>
  );
}
