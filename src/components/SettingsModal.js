import React, { useState, useEffect } from 'react';
import { X, Sparkles, Clock, Plus, Trash2, Calendar, Tag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore'; // setDoc: routineAlarms 토글/삭제에 사용
import { db } from '../firebase';

// ── 이미지 압축 유틸 (Canvas 리사이즈 + JPEG 압축) ──
function compressImage(dataUrl, maxPx = 600, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// ── 루틴 알람 상수 ──
const DAYS = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
];

const SITUATIONS = [
  { key: '출근', emoji: '💼' },
  { key: '운동', emoji: '🏃' },
  { key: '등교', emoji: '📚' },
  { key: '데이트', emoji: '💑' },
  { key: '여행', emoji: '✈️' },
  { key: '등산', emoji: '🏔️' },
  { key: '모임', emoji: '🎉' },
  { key: '기타', emoji: '📌' },
];

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };

function formatDays(days) {
  if (!days || days.length === 0) return '';
  const ordered = DAY_ORDER.filter(d => days.includes(d));
  if (ordered.length === 7) return '매일';
  if (ordered.length === 5 && !ordered.includes('sat') && !ordered.includes('sun')) return '평일';
  if (ordered.length === 2 && ordered.includes('sat') && ordered.includes('sun')) return '주말';
  return ordered.map(d => DAY_LABELS[d]).join('·');
}

// ── 루틴 알람 추가 폼 (인라인) ──
function AddRoutineForm({ onSave, onCancel, userId }) {
  const [enabled, setEnabled] = useState(true);
  const [selectedDays, setSelectedDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [alarmTime, setAlarmTime] = useState('08:00');
  const [situation, setSituation] = useState('출근');
  const [saving, setSaving] = useState(false);

  const toggleDay = (key) => {
    setSelectedDays(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      alert('요일을 하나 이상 선택해주세요.');
      return;
    }
    setSaving(true);
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const existing = userSnap.data()?.routineAlarms || [];

      const newAlarm = {
        id: Date.now().toString(),
        enabled,
        days: selectedDays,
        time: alarmTime,
        situation,
        createdAt: new Date().toISOString(),
      };
      const updated = [...existing.filter(a => !(a.situation === situation && a.time === alarmTime)), newAlarm];
      await setDoc(userRef, { routineAlarms: updated }, { merge: true });
      onSave(updated);
    } catch (e) {
      console.error('루틴 알람 저장 오류:', e);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: '#FAFAF8', borderRadius: 16, border: '1px solid #E2DDD6',
      padding: '20px', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      {/* 요일 선택 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Calendar size={14} color="#8C877F" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#18160F' }}>반복 요일</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {DAYS.map(({ key, label }) => {
            const isSelected = selectedDays.includes(key);
            const isWeekend = key === 'sat' || key === 'sun';
            return (
              <button
                key={key}
                onClick={() => toggleDay(key)}
                style={{
                  flex: 1, height: 36, borderRadius: 9, border: 'none',
                  background: isSelected ? '#18160F' : '#F0EDE8',
                  color: isSelected ? '#fff' : isWeekend ? '#E07070' : '#6B6260',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
          {[
            { label: '평일', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
            { label: '주말', days: ['sat', 'sun'] },
            { label: '매일', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
          ].map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setSelectedDays(days)}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 7,
                border: '1px solid #E2DDD6', background: '#fff',
                fontSize: 10, color: '#8C877F', cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 시간 설정 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Clock size={14} color="#8C877F" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#18160F' }}>알람 시간</span>
        </div>
        <input
          type="time"
          value={alarmTime}
          onChange={e => setAlarmTime(e.target.value)}
          style={{
            width: '100%', padding: '10px 16px', borderRadius: 10,
            border: '1px solid #E2DDD6', fontSize: 20,
            fontFamily: "'DM Sans', sans-serif", textAlign: 'center',
            color: '#18160F', background: '#fff', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 상황 선택 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Tag size={14} color="#8C877F" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#18160F' }}>코디 컨셉</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
          {SITUATIONS.map(({ key, emoji }) => {
            const isSelected = situation === key;
            return (
              <button
                key={key}
                onClick={() => setSituation(key)}
                style={{
                  padding: '9px 4px', borderRadius: 11,
                  border: isSelected ? '2px solid #18160F' : '1.5px solid #E2DDD6',
                  background: isSelected ? '#18160F' : '#fff',
                  color: isSelected ? '#fff' : '#4B4744',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 18 }}>{emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 600 }}>{key}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 안내 메시지 */}
      <div style={{
        background: '#F0EDE8', borderRadius: 10, padding: '10px 12px',
        fontSize: 11, color: '#8C877F', lineHeight: 1.6,
      }}>
        📌 <strong style={{ color: '#4B4744' }}>{formatDays(selectedDays)}</strong> {alarmTime}에 그날 날씨를 반영한 <strong style={{ color: '#4B4744' }}>{situation}</strong> 코디 알림을 보내드려요.
      </div>

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '11px', borderRadius: 11,
            border: '1px solid #E2DDD6', background: '#fff',
            fontSize: 13, color: '#8C877F', cursor: 'pointer',
          }}
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 2, padding: '11px', borderRadius: 11, border: 'none',
            background: '#18160F', color: 'white',
            fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '저장 중...' : '알람 추가하기'}
        </button>
      </div>
    </div>
  );
}

// ── 메인 설정 모달 ──
export default function SettingsModal({ onClose }) {
  const { user, userProfile, updateUserProfile, signOut } = useAuth();

  const [modelPhoto, setModelPhoto] = useState(userProfile?.modelPhoto ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [routineAlarms, setRoutineAlarms] = useState([]);

  // 루틴 알람은 users/{uid} root 문서에 저장됨 — 마운트 시 직접 fetch
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setRoutineAlarms(snap.data()?.routineAlarms ?? []);
    }).catch(console.error);
  }, [user?.uid]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result, 600, 0.72);
        setModelPhoto(compressed);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // profile 서브컬렉션에만 저장 (base64 이미지는 root 문서 1MB 제한 초과 방지)
      await updateUserProfile(user.uid, { modelPhoto });
      onClose();
    } catch (e) {
      console.error('Failed to save settings:', e);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 루틴 알람 토글
  const handleToggleRoutine = async (alarmId) => {
    const updated = routineAlarms.map(a =>
      a.id === alarmId ? { ...a, enabled: !a.enabled } : a
    );
    setRoutineAlarms(updated);
    await setDoc(doc(db, 'users', user.uid), { routineAlarms: updated }, { merge: true });
  };

  // 루틴 알람 삭제
  const handleDeleteRoutine = async (alarmId) => {
    if (!window.confirm('이 루틴 알람을 삭제할까요?')) return;
    const updated = routineAlarms.filter(a => a.id !== alarmId);
    setRoutineAlarms(updated);
    await setDoc(doc(db, 'users', user.uid), { routineAlarms: updated }, { merge: true });
  };

  // 루틴 알람 추가 완료
  const handleRoutineSaved = (updated) => {
    setRoutineAlarms(updated);
    setShowAddRoutine(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 900, padding: '20px', paddingBottom: '100px' }}>
      <div className="edit-modal" style={{ maxWidth: 360, maxHeight: '72vh', display: 'flex', flexDirection: 'column', paddingBottom: 0 }}>
        <div className="edit-modal-header" style={{ padding: '10px 20px', flexShrink: 0 }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 22, margin: 0 }}>설정</h3>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="edit-modal-body" style={{ padding: '0 24px 8px', overflowY: 'auto', flex: 1 }}>

          {/* ── 나의 모델 등록 ── */}
          <div style={{ marginBottom: 12, marginTop: 0, padding: '14px 16px', background: '#FAFAF8', borderRadius: 16, border: '1px solid #F0EDE8', display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* 썸네일 */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 64, height: 80, borderRadius: 10, border: '2px dashed #E2DDD6', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {modelPhoto ? (
                  <img src={modelPhoto} alt="My Model" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Sparkles size={22} color="#D0CAC3" />
                )}
                {uploading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⌛</div>
                )}
              </div>
              {modelPhoto && (
                <button
                  onClick={() => setModelPhoto(null)}
                  style={{ position: 'absolute', top: -6, right: -6, background: '#18160F', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
            {/* 텍스트 + 업로드 버튼 */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#18160F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Sparkles size={12} />
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#18160F' }}>나의 모델 등록</p>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: '#B8AFA4' }}>가상 입어보기에 사용될 전신사진입니다.</p>
              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, background: '#18160F', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 500 }}>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                {modelPhoto ? '사진 변경' : '사진 업로드'}
              </label>
            </div>
          </div>

          {/* ── 루틴 코디 알람 ── */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#18160F' }}>
                  <Clock size={16} />
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#18160F' }}>루틴 코디 알람</p>
              </div>
              {!showAddRoutine && (
                <button
                  onClick={() => setShowAddRoutine(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: '#18160F', border: 'none', borderRadius: 20,
                    padding: '6px 12px', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600,
                  }}
                >
                  <Plus size={13} /> 추가
                </button>
              )}
            </div>

            {/* 등록된 루틴 알람 목록 */}
            {routineAlarms.length === 0 && !showAddRoutine ? (
              <div style={{ padding: '16px', background: '#FAFAF8', borderRadius: 12, border: '1px solid #F0EDE8', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#B8AFA4' }}>등록된 루틴 알람이 없어요</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#C8C0B8' }}>+ 추가 버튼을 눌러 만들어보세요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {routineAlarms.map((alarm) => {
                  const sit = SITUATIONS.find(s => s.key === alarm.situation);
                  return (
                    <div
                      key={alarm.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', background: '#FAFAF8', borderRadius: 12,
                        border: `1px solid ${alarm.enabled ? '#D8D4CE' : '#F0EDE8'}`,
                        opacity: alarm.enabled ? 1 : 0.55,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                          <span style={{ fontSize: 16 }}>{sit?.emoji}</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#18160F' }}>{alarm.time}</span>
                          <span style={{ fontSize: 11, color: '#8C877F', background: '#F0EDE8', padding: '2px 8px', borderRadius: 20 }}>{alarm.situation}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: '#B8AFA4' }}>{formatDays(alarm.days)}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* 토글 */}
                        <label style={{ position: 'relative', display: 'inline-block', width: 38, height: 20, flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            checked={alarm.enabled}
                            onChange={() => handleToggleRoutine(alarm.id)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{
                            position: 'absolute', cursor: 'pointer', inset: 0,
                            backgroundColor: alarm.enabled ? '#18160F' : '#E2DDD6',
                            transition: '0.3s', borderRadius: 20,
                          }}>
                            <span style={{
                              position: 'absolute', height: 14, width: 14,
                              left: alarm.enabled ? 20 : 3, bottom: 3,
                              backgroundColor: 'white', transition: '0.3s', borderRadius: '50%',
                            }} />
                          </span>
                        </label>
                        {/* 삭제 */}
                        <button
                          onClick={() => handleDeleteRoutine(alarm.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D0C8C0', padding: 2 }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 새 루틴 추가 폼 */}
            {showAddRoutine && (
              <AddRoutineForm
                userId={user.uid}
                onSave={handleRoutineSaved}
                onCancel={() => setShowAddRoutine(false)}
              />
            )}
          </div>

        </div>

        {/* 하단 고정 영역: 저장 버튼 + 로그아웃 */}
        <div style={{ flexShrink: 0, borderTop: '1px solid #F0EDE8', padding: '14px 24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn primary"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 500 }}
          >
            {saving ? '저장 중...' : '설정 저장하기'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('로그아웃 하시겠습니까?')) {
                signOut();
                onClose();
              }
            }}
            style={{ width: '100%', background: 'none', border: 'none', color: '#B8AFA4', fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: '4px 0' }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
