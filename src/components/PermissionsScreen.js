import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';

const PERMISSIONS = [
  {
    icon: '📍',
    title: '위치 권한',
    desc: '현재 위치의 날씨를 기반으로\n맞춤 코디를 추천해드립니다.',
  },
  {
    icon: '📷',
    title: '카메라 권한',
    desc: '옷을 직접 촬영하거나\nOOTD 사진을 기록할 수 있습니다.',
  },
  {
    icon: '🖼️',
    title: '사진 보관함 권한',
    desc: '앨범에서 사진을 선택하거나\n코디 이미지를 저장할 수 있습니다.',
  },
];

export default function PermissionsScreen({ onDone }) {
  const [requesting, setRequesting] = useState(false);
  const [done, setDone] = useState(false);

  const handleAllow = async () => {
    setRequesting(true);
    try {
      // 1. 위치 권한
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(resolve, resolve, { timeout: 5000 });
      });

      // 2. 카메라 권한 (네이티브)
      if (Capacitor.isNativePlatform()) {
        try {
          const { Camera } = await import('@capacitor/camera');
          await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
        } catch (e) {
          console.warn('Camera permission request failed:', e);
        }
      }
    } catch (e) {
      console.warn('Permission request error:', e);
    } finally {
      setRequesting(false);
      setDone(true);
      localStorage.setItem('permissions_requested', 'true');
      setTimeout(() => onDone(), 600);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--background)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 28px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* 로고 */}
      <div style={{ marginBottom: 36, textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 32,
          color: 'var(--primary)',
          letterSpacing: '0.04em',
          marginBottom: 6,
        }}>
          Coordimentor
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Your AI Fashion Mentor
        </p>
      </div>

      {/* 안내 문구 */}
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 28, textAlign: 'center' }}>
        원활한 사용을 위해<br />아래 권한을 허용해주세요.
      </p>

      {/* 권한 목록 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
        {PERMISSIONS.map(({ icon, title, desc }) => (
          <div key={title} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            background: 'var(--surface)',
            borderRadius: 14,
            padding: '16px 18px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                {title}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 허용 버튼 */}
      <button
        onClick={handleAllow}
        disabled={requesting || done}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: 14,
          border: 'none',
          background: done ? '#4caf50' : 'var(--primary)',
          color: 'white',
          fontSize: 16,
          fontWeight: 600,
          cursor: requesting || done ? 'default' : 'pointer',
          transition: 'all 0.3s ease',
          letterSpacing: '0.02em',
        }}
      >
        {done ? '✓ 완료' : requesting ? '권한 요청 중...' : '모두 허용하기'}
      </button>

      <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
        권한을 거부해도 앱은 사용할 수 있으나<br />일부 기능이 제한될 수 있습니다.
      </p>
    </div>
  );
}
