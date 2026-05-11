import React, { useState, useEffect } from 'react';
import { Trash2, X, Shirt, CheckCircle, Loader, Plus } from 'lucide-react';
import { subscribeToItems, deleteItem, updateItem, isImageCached, markImageCached } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { runFullOutfitTryOn } from '../utils/tryon';

const CATEGORIES = ['아우터', '상의', '하의', '신발', '액세서리', '전체'];
const EDIT_CATEGORIES = ['아우터', '상의', '하의', '신발', '액세서리'];
const TRYON_SLOTS = ['상의', '하의', '아우터']; // 가상 입어보기 가능한 카테고리

export default function ClosetPage() {
  const { user, userProfile } = useAuth();
  const [active, setActive] = useState('아우터');
  const [items, setItems] = useState([]);
  const [confirmId, setConfirmId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // ── 직접 골라 입어보기 상태 ──
  const [tryOnMode, setTryOnMode] = useState(false);
  const [selected, setSelected] = useState({ 상의: null, 하의: null, 아우터: null });
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnProgress, setTryOnProgress] = useState({ step: 0, total: 0, label: '' });
  const [tryOnResult, setTryOnResult] = useState(null);

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

  // ── 선택 모드 카드 클릭 ──
  const handleSelectItem = (item) => {
    const cat = item.category;
    if (!TRYON_SLOTS.includes(cat)) return; // 신발/액세서리는 무시
    setSelected(prev => {
      // 이미 선택된 아이템 다시 누르면 해제
      if (prev[cat]?.id === item.id) return { ...prev, [cat]: null };
      return { ...prev, [cat]: item };
    });
  };

  const exitTryOnMode = () => {
    setTryOnMode(false);
    setSelected({ 상의: null, 하의: null, 아우터: null });
    setTryOnResult(null);
    setTryOnProgress({ step: 0, total: 0, label: '' });
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  // ── 가상 입어보기 실행 ──
  const handleTryOn = async () => {
    if (!userProfile?.modelPhoto) {
      alert('설정에서 "나의 모델(전신사진)"을 먼저 등록해주세요!');
      return;
    }
    if (selectedCount === 0) return;

    setTryOnLoading(true);
    setTryOnProgress({ step: 0, total: 0, label: '' });
    setTryOnResult(null);
    try {
      const recommendation = {
        top:    selected['상의']   || null,
        bottom: selected['하의']   || null,
        outer:  selected['아우터'] || null,
      };
      const result = await runFullOutfitTryOn(
        userProfile.modelPhoto,
        recommendation,
        (step, total, label) => setTryOnProgress({ step, total, label })
      );
      setTryOnResult(result);
    } catch (err) {
      console.error('TryOn error:', err);
      alert(`가상 입어보기 오류: ${err.message}`);
    } finally {
      setTryOnLoading(false);
      setTryOnProgress({ step: 0, total: 0, label: '' });
    }
  };

  const tryOnSteps = TRYON_SLOTS.filter(s => selected[s]);

  return (
    <div className="page closet-page">

      {/* ── 헤더 ── */}
      <div className="closet-header">
        <div className="header-info">
          <h2 className="page-title" style={{ marginBottom: 4 }}>내 옷장</h2>
          <p className="user-name">{userProfile?.name || user?.displayName || '사용자'}님의 컬렉션</p>
        </div>
        {/* 직접 입어보기 토글 */}
        {!tryOnMode ? (
          <button
            onClick={() => setTryOnMode(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #C16654, #D4845E)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: "'Pretendard', sans-serif",
              boxShadow: '0 4px 14px rgba(193,102,84,0.28)',
              flexShrink: 0,
            }}
          >
            <Shirt size={14} />
            입어보기
          </button>
        ) : (
          <button
            onClick={exitTryOnMode}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--border)', color: 'var(--text-muted)',
              border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: "'Pretendard', sans-serif",
              flexShrink: 0,
            }}
          >
            <X size={14} />
            선택 취소
          </button>
        )}
      </div>

      {/* ── 선택 모드 안내 배너 ── */}
      {tryOnMode && (
        <div style={{
          background: 'var(--accent-light)',
          border: '1.5px solid var(--accent)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          marginBottom: 14,
          fontSize: 12,
          color: 'var(--accent)',
          fontWeight: 500,
          fontFamily: "'Pretendard', sans-serif",
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Shirt size={14} />
          상의 · 하의 · 아우터를 각각 하나씩 골라보세요. 신발/액세서리는 선택 불가해요.
        </div>
      )}

      {/* ── 카테고리 탭 ── */}
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
        <div className="clothes-grid" style={{ paddingBottom: tryOnMode ? 180 : 0 }}>
          {filtered.map(item => {
            const cached = isImageCached(item.imageUrl);
            const canSelect = tryOnMode && TRYON_SLOTS.includes(item.category);
            const isSelected = tryOnMode && selected[item.category]?.id === item.id;

            return (
              <div
                key={item.id}
                className="cloth-card"
                onClick={() => tryOnMode ? handleSelectItem(item) : handleEditClick(item)}
                style={{
                  outline: isSelected ? '2.5px solid var(--accent)' : 'none',
                  opacity: tryOnMode && !canSelect ? 0.45 : 1,
                  transition: 'outline 0.15s, opacity 0.15s',
                  cursor: tryOnMode ? (canSelect ? 'pointer' : 'not-allowed') : 'pointer',
                }}
              >
                <div className="cloth-img-wrapper" style={{ background: '#F8F6F3' }}>
                  {!cached && <div className="img-loading-spinner"></div>}
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="eager"
                    decoding="async"
                    onLoad={(e) => {
                      markImageCached(item.imageUrl);
                      e.target.style.opacity = '1';
                      const spinner = e.target.previousSibling;
                      if (spinner?.classList?.contains('img-loading-spinner')) {
                        spinner.style.display = 'none';
                      }
                    }}
                    onError={(e) => {
                      const count = parseInt(e.target.dataset.retry || '0');
                      if (count < 3) {
                        e.target.dataset.retry = (count + 1).toString();
                        setTimeout(() => {
                          const src = e.target.src;
                          e.target.src = '';
                          e.target.src = src;
                        }, 1500);
                      } else {
                        e.target.style.display = 'none';
                        e.target.parentElement.querySelector('.img-error-placeholder').style.display = 'flex';
                      }
                    }}
                    style={{ opacity: cached ? 1 : 0, transition: cached ? 'none' : 'opacity 0.2s' }}
                  />
                  <div className="img-error-placeholder" style={{ display: 'none' }}>
                    <span>재연결 중...</span>
                  </div>

                  {/* 선택 오버레이 */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(193,102,84,0.18)',
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                      padding: 8,
                    }}>
                      <div style={{
                        background: 'var(--accent)', borderRadius: '50%',
                        width: 24, height: 24,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CheckCircle size={14} color="#fff" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="cloth-info">
                  <span className="cloth-name">{item.name}</span>
                  <span className="cloth-color">{item.color}</span>
                </div>

                {/* 삭제 버튼 — 선택 모드에서 숨김 */}
                {!tryOnMode && (
                  <button className="delete-btn" onClick={(e) => { e.stopPropagation(); setConfirmId(item.id); }}>
                    <Trash2 size={14} />
                  </button>
                )}

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
            );
          })}
        </div>
      )}

      {/* ── 선택 모드 하단 패널 ── */}
      {tryOnMode && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          background: 'var(--bg)',
          borderTop: '1px solid var(--border)',
          padding: '14px 20px calc(14px + env(safe-area-inset-bottom))',
          zIndex: 500,
          boxShadow: '0 -8px 24px rgba(94,61,49,0.10)',
        }}>
          {/* 선택된 슬롯 3개 */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {TRYON_SLOTS.map(slot => {
              const item = selected[slot];
              return (
                <div key={slot} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div
                    onClick={() => item && setSelected(prev => ({ ...prev, [slot]: null }))}
                    style={{
                      width: '100%', aspectRatio: '1',
                      borderRadius: 'var(--radius-sm)',
                      border: item ? '2px solid var(--accent)' : '1.5px dashed var(--border-strong)',
                      background: item ? 'var(--accent-light)' : 'var(--surface-2)',
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: item ? 'pointer' : 'default',
                      position: 'relative',
                    }}
                  >
                    {item ? (
                      <>
                        <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        <div style={{ position: 'absolute', top: 3, right: 3, background: 'var(--accent)', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={9} color="#fff" />
                        </div>
                      </>
                    ) : (
                      <Plus size={18} color="var(--border-strong)" />
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: item ? 'var(--accent)' : 'var(--text-faint)', fontWeight: item ? 600 : 400, fontFamily: "'Pretendard', sans-serif" }}>
                    {slot}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 입어보기 버튼 */}
          <button
            onClick={handleTryOn}
            disabled={selectedCount === 0 || tryOnLoading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: selectedCount === 0 || tryOnLoading
                ? 'var(--border)'
                : 'linear-gradient(135deg, #C16654 0%, #D4845E 60%, #E8A070 100%)',
              color: selectedCount === 0 || tryOnLoading ? 'var(--text-muted)' : '#fff',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Pretendard', sans-serif",
              cursor: selectedCount === 0 || tryOnLoading ? 'not-allowed' : 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 5,
              boxShadow: selectedCount > 0 && !tryOnLoading ? '0 6px 20px rgba(193,102,84,0.30)' : 'none',
              transition: 'all 0.25s',
            }}
          >
            {tryOnLoading ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader size={16} className="spin" />
                  <span>{tryOnProgress.label ? `${tryOnProgress.label} 합성 중...` : '준비 중...'}</span>
                </div>
                {tryOnProgress.total > 0 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {tryOnSteps.map((label, i) => {
                      const done = i < tryOnProgress.step;
                      const active2 = i === tryOnProgress.step - 1;
                      return (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%',
                            background: done ? '#5E3D31' : active2 ? '#C16654' : 'rgba(94,61,49,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {done
                              ? <CheckCircle size={10} color="#fff" />
                              : <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>{i + 1}</span>}
                          </div>
                          <span style={{ fontSize: 9, color: done ? '#5E3D31' : 'var(--text-muted)' }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shirt size={16} />
                <span>
                  {selectedCount > 0
                    ? `선택한 ${selectedCount}개 아이템 입어보기`
                    : '상의/하의/아우터를 먼저 선택하세요'}
                </span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* ── 가상 입어보기 결과 모달 ── */}
      {tryOnResult && (
        <div
          onClick={() => setTryOnResult(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(45,28,20,0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px 20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, animation: 'fadeUp 0.4s ease' }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>직접 고른 코디</p>
                <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: "'Pretendard', sans-serif" }}>
                  {tryOnSteps.join(' + ')} 가상 착장
                </p>
              </div>
              <button
                onClick={() => setTryOnResult(null)}
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} color="#fff" />
              </button>
            </div>

            <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
              <img src={tryOnResult} alt="가상 착장 결과" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>✨ AI가 생성한 가상 착장 이미지입니다</p>

            <div style={{ width: '100%', display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setTryOnResult(null); setSelected({ 상의: null, 하의: null, 아우터: null }); }}
                style={{ flex: 1, background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', padding: '13px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Pretendard', sans-serif" }}
              >
                다시 선택
              </button>
              <button
                onClick={() => setTryOnResult(null)}
                style={{ flex: 1, background: '#5E3D31', color: '#fff', border: 'none', padding: '13px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Pretendard', sans-serif" }}
              >
                확인했어요
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 아이템 편집 모달 ── */}
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
