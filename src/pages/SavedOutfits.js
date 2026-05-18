import React, { useState, useEffect } from 'react';
import { Loader, Trash2, Calendar, MapPin, List, X, Share2, Download, Check, CalendarDays } from 'lucide-react';
import { subscribeToSavedOutfits, deleteSavedOutfit } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import FlatLay from '../components/FlatLay';
import CalendarView from '../components/CalendarView';
import OotdUploadModal from '../components/OotdUploadModal';
import { toBlob } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { saveImageAsJpg } from '../utils/saveImage';

const IS_IOS = Capacitor.getPlatform() === 'ios';

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

  // URL → Blob
  const fetchImgBlob = async (url) => {
    if (!url) return null;
    try {
      const res = await Promise.race([fetch(url), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000))]);
      if (res.ok) return await res.blob();
    } catch {}
    try {
      const res = await Promise.race([
        fetch(`https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=png`),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
      ]);
      if (res.ok) return await res.blob();
    } catch {}
    return null;
  };

  const blobToDataUrl = (blob) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  const loadImg = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  // FlatLay 카테고리별 기본 사이즈
  const FL_BASE = {
    '얼굴/머리': { w: 120, h: 120 },
    '상의':      { w: 180, h: 200 },
    '하의':      { w: 150, h: 250 },
    '아우터':    { w: 190, h: 210 },
    '신발':      { w: 120, h: 120 },
    '손목/팔':   { w: 110, h: 110 },
    '기타':      { w: 160, h: 160 },
  };

  const getItemType = (item) => {
    const cat = item.category || '';
    if (cat.includes('아우터')) return '아우터';
    if (cat.includes('상의'))   return '상의';
    if (cat.includes('하의'))   return '하의';
    if (cat.includes('신발'))   return '신발';
    if (cat.includes('얼굴') || cat.includes('머리')) return '얼굴/머리';
    if (cat.includes('손목') || cat.includes('팔'))   return '손목/팔';
    return '기타';
  };

  // outfit 객체/배열 정규화 (FlatLay.js와 동일)
  const normalizeOutfit = (raw) => {
    if (!raw) return {};
    if (Array.isArray(raw)) {
      return raw.reduce((acc, item) => {
        if (!item) return acc;
        const cat = item.category || '';
        if (cat.includes('아우터'))                            acc['아우터'] = item;
        else if (cat.includes('상의'))                         acc['상의'] = item;
        else if (cat.includes('하의'))                         acc['하의'] = item;
        else if (cat.includes('신발'))                         acc['신발'] = item;
        else if (cat.includes('얼굴') || cat.includes('머리')) acc['액세서리_얼굴머리'] = item;
        else if (cat.includes('손목') || cat.includes('팔'))   acc['액세서리_손목팔'] = item;
        else                                                    acc['액세서리_기타'] = item;
        return acc;
      }, {});
    }
    return raw;
  };

  // Canvas로 FlatLay 세로 배열 합성 (원래 레이아웃 재현)
  const composeOutfitCanvas = async (outfit) => {
    const normalized = normalizeOutfit(outfit.items || outfit);
    const ORDER = ['액세서리_얼굴머리','아우터','상의','액세서리_손목팔','하의','신발','액세서리_기타'];
    const items = ORDER.map(k => normalized[k]).filter(v => v?.imageUrl);

    const SCALE = 2.2;
    const GAP = 12;
    const PAD = 40;
    const totalH = items.reduce((s, item) => {
      const type = getItemType(item);
      return s + (FL_BASE[type]?.h || 140) * SCALE + GAP;
    }, 0);
    const maxW = Math.max(...items.map(item => (FL_BASE[getItemType(item)]?.w || 140) * SCALE));
    const SIZE_W = maxW + PAD * 2;
    const SIZE_H = totalH + PAD * 2 + 60;

    const canvas = document.createElement('canvas');
    canvas.width = SIZE_W;
    canvas.height = SIZE_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE_W, SIZE_H);

    // 이미지 로드
    const dataUrls = await Promise.all(items.map(async (item) => {
      const blob = await fetchImgBlob(item.imageUrl);
      return blob ? await blobToDataUrl(blob) : null;
    }));
    const imgs = await Promise.all(dataUrls.map(d => d ? loadImg(d) : Promise.resolve(null)));

    let curY = PAD;
    items.forEach((item, i) => {
      const type = getItemType(item);
      const base = FL_BASE[type] || { w: 140, h: 140 };
      const w = base.w * SCALE, h = base.h * SCALE;
      const x = (SIZE_W - w) / 2;
      ctx.fillStyle = '#f7f5f2';
      ctx.fillRect(x, curY, w, h);
      const img = imgs[i];
      if (img) {
        const r = Math.min(w / img.width, h / img.height);
        const dw = img.width * r, dh = img.height * r;
        ctx.drawImage(img, x + (w - dw) / 2, curY + (h - dh) / 2, dw, dh);
      }
      curY += h + GAP;
    });

    // 브랜드
    ctx.fillStyle = '#9a8a7a';
    ctx.font = 'italic 24px serif';
    ctx.textAlign = 'center';
    ctx.fillText('Coordimentor', SIZE_W / 2, SIZE_H - 16);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  };

  const prepareShareImage = async (outfit) => {
    if (sharingId) return;
    setSharingId(outfit.id);
    const shareText = `[출처: 코디멘토 Coordimentor]\n\n상황: ${outfit.tpoInfo?.event || '일상'}\n날씨: ${outfit.weather?.temp}°C\n\n"${outfit.reason}"\n\n나만의 스타일 멘토, 코디멘토에서 추천받은 룩입니다.`;

    try {
      let blob;

      if (IS_IOS) {
        // iOS: Canvas API 사용 (WKWebView CORS 우회)
        blob = await composeOutfitCanvas(outfit);
      } else {
        // Android/Web: 기존 html-to-image 방식
        const targetEl = document.getElementById(`outfit-capture-${outfit.id}`);
        if (!targetEl) throw new Error('캡처 대상 요소를 찾을 수 없습니다.');

        // 이미지를 data URL로 미리 변환 (CORS 우회)
        const images = Array.from(targetEl.querySelectorAll('img'));
        const originalSrcs = [];
        await Promise.allSettled(images.map(async (img) => {
          const originalSrc = img.src;
          originalSrcs.push(originalSrc);
          try {
            const blob = await fetchImgBlob(originalSrc);
            if (blob) {
              const dataUrl = await blobToDataUrl(blob);
              img.src = dataUrl;
              await new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 1000); });
            }
          } catch {}
        }));
        await new Promise(r => setTimeout(r, 400));

        blob = await Promise.race([
          toBlob(targetEl, { backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: true }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('캡처 시간 초과')), 20000)),
        ]);

        // 원래 src 복원
        images.forEach((img, i) => { if (originalSrcs[i]) img.src = originalSrcs[i]; });
      }

      if (!blob) throw new Error('이미지 생성 실패');
      const file = new File([blob], 'coordimentor-outfit.png', { type: 'image/png' });
      const objectUrl = URL.createObjectURL(blob);
      setShareModalData({ file, objectUrl, shareText });
    } catch (e) {
      console.error('이미지 준비 오류:', e);
      alert('이미지를 준비하는 중 문제가 발생했습니다.');
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
