import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader, Check, AlertCircle, X, Camera as CameraIcon } from 'lucide-react';
import { removeBackground, analyzeClothing, analyzeTag } from '../utils/api';
import { uploadImage, saveItem } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import ImageEditor from '../components/ImageEditor';
import CameraTutorial from '../components/CameraTutorial';

const CATEGORY_LABELS = ['아우터', '상의', '하의', '신발', '액세서리'];

export default function UploadPage({ onSaved, onCameraOpen, onCameraClose }) {
  const { user } = useAuth();
  const [step, setStep] = useState('method_clothes');
  // steps: idle -> method_select -> camera -> removing/analyzing_tag -> editing -> analyzing_clothes -> preview -> saving -> done -> error
  const [uploadMethod, setUploadMethod] = useState('clothes'); // 'tag', 'clothes', 'manual'
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [removedUrl, setRemovedUrl] = useState(null);
  const [removedBlob, setRemovedBlob] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stopCamera(), []);

  const openCamera = async (method) => {
    setUploadMethod(method);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setError('카메라 권한이 필요합니다. 앱 설정에서 카메라 권한을 허용해주세요.');
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      stopCamera();
      setCameraOpen(false);
      
      if (uploadMethod === 'tag') {
        processTagFile(file);
      } else {
        processFile(file);
      }
    }, 'image/jpeg', 0.92);
  };

  const closeCamera = () => { stopCamera(); setCameraOpen(false); onCameraClose?.(); };

  const reset = () => {
    setStep('method_clothes');
    setUploadMethod('clothes');
    setError('');
    setPreview(null);
    setRemovedUrl(null);
    setRemovedBlob(null);
    setAnalysis(null);
  };

  const blobToDataUrl = (blob) =>
    new Promise((res) => {
      const reader = new FileReader();
      reader.onload = (e) => res(e.target.result);
      reader.readAsDataURL(blob);
    });

  const processFile = async (file) => {
    if (!file) return;
    setError('');
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setStep('removing');
    setBgProgress(0);
    try {
      const bgRemovedUrl = await removeBackground(file, (pct, key) => {
        if (key && key.includes('fetch')) setBgProgress(Math.min(pct, 80));
        else setBgProgress(pct);
      });
      setRemovedUrl(bgRemovedUrl);
      let blob;
      if (bgRemovedUrl.startsWith('data:')) {
        const arr = bgRemovedUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        const resp = await fetch(bgRemovedUrl);
        blob = await resp.blob();
      }
      setRemovedBlob(blob);
      setStep('editing');
    } catch (e) {
      // 배경 제거 실패 시 원본으로 편집 단계 진행
      console.warn('배경 제거 실패, 원본 사용:', e.message);
      setRemovedUrl(objectUrl);
      setRemovedBlob(file);
      setStep('editing');
    }
  };

  const processTagFile = async (file) => {
    if (!file) return;
    setError('');
    setPreview(URL.createObjectURL(file));
    setStep('analyzing_tag');
    try {
      const dataUrl = await blobToDataUrl(file);
      const result = await analyzeTag(dataUrl);
      setAnalysis({
        name: result.name || '',
        category: result.category || '상의',
        color: result.color || '',
        tags: result.tags || [],
        brand: result.brand || '',
      });
      setStep('preview');
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  };

  const handleEditConfirm = async (editedBlob) => {
    setRemovedBlob(editedBlob);
    const editedUrl = URL.createObjectURL(editedBlob);
    setRemovedUrl(editedUrl);
    setStep('analyzing');
    try {
      const dataUrl = await blobToDataUrl(editedBlob);
      const result = await analyzeClothing(dataUrl);
      setAnalysis(result);
      setStep('preview');
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  };

  const handleSkipEdit = async () => {
    setStep('analyzing');
    try {
      const dataUrl = await blobToDataUrl(removedBlob);
      const result = await analyzeClothing(dataUrl);
      setAnalysis(result);
      setStep('preview');
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (uploadMethod === 'tag') {
      processTagFile(file);
    } else {
      processFile(file);
    }
    e.target.value = '';
  };

  const addWatermarkToBlob = (blob) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Add Watermark
        const fontSize = Math.max(14, img.width * 0.03);
        ctx.font = `bold ${fontSize}px sans-serif`;
        const text = "Image from Google";
        const padding = fontSize * 0.5;
        const textWidth = ctx.measureText(text).width;
        
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(
          img.width - textWidth - padding * 2, 
          img.height - fontSize - padding * 2, 
          textWidth + padding * 2, 
          fontSize + padding * 2
        );

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(text, img.width - padding, img.height - padding);

        canvas.toBlob((watermarkedBlob) => {
          resolve(watermarkedBlob);
        }, blob.type || 'image/jpeg', 0.95);
      };
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = URL.createObjectURL(blob);
    });
  };

  const handlePasteImage = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        throw new Error("이 브라우저에서는 클립보드 이미지 읽기를 지원하지 않습니다.");
      }
      const items = await navigator.clipboard.read();
      let imageBlob = null;
      for (const item of items) {
        if (item.types.includes('image/png')) {
          imageBlob = await item.getType('image/png');
          break;
        } else if (item.types.includes('image/jpeg')) {
          imageBlob = await item.getType('image/jpeg');
          break;
        }
      }

      if (!imageBlob) {
        alert('클립보드에 복사된 이미지가 없습니다. 구글에서 이미지를 길게 눌러 복사해주세요.');
        return;
      }

      const watermarkedBlob = await addWatermarkToBlob(imageBlob);
      const url = URL.createObjectURL(watermarkedBlob);
      setRemovedUrl(url);
      setRemovedBlob(watermarkedBlob);
    } catch (e) {
      alert('이미지를 붙여넣지 못했습니다. 권한을 허용했는지 확인해주세요: ' + e.message);
    }
  };

  const handleManualImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setRemovedUrl(url);
      setRemovedBlob(file);
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    setStep('saving');
    try {
      let url = '', path = '';
      if (removedBlob) {
        const result = await uploadImage(user.uid, removedBlob);
        url = result.url;
        path = result.path;
      }
      
      await saveItem(user.uid, {
        imageUrl: url,
        imagePath: path,
        category: analysis?.category || '상의',
        color: analysis?.color || '',
        tags: analysis?.tags || [],
        name: analysis?.name || '',
        brand: analysis?.brand || '',
      });
      setStep('done');
      setTimeout(() => { reset(); onSaved?.(); }, 1200);
    } catch (e) {
      console.error('저장 오류:', e);
      setError(e.message || e.code || '저장 중 오류가 발생했어요.');
      setStep('error');
    }
  };

  if (showTutorial) {
    return (
      <CameraTutorial
        onConfirm={() => { setShowTutorial(false); openCamera('clothes'); }}
        onClose={() => { setShowTutorial(false); onCameraClose?.(); }}
      />
    );
  }

  if (cameraOpen) {
    return (
      <div className="camera-overlay">
        <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* 카메라 가이드 오버레이 */}
        <div className="camera-guide-box">
          <div className="guide-corner top-left"></div>
          <div className="guide-corner top-right"></div>
          <div className="guide-corner bottom-left"></div>
          <div className="guide-corner bottom-right"></div>
          <p className="guide-text">
            {uploadMethod === 'tag' 
              ? '텍스트가 선명하게 보이도록 찍어주세요' 
              : '옷을 사각형 테두리에 꽉 차게 맞춰주세요'}
          </p>
        </div>

        <div className="camera-controls">
          <button className="camera-close" onClick={closeCamera}><X size={24} /></button>
          <button className="camera-shutter" onClick={takePhoto} />
        </div>
      </div>
    );
  }

  return (
    <div className="page upload-page">
      <h2 className="page-title">옷 추가</h2>

      {/* Tag Scan feature is hidden for now */}
      {(step === 'method_clothes') && (
        <div className="upload-methods">
          <p className="method-instruction">
            새로운 옷을 추가할 방법을 선택해주세요.
          </p>
          
          <div className="method-card" onClick={() => { onCameraOpen?.(); setShowTutorial(true); }}>
            <div className="icon-circle">
              <Camera size={24} />
            </div>
            <div className="method-card-text">
              <h3>직접 촬영하기</h3>
              <p>옷을 평평한 곳에 두고 촬영하면 AI가 자동으로 배경을 지워줍니다.</p>
            </div>
          </div>

          <label className="method-card" htmlFor="file-input">
            <div className="icon-circle">
              <Upload size={24} />
            </div>
            <div className="method-card-text">
              <h3>앨범에서 가져오기</h3>
              <p>미리 찍어둔 옷 사진을 선택하여 분석을 시작합니다.</p>
            </div>
          </label>
          <input id="file-input" type="file" accept="image/*" onChange={(e) => {
            setUploadMethod('clothes');
            handleFileChange(e);
          }} style={{ display: 'none' }} />

          {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {(step === 'removing' || step === 'analyzing' || step === 'analyzing_tag' || step === 'saving') && (
        <div className="processing">
          {preview && <img src={preview} alt="preview" className="processing-img" />}
          <div className="processing-status">
            <Loader size={24} className="spin" />
            <span>
              {step === 'removing' && (
                bgProgress > 0 
                  ? `분석 중... ${bgProgress}%` 
                  : 'AI 모델 로딩 중... (처음엔 30초 정도 소요됩니다)'
              )}
              {step === 'analyzing' && '옷 종류 분류 중...'}
              {step === 'analyzing_tag' && '태그 정보 분석 중...'}
              {step === 'saving' && '저장 중...'}
            </span>
          </div>
          {step === 'removing' && (
            <div style={{ width: '80%', height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ 
                width: `${Math.max(5, bgProgress)}%`, 
                height: '100%', 
                background: 'var(--primary)', 
                borderRadius: 3, 
                transition: 'width 0.5s ease-out' 
              }} />
            </div>
          )}
        </div>
      )}

      {/* ── New: Editing step ── */}
      {step === 'editing' && removedUrl && (
        <div className="editing-step">
          <p className="editing-intro">
            누끼 결과를 확인하고 <strong>지우거나 복원</strong>해 보세요.<br />
            만족스러우면 바로 다음으로 넘어가도 됩니다.
          </p>
          <ImageEditor
            removedUrl={removedUrl}
            onConfirm={handleEditConfirm}
            onCancel={reset}
          />
          <button
            className="btn secondary skip-btn"
            onClick={handleSkipEdit}
          >
            편집 없이 다음 단계로 →
          </button>
        </div>
      )}

      {step === 'preview' && analysis && (
        <div className="preview-card">
          <div className="preview-img-container">
            {removedUrl ? (
              <img src={removedUrl} alt="item" className="preview-img" />
            ) : (
              <div className="empty-img-placeholder">
                <CameraIcon size={40} />
                <p>옷 이미지가 없습니다</p>
                {uploadMethod === 'tag' && (
                  <div className="google-image-actions" style={{ width: '100%', marginBottom: '16px' }}>
                    <p style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4}}>
                      구글에서 이미지를 찾아<br/><strong>'이미지 복사'</strong> 후 붙여넣어보세요.
                    </p>
                    <button className="btn outline" style={{marginBottom: '8px', width: '100%'}} onClick={() => {
                      const query = encodeURIComponent(`${analysis?.brand || ''} ${analysis?.name || ''}`.trim());
                      window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank');
                    }}>
                      1. 구글 이미지 검색 (새 창)
                    </button>
                    <button className="btn outline" style={{marginBottom: '10px', width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)'}} onClick={handlePasteImage}>
                      2. 복사한 이미지 붙여넣기
                    </button>
                  </div>
                )}
                <label className="btn primary" htmlFor="manual-img-upload">
                  사진 추가하기
                </label>
                <input id="manual-img-upload" type="file" accept="image/*" onChange={handleManualImageChange} style={{display:'none'}} />
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

      {step === 'done' && (
        <div className="done-state">
          <Check size={48} className="done-icon" />
          <p>저장되었습니다!</p>
        </div>
      )}

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
