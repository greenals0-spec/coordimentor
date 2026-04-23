import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader, Check, AlertCircle, X } from 'lucide-react';
import { removeBackground, analyzeClothing } from '../utils/api';
import { uploadImage, saveItem } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_LABELS = ['아우터', '상의', '하의', '신발', '액세서리'];

export default function UploadPage({ onSaved }) {
  const { user } = useAuth();
  const [step, setStep] = useState('idle');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [removedUrl, setRemovedUrl] = useState(null);
  const [removedBlob, setRemovedBlob] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);

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

  const openCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } },
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
      setError('카메라 접근 권한이 필요해요. 브라우저 주소창 옆 자물쇠 아이콘에서 허용해주세요.');
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
      processFile(file);
    }, 'image/jpeg', 0.92);
  };

  const closeCamera = () => { stopCamera(); setCameraOpen(false); };

  const reset = () => {
    setStep('idle');
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
    setPreview(URL.createObjectURL(file));
    setStep('removing');
    try {
      const bgRemovedUrl = await removeBackground(file);
      setRemovedUrl(bgRemovedUrl);
      const resp = await fetch(bgRemovedUrl);
      const blob = await resp.blob();
      setRemovedBlob(blob);
      setStep('analyzing');
      const dataUrl = await blobToDataUrl(blob);
      const result = await analyzeClothing(dataUrl);
      setAnalysis(result);
      setStep('preview');
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  };

  const handleFileChange = (e) => {
    processFile(e.target.files[0]);
    e.target.value = '';
  };

  const handleSave = async () => {
    setStep('saving');
    try {
      const { url, path } = await uploadImage(user.uid, removedBlob);
      await saveItem(user.uid, {
        imageUrl: url,
        imagePath: path,
        category: analysis.category,
        color: analysis.color,
        tags: analysis.tags,
        name: analysis.name,
      });
      setStep('done');
      setTimeout(() => { reset(); onSaved?.(); }, 1200);
    } catch (e) {
      console.error('저장 오류:', e);
      setError(e.message || e.code || '저장 중 오류가 발생했어요.');
      setStep('error');
    }
  };

  if (cameraOpen) {
    return (
      <div className="camera-overlay">
        <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
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

      {step === 'idle' && (
        <div className="upload-actions">
          <button className="upload-btn primary" onClick={openCamera}>
            <Camera size={28} />
            <span>사진 촬영</span>
          </button>
          <label className="upload-btn secondary" htmlFor="file-input">
            <Upload size={28} />
            <span>앨범에서 선택</span>
          </label>
          <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          {error && <p className="error-msg">{error}</p>}
        </div>
      )}

      {(step === 'removing' || step === 'analyzing' || step === 'saving') && (
        <div className="processing">
          {preview && <img src={preview} alt="preview" className="processing-img" />}
          <div className="processing-status">
            <Loader size={24} className="spin" />
            <span>
              {step === 'removing' && '배경 제거 중...'}
              {step === 'analyzing' && 'AI 분류 중...'}
              {step === 'saving' && '저장 중...'}
            </span>
          </div>
        </div>
      )}

      {step === 'preview' && analysis && (
        <div className="preview-card">
          <img src={removedUrl} alt="removed bg" className="preview-img" />
          <div className="analysis-result">
            <div className="analysis-row">
              <span className="label">이름</span>
              <input className="analysis-input" value={analysis.name}
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
              <input className="analysis-input" value={analysis.color}
                onChange={(e) => setAnalysis({ ...analysis, color: e.target.value })} />
            </div>
            <div className="analysis-row">
              <span className="label">태그</span>
              <span className="tags">{analysis.tags?.join(', ')}</span>
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
