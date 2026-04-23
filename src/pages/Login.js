import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
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
      setError(errorMessage(e.code));
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

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">👗</div>
        <h1 className="login-title">My Closet</h1>
        <p className="login-sub">나만의 스마트 옷장</p>

        {mode === 'select' && (
          <div className="login-options">
            <button className="google-btn" onClick={handleGoogle} disabled={loading}>
              {loading ? <span>로그인 중...</span> : <><GoogleIcon /><span>Google로 시작하기</span></>}
            </button>
            <div className="divider"><span>또는</span></div>
            <button className="email-btn" onClick={() => setMode('email')}>
              ✉️ 이메일로 시작하기
            </button>
          </div>
        )}

        {mode === 'email' && (
          <form className="email-form" onSubmit={handleEmail} noValidate>
            <div className="form-tabs">
              <button type="button" className={`form-tab ${!isSignUp ? 'active' : ''}`}
                onClick={() => { setIsSignUp(false); setError(''); }}>로그인</button>
              <button type="button" className={`form-tab ${isSignUp ? 'active' : ''}`}
                onClick={() => { setIsSignUp(true); setError(''); }}>회원가입</button>
            </div>

            {isSignUp && (
              <input className="form-input" type="text" placeholder="이름" value={name}
                onChange={e => setName(e.target.value)} />
            )}
            <input className="form-input" type="email" placeholder="이메일" value={email}
              onChange={e => setEmail(e.target.value)} />
            <input className="form-input" type="password" placeholder="비밀번호 (6자 이상)" value={password}
              onChange={e => setPassword(e.target.value)} />

            <button className="btn primary full-width" type="submit" disabled={loading}>
              {loading ? '처리 중...' : isSignUp ? '가입하기' : '로그인'}
            </button>
            <button type="button" className="back-btn" onClick={() => { setMode('select'); setError(''); }}>
              ← 뒤로
            </button>
          </form>
        )}

        {error && <p className="login-error">{error}</p>}
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
