import React, { useState } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { POINT_COSTS } from '../utils/points';

const PACKAGES = [
  { id: 'points_1000',  points: 1000,  price: '990원',   label: '기본',     popular: false },
  { id: 'points_3000',  points: 3000,  price: '2,490원', label: '스탠다드', popular: true  },
  { id: 'points_10000', points: 10000, price: '6,900원', label: '프리미엄', popular: false },
];

const SERVICES = [
  { name: '옷 1벌 등록',      cost: POINT_COSTS.ITEM_REGISTER },
  { name: '가상 입어보기',    cost: POINT_COSTS.TRY_ON        },
  { name: '코디 추천',        cost: POINT_COSTS.OUTFIT_REC    },
  { name: '루틴 알람 설정',   cost: POINT_COSTS.ROUTINE_ALARM },
];

export default function StorePage({ onBack }) {
  const { user, points } = useAuth();
  const [selected, setSelected] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async () => {
    if (!selected) return;
    setPurchasing(true);
    // TODO: Google Play Billing / Apple IAP 연동
    alert('결제 시스템 준비 중이에요. 곧 만나요!');
    setPurchasing(false);
  };

  return (
    <div className="page" style={{ fontFamily: "'Pretendard', sans-serif", overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 8px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ChevronLeft size={24} color="#5E3D31" />
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#5E3D31', margin: 0 }}>포인트 충전</h2>
      </div>

      {/* 잔여 포인트 */}
      <div style={{ margin: '12px 20px', background: 'linear-gradient(135deg, #5E3D31, #C16654)', borderRadius: 16, padding: '20px 24px', color: '#fff' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px', letterSpacing: '0.08em' }}>현재 잔여 포인트</p>
        <p style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{(points ?? 0).toLocaleString()} <span style={{ fontSize: 16, fontWeight: 400 }}>P</span></p>
      </div>

      {/* 서비스 요금표 */}
      <div style={{ margin: '20px 20px 8px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#7A4F3E', margin: '0 0 10px' }}>서비스 이용 요금</p>
        <div style={{ background: '#FDF4EB', borderRadius: 14, overflow: 'hidden', border: '1px solid #EDE0D0' }}>
          {SERVICES.map((s, i) => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < SERVICES.length - 1 ? '1px solid #EDE0D0' : 'none' }}>
              <span style={{ fontSize: 13, color: '#5E3D31' }}>{s.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#C16654' }}>{s.cost}P</span>
            </div>
          ))}
        </div>
      </div>

      {/* 충전 패키지 */}
      <div style={{ margin: '20px 20px 0' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#7A4F3E', margin: '0 0 10px' }}>충전 패키지 선택</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PACKAGES.map(pkg => (
            <button
              key={pkg.id}
              onClick={() => setSelected(pkg.id)}
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                border: selected === pkg.id ? '2px solid #C16654' : '1.5px solid #EDE0D0',
                background: selected === pkg.id ? '#FDF4EB' : '#fff',
                position: 'relative', transition: 'all 0.2s',
              }}
            >
              {pkg.popular && (
                <span style={{ position: 'absolute', top: -10, right: 16, background: '#C16654', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20, letterSpacing: '0.05em' }}>
                  인기
                </span>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 11, color: '#9E7B6A', margin: '0 0 2px' }}>{pkg.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#5E3D31', margin: 0 }}>{pkg.points.toLocaleString()}P</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: selected === pkg.id ? '#C16654' : '#5E3D31', margin: 0 }}>{pkg.price}</p>
                  {selected === pkg.id && <Check size={16} color="#C16654" style={{ marginTop: 4 }} />}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 결제 버튼 */}
      <div style={{ padding: '24px 20px 32px' }}>
        <button
          onClick={handlePurchase}
          disabled={!selected || purchasing}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none', fontSize: 15, fontWeight: 700, cursor: selected ? 'pointer' : 'not-allowed',
            background: selected ? 'linear-gradient(135deg, #C16654, #E8A070)' : '#EDE0D0',
            color: selected ? '#fff' : '#9E7B6A', transition: 'all 0.2s',
          }}
        >
          {purchasing ? '처리 중...' : selected ? `${PACKAGES.find(p => p.id === selected)?.price} 결제하기` : '패키지를 선택해주세요'}
        </button>
        <p style={{ fontSize: 11, color: '#9E7B6A', textAlign: 'center', marginTop: 10 }}>
          결제는 Google Play / App Store를 통해 안전하게 처리됩니다.
        </p>
      </div>
    </div>
  );
}
