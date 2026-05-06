import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import FlatLay from './FlatLay';
import { Share2, Download, X, Loader } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { CapacitorHttp, Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export default function CalendarView() {
  const { user } = useAuth();
  const [logs, setLogs] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // 공유/저장 상태
  const [sharingDate, setSharingDate] = useState(null);  // 공유 중인 날짜
  const [savingDate, setSavingDate] = useState(null);    // 저장 중인 날짜
  const [shareOptionModalOpen, setShareOptionModalOpen] = useState(false);
  const [saveOptionModalOpen, setSaveOptionModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users', user.uid, 'ootd_logs'));
        const snapshot = await getDocs(q);
        const logData = {};
        snapshot.forEach(doc => {
          logData[doc.id] = doc.data();
        });
        setLogs(logData);
      } catch (e) {
        console.error('Failed to fetch calendar logs:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [user]);

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const formattedDate = format(date, 'yyyy-MM-dd');
      if (logs[formattedDate]) {
        const log = logs[formattedDate];
        return (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2px' }}>
            <div style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              background: log.photoUrl ? 'var(--primary)' : 'var(--text-muted)' 
            }} />
          </div>
        );
      }
    }
    return null;
  };

  const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');
  const activeLog = logs[formattedSelectedDate];

  // ── 이미지 다운로드 헬퍼 ──────────────────────────────────

  // URL → Blob (네이티브: CapacitorHttp로 CORS 우회 / 웹: fetch)
  const fetchImageBlob = async (url) => {
    if (!url) return null;
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await Promise.race([
          CapacitorHttp.get({ url, responseType: 'blob' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
        ]);
        if (!res || res.status !== 200 || !res.data) return null;
        const ct = (res.headers?.['content-type'] || 'image/jpeg').split(';')[0];
        const d = res.data;
        if (typeof d === 'string' && d.length > 0) {
          const bytes = Uint8Array.from(atob(d), c => c.charCodeAt(0));
          return new Blob([bytes], { type: ct });
        }
        if (d instanceof Blob) return d;
        if (d instanceof ArrayBuffer) return new Blob([d], { type: ct });
        return null;
      } else {
        // 웹: CORS 우회를 위해 weserv.nl 프록시 사용
        const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=png`;
        try {
          const res = await Promise.race([
            fetch(proxyUrl),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
          ]);
          if (res.ok) return await res.blob();
        } catch {}
        // 프록시 실패시 직접 시도
        try {
          const res = await Promise.race([
            fetch(url, { mode: 'cors' }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
          ]);
          return res.ok ? await res.blob() : null;
        } catch { return null; }
      }
    } catch { return null; }
  };

  // Blob → base64 문자열 (data: prefix 없음)
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // URL → data URL (html-to-image 캡처용 img src 교체에 사용)
  const imgToDataUrl = async (url) => {
    const blob = await fetchImageBlob(url);
    if (!blob) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  };

  // Blob을 저장/공유 (네이티브: Filesystem + Share / 웹: navigator.share or <a download>)
  const shareOrDownload = async (blob, filename) => {
    if (Capacitor.isNativePlatform()) {
      // 1) cache에 저장
      const base64 = await blobToBase64(blob);
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      // 2) 네이티브 공유 시트 (갤러리 저장 등 선택 가능)
      await Share.share({ files: [saved.uri], title: 'Coordimentor OOTD' });
    } else {
      // 웹: Web Share API → <a download> fallback
      if (navigator.share) {
        try {
          const file = new File([blob], filename, { type: blob.type });
          await navigator.share({ files: [file], title: 'Coordimentor OOTD' });
          return;
        } catch (e) { if (e.name === 'AbortError') return; }
      }
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    }
  };

  const prepareShareImage = async (fmt) => {
    if (sharingDate || !activeLog) return;
    setShareOptionModalOpen(false);
    setSharingDate(formattedSelectedDate);

    // ── 내 사진만 ───────────────────────────────────────────
    if (fmt === 'photo') {
      try {
        if (!activeLog.photoUrl) throw new Error('저장된 사진이 없습니다.');
        const blob = await fetchImageBlob(activeLog.photoUrl);
        if (!blob) throw new Error('이미지를 가져올 수 없습니다.');
        await shareOrDownload(blob, `photo-${formattedSelectedDate}.jpg`);
      } catch (e) {
        if (e.name !== 'AbortError') alert('사진 저장 실패: ' + e.message);
      } finally {
        setSharingDate(null);
      }
      return;
    }

    // ── 인스타그램/세로 레이아웃 캡처 ───────────────────────
    const targetEl = document.getElementById(`ootd-share-capture-${fmt}-${formattedSelectedDate}`);
    const images = targetEl ? Array.from(targetEl.getElementsByTagName('img')) : [];
    const origSrcs = images.map(img => img.src);

    try {
      if (!targetEl) throw new Error('캡처 대상을 찾을 수 없습니다.');

      await Promise.allSettled(
        images.map(async (img) => {
          if (!img.src || img.src.startsWith('data:')) return;
          const d = await imgToDataUrl(img.src);
          if (d) img.src = d;
        })
      );

      await new Promise(r => setTimeout(r, 400));

      const captureBlob = await Promise.race([
        toBlob(targetEl, { backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('캡처 시간 초과')), 20000)),
      ]);

      images.forEach((img, i) => { img.src = origSrcs[i]; });

      if (!captureBlob) throw new Error('이미지 생성 실패');
      await shareOrDownload(captureBlob, `coordimentor-ootd-${fmt}-${formattedSelectedDate}.png`);

    } catch (e) {
      images.forEach((img, i) => { try { img.src = origSrcs[i]; } catch {} });
      if (e.name !== 'AbortError') alert('저장 실패: ' + e.message);
    } finally {
      setSharingDate(null);
    }
  };

  // 기기에 직접 저장 (Filesystem.Documents → 파일 앱에서 확인 가능 / 웹: <a download>)
  const saveToDevice = async (blob, filename) => {
    if (Capacitor.isNativePlatform()) {
      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      alert('저장 완료! 📁\n파일 앱 > 내 파일에서 확인하세요.');
    } else {
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    }
  };

  const prepareSaveImage = async (fmt) => {
    if (savingDate || !activeLog) return;
    setSaveOptionModalOpen(false);
    setSavingDate(formattedSelectedDate);

    if (fmt === 'photo') {
      try {
        if (!activeLog.photoUrl) throw new Error('저장된 사진이 없습니다.');
        const blob = await fetchImageBlob(activeLog.photoUrl);
        if (!blob) throw new Error('이미지를 가져올 수 없습니다.');
        await saveToDevice(blob, `photo-${formattedSelectedDate}.jpg`);
      } catch (e) {
        if (e.name !== 'AbortError') alert('저장 실패: ' + e.message);
      } finally {
        setSavingDate(null);
      }
      return;
    }

    const targetEl = document.getElementById(`ootd-share-capture-${fmt}-${formattedSelectedDate}`);
    const images = targetEl ? Array.from(targetEl.getElementsByTagName('img')) : [];
    const origSrcs = images.map(img => img.src);

    try {
      if (!targetEl) throw new Error('캡처 대상을 찾을 수 없습니다.');
      await Promise.allSettled(
        images.map(async (img) => {
          if (!img.src || img.src.startsWith('data:')) return;
          const d = await imgToDataUrl(img.src);
          if (d) img.src = d;
        })
      );
      await new Promise(r => setTimeout(r, 400));
      const captureBlob = await Promise.race([
        toBlob(targetEl, { backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('캡처 시간 초과')), 20000)),
      ]);
      images.forEach((img, i) => { img.src = origSrcs[i]; });
      if (!captureBlob) throw new Error('이미지 생성 실패');
      await saveToDevice(captureBlob, `coordimentor-ootd-${fmt}-${formattedSelectedDate}.png`);
    } catch (e) {
      images.forEach((img, i) => { try { img.src = origSrcs[i]; } catch {} });
      if (e.name !== 'AbortError') alert('저장 실패: ' + e.message);
    } finally {
      setSavingDate(null);
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', paddingBottom: '100px', overflowY: 'auto' }}>
      
      <style>{`
        .react-calendar {
          width: 100%;
          border: none;
          background: var(--surface);
          border-radius: 12px;
          padding: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          font-family: inherit;
        }
        .react-calendar__navigation button {
          color: var(--text);
          font-weight: 600;
          font-size: 16px;
        }
        .react-calendar__navigation button:enabled:hover, .react-calendar__navigation button:enabled:focus {
          background-color: var(--surface-2);
        }
        .react-calendar__month-view__weekdays {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .react-calendar__month-view__days__day {
          color: var(--text);
        }
        .react-calendar__month-view__days__day--weekend {
          color: #d32f2f;
        }
        .react-calendar__month-view__days__day--neighboringMonth {
          color: var(--border) !important;
        }
        .react-calendar__tile--active {
          background: var(--primary) !important;
          color: white !important;
          border-radius: 8px;
        }
        .react-calendar__tile--now {
          background: var(--surface-2);
          border-radius: 8px;
        }
        .react-calendar__tile {
          padding: 10px 6px;
          height: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
        }
      `}</style>

      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px', color: 'var(--text)' }}>
        OOTD 캘린더
      </h2>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="loader spin" style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} />
        </div>
      ) : (
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          tileContent={tileContent}
          formatDay={(locale, date) => format(date, 'd')}
          next2Label={null}
          prev2Label={null}
        />
      )}

      {/* Selected Date Info */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
            {format(selectedDate, 'M월 d일')} 기록
          </h3>
          {activeLog && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {/* 공유 버튼 */}
              <button
                onClick={() => setShareOptionModalOpen(true)}
                disabled={!!sharingDate || !!savingDate}
                title="공유하기"
                style={{ background: 'var(--primary)', border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 13, fontWeight: 600 }}
              >
                {sharingDate === formattedSelectedDate
                  ? <Loader size={16} className="spin" />
                  : <Share2 size={16} />}
                공유
              </button>
              {/* 저장 버튼 */}
              <button
                onClick={() => setSaveOptionModalOpen(true)}
                disabled={!!sharingDate || !!savingDate}
                title="저장하기"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontSize: 13, fontWeight: 600 }}
              >
                {savingDate === formattedSelectedDate
                  ? <Loader size={16} className="spin" />
                  : <Download size={16} />}
                저장
              </button>
            </div>
          )}
        </div>

        {!activeLog ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '30px 0', background: 'var(--surface-2)', borderRadius: '12px' }}>
            이날 기록된 코디가 없습니다.
          </p>
        ) : (
          <div 
            id={`ootd-capture-${formattedSelectedDate}`}
            style={{ background: 'var(--surface)', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          >
            {activeLog.photoUrl && (
              <div style={{ marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', height: '300px' }}>
                <img src={activeLog.photoUrl} alt="OOTD" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            
            <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{activeLog.outfitTitle}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>{format(selectedDate, 'M월 d일')}</span>
            </h4>
            
            <div style={{ background: 'var(--surface-2)', borderRadius: '12px', padding: '16px' }}>
              <FlatLay items={activeLog.outfit} showWatermark={sharingDate === formattedSelectedDate} />
            </div>
            
          </div>
        )}
      </div>

      {/* ── Hidden Share Image Containers ── */}
      <div style={{ position: 'fixed', left: 0, top: 0, zIndex: -9999, opacity: 0, pointerEvents: 'none' }}>
        {activeLog && (
          <>
            {/* 1. Split Layout (Instagram - 1080x1080) */}
            <div 
              id={`ootd-share-capture-split-${formattedSelectedDate}`}
              style={{ 
                width: '1080px', 
                height: '1080px', 
                background: '#ffffff', 
                display: 'flex', 
                flexDirection: 'row',
                fontFamily: 'sans-serif'
              }}
            >
              {/* Left: Photo */}
              <div style={{ flex: 1, background: '#f5f5f5', overflow: 'hidden' }}>
                {activeLog.photoUrl ? (
                  <img src={activeLog.photoUrl} alt="OOTD" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>No Photo</div>
                )}
              </div>
              {/* Right: Outfit Info */}
              <div style={{ flex: 1, padding: '60px 40px', display: 'flex', flexDirection: 'column', background: '#ffffff', overflow: 'hidden' }}>
                {/* Brand Header */}
                <div style={{ 
                  marginBottom: '40px', 
                  textAlign: 'center',
                  flexShrink: 0
                }}>
                  <div style={{ 
                    fontFamily: "'Cormorant Garamond', serif", 
                    fontStyle: 'italic', 
                    fontSize: '28px', 
                    color: '#635d54',
                    letterSpacing: '0.05em'
                  }}>
                    Coordimentor
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.2em', 
                    color: '#999', 
                    marginTop: '4px' 
                  }}>
                    Personal Styling Mentor
                  </div>
                  
                  <div style={{ 
                    marginTop: '20px',
                    fontSize: '18px', 
                    color: '#888', 
                    fontWeight: 500,
                    letterSpacing: '0.02em'
                  }}>
                    {format(selectedDate, 'yyyy. MM. dd.')}
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                  {/* 아이템 개수에 따라 동적 스케일 조절 (잘림 방지) */}
                  {(() => {
                    const itemsCount = Object.values(activeLog.outfit).filter(v => !!v).length;
                    const dynamicScale = Math.max(0.45, Math.min(0.85, 0.85 - (Math.max(0, itemsCount - 4) * 0.08)));
                    return <FlatLay items={activeLog.outfit} noBorder={true} showWatermark={false} scale={dynamicScale} />;
                  })()}
                </div>
              </div>
            </div>

            {/* 2. Vertical Layout (Long) */}
            <div 
              id={`ootd-share-capture-vertical-${formattedSelectedDate}`}
              style={{ 
                width: '1080px', 
                background: '#ffffff', 
                display: 'flex', 
                flexDirection: 'column',
                fontFamily: 'sans-serif'
              }}
            >
              <div style={{ padding: '60px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                  <h2 style={{ fontSize: '56px', fontWeight: 700, margin: 0, color: '#222' }}>나의 코디</h2>
                  <span style={{ fontSize: '36px', color: '#888', fontWeight: 500 }}>{format(selectedDate, 'yyyy. MM. dd.')}</span>
                </div>
                
                {activeLog.photoUrl && (
                  <div style={{ width: '100%', borderRadius: '24px', overflow: 'hidden', marginBottom: '60px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                    <img src={activeLog.photoUrl} alt="OOTD" style={{ width: '100%', display: 'block' }} crossOrigin="anonymous" />
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <FlatLay items={activeLog.outfit} noBorder={true} showWatermark={false} />
                </div>

                {/* Brand Watermark Footer */}
                <div style={{ 
                  marginTop: '60px', 
                  paddingTop: '30px', 
                  borderTop: '1px solid #eee', 
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    fontFamily: "'Cormorant Garamond', serif", 
                    fontStyle: 'italic', 
                    fontSize: '28px', 
                    color: '#635d54',
                    letterSpacing: '0.05em'
                  }}>
                    Coordimentor
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.2em', 
                    color: '#999', 
                    marginTop: '6px' 
                  }}>
                    Personal Styling Mentor
                  </div>
                </div>
              </div>
            </div>


          </>
        )}
      </div>

      {/* ── 공유 옵션 모달 ── */}
      {shareOptionModalOpen && (
        <div onClick={() => setShareOptionModalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 16px 16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>공유하기</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 4 }}>SNS나 메신저로 공유할 형식을 선택하세요</div>
            </div>
            <button onClick={() => prepareShareImage('split')} style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: '22px' }}>📱</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>인스타그램 분할형</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>사진 + 코디 좌우 배치 (1:1)</div>
              </div>
            </button>
            <button onClick={() => prepareShareImage('vertical')} style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: '22px' }}>↕️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>세로형 전체</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>사진 + 코디 세로 배치</div>
              </div>
            </button>
            {activeLog?.photoUrl && (
              <button onClick={() => prepareShareImage('photo')} style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: '22px' }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>내 사진만</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>착장 사진만 공유</div>
                </div>
              </button>
            )}
            <button onClick={() => setShareOptionModalOpen(false)} style={{ marginTop: '4px', padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* ── 저장 옵션 모달 ── */}
      {saveOptionModalOpen && (
        <div onClick={() => setSaveOptionModalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 16px 16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>저장하기</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 4 }}>기기 파일 앱에 저장할 형식을 선택하세요</div>
            </div>
            <button onClick={() => prepareSaveImage('split')} style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: '22px' }}>📱</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>인스타그램 분할형</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>사진 + 코디 좌우 배치 (1:1)</div>
              </div>
            </button>
            <button onClick={() => prepareSaveImage('vertical')} style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: '22px' }}>↕️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>세로형 전체</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>사진 + 코디 세로 배치</div>
              </div>
            </button>
            {activeLog?.photoUrl && (
              <button onClick={() => prepareSaveImage('photo')} style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: '22px' }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>내 사진만</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>착장 사진만 저장</div>
                </div>
              </button>
            )}
            <button onClick={() => setSaveOptionModalOpen(false)} style={{ marginTop: '4px', padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
              취소
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
