import React, { useState, useEffect } from 'react';
import { Trash2, LogOut } from 'lucide-react';
import { subscribeToItems, deleteItem } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';

const CATEGORIES = ['전체', '아우터', '상의', '하의', '신발', '액세서리'];

export default function ClosetPage() {
  const { user, signOut } = useAuth();
  const [active, setActive] = useState('전체');
  const [items, setItems] = useState([]);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToItems(user.uid, setItems);
  }, [user]);

  const filtered = active === '전체' ? items : items.filter(i => i.category === active);

  const handleDelete = async (item) => {
    await deleteItem(user.uid, item.id, item.imagePath);
    setConfirmId(null);
  };

  return (
    <div className="page closet-page">
      <div className="closet-header">
        <div>
          <h2 className="page-title" style={{ marginBottom: 2 }}>내 옷장</h2>
          <p className="user-name">{user?.displayName}</p>
        </div>
        <button className="signout-btn" onClick={signOut}>
          <LogOut size={18} />
        </button>
      </div>

      <div className="category-tabs">
        {CATEGORIES.map(cat => (
          <button key={cat} className={`tab ${active === cat ? 'active' : ''}`}
            onClick={() => setActive(cat)}>{cat}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>옷이 없어요.<br />옷 추가 탭에서 추가해보세요!</p>
        </div>
      ) : (
        <div className="clothes-grid">
          {filtered.map(item => (
            <div key={item.id} className="cloth-card">
              <img src={item.imageUrl} alt={item.name} />
              <div className="cloth-info">
                <span className="cloth-name">{item.name}</span>
                <span className="cloth-color">{item.color}</span>
              </div>
              <button className="delete-btn" onClick={() => setConfirmId(item.id)}>
                <Trash2 size={14} />
              </button>
              {confirmId === item.id && (
                <div className="confirm-overlay">
                  <p>삭제할까요?</p>
                  <div className="confirm-actions">
                    <button onClick={() => setConfirmId(null)}>취소</button>
                    <button className="danger" onClick={() => handleDelete(item)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
