import React, { useState, useEffect } from 'react';
import { Trash2, LogOut, X } from 'lucide-react';
import { subscribeToItems, deleteItem, updateItem } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';

const CATEGORIES = ['전체', '아우터', '상의', '하의', '신발', '액세서리'];
const EDIT_CATEGORIES = ['아우터', '상의', '하의', '신발', '액세서리'];

export default function ClosetPage() {
  const { user, userProfile, signOut } = useAuth();
  const [active, setActive] = useState('전체');
  const [items, setItems] = useState([]);
  const [confirmId, setConfirmId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToItems(user.uid, setItems);
  }, [user]);

  const filtered = active === '전체' ? items : items.filter(i => i.category === active);

  const handleDelete = async (item, e) => {
    e.stopPropagation();
    await deleteItem(user.uid, item.id, item.imagePath);
    setConfirmId(null);
  };

  const handleEditClick = (item) => {
    setEditingItem({ ...item, tagsString: item.tags ? item.tags.join(', ') : '' });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const { id, tagsString, ...rest } = editingItem;
    const newTags = tagsString ? tagsString.split(',').map(t => t.trim()).filter(t => t) : [];
    
    await updateItem(user.uid, id, {
      name: rest.name,
      brand: rest.brand || '',
      category: rest.category,
      color: rest.color || '',
      tags: newTags,
    });
    setEditingItem(null);
  };

  return (
    <div className="page closet-page">
      <div className="closet-header">
        <div className="header-info">
          <h2 className="page-title" style={{ marginBottom: 4 }}>내 옷장</h2>
          <p className="user-name">{userProfile?.name || user?.displayName || '사용자'}님의 컬렉션</p>
        </div>
        <button className="signout-btn" onClick={signOut} title="로그아웃">
          <LogOut size={20} />
        </button>
      </div>

      <div className="category-tabs">
        {CATEGORIES.map(cat => (
          <button 
            key={cat} 
            className={`tab ${active === cat ? 'active' : ''}`}
            onClick={() => setActive(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>옷이 없어요.<br />옷 추가 탭에서 추가해보세요!</p>
        </div>
      ) : (
        <div className="clothes-grid">
          {filtered.map(item => (
            <div key={item.id} className="cloth-card" onClick={() => handleEditClick(item)}>
              <div className="cloth-img-wrapper" style={{ background: '#F8F6F3' }}>
                <div className="img-loading-spinner"></div>
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  onLoad={(e) => {
                    e.target.style.opacity = '1';
                    e.target.previousSibling.style.display = 'none'; // 스피너 숨김
                  }}
                  onError={(e) => {
                    // 최대 3번 재시도 로직
                    const count = parseInt(e.target.dataset.retry || '0');
                    if (count < 3) {
                      e.target.dataset.retry = (count + 1).toString();
                      setTimeout(() => {
                        const originalSrc = e.target.src;
                        e.target.src = ''; 
                        e.target.src = originalSrc; // 다시 시도
                      }, 1500);
                    } else {
                      e.target.style.display = 'none';
                      e.target.parentElement.querySelector('.img-error-placeholder').style.display = 'flex';
                      e.target.previousSibling.style.display = 'none';
                    }
                  }}
                  style={{ opacity: 0, transition: 'opacity 0.5s' }}
                />
                <div className="img-error-placeholder" style={{ display: 'none' }}>
                  <span>재연결 중...</span>
                </div>
              </div>
              <div className="cloth-info">
                <span className="cloth-name">{item.name}</span>
                <span className="cloth-color">{item.color}</span>
              </div>
              <button className="delete-btn" onClick={(e) => { e.stopPropagation(); setConfirmId(item.id); }}>
                <Trash2 size={14} />
              </button>
              {confirmId === item.id && (
                <div className="confirm-overlay" onClick={(e) => e.stopPropagation()}>
                  <p>삭제할까요?</p>
                  <div className="confirm-actions">
                    <button onClick={(e) => { e.stopPropagation(); setConfirmId(null); }}>취소</button>
                    <button className="danger" onClick={(e) => handleDelete(item, e)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>정보 수정</h3>
              <button className="close-btn" onClick={() => setEditingItem(null)}><X size={24} /></button>
            </div>
            <div className="edit-modal-body">
              <div className="cloth-img-wrapper" style={{ borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                <img 
                  src={editingItem.imageUrl} 
                  alt="item" 
                  onLoad={(e) => { e.target.style.opacity = '1'; }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                  style={{ opacity: 0, transition: 'opacity 0.2s' }}
                />
                <div className="img-error-placeholder" style={{ display: 'none' }}>
                  <span>이미지 없음</span>
                </div>
              </div>
              <div className="analysis-result">
                <div className="analysis-row">
                  <span className="label">브랜드</span>
                  <input className="analysis-input" value={editingItem.brand || ''} placeholder="브랜드명"
                    onChange={(e) => setEditingItem({ ...editingItem, brand: e.target.value })} />
                </div>
                <div className="analysis-row">
                  <span className="label">상품명</span>
                  <input className="analysis-input" value={editingItem.name || ''} placeholder="상품명 또는 품번"
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} />
                </div>
                <div className="analysis-row">
                  <span className="label">카테고리</span>
                  <div className="category-pills">
                    {EDIT_CATEGORIES.map((cat) => (
                      <button key={cat} className={`pill ${editingItem.category === cat ? 'active' : ''}`}
                        onClick={() => setEditingItem({ ...editingItem, category: cat })}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div className="analysis-row">
                  <span className="label">색상</span>
                  <input className="analysis-input" value={editingItem.color || ''} placeholder="색상"
                    onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })} />
                </div>
                <div className="analysis-row">
                  <span className="label">태그</span>
                  <input className="analysis-input" value={editingItem.tagsString || ''} placeholder="쉼표로 구분"
                    onChange={(e) => setEditingItem({ ...editingItem, tagsString: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="edit-modal-footer">
              <button className="btn secondary" onClick={() => setEditingItem(null)}>취소</button>
              <button className="btn primary" onClick={handleSaveEdit}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
