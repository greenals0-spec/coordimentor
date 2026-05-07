import React, { useState, useEffect } from 'react';
import { Home, Shirt, PlusCircle, Sparkles, CalendarDays } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/Login';
import HomePage from './pages/Home';
import UploadPage from './pages/Upload';
import ClosetPage from './pages/Closet';
import OutfitPage from './pages/Outfit';
import SavedOutfitsPage from './pages/SavedOutfits';
import OnboardingPage from './pages/Onboarding';
import SplashScreen from './components/SplashScreen';
import PermissionsScreen from './components/PermissionsScreen';
import './App.css';

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
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (user !== undefined) {
      setAuthTimedOut(false);
      return;
    }
    const t = setTimeout(() => setAuthTimedOut(true), 15000);
    return () => clearTimeout(t);
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
      <main className="app-content">
        <KeepAliveTab active={tab === 'home'}>
          <HomePage onNavigate={setTab} />
        </KeepAliveTab>
        <KeepAliveTab active={tab === 'closet'}>
          <ClosetPage />
        </KeepAliveTab>
        <KeepAliveTab active={tab === 'upload'}>
          <UploadPage
            onSaved={() => { setHideNav(false); setTab('closet'); }}
            onCameraOpen={() => setHideNav(true)}
            onCameraClose={() => setHideNav(false)}
          />
        </KeepAliveTab>
        <KeepAliveTab active={tab === 'outfit'}>
          <OutfitPage />
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
            onClick={() => setTab(id)}
          >
            <div className="nav-icon-wrapper">
              <Icon size={20} />
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>
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
