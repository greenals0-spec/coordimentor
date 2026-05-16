import { X } from 'lucide-react';

export default function InsufficientPointsModal({ onClose, onCharge, required, current }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 32px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '32px 24px',
        maxWidth: 340, width: '100%', textAlign: 'center',
        animation: 'fadeUp 0.3s ease',
        fontFamily: "'Pretendard', sans-serif",
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <X size={20} color="#9E7B6A" />
        </button>

        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FDF4EB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '2px solid #EDE0D0' }}>
          <span style={{ fontSize: 24 }}>P</span>
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#5E3D31', margin: '0 0 8px' }}>
          포인트가 부족해요
        </h3>
        <p style={{ fontSize: 13, color: '#9E7B6A', lineHeight: 1.7, margin: '0 0 8px' }}>
          이 서비스는 <strong style={{ color: '#C16654' }}>{required}P</strong>가 필요해요.
        </p>
        <p style={{ fontSize: 13, color: '#9E7B6A', margin: '0 0 24px' }}>
          현재 잔여 포인트: <strong style={{ color: '#5E3D31' }}>{current}P</strong>
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '13px', borderRadius: 12,
              border: '1px solid #EDE0D0', background: '#FDF4EB',
              color: '#7A4F3E', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={onCharge}
            style={{
              flex: 2, padding: '13px', borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #C16654, #E8A070)',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            포인트 충전하기
          </button>
        </div>
      </div>
    </div>
  );
}
