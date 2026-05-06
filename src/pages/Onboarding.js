import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function OnboardingPage() {
  const { user, updateUserProfile } = useAuth();
  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gender) {
      setError('성별은 필수 입력 항목입니다.');
      return;
    }
    setLoading(true);
    try {
      await updateUserProfile(user.uid, {
        gender,
        ageGroup: ageGroup || null,
        height: height ? parseInt(height, 10) : null,
        weight: weight ? parseInt(weight, 10) : null,
      });
    } catch (err) {
      setError('정보 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page onboarding-page">
      <div className="onboarding-card">
        <h2 className="onboarding-title">환영합니다! 🎉</h2>
        <p className="onboarding-sub">
          더 정확한 체형 맞춤 코디와 실사이즈 핏을 제공하기 위해 기본 정보를 입력해 주세요.
        </p>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">성별 <span className="required">*</span></label>
            <div className="form-options">
              {['남성', '여성', '기타'].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`option-btn ${gender === g ? 'active' : ''}`}
                  onClick={() => setGender(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">연령대 <span className="optional">(선택)</span></label>
            <div className="form-options">
              {['10~20대', '30~40대', '50대 이상'].map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`option-btn ${ageGroup === a ? 'active' : ''}`}
                  onClick={() => setAgeGroup(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">키 (cm) <span className="optional">(선택)</span></label>
            <input
              type="number"
              className="form-input"
              placeholder="예: 170"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">몸무게 (kg) <span className="optional">(선택)</span></label>
            <input
              type="number"
              className="form-input"
              placeholder="예: 65"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <p className="form-hint">키와 몸무게를 입력하시면 옷의 비율이 체형에 맞게 표시됩니다.</p>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn primary full-width" disabled={loading} style={{ marginTop: '10px' }}>
            {loading ? '저장 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
