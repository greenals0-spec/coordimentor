import React, { useState } from 'react';
import { Camera, X, Calendar as CalendarIcon, UploadCloud, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { compressImage } from '../utils/storage';
import { Capacitor } from '@capacitor/core';

export default function OotdUploadModal({ outfit, onClose, onUploadComplete }) {
  const { user } = useAuth();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const compressed = await compressImage(file, 1200);
      setPhoto(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
    } finally {
      setLoading(false);
    }
  };

  // 네이티브 카메라 촬영 (@capacitor/camera)
  const handleNativeCamera = async () => {
    if (!Capacitor.isNativePlatform()) return;
    setLoading(true);
    setError('');
    try {
      const { Camera: CapCamera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(file, 1200);
      setPhoto(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch (e) {
      if (!e.message?.includes('cancel')) {
        setError('카메라를 열 수 없습니다. 권한을 확인해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    // 타임아웃 처리를 위한 프로미스
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 네트워크를 확인해주세요.')), 25000)
    );

    try {
      const savePromise = (async () => {
        let photoUrl = null;

        // 1. Upload photo if exists
        if (photo) {
          const ext = photo.type === 'image/webp' ? 'webp' : 'jpg';
          const storageRef = ref(storage, `users/${user.uid}/ootd/${date}_${Date.now()}.${ext}`);
          const snapshot = await uploadBytes(storageRef, photo, { contentType: photo.type, cacheControl: 'public, max-age=31536000' });
          photoUrl = await getDownloadURL(snapshot.ref);
        }

        // 2. Save to Firestore (데이터 정규화: 객체/배열 모두 대응)
        const ootdRef = doc(db, 'users', user.uid, 'ootd_logs', date);
        
        let outfitData = [];
        if (outfit.items) {
          if (Array.isArray(outfit.items)) {
            outfitData = outfit.items.map(item => ({
              id: item?.id || '',
              name: item?.name || '',
              imageUrl: item?.imageUrl || '',
              category: item?.category || ''
            }));
          } else {
            // 객체인 경우 (카테고리별 아이템)
            outfitData = Object.values(outfit.items)
              .filter(item => item !== null)
              .map(item => ({
                id: item.id || '',
                name: item.name || '',
                imageUrl: item.imageUrl || '',
                category: item.category || ''
              }));
          }
        }

        console.log('Saving OOTD with data:', { date, photoUrl, itemsCount: outfitData.length });

        await setDoc(ootdRef, {
          date,
          outfit: outfitData,
          outfitTitle: outfit.title || outfit.tpoInfo?.event || '나의 코디',
          photoUrl,
          timestamp: Date.now(),
        }, { merge: true });

        return true;
      })();

      // 타임아웃과 저장 로직 중 먼저 끝나는 쪽 처리
      await Promise.race([savePromise, timeoutPromise]);

      alert('성공적으로 기록되었습니다!');
      if (onUploadComplete) onUploadComplete();
      onClose();
    } catch (err) {
      console.error('OOTD 저장 상세 오류:', err);
      setError(err.message || '저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>OOTD 기록하기</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-muted)' }}>
            이 코디를 언제 입으셨나요? 인증 사진이 있다면 함께 올려주세요.
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
              <CalendarIcon size={16} /> 날짜 선택
            </label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '16px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
              <Camera size={16} /> 인증 사진 (선택)
            </label>
            
            {preview ? (
              <div style={{ position: 'relative', width: '100%', height: '240px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={preview} alt="미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button 
                  onClick={() => { setPhoto(null); setPreview(null); }}
                  style={{ position: 'absolute', top: '10px', right: '10px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                {/* 사진 촬영: 네이티브는 @capacitor/camera, 웹은 capture="environment" */}
                {Capacitor.isNativePlatform() ? (
                  <button
                    type="button"
                    onClick={handleNativeCamera}
                    style={{ flex: 1, height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface-2)', cursor: 'pointer', gap: '8px' }}
                  >
                    <Camera size={24} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>사진 촬영</span>
                  </button>
                ) : (
                  <label style={{ flex: 1, height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface-2)', cursor: 'pointer', gap: '8px' }}>
                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                    <Camera size={24} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>사진 촬영</span>
                  </label>
                )}

                <label style={{ flex: 1, height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface-2)', cursor: 'pointer', gap: '8px' }}>
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                  <UploadCloud size={24} color="var(--text-muted)" />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>앨범 선택</span>
                </label>
              </div>
            )}
          </div>

          {/* 코디 미리보기 추가 */}
          <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--surface-2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--primary)' }}>
              <UploadCloud size={14} /> 기록될 코디 정보
            </label>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {(Array.isArray(outfit.items) ? outfit.items : Object.values(outfit.items || {})).filter(Boolean).map((item, i) => (
                <div key={i} style={{ flexShrink: 0, width: '50px', height: '50px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', background: 'white' }}>
                  <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {outfit.title || outfit.tpoInfo?.event || '나의 코디'}
            </p>
          </div>

          {error && <p style={{ color: 'red', fontSize: '13px', marginTop: '10px' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
          <button 
            onClick={onClose}
            style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600 }}
          >
            취소
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            {loading ? <Loader size={18} className="spin" /> : '기록 저장'}
          </button>
        </div>

      </div>
    </div>
  );
}
