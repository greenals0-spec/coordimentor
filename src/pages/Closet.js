import React, { useState, useEffect, useRef } from 'react';
import { Trash2, X, Shirt, CheckCircle, Loader, Plus } from 'lucide-react';
import { subscribeToItems, deleteItem, updateItem, isImageCached, markImageCached } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { runFlatlayTryOn } from '../utils/tryon';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const CATEGORIES = ['아우터', '상의', '하의', '신발', '액세서리', '전체'];
const EDIT_CATEGORIES = ['아우터', '상의', '하의', '신발', '액세서리'];
const TRYON_SLOTS = ['상의', '하의', '아우터', '신발', '액세서리']; // 가상 입어보기 카테고리

export default function ClosetPage({ tryOnMode, setTryOnMode }) {
  const { user, userProfile } = useAuth();
  const [active, setActive] = useState('아우터');
  const [items, setItems] = useState([]);
  const [confirmId, setConfirmId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // ── 직접 골라 입어보기 상태 ──
  const [selected, setSelected] = useState({ 상의: null, 하의: null, 아우터: null, 신발: null, 액세서리: null });
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnProgress, setTryOnProgress] = useState({ step: 0, total: 0, label: '' });
  const [tryOnResult, setTryOnResult] = useState(null);
  const [progressPct, setProgressPct] = useState(0);   // 0~100 smooth progress bar
  const progressTimerRef = useRef(null);
  const progressTargetRef = useRef(0);

  // ── 부드러운 퍼센트 애니메이션 ──
  const animateToTarget = (target) => {
    progressTargetRef.current = target;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgressPct(prev => {
        const diff = progressTargetRef.current - prev;
        if (Math.abs(diff) < 0.5) {
          clearInterval(progressTimerRef.current);
          return progressTargetRef.current;
        }
        return prev + diff * 0.08; // easing
      });
    }, 30);
  };

  // tryOnProgress가 바뀌면 목표 % 계산
  useEffect(() => {
    if (!tryOnLoading) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      return;
    }
    const { step, total } = tryOnProgress;
    if (total === 0) {
      animateToTarget(5); // 준비 중
      return;
    }
    // step 1 → 0~45%, step 2 → 50~88%
    const base = ((step - 1) / total) * 90;
    animateToTarget(Math.max(5, base + 5));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tryOnProgress, tryOnLoading]);

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
    setSelected({ 상의: null, 하의: null, 아우터: null, 신발: null, 액세서리: null });
    setTryOnResult(null);
    setTryOnProgress({ step: 0, total: 0, label: '' });
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleFlatlayTryOn = async () => {
    if (!userProfile?.modelPhoto) {
      alert('설정에서 "나의 모델(전신사진)"을 먼저 등록해주세요!');
      return;
    }
    if (selectedCount === 0) return;

    setTryOnLoading(true);
    setProgressPct(0);
    setTryOnProgress({ step: 0, total: 0, label: '' });
    setTryOnResult(null);
    try {
      const recommendation = {
        top:       selected['상의']    || null,
        bottom:    selected['하의']    || null,
        outer:     selected['아우터']  || null,
        shoes:     selected['신발']    || null,
        accessory: selected['액세서리'] || null,
      };
      const result = await runFlatlayTryOn(
        userProfile.modelPhoto,
        recommendation,
        (step, total, label) => setTryOnProgress({ step, total, label })
      );
      // 완료: 100%까지 채운 뒤 결과 표시
      animateToTarget(100);
      await new Promise(r => setTimeout(r, 500));
      setTryOnResult(result);
    } catch (err) {
      console.error('TryOn error:', err);
      alert(`가상 입어보기 오류: ${err.message}`);
    } finally {
      setTryOnLoading(false);
      setTryOnProgress({ step: 0, total: 0, label: '' });
      setProgressPct(0);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const tryOnSteps = TRYON_SLOTS.filter(s => selected[s]);

  return (
    <div className="page closet-page">

      {/* ── 헤더 ── */}
      <div className="closet-header">
        <div className="header-info">
          <h2 className="page-title">내 옷장</h2>
          <p className="user-name">{userProfile?.name || user?.displayName || '사용자'}님의 컬렉션</p>
        </div>
      </div>


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
        <div className="clothes-grid" style={{ paddingBottom: tryOnMode ? 'calc(var(--nav-h) + 200px)' : 0 }}>
          {filtered.map(item => {
            const cached = isImageCached(item.imageUrl);
            const canSelect = tryOnMode; // 모든 카테고리 선택 가능
            const isSelected = tryOnMode && selected[item.category]?.id === item.id;

            return (
              <div
                key={item.id}
                className="cloth-card"
                onClick={() => tryOnMode ? handleSelectItem(item) : handleEditClick(item)}
                style={{
                  outline: isSelected ? '2.5px solid var(--accent)' : 'none',
                  opacity: 1,
                  transition: 'outline 0.15s',
                  cursor: 'pointer',
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
          position: 'fixed',
          bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom))',
          left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          background: 'var(--bg)',
          borderTop: '1px solid var(--border)',
          padding: '14px 20px 16px',
          zIndex: 1100,
          boxShadow: '0 -8px 24px rgba(94,61,49,0.12)',
        }}>
          {/* 선택된 슬롯 5개 */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
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

          {/* ── 입어보기 버튼 / 진행률 ── */}
          {tryOnLoading ? (
            /* 로딩 중: 프로그레스 바 (전체 너비) */
            <div style={{
              borderRadius: 'var(--radius)',
              background: 'rgba(193,102,84,0.08)',
              border: '1px solid rgba(193,102,84,0.22)',
              padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {/* 라벨 + % */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Loader size={14} className="spin" style={{ color: '#C16654', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#C16654', fontFamily: "'Pretendard', sans-serif" }}>
                    {tryOnProgress.label || '준비 중...'}
                  </span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#C16654', fontFamily: "'Pretendard', sans-serif", minWidth: 42, textAlign: 'right' }}>
                  {Math.round(progressPct)}%
                </span>
              </div>

              {/* 프로그레스 바 */}
              <div style={{ width: '100%', height: 10, borderRadius: 100, background: 'rgba(193,102,84,0.15)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  borderRadius: 100,
                  background: 'linear-gradient(90deg, #C16654 0%, #D4845E 60%, #E8A070 100%)',
                  boxShadow: '0 0 8px rgba(193,102,84,0.5)',
                  transition: 'width 0.08s linear',
                }} />
              </div>

              {/* 단계 */}
              {tryOnProgress.total > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Pretendard', sans-serif", textAlign: 'center' }}>
                  {tryOnProgress.step} / {tryOnProgress.total} 단계 진행 중
                </span>
              )}
            </div>
          ) : (
            /* 대기 중: 입어보기 버튼 */
            <button
              onClick={handleFlatlayTryOn}
              disabled={selectedCount === 0}
              style={{
                width: '100%', padding: '15px',
                borderRadius: 'var(--radius)', border: 'none',
                background: selectedCount === 0
                  ? 'var(--border)'
                  : 'linear-gradient(135deg, #C16654 0%, #D4845E 60%, #E8A070 100%)',
                color: selectedCount === 0 ? 'var(--text-muted)' : '#fff',
                fontSize: 15, fontWeight: 700,
                fontFamily: "'Pretendard', sans-serif",
                cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: selectedCount > 0 ? '0 6px 20px rgba(193,102,84,0.30)' : 'none',
                transition: 'all 0.25s',
              }}
            >
              <Shirt size={17} />
              <span>
                {selectedCount > 0 ? `선택한 ${selectedCount}개 입어보기` : '아이템을 선택해주세요'}
              </span>
            </button>
          )}
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
            padding: 'max(env(safe-area-inset-top, 40px), 40px) 20px max(env(safe-area-inset-bottom, 24px), 24px)',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, height: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, animation: 'fadeUp 0.4s ease' }}
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

            {/* 전신 이미지 — flex: 1을 주어 남는 공간을 차지하되 버튼들을 밀어내지 않게 함 */}
            <div style={{ width: '100%', flex: 1, minHeight: 0, borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', background: '#1a1008', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img src={tryOnResult} alt="가상 착장 결과" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
            </div>

            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>✨ AI가 생성한 가상 착장 이미지입니다</p>

            <div style={{ width: '100%', display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setTryOnResult(null); setSelected({ 상의: null, 하의: null, 아우터: null, 신발: null, 액세서리: null }); }}
                style={{ flex: 1, background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', padding: '13px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Pretendard', sans-serif" }}
              >
                다시 선택
              </button>
              <button
                onClick={async () => {
                  try {
                    // Canvas로 JPG 변환
                    const jpgBase64 = await new Promise((resolve, reject) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                        resolve(dataUrl.split(',')[1]);
                      };
                      img.onerror = reject;
                      img.src = tryOnResult;
                    });

                    const fileName = `coordimentor_tryon_${Date.now()}.jpg`;

                    if (Capacitor.isNativePlatform()) {
                      // 네이티브: 캐시에 저장 후 공유 시트로 갤러리 저장 유도
                      const result = await Filesystem.writeFile({
                        path: fileName,
                        data: jpgBase64,
                        directory: Directory.Cache,
                      });
                      await Share.share({
                        title: 'Coordimentor 가상 착장',
                        text: 'AI가 생성한 가상 착장 이미지',
                        files: [result.uri],
                        dialogTitle: '이미지 저장',
                      });
                    } else {
                      // 웹: 앵커 다운로드
                      const a = document.createElement('a');
                      a.href = `data:image/jpeg;base64,${jpgBase64}`;
                      a.download = fileName;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  } catch (e) {
                    console.error('저장 실패:', e);
                    alert('이미지 저장에 실패했습니다.');
                  }
                }}
                style={{ flex: 1, background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', padding: '13px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Pretendard', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                저장
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
