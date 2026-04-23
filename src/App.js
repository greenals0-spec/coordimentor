import React, { useState } from 'react';
import { Shirt, PlusCircle, Sparkles } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/Login';
import UploadPage from './pages/Upload';
import ClosetPage from './pages/Closet';
import OutfitPage from './pages/Outfit';
import './App.css';

const TABS = [
  { id: 'closet', label: '옷장', Icon: Shirt },
  { id: 'upload', label: '추가', Icon: PlusCircle },
  { id: 'outfit', label: '코디', Icon: Sparkles },
];

function Main() {
  const { user } = useAuth();
  const [tab, setTab] = useState('closet');

  // user === undefined: 로딩 중
  if (user === undefined) {
    return (
      <div className="app-shell">
        <div className="splash">
          <div className="splash-logo">👗</div>
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

  return (
    <div className="app-shell">
      <main className="app-content">
        {tab === 'closet' && <ClosetPage />}
        {tab === 'upload' && <UploadPage onSaved={() => setTab('closet')} />}
        {tab === 'outfit' && <OutfitPage />}
      </main>
      <nav className="bottom-nav">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`nav-item ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}>
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
}
