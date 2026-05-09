import React, { useState } from 'react';
import { X, Bell, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { scheduleMorningNotification, testNotification } from '../utils/notifications';

export default function SettingsModal({ onClose }) {
  const { user, userProfile, updateUserProfile } = useAuth();
  
  // Initial values from userProfile
  const [alarmEnabled, setAlarmEnabled] = useState(userProfile?.alarmEnabled ?? false);
  const [alarmTime, setAlarmTime] = useState(userProfile?.alarmTime ?? '07:30');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        alarmEnabled,
        alarmTime
      });
      
      // 알림 스케줄링
      await scheduleMorningNotification(alarmTime, alarmEnabled);
      
      onClose();
    } catch (e) {
      console.error('Failed to save settings:', e);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 900, padding: '20px', paddingBottom: '100px' }}>
      <div className="edit-modal" style={{ maxWidth: 360, paddingBottom: 32, maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="edit-modal-header">
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 22 }}>설정</h3>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="edit-modal-body" style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#18160F' }}>
                  <Bell size={16} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#18160F' }}>날씨 코디 알람</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#B8AFA4' }}>아침에 날씨에 맞는 옷을 추천해드려요.</p>
                </div>
              </div>
              <label className="switch-toggle" style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                <input 
                  type="checkbox" 
                  checked={alarmEnabled}
                  onChange={(e) => setAlarmEnabled(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }} 
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', inset: 0,
                  backgroundColor: alarmEnabled ? '#18160F' : '#E2DDD6',
                  transition: '0.4s', borderRadius: 24
                }}>
                  <span style={{
                    position: 'absolute', height: 18, width: 18, left: alarmEnabled ? 22 : 4, bottom: 3,
                    backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                  }} />
                </span>
              </label>
            </div>
          </div>

          <div style={{ opacity: alarmEnabled ? 1 : 0.4, pointerEvents: alarmEnabled ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#18160F' }}>
                <Clock size={16} />
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#18160F' }}>알람 시간 설정</p>
            </div>
            
            <input 
              type="time" 
              value={alarmTime}
              onChange={(e) => setAlarmTime(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #E2DDD6',
                fontSize: 20,
                fontFamily: "'DM Sans', sans-serif",
                textAlign: 'center',
                color: '#18160F',
                background: '#FAFAF8'
              }}
            />
            <p style={{ fontSize: 11, color: '#B8AFA4', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
              설정한 시간에 앱을 열면<br />오늘의 날씨와 추천 코디를 바로 확인하실 수 있어요.
            </p>
          </div>
        </div>

        <div className="edit-modal-footer" style={{ padding: '0 24px 8px' }}>
          <button 
            className="btn primary" 
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 500, marginBottom: 8 }}
          >
            {saving ? '저장 중...' : '설정 저장하기'}
          </button>
          <button 
            className="btn secondary" 
            onClick={testNotification}
            style={{ width: '100%', padding: '12px', borderRadius: 14, fontSize: 12, color: '#8C877F' }}
          >
            테스트 알람 보내기 (5초 뒤)
          </button>
        </div>
      </div>
    </div>
  );
}
