import React, { useState, useEffect } from 'react';
import { Home, Shirt, PlusCircle, Sparkles, CalendarDays, Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/Login';
import HomePage from './pages/Home';
import UploadPage from './pages/Upload';
import ClosetPage from './pages/Closet';
import OutfitPage from './pages/Outfit';
import SavedOutfitsPage from './pages/SavedOutfits';
import OnboardingPage from './pages/Onboarding';
import StorePage from './pages/StorePage';
import SplashScreen from './components/SplashScreen';
import PermissionsScreen from './components/PermissionsScreen';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { initPushNotifications } from './utils/pushNotifications';
import { scheduleRoutineAlarms } from './utils/notifications';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import './App.css';
import SettingsModal from './components/SettingsModal';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, color: '#c00', background: '#fff', minHeight: '100vh', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <strong>Error:</strong>{'\n'}{this.state.error?.message}{'\n\n'}{this.state.error?.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

const TABS = [
  { id: 'home',   label: '홈',    Icon: Home },
  { id: 'closet', label: '옷장',  Icon: Shirt },
  { id: 'upload', label: '추가',  Icon: PlusCircle },
  { id: 'outfit', label: '코디',  Icon: Sparkles },
  { id: 'saved',  label: '기록',  Icon: CalendarDays },
];

const KeepAliveTab = ({ active, children }) => {
  const [hasRendered, setHasRendered] = React.useState(active);
  React.useEffect(() => {
    if (active && !hasRendered) setHasRendered(true);
  }, [active, hasRendered]);

  if (!hasRendered) return null;

  return (
    <div style={{ display: active ? 'block' : 'none' }}>
      {children}
    </div>
  );
};

function Main() {
  const { user, userProfile } = useAuth();
  // 앱 시작 시 공유받은 데이터가 있다면 바로 업로드 탭으로 시작
  const [tab, setTab] = useState(() => {
    // 1. 네이티브 인터페이스 직접 확인 (가장 빠르고 정확함)
    if (window.AndroidShare) {
      const path = window.AndroidShare.getSharedImagePath();
      if (path) {
        window._sharedImagePath = path;
        return 'upload';
      }
    }
    // 2. 기존 전역 변수 확인
    return (window._sharedImage || window._sharedImagePath) ? 'upload' : 'home';
  });
  const [hideNav, setHideNav] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [closetTryOnMode, setClosetTryOnMode] = useState(false);
  const [showStore, setShowStore] = useState(false);

  // 탭 이동 시 입어보기 모드 자동 해제
  const handleTabChange = (newTab) => {
    if (newTab !== 'closet') setClosetTryOnMode(false);
    setTab(newTab);
  };

  // 포인트 충전 페이지 등 특수 화면 이동
  const handleNavigate = (dest) => {
    if (dest === 'store') { setShowStore(true); return; }
    handleTabChange(dest);
  };

  // ── 푸시 알림 리스너: auth 완료 전 앱 마운트 즉시 등록 (콜드스타트 대응) ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listeners = [];
    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // 포그라운드 수신
        const l1 = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[App] pushNotificationReceived:', notification);
          const type = notification.data?.type;
          const situation = notification.data?.situation || null;
          if (type === 'morning_recommendation' || type === 'routine_alarm') {
            window.dispatchEvent(new CustomEvent('morningRecommendation', { detail: { situation } }));
          }
        });

        // 알림 탭 (백그라운드 or 종료 상태 → 앱 오픈)
        const l2 = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[App] pushNotificationActionPerformed:', action);
          const type = action.notification.data?.type;
          const situation = action.notification.data?.situation || null;
          if (type === 'morning_recommendation' || type === 'routine_alarm') {
            // localStorage에 저장 (Home.js가 아직 마운트 안됐을 수 있으므로)
            localStorage.setItem('pending_recommendation', JSON.stringify({
              situation,
              timestamp: Date.now(),
            }));
            // 이미 마운트된 경우엔 CustomEvent로도 전달
            window.dispatchEvent(new CustomEvent('morningRecommendation', { detail: { situation } }));
          }
        });

        listeners = [l1, l2];
      } catch (e) {
        console.error('[App] Early push listener error:', e);
      }
    })();

    return () => {
      listeners.forEach(l => l?.remove?.());
    };
  }, []); // 빈 deps: 앱 마운트 즉시 1회 실행

  // ── Splash screen: show for 3s on first load ──
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  // 권한 안내 화면 (최초 1회, 네이티브 앱에서만)
  const [showPermissions, setShowPermissions] = useState(() => {
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform() && !localStorage.getItem('permissions_requested');
  });

  // 인증 로딩 타임아웃 (15초 초과 시 로그인 화면으로 강제 이동)
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    // Start fade-out at 2.5s, fully dismiss at 3s
    const fadeTimer = setTimeout(() => setSplashFading(true), 2500);
    const hideTimer = setTimeout(() => setShowSplash(false), 3000);

    // 안드로이드 상태바 설정
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: '#ffffff' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    }

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // 안드로이드 하드웨어 뒤로가기 버튼 처리
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (tab !== 'home') {
        // 홈 탭이 아니면 홈으로 이동
        setTab('home');
      } else {
        // 홈 탭에서 뒤로가기 시 앱 종료 (또는 안내문구)
        CapApp.exitApp();
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [tab]);

  useEffect(() => {
    if (user !== undefined) {
      setAuthTimedOut(false);
      return;
    }
    const t = setTimeout(() => setAuthTimedOut(true), 15000);
    return () => clearTimeout(t);
  }, [user]);

  // 로그인 완료 후 FCM 푸시 알림 초기화
  useEffect(() => {
    if (!user) return;
    initPushNotifications(user.uid);
  }, [user]);

  // 로그인 완료 후 Firestore 루틴 알람으로 로컬 알림 동기화
  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const alarms = snap.data()?.routineAlarms ?? [];
      scheduleRoutineAlarms(alarms);
    }).catch(console.error);
  }, [user]);

  // auth 완료 직후 공유 이미지 최종 점검 (스플래시/로딩 중에 타이밍이 엇갈린 경우 복구)
  useEffect(() => {
    if (!user || !userProfile) return;
    // window 전역 또는 네이티브 브릿지 확인
    const path = window._sharedImage || window._sharedImagePath ||
      (window.AndroidShare ? window.AndroidShare.getSharedImagePath() : null);
    if (path) {
      if (window.AndroidShare && !window._sharedImagePath) window._sharedImagePath = path;
      setTab('upload');
    }
  }, [user, userProfile]);

  // 공유 이미지 수신 시 업로드 탭으로 자동 이동 (폴링 방식 추가)
  useEffect(() => {
    const checkSharedData = () => {
      if (window._sharedImage || window._sharedImagePath) {
        setTab('upload');
        return true;
      }
      return false;
    };

    // 1. 즉시 체크
    checkSharedData();

    // 2. 5초 동안 0.5초마다 끈질기게 체크 (앱 로딩 타이밍 대응)
    let count = 0;
    const interval = setInterval(() => {
      if (checkSharedData() || count > 10) {
        clearInterval(interval);
      }
      count++;
    }, 500);

    // 3. 실시간 이벤트 리스너 (이미 앱이 켜져 있을 때 대응)
    const handleSharedImage = () => {
      setTab('upload');
    };
    window.addEventListener('sharedImage', handleSharedImage);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('sharedImage', handleSharedImage);
    };
  }, []);

  // 전역 설정창 열기 이벤트 리스너
  useEffect(() => {
    const handleOpenSettings = () => setShowSettings(true);
    window.addEventListener('openSettings', handleOpenSettings);
    return () => window.removeEventListener('openSettings', handleOpenSettings);
  }, []);

  // 포인트 충전 화면 열기 이벤트 리스너 (SettingsModal 내 루틴 추가 폼용)
  useEffect(() => {
    const handleOpenStore = () => setShowStore(true);
    window.addEventListener('openStore', handleOpenStore);
    return () => window.removeEventListener('openStore', handleOpenStore);
  }, []);

  if (showSplash) {
    return <SplashScreen fadingOut={splashFading} />;
  }

  if (showPermissions) {
    return <PermissionsScreen onDone={() => setShowPermissions(false)} />;
  }

  // Loading state while auth resolves
  if (!authTimedOut && (user === undefined || (user && userProfile === undefined))) {
    return (
      <div className="app-shell">
        <div className="splash">
          <div className="splash-img-container" style={{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', marginBottom: 20 }}>
            <img src="/assets/splash_image.webp" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <p className="splash-text">Coordimentor</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell">
        <LoginPage />
      </div>
    );
  }

  if (!userProfile?.gender) {
    return (
      <div className="app-shell">
        <OnboardingPage />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* ── 전역 헤더 ── */}
      <header className="global-header" style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 800,
        padding: 'calc(var(--safe-top) + 16px) 20px 12px',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
        pointerEvents: 'none' // 배경 클릭 방지 안함 (아이콘만 클릭되게)
      }}>
        {/* 입어보기 버튼 — 내 옷장 탭에서만 표시 */}
        {tab === 'closet' && (
          !closetTryOnMode ? (
            <button
              onClick={() => setClosetTryOnMode(true)}
              style={{
                pointerEvents: 'auto',
                display: 'flex', alignItems: 'center', gap: 5,
                height: 40, padding: '0 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, #C16654, #D4845E)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: "'Pretendard', sans-serif",
                boxShadow: '0 3px 10px rgba(193,102,84,0.30)',
              }}
            >
              <Shirt size={14} />
              입어보기
            </button>
          ) : (
            <button
              onClick={() => setClosetTryOnMode(false)}
              style={{
                pointerEvents: 'auto',
                display: 'flex', alignItems: 'center', gap: 5,
                height: 40, padding: '0 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)',
                color: 'var(--text-muted)', border: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: "'Pretendard', sans-serif",
                boxShadow: '0 2px 8px rgba(94,61,49,0.08)',
              }}
            >
              <X size={14} />
              취소
            </button>
          )
        )}
        {/* 메뉴 버튼 */}
        <button
          onClick={() => setShowSettings(true)}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
            border: 'none', width: 40, height: 40, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            color: '#18160F'
          }}
        >
          <Menu size={22} />
        </button>
      </header>

      {/* 포인트 충전 페이지 (오버레이) */}
      {showStore && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#fff', overflowY: 'auto' }}>
          <StorePage onBack={() => setShowStore(false)} />
        </div>
      )}

      <main className="app-content">
        <KeepAliveTab active={tab === 'home'}>
          <HomePage onNavigate={handleNavigate} />
        </KeepAliveTab>
        <KeepAliveTab active={tab === 'closet'}>
          <ClosetPage tryOnMode={closetTryOnMode} setTryOnMode={setClosetTryOnMode} onNavigate={handleNavigate} />
        </KeepAliveTab>
        <KeepAliveTab active={tab === 'upload'}>
          <UploadPage
            onSaved={() => { setHideNav(false); handleTabChange('closet'); }}
            onCameraOpen={() => setHideNav(true)}
            onCameraClose={() => setHideNav(false)}
            onNavigate={handleNavigate}
          />
        </KeepAliveTab>
        <KeepAliveTab active={tab === 'outfit'}>
          <OutfitPage onNavigate={handleNavigate} />
        </KeepAliveTab>
        <KeepAliveTab active={tab === 'saved'}>
          <SavedOutfitsPage
            onSheetOpen={() => setHideNav(true)}
            onSheetClose={() => setHideNav(false)}
          />
        </KeepAliveTab>
      </main>
      <nav className="bottom-nav" style={{ display: hideNav ? 'none' : 'flex' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${tab === id ? 'active' : ''}`}
            onClick={() => handleTabChange(id)}
          >
            <div className="nav-icon-wrapper">
              <Icon size={20} />
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* ── 통합 설정 모달 ── */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Main />
      </AuthProvider>
    </ErrorBoundary>
  );
}
