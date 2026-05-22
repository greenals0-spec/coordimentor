import React, { useState, useEffect } from 'react';
import { X, Check, Zap, Bell, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';

// TODO: RevenueCat 설치 후 아래 주석 해제
// import { Purchases, PRODUCT_CATEGORY } from '@revenuecat/purchases-capacitor';

// ── 상품 ID (Google Play Console에서 등록한 ID로 교체) ──
const PRODUCT_ID = 'coordimentor_premium_monthly'; // TODO: 실제 상품 ID로 교체

const BENEFITS = [
  {
    icon: <Zap size={20} color="#C16654" />,
    title: '광고 없는 경험',
    desc: '모든 기능을 광고 없이 자유롭게 사용해요',
  },
  {
    icon: <Bell size={20} color="#C16654" />,
    title: '루틴 코디 알람',
    desc: '매일 아침 날씨에 맞는 코디 알림을 받아요',
  },
  {
    icon: <Star size={20} color="#C16654" />,
    title: '프리미엄 배지',
    desc: '✦ Premium 배지로 특별한 멤버십을 표시해요',
  },
];

export default function PremiumPage({ onClose }) {
  const { user, isPremium } = useAuth();
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState('₩4,900 / 월');

  useEffect(() => {
    // TODO: RevenueCat 설치 후 아래 주석 해제하여 실제 가격 표시
    // loadProductPrice();
  }, []);

  // const loadProductPrice = async () => {
  //   if (!Capacitor.isNativePlatform()) return;
  //   try {
  //     await Purchases.configure({ apiKey: 'YOUR_REVENUECAT_API_KEY' });
  //     const { products } = await Purchases.getProducts({ productIdentifiers: [PRODUCT_ID] });
  //     if (products.length > 0) setPrice(products[0].priceString + ' / 월');
  //   } catch (e) {
  //     console.warn('[RevenueCat] 가격 로드 실패:', e.message);
  //   }
  // };

  const handlePurchase = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert('앱에서만 결제할 수 있어요.');
      return;
    }
    setLoading(true);
    try {
      // TODO: RevenueCat 설치 후 아래 주석 해제
      // await Purchases.configure({ apiKey: 'YOUR_REVENUECAT_API_KEY' });
      // const { customerInfo } = await Purchases.purchaseStoreProduct({ product: { productIdentifier: PRODUCT_ID } });
      // if (customerInfo.entitlements.active['premium']) {
      //   // Firestore isPremium 업데이트는 RevenueCat Webhook 또는 여기서 직접
      //   alert('✨ 프리미엄 구독이 완료됐어요!');
      //   onClose();
      // }
      alert('RevenueCat 설정 후 결제가 가능해요.\nGoogle Play Console에서 상품을 먼저 등록해 주세요!');
    } catch (e) {
      if (e.message?.includes('userCancelled')) {
        // 사용자가 취소한 경우 - 아무것도 안 함
      } else {
        alert('결제 중 오류가 발생했어요. 다시 시도해 주세요.');
        console.error('[Purchase] 오류:', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!Capacitor.isNativePlatform()) return;
    setLoading(true);
    try {
      // TODO: RevenueCat 설치 후 아래 주석 해제
      // const { customerInfo } = await Purchases.restorePurchases();
      // if (customerInfo.entitlements.active['premium']) {
      //   alert('✨ 구독이 복원됐어요!');
      //   onClose();
      // } else {
      //   alert('복원할 구독이 없어요.');
      // }
      alert('RevenueCat 설정 후 복원이 가능해요.');
    } catch (e) {
      alert('복원 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };

  if (isPremium) {
    return (
      <div style={styles.overlay}>
        <div style={styles.sheet}>
          <button onClick={onClose} style={styles.closeBtn}><X size={22} /></button>
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#18160F' }}>
              이미 프리미엄 멤버예요!
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: '#8C877F' }}>
              모든 프리미엄 혜택을 누리고 있어요 😊
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.sheet}>
        {/* 닫기 버튼 */}
        <button onClick={onClose} style={styles.closeBtn}><X size={22} /></button>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', padding: '36px 24px 24px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #5E3D31, #C16654)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>✦</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#18160F', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
            Premium
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: '#8C877F', lineHeight: 1.6 }}>
            광고 없이, 더 스마트하게
          </p>
        </div>

        {/* 혜택 목록 */}
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {BENEFITS.map((b, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 16px', borderRadius: 14,
              background: '#FAFAF8', border: '1px solid #F0EDE8',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FDF4EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {b.icon}
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: '#18160F' }}>{b.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#8C877F', lineHeight: 1.5 }}>{b.desc}</p>
              </div>
              <Check size={16} color="#C16654" style={{ flexShrink: 0, marginTop: 4 }} />
            </div>
          ))}
        </div>

        {/* 결제 버튼 */}
        <div style={{ padding: '0 24px 12px' }}>
          <button
            onClick={handlePurchase}
            disabled={loading}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: loading ? '#C8C0B8' : 'linear-gradient(135deg, #18160F, #4B4744)',
              color: '#fff', fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {loading ? '처리 중...' : `✦ 구독하기 · ${price}`}
          </button>
        </div>

        {/* 구독 복원 */}
        <div style={{ padding: '0 24px 8px', textAlign: 'center' }}>
          <button
            onClick={handleRestore}
            disabled={loading}
            style={{ background: 'none', border: 'none', fontSize: 13, color: '#B8AFA4', cursor: 'pointer', textDecoration: 'underline' }}
          >
            이미 구독했어요 (복원하기)
          </button>
        </div>

        {/* 안내 문구 */}
        <p style={{ margin: '8px 24px 24px', fontSize: 11, color: '#C8C0B8', textAlign: 'center', lineHeight: 1.6 }}>
          구독은 Google Play에서 관리되며 언제든지 해지할 수 있어요.
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    background: '#fff', borderRadius: '24px 24px 0 0',
    width: '100%', maxWidth: 480,
    position: 'relative', maxHeight: '90vh', overflowY: 'auto',
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    background: '#F0EDE8', border: 'none', borderRadius: '50%',
    width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 1,
  },
};
