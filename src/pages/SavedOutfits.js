import React, { useState, useEffect } from 'react';
import { Loader, Trash2, Calendar, MapPin, List, X, Share2, Download, Check, CalendarDays } from 'lucide-react';
import { subscribeToSavedOutfits, deleteSavedOutfit } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import FlatLay from '../components/FlatLay';
import { toBlob } from 'html-to-image';
import CalendarView from '../components/CalendarView';
import OotdUploadModal from '../components/OotdUploadModal';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { saveImageAsJpg } from '../utils/saveImage';

const getTitleFontSize = (text = '') => {
  const len = text.length;
  if (len <= 10) return 22;
  if (len <= 18) return 18;
  if (len <= 28) return 15;
  return 12;
};

const LABEL = {
  '아우터': '아우터',
  '상의': '상의',
  '하의': '하의',
  '신발': '신발',
  '액세서리_얼굴머리': '얼굴/머리',
  '액세서리_손목팔': '손목/팔',
  '액세서리_기타': '가방/벨트 등',
};

export default function SavedOutfitsPage({ onSheetOpen, onSheetClose }) {
  const { user } = useAuth();
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState(null);
  const [detailOutfit, setDetailOutfit] = useState(null);
  
  // 탭 상태: 'saved' | 'calendar'
  const [activeTab, setActiveTab] = useState('saved');

  // 공유 및 OOTD 모달 상태
  const [shareModalData, setShareModalData] = useState(null);
  const [ootdOutfit, setOotdOutfit] = useState(null);

  const openSheet = (outfit) => { setDetailOutfit(outfit); onSheetOpen?.(); };
  const closeSheet = () => { setDetailOutfit(null); onSheetClose?.(); };

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToSavedOutfits(user.uid, (data) => {
      setOutfits(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleDelete = async (id) => {
    if (window.confirm('이 코디를 즐겨찾기에서 삭제하시겠습니까?')) {
      try {
        await deleteSavedOutfit(user.uid, id);
      } catch (e) {
        alert('삭제 실패: ' + e.message);
      }
    }
  };

  const prepareShareImage = async (outfit) => {
    if (sharingId) return;
    setSharingId(outfit.id);
    
    const shareText = `[출처: 코디멘토 Coordimentor]\n\n상황: ${outfit.tpoInfo?.event || '일상'}\n날씨: ${outfit.weather?.temp}°C\n\n"${outfit.reason}"\n\n나만의 스타일 멘토, 코디멘토에서 추천받은 룩입니다.`;

    try {
      const targetEl = document.getElementById(`outfit-capture-${outfit.id}`);
      if (!targetEl) throw new Error('캡처 대상을 찾을 수 없습니다.');

      // 이미지 베이킹 로직
      const images = Array.from(targetEl.getElementsByTagName('img'));
      for (const img of images) {
        if (img.src.startsWith('data:')) continue;
        try {
          const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(img.src)}&output=png`;
          const response = await fetch(proxyUrl);
          if (!response.ok) throw new Error('Proxy fetch failed');
          const blob = await response.blob();
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          img.src = dataUrl;
        } catch (bakeErr) {
          console.warn('이미지 베이킹 실패 (기본 주소 사용):', img.src, bakeErr);
        }
      }

      await new Promise(r => setTimeout(r, 300));

      const capturePromise = toBlob(targetEl, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
        style: { borderRadius: '0' }
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('이미지 생성 시간 초과')), 10000)
      );

      const blob = await Promise.race([capturePromise, timeoutPromise]);
      if (!blob) throw new Error('이미지 데이터 생성 실패');

      const file = new File([blob], `coordimentor-outfit.png`, { type: 'image/png' });
      const objectUrl = URL.createObjectURL(blob);

      // 이미지가 준비되면 팝업을 띄움
      setShareModalData({
        file,
        objectUrl,
        shareText
      });

    } catch (e) {
      console.error('이미지 준비 오류:', e);
      alert('이미지를 준비하는 중 문제가 발생했습니다. 나중에 다시 시도해주세요.');
    } finally {
      setSharingId(null);
    }
  };

  // Blob → base64 (data: prefix 없음)
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const executeShare = async () => {
    if (!shareModalData) return;
    const { file, shareText } = shareModalData;

    try {
      if (Capacitor.isNativePlatform()) {
        // 네이티브: @capacitor/share 사용
        const base64 = await blobToBase64(file);
        const saved = await Filesystem.writeFile({
          path: `coordimentor-outfit-${Date.now()}.png`,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({ files: [saved.uri], title: 'Coordimentor 코디 공유', text: shareText });
      } else if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Coordimentor 코디 공유',
          text: shareText,
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'Coordimentor 코디 공유',
          text: shareText,
          url: window.location.origin
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('이미지 공유를 지원하지 않는 브라우저입니다. 텍스트가 복사되었습니다.');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('공유 실행 오류:', e);
      }
    }
  };

  const executeDownload = async () => {
    if (!shareModalData) return;
    try {
      // full dataUrl (data: prefix 포함) 필요
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(shareModalData.file);
      });
      await saveImageAsJpg(dataUrl, 'coordimentor-outfit');
    } catch (e) {
      alert('저장 실패: ' + e.message);
    }
  };

  const detailItems = detailOutfit
    ? Object.entries(detailOutfit.items).filter(([, item]) => item)
    : [];

  return (
    <div className="page saved-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* ── Top Tabs ── */}
      <div style={{ display: 'flex', padding: '16px 16px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <button 
          onClick={() => setActiveTab('saved')}
          style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'saved' ? '2px solid var(--text)' : '2px solid transparent', color: activeTab === 'saved' ? 'var(--text)' : 'var(--text-muted)', fontWeight: activeTab === 'saved' ? 600 : 500, fontSize: '15px', cursor: 'pointer' }}
        >
          저장된 코디
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: activeTab === 'calendar' ? '2px solid var(--text)' : '2px solid transparent', color: activeTab === 'calendar' ? 'var(--text)' : 'var(--text-muted)', fontWeight: activeTab === 'calendar' ? 600 : 500, fontSize: '15px', cursor: 'pointer' }}
        >
          OOTD 캘린더
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        
        {/* ── Saved Outfits Tab ── */}
        {activeTab === 'saved' && (
          <div style={{ paddingBottom: '100px' }}>
            <h2 className="page-title" style={{ marginTop: '20px' }}>저장된 코디</h2>
            
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader size={30} className="spin" color="var(--primary)" />
              </div>
            ) : outfits.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '40px' }}>
                <Check size={48} strokeWidth={1} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>아직 저장된 코디가 없습니다.</p>
                <p className="empty-state-sub" style={{ marginTop: '8px', color: '#888' }}>마음에 드는 코디의 하트를 눌러보세요!</p>
              </div>
            ) : (
              <div className="outfit-results-list">
                {outfits.map((outfit) => (
                  <div key={outfit.id} className="outfit-result-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="outfit-card-header">
                      <div className="saved-meta">
                        {outfit.tpoInfo && (
                          <span className="saved-meta-item">
                            <Calendar size={12} /> {outfit.tpoInfo.date} {outfit.tpoInfo.time}시
                          </span>
                        )}
                        {outfit.weather && (
                          <span className="saved-meta-item">
                            <MapPin size={12} /> {outfit.weather.temp}°C {outfit.weather.emoji}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          onClick={() => setOotdOutfit(outfit)}
                          title="오늘 입었어요 (OOTD 기록)"
                          style={{ background: 'var(--surface-2)', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', color: 'var(--primary)' }}
                        >
                          <CalendarDays size={18} />
                        </button>
                        <button
                          onClick={() => prepareShareImage(outfit)}
                          title="공유 및 저장"
                          disabled={sharingId === outfit.id}
                          style={{ background: 'var(--surface-2)', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                        >
                          {sharingId === outfit.id ? <Loader size={18} className="spin" /> : <Share2 size={18} />}
                        </button>
                        <button
                          onClick={() => openSheet(outfit)}
                          title="아이템 목록 보기"
                          style={{ background: 'var(--surface-2)', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                        >
                          <List size={18} />
                        </button>
                        <button
                          className="btn-icon danger-text"
                          onClick={() => handleDelete(outfit.id)}
                          title="삭제"
                          style={{ background: 'var(--surface-2)', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {outfit.tpoInfo?.event && (
                      <p className="saved-event-tag" style={{ margin: 0 }}>{outfit.tpoInfo.event}</p>
                    )}

                    <p className="result-reason" style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>{outfit.reason}</p>

                    <div 
                      id={`outfit-capture-${outfit.id}`}
                      className="flatlay-wrapper" 
                      style={{ background: '#ffffff', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', marginTop: '4px' }}
                    >
                      <FlatLay items={outfit.items} noBorder showWatermark={sharingId === outfit.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Calendar Tab ── */}
        {activeTab === 'calendar' && (
          <CalendarView />
        )}

      </div>

      {/* ── 공유 미리보기 팝업 (Share Modal) ── */}
      {shareModalData && (
        <div
          onClick={() => setShareModalData(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 360, maxHeight: '85vh', background: 'var(--surface)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>코디 이미지 완성!</h3>
              <button onClick={() => setShareModalData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--surface-2)', flex: 1, overflowY: 'auto' }}>
              <img 
                src={shareModalData.objectUrl} 
                alt="공유할 코디" 
                style={{ width: '100%', maxWidth: '280px', maxHeight: '45vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
              />
              <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', flexShrink: 0 }}>
                이미지를 꾹 눌러 저장하거나 아래 버튼을 통해 공유하세요.
              </p>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', gap: '10px', flexShrink: 0 }}>
              <button 
                onClick={executeDownload}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 500, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                <Download size={18} /> 저장
              </button>
              <button 
                onClick={executeShare}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 500, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                <Share2 size={18} /> SNS 공유
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 아이템 목록 바텀시트 ── */}
      {detailOutfit && (
        <div
          onClick={() => closeSheet()}
          style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 430, background: 'var(--surface)', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', height: '80vh', maxHeight: '80vh' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 2px', fontFamily: "'DM Sans', sans-serif" }}>
                  코디 아이템
                </p>
                <h3 style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontStyle: 'italic',
                  fontSize: getTitleFontSize(detailOutfit.tpoInfo?.event || detailOutfit.tpoInfo?.date || '저장된 코디'),
                  fontWeight: 500,
                  margin: 0,
                  color: 'var(--primary)',
                  height: 28,
                  lineHeight: '28px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}>
                  {detailOutfit.tpoInfo?.event || detailOutfit.tpoInfo?.date || '저장된 코디'}
                </h3>
              </div>
              <button onClick={() => closeSheet()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'flex' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '12px 20px 0' }}>
              {detailItems.map(([key, item]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 64, height: 64, flexShrink: 0, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 3px', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {LABEL[key] || key}
                    </p>
                    <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </p>
                    {item.color && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: "'DM Sans', sans-serif" }}>{item.color}</p>
                    )}
                  </div>
                </div>
              ))}
              
              <div style={{ padding: '8px 0 32px' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── OOTD Upload Modal ── */}
      {ootdOutfit && (
        <OotdUploadModal
          outfit={ootdOutfit}
          onClose={() => setOotdOutfit(null)}
          onUploadComplete={() => {
            setOotdOutfit(null);
            closeSheet();
            setActiveTab('calendar');
          }}
        />
      )}

    </div>
  );
}
