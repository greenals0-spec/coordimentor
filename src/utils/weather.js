const WMO_CODE_MAP = {
  0: { condition: '맑음', emoji: '☀️' },
  1: { condition: '맑음', emoji: '🌤️' },
  2: { condition: '흐림', emoji: '⛅' },
  3: { condition: '흐림', emoji: '☁️' },
  45: { condition: '안개', emoji: '🌫️' },
  48: { condition: '안개', emoji: '🌫️' },
  51: { condition: '비', emoji: '🌧️' },
  53: { condition: '비', emoji: '🌧️' },
  55: { condition: '비', emoji: '🌧️' },
  61: { condition: '비', emoji: '🌧️' },
  63: { condition: '비', emoji: '🌧️' },
  65: { condition: '비', emoji: '🌧️' },
  71: { condition: '눈', emoji: '❄️' },
  73: { condition: '눈', emoji: '❄️' },
  75: { condition: '눈', emoji: '❄️' },
  77: { condition: '눈', emoji: '❄️' },
  80: { condition: '비', emoji: '🌧️' },
  81: { condition: '비', emoji: '🌧️' },
  82: { condition: '비', emoji: '🌧️' },
  85: { condition: '눈', emoji: '❄️' },
  86: { condition: '눈', emoji: '❄️' },
  95: { condition: '비', emoji: '⛈️' },
  96: { condition: '비', emoji: '⛈️' },
  99: { condition: '비', emoji: '⛈️' },
};

export const getWeatherByLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('위치 정보를 지원하지 않는 브라우저예요.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude: lat, longitude: lon } = coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
          );
          const data = await res.json();
          const temp = Math.round(data.current.temperature_2m);
          const code = data.current.weather_code;
          const { condition, emoji } = WMO_CODE_MAP[code] || { condition: '흐림', emoji: '⛅' };
          resolve({ temp, condition, emoji });
        } catch {
          reject(new Error('날씨 정보를 가져오지 못했어요.'));
        }
      },
      () => reject(new Error('위치 접근이 거부됐어요. 브라우저 설정에서 허용해주세요.'))
    );
  });
