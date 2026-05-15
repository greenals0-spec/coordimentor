import React, { useState } from 'react';
import { X, Bell, Clock, Calendar, Tag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { deductPoints, POINT_COSTS } from '../utils/points';
import InsufficientPointsModal from './InsufficientPointsModal';
import { scheduleRoutineAlarms } from '../utils/notifications';

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

export default function RoutineAlarmModal({ onClose, onNavigate }) {
  const { user, points, refreshPoints } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [selectedDays, setSelectedDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [alarmTime, setAlarmTime] = useState('08:00');
  const [situation, setSituation] = useState('출근');

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
    // 포인트 확인
    const cost = POINT_COSTS.ROUTINE_ALARM;
    if ((points ?? 0) < cost) { setShowPointsModal(true); return; }
    const ok = await deductPoints(user.uid, cost, '루틴 알람 설정');
    if (!ok) { setShowPointsModal(true); return; }
    await refreshPoints(user.uid);
    setSaving(true);
    try {
      // 기존 루틴 알람 목록 불러오기
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const existing = userSnap.data()?.routineAlarms || [];

      // 같은 상황+시간 중복 제거 후 추가
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
      await scheduleRoutineAlarms(updated);
      setSaved(true);
      setTimeout(() => onClose(), 1000);
    } catch (e) {
      console.error('루틴 알람 저장 오류:', e);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    {showPointsModal && (
      <InsufficientPointsModal
        required={POINT_COSTS.ROUTINE_ALARM}
        current={points ?? 0}
        onClose={() => setShowPointsModal(false)}
        onCharge={() => { setShowPointsModal(false); onNavigate?.('store'); }}
      />
    )}
    <div className="modal-overlay" style={{ zIndex: 900, padding: '20px', paddingBottom: '100px' }}>
      <div className="edit-modal" style={{ maxWidth: 380, maxHeight: '88vh', overflowY: 'auto' }}>

        {/* 헤더 */}
        <div className="edit-modal-header">
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 22 }}>
            루틴 코디 알람
          </h3>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="edit-modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* 알람 ON/OFF */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={16} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#18160F' }}>알람 활성화</p>
                <p style={{ margin: 0, fontSize: 11, color: '#B8AFA4' }}>설정한 루틴에 맞게 알림을 보내드려요</p>
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: 'absolute', cursor: 'pointer', inset: 0,
                backgroundColor: enabled ? '#18160F' : '#E2DDD6',
                transition: '0.3s', borderRadius: 24,
              }}>
                <span style={{
                  position: 'absolute', height: 18, width: 18,
                  left: enabled ? 22 : 4, bottom: 3,
                  backgroundColor: 'white', transition: '0.3s', borderRadius: '50%',
                }} />
              </span>
            </label>
          </div>

          {/* 요일 선택 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Calendar size={15} color="#8C877F" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#18160F' }}>반복 요일</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {DAYS.map(({ key, label }) => {
                const isSelected = selectedDays.includes(key);
                const isWeekend = key === 'sat' || key === 'sun';
                return (
                  <button
                    key={key}
                    onClick={() => toggleDay(key)}
                    style={{
                      flex: 1, height: 38, borderRadius: 10, border: 'none',
                      background: isSelected ? '#18160F' : '#F0EDE8',
                      color: isSelected ? '#fff' : isWeekend ? '#E07070' : '#6B6260',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* 빠른 선택 */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[
                { label: '평일', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
                { label: '주말', days: ['sat', 'sun'] },
                { label: '매일', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
              ].map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => setSelectedDays(days)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8,
                    border: '1px solid #E2DDD6', background: '#FAFAF8',
                    fontSize: 11, color: '#8C877F', cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 시간 설정 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Clock size={15} color="#8C877F" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#18160F' }}>알람 시간</span>
            </div>
            <input
              type="time"
              value={alarmTime}
              onChange={e => setAlarmTime(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12,
                border: '1px solid #E2DDD6', fontSize: 22,
                fontFamily: "'DM Sans', sans-serif", textAlign: 'center',
                color: '#18160F', background: '#FAFAF8',
              }}
            />
          </div>

          {/* 상황 선택 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Tag size={15} color="#8C877F" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#18160F' }}>어떤 상황인가요?</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {SITUATIONS.map(({ key, emoji }) => {
                const isSelected = situation === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSituation(key)}
                    style={{
                      padding: '10px 4px', borderRadius: 12,
                      border: isSelected ? '2px solid #18160F' : '1.5px solid #E2DDD6',
                      background: isSelected ? '#18160F' : '#FAFAF8',
                      color: isSelected ? '#fff' : '#4B4744',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{key}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 안내 */}
          <div style={{
            background: '#F8F6F3', borderRadius: 12, padding: '12px 14px',
            fontSize: 12, color: '#8C877F', lineHeight: 1.6,
          }}>
            📌 설정한 요일·시간에 그날 날씨를 반영한 <strong style={{ color: '#4B4744' }}>{situation}</strong> 코디 알림을 보내드려요.
          </div>
        </div>

        {/* 저장 버튼 */}
        <div style={{ padding: '0 24px 24px' }}>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: saved ? '#4CAF50' : '#18160F', color: 'white',
              fontSize: 15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s',
            }}
          >
            {saved ? '✓ 저장됐어요!' : saving ? '저장 중...' : '루틴 알람 설정하기'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
