import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState('select'); // select | email
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error('Google 로그인 오류:', e);
      setError(errorMessage(e.code) + (e.message ? ` (${e.message})` : ''));
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@')) { setError('이메일 형식이 올바르지 않아요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 해요.'); return; }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name || email.split('@')[0]);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (e) {
      setError(errorMessage(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('비밀번호를 재설정할 이메일 주소를 먼저 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      alert('비밀번호 재설정 링크가 이메일로 발송되었습니다. 메일함을 확인해주세요.');
      setError('');
    } catch (e) {
      setError(errorMessage(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* ── 상단 비주얼 영역 ── */}
      <div className="login-visual">
        <img src="/assets/login_bg.jpg" alt="Fashion Visual" className="login-visual-img" />
        <div className="login-visual-overlay" />
        <div className="login-brand-group">
          <h1 className="login-brand-title">Coordimentor</h1>
          <p className="login-brand-sub">YOUR AI FASHION CURATOR</p>
        </div>
      </div>

      {/* ── 로그인 폼 영역 ── */}
      <div className="login-container">
        <div className="login-card">
          {mode === 'select' && (
            <div className="login-options">
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <p style={{ fontSize: '15px', fontWeight: 300, color: '#666', margin: 0, letterSpacing: '-0.02em' }}>나만의 스타일을 관리해보세요.</p>
              </div>

              <button className="google-btn" onClick={handleGoogle} disabled={loading}>
                {loading ? <span>로그인 중...</span> : <><GoogleIcon /><span>Google로 계속하기</span></>}
              </button>

              <div className="divider"><span>또는</span></div>

              <button className="email-btn" onClick={() => { setMode('email'); setIsSignUp(false); }}>
                ✉️ 이메일로 계속하기
              </button>
              
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>아직 계정이 없으신가요? </span>
                <button 
                  type="button"
                  onClick={() => { setMode('email'); setIsSignUp(true); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '13px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                >
                  이메일로 회원가입하기
                </button>
              </div>
            </div>
          )}

          {mode === 'email' && (
            <form className="email-form" onSubmit={handleEmail} noValidate>
              <h3 style={{ margin: '0 0 20px', textAlign: 'center', fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
                {isSignUp ? '이메일로 회원가입' : '이메일로 로그인'}
              </h3>

              <div className="input-group">
                {isSignUp && (
                  <input className="form-input" type="text" placeholder="이름" value={name}
                    onChange={e => setName(e.target.value)} />
                )}
                <input className="form-input" type="email" placeholder="이메일 주소" value={email}
                  onChange={e => setEmail(e.target.value)} />
                <input className="form-input" type="password" placeholder="비밀번호" value={password}
                  onChange={e => setPassword(e.target.value)} />
              </div>

              {!isSignUp && (
                <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                  <button 
                    type="button" 
                    onClick={handlePasswordReset} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </div>
              )}

              <button className="btn primary full-width login-submit-btn" type="submit" disabled={loading} style={{ marginTop: isSignUp ? '20px' : '0' }}>
                {loading ? '처리 중...' : isSignUp ? '계정 만들기' : '로그인'}
              </button>
              
              <button type="button" className="back-btn" onClick={() => { setMode('select'); setError(''); }}>
                ← 다른 방법으로 로그인
              </button>
            </form>
          )}

          {error && <p className="login-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function errorMessage(code) {
  const map = {
    'auth/invalid-credential': '이메일 또는 비밀번호가 틀렸어요.',
    'auth/email-already-in-use': '이미 사용 중인 이메일이에요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
    'auth/invalid-email': '이메일 형식이 올바르지 않아요.',
    'auth/user-not-found': '가입되지 않은 이메일이에요.',
    'auth/wrong-password': '비밀번호가 틀렸어요.',
    'auth/too-many-requests': '잠시 후 다시 시도해주세요.',
  };
  return map[code] || '오류가 발생했어요. 다시 시도해주세요.';
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
