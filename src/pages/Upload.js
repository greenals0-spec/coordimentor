import React, { useState, useRef, useEffect } from 'react';
import { Loader, Check, AlertCircle, Camera as CameraIcon, ChevronLeft, Image as ImageIcon } from 'lucide-react';
import { removeBackground, analyzeClothing } from '../utils/api';
import { uploadImage, saveItem } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import ImageEditor from '../components/ImageEditor';

const CATEGORY_LABELS = ['아우터', '상의', '하의', '신발', '액세서리'];

// ── 단계별 SVG 일러스트 ────────────────────────────────────────────────────────
const IllustCamera = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    <rect x="10" y="18" width="52" height="38" rx="7" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.2"/>
    <circle cx="36" cy="37" r="11" fill="none" stroke="var(--primary)" strokeWidth="2.2"/>
    <circle cx="36" cy="37" r="5.5" fill="var(--primary)" opacity="0.25"/>
    <circle cx="36" cy="37" r="2.5" fill="var(--primary)" opacity="0.6"/>
    <rect x="27" y="13" width="18" height="8" rx="4" fill="var(--primary)" opacity="0.3"/>
    <circle cx="56" cy="26" r="3" fill="var(--primary)" opacity="0.5"/>
  </svg>
);

const IllustLongPress = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    <rect x="12" y="8" width="34" height="50" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    <rect x="16" y="14" width="26" height="26" rx="3" fill="var(--primary)" opacity="0.15"/>
    <rect x="18" y="16" width="22" height="22" rx="2" fill="var(--primary)" opacity="0.2"/>
    {/* 손가락 */}
    <ellipse cx="53" cy="44" rx="7" ry="11" rx2="7" fill="#f0e9ff" stroke="var(--primary)" strokeWidth="1.8"/>
    <line x1="53" y1="33" x2="53" y2="40" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
    {/* 누름 파동 */}
    <circle cx="29" cy="27" r="8" stroke="var(--primary)" strokeWidth="1.5" opacity="0.4" strokeDasharray="3 2"/>
    <circle cx="29" cy="27" r="13" stroke="var(--primary)" strokeWidth="1" opacity="0.2" strokeDasharray="3 3"/>
    <circle cx="29" cy="27" r="4" fill="var(--primary)" opacity="0.35"/>
  </svg>
);

const IllustShare = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    {/* 폰 */}
    <rect x="10" y="8" width="30" height="50" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    {/* 공유 아이콘 */}
    <circle cx="25" cy="28" r="4" fill="var(--primary)" opacity="0.7"/>
    <circle cx="17" cy="37" r="3.5" fill="var(--primary)" opacity="0.5"/>
    <circle cx="33" cy="37" r="3.5" fill="var(--primary)" opacity="0.5"/>
    <line x1="21" y1="30" x2="18" y2="36" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="29" y1="30" x2="32" y2="36" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round"/>
    {/* 화살표 */}
    <line x1="42" y1="36" x2="58" y2="36" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
    <polyline points="52,29 60,36 52,43" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    {/* 앱 아이콘 힌트 */}
    <rect x="58" y="27" width="0" height="0" rx="0"/>
  </svg>
);

const IllustAI = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    <rect x="14" y="12" width="34" height="48" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    <rect x="19" y="28" width="24" height="20" rx="3" fill="var(--primary)" opacity="0.12"/>
    {/* 스파클 */}
    <path d="M52 14 L54 20 L60 22 L54 24 L52 30 L50 24 L44 22 L50 20 Z" fill="var(--primary)" opacity="0.8"/>
    <path d="M58 8 L59 11 L62 12 L59 13 L58 16 L57 13 L54 12 L57 11 Z" fill="var(--primary)" opacity="0.5"/>
    <path d="M45 6 L46 8 L48 9 L46 10 L45 12 L44 10 L42 9 L44 8 Z" fill="var(--primary)" opacity="0.4"/>
    {/* 분석 바 */}
    <rect x="19" y="30" width="14" height="3" rx="1.5" fill="var(--primary)" opacity="0.5"/>
    <rect x="19" y="36" width="20" height="3" rx="1.5" fill="var(--primary)" opacity="0.35"/>
    <rect x="19" y="42" width="10" height="3" rx="1.5" fill="var(--primary)" opacity="0.25"/>
  </svg>
);

const IllustSave = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    <circle cx="36" cy="36" r="24" fill="var(--primary)" opacity="0.12"/>
    <circle cx="36" cy="36" r="18" fill="var(--primary)" opacity="0.2"/>
    <polyline points="24,36 32,44 48,28" fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    {/* 작은 별 */}
    <circle cx="58" cy="18" r="3" fill="var(--primary)" opacity="0.6"/>
    <circle cx="14" cy="22" r="2" fill="var(--primary)" opacity="0.4"/>
    <circle cx="60" cy="52" r="2" fill="var(--primary)" opacity="0.4"/>
  </svg>
);

// ── 가이드 단계 데이터 ──────────────────────────────────────────────────────────
const CAMERA_STEPS = [
  { id: 'photo', illust: <IllustCamera />, title: '카메라로 원하는 옷을 찍으세요', desc: '평평한 곳에 펼쳐두고 위에서 찍으면 더 깔끔해요' },
  { id: 'nukki', illust: <IllustLongPress />, title: '앨범에서 찍은 옷을 꾹 눌러 누끼를 따주세요', desc: '갤러리 앱에서 사진을 길게 누르면 피사체만 선택돼요' },
  { id: 'share', illust: <IllustShare />, title: '공유에서 "코디멘토"를 선택해주세요', desc: '공유 버튼 → 앱 목록에서 코디멘토를 찾아 탭하세요' },
  { id: 'ai', illust: <IllustAI />, title: 'AI로 옷 분석 후 카테고리 구분됩니다', desc: '카테고리, 색상, 태그를 자동으로 인식해드려요' },
  { id: 'save', illust: <IllustSave />, title: '내 옷장에 저장 완료!', desc: '저장된 옷으로 AI 코디 추천을 받을 수 있어요' },
];

const ALBUM_STEPS = [
  { id: 'nukki', illust: <IllustLongPress />, title: '앨범에서 찍은 옷을 꾹 눌러 누끼를 따주세요', desc: '갤러리 앱에서 사진을 길게 누르면 피사체만 선택돼요' },
  { id: 'share', illust: <IllustShare />, title: '공유에서 "코디멘토"를 선택해주세요', desc: '공유 버튼 → 앱 목록에서 코디멘토를 찾아 탭하세요' },
  { id: 'ai', illust: <IllustAI />, title: 'AI로 옷 분석 후 카테고리 구분됩니다', desc: '카테고리, 색상, 태그를 자동으로 인식해드려요' },
  { id: 'save', illust: <IllustSave />, title: '내 옷장에 저장 완료!', desc: '저장된 옷으로 AI 코디 추천을 받을 수 있어요' },
];

// ── 가이드 화면 컴포넌트 ────────────────────────────────────────────────────────
function GuideScreen({ steps, onBack, cameraActionDone, onCameraAction, onAlbumAction }) {
  const currentIdx = cameraActionDone ? 1 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 4px 12px', gap: 4 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={22} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>이용 방법</span>
      </div>

      {/* 단계 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, marginBottom: i < steps.length - 1 ? 0 : 24 }}>
            {/* 왼쪽: 숫자 + 연결선 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div 
                className={i === currentIdx ? 'blink' : ''}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: i === currentIdx ? 'var(--primary)' : (i < currentIdx ? '#86efac' : '#e5e7eb'), 
                  color: i <= currentIdx ? 'white' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative', zIndex: 2
                }}
              >
                {i < currentIdx ? <Check size={16} strokeWidth={3} /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{ 
                  width: 2, flex: 1, minHeight: 32, 
                  background: i < currentIdx ? '#86efac' : 'var(--border)', 
                  margin: '4px 0',
                  transition: 'background 0.5s'
                }} />
              )}
            </div>

            {/* 오른쪽: 일러스트 + 텍스트 */}
            <div style={{ flex: 1, paddingBottom: 28 }}>
              <div style={{
                background: 'var(--surface)', borderRadius: 16,
                border: i === currentIdx ? '2px solid var(--primary)' : '1px solid var(--border)',
                padding: '20px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                opacity: i > currentIdx ? 0.6 : 1,
                transform: i === currentIdx ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.3s'
              }}>
                {s.illust}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px', lineHeight: 1.4 }}>{s.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
                </div>

                {/* 단계별 버튼 주입 */}
                {i === 0 && !cameraActionDone && steps.length > 4 && (
                  <button 
                    onClick={onCameraAction}
                    style={{
                      marginTop: 8, padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                    }}
                  >
                    <CameraIcon size={16} /> 사진 촬영하기
                  </button>
                )}
                
                {i === 1 && cameraActionDone && steps.length > 4 && (
                  <button 
                    onClick={onAlbumAction}
                    style={{
                      marginTop: 8, padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                    }}
                  >
                    <ImageIcon size={16} /> 앨범으로 가기
                  </button>
                )}

                {/* 앨범 전용 가이드의 경우 1단계 버튼 */}
                {i === 0 && steps.length === 4 && (
                  <button 
                    onClick={onAlbumAction}
                    style={{
                      marginTop: 8, padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                    }}
                  >
                    <ImageIcon size={16} /> 앨범으로 가기
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 하단 안내 배너 (카메라 촬영 후만 표시) */}
      {cameraActionDone && (
        <div style={{ padding: '12px 20px 24px', background: 'var(--background)' }}>
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12,
            padding: '14px 16px', textAlign: 'center', color: '#166534', fontSize: 13, lineHeight: 1.5,
          }}>
            📸 사진이 저장되었습니다!<br/>
            이제 앨범에서 <strong>옷을 꾹 눌러</strong> 코디멘토로 공유해주세요.
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────────────
export default function UploadPage({ onSaved, onCameraOpen, onCameraClose }) {
  const { user } = useAuth();
  const [step, setStep] = useState('main');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [removedUrl, setRemovedUrl] = useState(null);
  const [removedBlob, setRemovedBlob] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [bgProgress, setBgProgress] = useState(0);
  const [bulkItems, setBulkItems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [cameraActionDone, setCameraActionDone] = useState(false);

  const albumInputRef = useRef(null);

  // ── 공유 이미지 수신 처리 ─────────────────────────────────────────────────────
  useEffect(() => {
    let processing = false;

    const handleSharedImage = async (imgData) => {
      if (processing) return;
      const rawPath = typeof imgData === 'string' ? imgData : (imgData?.detail || '');
      if (!rawPath) return;

      processing = true;
      setStep('analyzing');

      try {
        let dataUrl;
        if (rawPath.startsWith('data:')) {
          dataUrl = rawPath;
        } else {
          try {
            const { Filesystem } = await import('@capacitor/filesystem');
            const filename = rawPath.split('/').pop();
            const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            const fileResult = await Filesystem.readFile({ path: filename, directory: 'CACHE' });
            dataUrl = `data:${mimeType};base64,${fileResult.data}`;
          } catch {
            const convUrl = Capacitor.convertFileSrc(rawPath) + `?t=${Date.now()}`;
            const res = await fetch(convUrl);
            if (!res.ok) throw new Error(`fetch 실패 (${res.status})`);
            const blob = await res.blob();
            dataUrl = await blobToDataUrl(blob);
          }
        }

        const result = await analyzeClothing(dataUrl);
        setAnalysis(result);
        const fetchRes = await fetch(dataUrl);
        const blob = await fetchRes.blob();
        setRemovedBlob(blob);
        setRemovedUrl(dataUrl);
        setPreview(dataUrl);
        setStep('preview');

        window._sharedImage = null;
        window._sharedImagePath = null;
        if (window.AndroidShare) window.AndroidShare.clearSharedImagePath();
      } catch (e) {
        processing = false;
        setError('공유받은 이미지 분석에 실패했습니다: ' + e.message);
        setStep('error');
      }
    };

    let checkCount = 0;
    const checkInterval = setInterval(() => {
      if (processing) { clearInterval(checkInterval); return; }
      let data = window._sharedImage || window._sharedImagePath;
      if (!data && window.AndroidShare) {
        const nativePath = window.AndroidShare.getSharedImagePath();
        if (nativePath) { data = nativePath; window._sharedImagePath = nativePath; }
      }
      if (data) { clearInterval(checkInterval); handleSharedImage(data); }
      else if (checkCount >= 20) clearInterval(checkInterval);
      checkCount++;
    }, 500);

    window.addEventListener('sharedImage', handleSharedImage);
    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('sharedImage', handleSharedImage);
    };
  }, []);

  const blobToDataUrl = (blob) =>
    new Promise((res) => { const r = new FileReader(); r.onload = (e) => res(e.target.result); r.readAsDataURL(blob); });

  const reset = () => {
    setStep('main');

    setError('');
    setPreview(null);
    setRemovedUrl(null);
    setRemovedBlob(null);
    setAnalysis(null);
    setBulkItems([]);
    setCurrentIdx(0);
    setCameraActionDone(false);
  };

  // ── 카메라 버튼 ───────────────────────────────────────────────────────────────
  const handleOpenCamera = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera: CapCamera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          saveToGallery: true,
        });
        setCameraActionDone(true);
      } catch (e) {
        if (!e.message?.includes('cancel') && !e.message?.includes('User cancelled')) {
          setError('카메라를 열 수 없어요: ' + e.message);
        }
      }
    } else {
      // 웹: input[capture] 트리거
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => { const f = e.target.files[0]; if (f) processFile(f); };
      input.click();
    }
  };

  // ── 앨범 버튼 ─────────────────────────────────────────────────────────────────
  const handleOpenAlbum = () => {
    if (Capacitor.isNativePlatform() && window.AndroidShare) {
      // 갤러리 앱 직접 오픈 (누끼 따기 → 공유 흐름용)
      window.AndroidShare.openGallery();
    } else {
      albumInputRef.current?.click();
    }
  };

  // ── 파일 처리 ─────────────────────────────────────────────────────────────────
  const processFile = async (file) => {
    if (!file) return;
    setError('');
    const dataUrl = await blobToDataUrl(file);
    setPreview(dataUrl);
    setRemovedBlob(file);
    setStep('capture_preview');
  };

  const processBulk = async (files) => {
    setStep('bulk_processing');
    const items = [];
    for (let i = 0; i < files.length; i++) {
      setCurrentIdx(i);
      const file = files[i];
      try {
        setBgProgress(0);
        const bgRemovedUrl = await removeBackground(file, (pct) => setBgProgress(pct));
        let blob;
        if (bgRemovedUrl.startsWith('data:')) {
          const arr = bgRemovedUrl.split(',');
          const mime = arr[0].match(/:(.*?);/)[1];
          const bstr = atob(arr[1]); let n = bstr.length; const u8 = new Uint8Array(n);
          while (n--) u8[n] = bstr.charCodeAt(n);
          blob = new Blob([u8], { type: mime });
        } else { const r = await fetch(bgRemovedUrl); blob = await r.blob(); }
        const dataUrl = await blobToDataUrl(blob);
        const analysisResult = await analyzeClothing(dataUrl);
        items.push({ id: Date.now() + i, removedBlob: blob, removedUrl: bgRemovedUrl, analysis: analysisResult });
      } catch (e) { console.error(`이미지 ${i + 1} 처리 실패:`, e); }
    }
    setBulkItems(items);
    setStep('bulk_review');
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (files.length > 1) processBulk(files);
    else processFile(files[0]);
    e.target.value = '';
  };

  const startAutoRemoving = async () => {
    if (!removedBlob) return;
    setStep('removing');
    setBgProgress(0);
    try {
      const bgRemovedUrl = await removeBackground(removedBlob, (pct) => setBgProgress(pct));
      setRemovedUrl(bgRemovedUrl);
      let blob;
      if (bgRemovedUrl.startsWith('data:')) {
        const arr = bgRemovedUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]); let n = bstr.length; const u8 = new Uint8Array(n);
        while (n--) u8[n] = bstr.charCodeAt(n);
        blob = new Blob([u8], { type: mime });
      } else { const r = await fetch(bgRemovedUrl); blob = await r.blob(); }
      setRemovedBlob(blob);
      setStep('editing');
    } catch (e) {
      setRemovedUrl(preview);
      setStep('editing');
    }
  };

  const handlePasteImage = async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error('이 브라우저에서는 지원하지 않습니다.');
      setError('');
      const clipItems = await navigator.clipboard.read();
      let imageBlob = null;
      for (const item of clipItems) {
        if (item.types.includes('image/png')) { imageBlob = await item.getType('image/png'); break; }
        else if (item.types.includes('image/jpeg')) { imageBlob = await item.getType('image/jpeg'); break; }
      }
      if (!imageBlob) { alert('클립보드에 복사된 이미지가 없습니다.'); return; }
      const url = URL.createObjectURL(imageBlob);
      setRemovedUrl(url); setRemovedBlob(imageBlob); setPreview(url);
      setStep('analyzing');
      const dataUrl = await blobToDataUrl(imageBlob);
      const result = await analyzeClothing(dataUrl);
      setAnalysis(result);
      setStep('preview');
    } catch (e) { setError('붙여넣기 실패: ' + e.message); }
  };

  const handleEditConfirm = async (editedBlob) => {
    setRemovedBlob(editedBlob);
    setRemovedUrl(URL.createObjectURL(editedBlob));
    setStep('analyzing');
    try {
      const dataUrl = await blobToDataUrl(editedBlob);
      const result = await analyzeClothing(dataUrl);
      setAnalysis(result); setStep('preview');
    } catch (e) { setError(e.message); setStep('error'); }
  };

  const handleSkipEdit = async () => {
    setStep('analyzing');
    try {
      const dataUrl = await blobToDataUrl(removedBlob);
      const result = await analyzeClothing(dataUrl);
      setAnalysis(result); setStep('preview');
    } catch (e) { setError(e.message); setStep('error'); }
  };

  const handleManualImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setRemovedUrl(URL.createObjectURL(file)); setRemovedBlob(file); }
    e.target.value = '';
  };

  const handleSave = async () => {
    setStep('saving');
    try {
      let url = '', path = '';
      if (removedBlob) { const result = await uploadImage(user.uid, removedBlob); url = result.url; path = result.path; }
      await saveItem(user.uid, {
        imageUrl: url, imagePath: path,
        category: analysis?.category || '상의', color: analysis?.color || '',
        tags: analysis?.tags || [], name: analysis?.name || '', brand: analysis?.brand || '',
      });
      setStep('done');
      setTimeout(() => { reset(); onSaved?.(); }, 1200);
    } catch (e) {
      setError(e.message || '저장 중 오류가 발생했어요.');
      setStep('error');
    }
  };

  const handleBulkSave = async () => {
    setStep('saving');
    try {
      for (const item of bulkItems) {
        const result = await uploadImage(user.uid, item.removedBlob);
        await saveItem(user.uid, {
          imageUrl: result.url, imagePath: result.path,
          category: item.analysis?.category || '상의', color: item.analysis?.color || '',
          tags: item.analysis?.tags || [], name: item.analysis?.name || '', brand: item.analysis?.brand || '',
        });
      }
      setStep('done');
      setTimeout(() => { reset(); onSaved?.(); }, 1200);
    } catch (e) { setError('저장 중 오류가 발생했습니다.'); setStep('error'); }
  };

  // ── 렌더 ───────────────────────────────────────────────────────────────────────
  return (
    <div className="page upload-page" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* 숨겨진 앨범 파일 입력 */}
      <input ref={albumInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ── 메인: 두 버튼 ── */}
      {step === 'main' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h2 className="page-title" style={{ padding: '0 20px' }}>옷 추가</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 20px', marginBottom: 28 }}>
            어떻게 추가하시겠어요?
          </p>

          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 촬영 후 가져오기 */}
            <button
              onClick={() => setStep('guide_camera')}
              style={{
                display: 'flex', alignItems: 'center', gap: 18,
                background: 'var(--surface)', border: '1.5px solid var(--border)',
                borderRadius: 18, padding: '20px 20px', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <CameraIcon size={26} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>촬영 후 가져오기</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>옷을 직접 촬영한 뒤<br/>갤러리 누끼로 깔끔하게 등록</p>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>›</span>
            </button>

            {/* 앨범에서 가져오기 */}
            <button
              onClick={() => setStep('guide_album')}
              style={{
                display: 'flex', alignItems: 'center', gap: 18,
                background: 'var(--surface)', border: '1.5px solid var(--border)',
                borderRadius: 18, padding: '20px 20px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: '#6B7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <ImageIcon size={26} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>앨범에서 가져오기</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>갤러리 기존 사진에서<br/>누끼를 따서 등록</p>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>›</span>
            </button>
          </div>

          {error && <p style={{ color: 'var(--error)', fontSize: 13, padding: '12px 20px' }}>{error}</p>}
        </div>
      )}

      {/* ── 가이드: 촬영 후 가져오기 ── */}
      {step === 'guide_camera' && (
        <GuideScreen
          steps={CAMERA_STEPS}
          onCameraAction={handleOpenCamera}
          onBack={() => { setStep('main'); setCameraActionDone(false); }}
          cameraActionDone={cameraActionDone}
          onAlbumAction={handleOpenAlbum}
        />
      )}

      {/* ── 가이드: 앨범에서 가져오기 ── */}
      {step === 'guide_album' && (
        <GuideScreen
          steps={ALBUM_STEPS}
          onBack={() => setStep('main')}
          cameraActionDone={false}
          onAlbumAction={handleOpenAlbum}
        />
      )}

      {/* ── 촬영 후 누끼 프리뷰 ── */}
      {step === 'capture_preview' && preview && (
        <div className="capture-preview-step">
          <p className="preview-instruction">
            사진 속 <strong>옷을 길게 꾹 눌러서</strong><br/>
            '복사'한 뒤 아래 버튼을 눌러주세요.
          </p>
          <div className="preview-container">
            <img src={preview} alt="captured" className="nukki-ready-img"
              style={{ WebkitTouchCallout: 'default', userSelect: 'auto', touchAction: 'manipulation', WebkitUserSelect: 'auto' }} />
          </div>
          <div className="preview-actions-vertical">
            <button className="btn primary big-btn" onClick={handlePasteImage}>복사한 누끼 붙여넣기</button>
            {/* 서버 배경 제거 버튼 — 기능 유지, UI에서 숨김 */}
            {/* <button className="btn secondary" onClick={startAutoRemoving} style={{ marginTop: 12 }}>자동 배경 제거 (서버)</button> */}
          </div>
        </div>
      )}

      {/* ── 일괄 처리 중 ── */}
      {step === 'bulk_processing' && (
        <div className="processing">
          <div className="bulk-progress-header">
            <h3>일괄 처리 중...</h3>
            <p>{currentIdx + 1} / {bulkItems.length + 1} 번째 이미지</p>
          </div>
          <div className="processing-status"><Loader size={24} className="spin" /><span>자동 누끼 및 정보 분석 중...</span></div>
          <div className="progress-container"><div className="progress-bar" style={{ width: `${bgProgress}%` }} /></div>
        </div>
      )}

      {/* ── 일괄 검토 ── */}
      {step === 'bulk_review' && (
        <div className="bulk-review-step">
          <div className="review-header">
            <h3>처리 완료! ({bulkItems.length}벌)</h3>
            <p>정보가 맞는지 확인하고 한꺼번에 저장하세요.</p>
          </div>
          <div className="bulk-items-grid">
            {bulkItems.map((item, idx) => (
              <div key={item.id} className="bulk-item-card">
                <div className="item-img-box"><img src={item.removedUrl} alt="item" /></div>
                <div className="item-info-mini">
                  <select value={item.analysis.category} onChange={(e) => {
                    const newItems = [...bulkItems]; newItems[idx].analysis.category = e.target.value; setBulkItems(newItems);
                  }}>{CATEGORY_LABELS.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  <input value={item.analysis.name} placeholder="상품명" onChange={(e) => {
                    const newItems = [...bulkItems]; newItems[idx].analysis.name = e.target.value; setBulkItems(newItems);
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div className="bulk-actions">
            <button className="btn secondary" onClick={reset}>취소</button>
            <button className="btn primary" onClick={handleBulkSave}>모두 저장하기</button>
          </div>
        </div>
      )}

      {/* ── 처리 중 ── */}
      {(step === 'removing' || step === 'analyzing' || step === 'analyzing_tag' || step === 'saving') && (
        <div className="processing">
          {preview && <img src={preview} alt="preview" className="processing-img" />}
          <div className="processing-status">
            <Loader size={24} className="spin" />
            <span>
              {step === 'removing' && (bgProgress > 0 ? `분석 중... ${bgProgress}%` : 'AI 모델 로딩 중...')}
              {step === 'analyzing' && '옷 종류 분류 중...'}
              {step === 'analyzing_tag' && '태그 정보 분석 중...'}
              {step === 'saving' && '저장 중...'}
            </span>
          </div>
          {step === 'removing' && (
            <div style={{ width: '80%', height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(5, bgProgress)}%`, height: '100%', background: 'var(--primary)', borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
          )}
        </div>
      )}

      {/* ── 편집 ── */}
      {step === 'editing' && removedUrl && (
        <div className="editing-step">
          <p className="editing-intro">
            누끼 결과를 확인하고 <strong>지우거나 복원</strong>해 보세요.<br />
            만족스러우면 바로 다음으로 넘어가도 됩니다.
          </p>
          <ImageEditor removedUrl={removedUrl} onConfirm={handleEditConfirm} onCancel={reset} />
          <button className="btn secondary skip-btn" onClick={handleSkipEdit}>편집 없이 다음 단계로 →</button>
        </div>
      )}

      {/* ── 미리보기 / 정보 확인 ── */}
      {step === 'preview' && analysis && (
        <div className="preview-card">
          <div className="preview-img-container">
            {removedUrl ? (
              <img src={removedUrl} alt="item" className="preview-img" />
            ) : (
              <div className="empty-img-placeholder">
                <CameraIcon size={40} />
                <p>옷 이미지가 없습니다</p>
                <label className="btn primary" htmlFor="manual-img-upload">사진 추가하기</label>
                <input id="manual-img-upload" type="file" accept="image/*" onChange={handleManualImageChange} style={{ display: 'none' }} />
              </div>
            )}
          </div>
          <div className="analysis-result">
            <div className="analysis-row">
              <span className="label">브랜드</span>
              <input className="analysis-input" value={analysis.brand || ''} placeholder="브랜드명"
                onChange={(e) => setAnalysis({ ...analysis, brand: e.target.value })} />
            </div>
            <div className="analysis-row">
              <span className="label">상품/품번</span>
              <input className="analysis-input" value={analysis.name} placeholder="상품명 또는 품번"
                onChange={(e) => setAnalysis({ ...analysis, name: e.target.value })} />
            </div>
            <div className="analysis-row">
              <span className="label">카테고리</span>
              <div className="category-pills">
                {CATEGORY_LABELS.map((cat) => (
                  <button key={cat} className={`pill ${analysis.category === cat ? 'active' : ''}`}
                    onClick={() => setAnalysis({ ...analysis, category: cat })}>{cat}</button>
                ))}
              </div>
            </div>
            <div className="analysis-row">
              <span className="label">색상</span>
              <input className="analysis-input" value={analysis.color} placeholder="색상"
                onChange={(e) => setAnalysis({ ...analysis, color: e.target.value })} />
            </div>
            <div className="analysis-row">
              <span className="label">태그</span>
              <input className="analysis-input" value={analysis.tags ? analysis.tags.join(', ') : ''} placeholder="쉼표로 구분"
                onChange={(e) => setAnalysis({ ...analysis, tags: e.target.value.split(',').map(t => t.trim()) })} />
            </div>
          </div>
          <div className="preview-actions">
            <button className="btn secondary" onClick={reset}>취소</button>
            <button className="btn primary" onClick={handleSave}>저장</button>
          </div>
        </div>
      )}

      {/* ── 완료 ── */}
      {step === 'done' && (
        <div className="done-state">
          <Check size={48} className="done-icon" />
          <p>저장되었습니다!</p>
        </div>
      )}

      {/* ── 오류 ── */}
      {step === 'error' && (
        <div className="error-state">
          <AlertCircle size={32} />
          <p>{error}</p>
          <button className="btn primary" onClick={reset}>다시 시도</button>
        </div>
      )}
    </div>
  );
}
