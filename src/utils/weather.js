// ─── 기상청 단기예보 API + Open-Meteo 폴백 ──────────────────────────────────
// 한국 좌표 → 기상청 API, 해외/실패 → Open-Meteo

const KMA_KEY = process.env.REACT_APP_KMA_API_KEY;
const KMA_BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

// ─── 위경도 → 기상청 격자(nx, ny) 변환 ────────────────────────────────────────
function latLonToGrid(lat, lon) {
  const RE     = 6371.00877;
  const GRID   = 5.0;
  const SLAT1  = 30.0;
  const SLAT2  = 60.0;
  const OLON   = 126.0;
  const OLAT   = 38.0;
  const XO     = 43;
  const YO     = 136;
  const D2R    = Math.PI / 180.0;

  const re    = RE / GRID;
  const slat1 = SLAT1 * D2R;
  const slat2 = SLAT2 * D2R;
  const olon  = OLON  * D2R;
  const olat  = OLAT  * D2R;

  let sn = Math.log(Math.cos(slat1) / Math.cos(slat2))
         / Math.log(Math.tan(Math.PI * 0.25 + slat2 * 0.5)
                  / Math.tan(Math.PI * 0.25 + slat1 * 0.5));
  let sf = Math.pow(Math.tan(Math.PI * 0.25 + slat1 * 0.5), sn)
         * Math.cos(slat1) / sn;
  let ro = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + olat * 0.5), sn);

  let ra    = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + lat * D2R * 0.5), sn);
  let theta = lon * D2R - olon;
  if (theta >  Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

// ─── KST 기준 현재 날짜/시간 ────────────────────────────────────────────────
function getNowKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    hour: kst.getUTCHours(),
    min:  kst.getUTCMinutes(),
    kst,
  };
}

// ─── 초단기실황 base_time 계산 (매시 10분 후 공개) ───────────────────────────
function getUltraNcstBaseTime() {
  const { date, hour, min, kst } = getNowKST();
  if (min < 10) {
    // 아직 이번 시각 데이터 미공개 → 이전 시간 사용
    const prev = new Date(kst.getTime() - 60 * 60 * 1000);
    const p    = new Date(prev.getTime());
    const pad  = (n) => String(n).padStart(2, '0');
    return {
      base_date: `${p.getUTCFullYear()}${pad(p.getUTCMonth()+1)}${pad(p.getUTCDate())}`,
      base_time: `${pad(p.getUTCHours())}00`,
    };
  }
  return { base_date: date, base_time: `${String(hour).padStart(2,'0')}00` };
}

// ─── 단기예보 base_time 계산 (0200/0500/0800/1100/1400/1700/2000/2300, 10분 후 공개) ─
function getVilageFcstBaseTime() {
  const { hour, min, kst } = getNowKST();
  const pad = (n) => String(n).padStart(2, '0');
  const BASES = [2, 5, 8, 11, 14, 17, 20, 23];

  // 현재 시각 기준 사용 가능한 가장 최근 base time 탐색
  let baseHour = null;
  for (let i = BASES.length - 1; i >= 0; i--) {
    if (hour > BASES[i] || (hour === BASES[i] && min >= 10)) {
      baseHour = BASES[i];
      break;
    }
  }

  let baseDate = kst;
  if (baseHour === null) {
    // 자정 직후 0210 이전이면 전날 2300 사용
    baseHour = 23;
    baseDate = new Date(kst.getTime() - 24 * 60 * 60 * 1000);
  }

  return {
    base_date: `${baseDate.getUTCFullYear()}${pad(baseDate.getUTCMonth()+1)}${pad(baseDate.getUTCDate())}`,
    base_time: `${pad(baseHour)}00`,
  };
}

// ─── SKY/PTY 코드 → 날씨 표현 ────────────────────────────────────────────────
function interpretKMA(sky, pty) {
  // PTY 우선
  const ptyMap = {
    1: { condition: '비',         emoji: '🌧️' },
    2: { condition: '비/눈',      emoji: '🌨️' },
    3: { condition: '눈',         emoji: '❄️' },
    4: { condition: '소나기',     emoji: '🌦️' },
    5: { condition: '이슬비',     emoji: '🌦️' },
    6: { condition: '이슬비/눈',  emoji: '🌨️' },
    7: { condition: '눈날림',     emoji: '🌨️' },
  };
  if (pty && pty !== 0) return ptyMap[pty] || { condition: '비', emoji: '🌧️' };

  const skyMap = {
    1: { condition: '맑음',     emoji: '☀️' },
    3: { condition: '구름많음', emoji: '⛅' },
    4: { condition: '흐림',     emoji: '☁️' },
  };
  return skyMap[sky] || { condition: '흐림', emoji: '☁️' };
}

// ─── 기상청 초단기실황 (현재 날씨) ───────────────────────────────────────────
async function fetchKmaCurrent(nx, ny) {
  const { base_date, base_time } = getUltraNcstBaseTime();
  const url = `${KMA_BASE}/getUltraSrtNcst`
    + `?serviceKey=${encodeURIComponent(KMA_KEY)}`
    + `&pageNo=1&numOfRows=60&dataType=JSON`
    + `&base_date=${base_date}&base_time=${base_time}`
    + `&nx=${nx}&ny=${ny}`;

  const res  = await fetch(url);
  const data = await res.json();
  const items = data?.response?.body?.items?.item;
  if (!items?.length) throw new Error('기상청 실황 데이터 없음');

  const get = (cat) => items.find(i => i.category === cat)?.obsrValue;
  const sky = null; // 실황에는 SKY 없음
  const pty = Number(get('PTY') ?? 0);
  const tmp = Number(get('T1H'));
  const wsd = Number(get('WSD') ?? 0);

  const { condition, emoji } = interpretKMA(sky, pty);
  return {
    temp:         Math.round(tmp),
    apparentTemp: Math.round(tmp), // 실황엔 체감온도 없음
    condition,
    emoji,
    precipProb:   null,
    windSpeed:    Math.round(wsd * 3.6), // m/s → km/h
    source:       'KMA',
  };
}

// ─── 기상청 단기예보 (미래 날씨) ─────────────────────────────────────────────
async function fetchKmaForecast(nx, ny, targetDate, targetHour) {
  const { base_date, base_time } = getVilageFcstBaseTime();
  const url = `${KMA_BASE}/getVilageFcst`
    + `?serviceKey=${encodeURIComponent(KMA_KEY)}`
    + `&pageNo=1&numOfRows=1000&dataType=JSON`
    + `&base_date=${base_date}&base_time=${base_time}`
    + `&nx=${nx}&ny=${ny}`;

  const res  = await fetch(url);
  const data = await res.json();
  const items = data?.response?.body?.items?.item;
  if (!items?.length) throw new Error('기상청 예보 데이터 없음');

  // targetDate: YYYY-MM-DD → YYYYMMDD, targetHour: 숫자 → "HH00"
  const fcstDate = targetDate.replace(/-/g, '');
  const fcstTime = `${String(targetHour).padStart(2, '0')}00`;

  const get = (cat) => {
    const item = items.find(i => i.category === cat && i.fcstDate === fcstDate && i.fcstTime === fcstTime);
    return item ? Number(item.fcstValue) : null;
  };

  const tmp = get('TMP');
  const sky = get('SKY');
  const pty = get('PTY') ?? 0;
  const pop = get('POP'); // 강수확률 (%)
  const wsd = get('WSD'); // 풍속 m/s

  if (tmp === null) throw new Error('해당 시각 예보 없음 (최대 3일)');

  const { condition, emoji } = interpretKMA(sky, pty);
  return {
    temp:         Math.round(tmp),
    apparentTemp: Math.round(tmp),
    condition,
    emoji,
    precipProb:   pop,
    windSpeed:    wsd !== null ? Math.round(wsd * 3.6) : 0, // m/s → km/h
    source:       'KMA',
  };
}

// ─── Open-Meteo 폴백 (해외/기상청 실패 시) ────────────────────────────────────
const WMO_MAP = {
  0:  { condition: '맑음',       emoji: '☀️' },
  1:  { condition: '맑음',       emoji: '🌤️' },
  2:  { condition: '구름조금',   emoji: '⛅' },
  3:  { condition: '흐림',       emoji: '☁️' },
  45: { condition: '안개',       emoji: '🌫️' },
  48: { condition: '안개',       emoji: '🌫️' },
  51: { condition: '이슬비',     emoji: '🌦️' },
  53: { condition: '이슬비',     emoji: '🌦️' },
  55: { condition: '이슬비',     emoji: '🌦️' },
  61: { condition: '비',         emoji: '🌧️' },
  63: { condition: '비',         emoji: '🌧️' },
  65: { condition: '강한 비',    emoji: '🌧️' },
  71: { condition: '눈',         emoji: '❄️' },
  73: { condition: '눈',         emoji: '❄️' },
  75: { condition: '강한 눈',    emoji: '❄️' },
  80: { condition: '소나기',     emoji: '🌦️' },
  81: { condition: '소나기',     emoji: '🌧️' },
  82: { condition: '강한 소나기',emoji: '🌧️' },
  95: { condition: '뇌우',       emoji: '⛈️' },
  99: { condition: '뇌우',       emoji: '⛈️' },
};

async function fetchOpenMeteo(lat, lon, targetDate, targetHour) {
  const now      = new Date();
  const todayStr = now.toLocaleDateString('en-CA');
  const curHour  = now.getHours();
  const isCurrent = !targetDate || (targetDate === todayStr && Number(targetHour) === curHour);

  let temp, apparentTemp, code, precipProb, windSpeed;

  if (isCurrent) {
    const res  = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m`
      + `&timezone=Asia%2FSeoul`
    );
    if (!res.ok) throw new Error('Open-Meteo 오류');
    const data   = await res.json();
    temp         = Math.round(data.current.temperature_2m);
    apparentTemp = Math.round(data.current.apparent_temperature);
    code         = data.current.weather_code;
    windSpeed    = Math.round(data.current.wind_speed_10m ?? 0);
    precipProb   = null;
  } else {
    const res  = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&hourly=temperature_2m,apparent_temperature,weather_code,precipitation_probability,wind_speed_10m`
      + `&timezone=Asia%2FSeoul&forecast_days=8`
    );
    if (!res.ok) throw new Error('Open-Meteo 오류');
    const data = await res.json();
    const tStr = `${targetDate}T${String(targetHour).padStart(2,'0')}:00`;
    const idx  = data.hourly.time.indexOf(tStr);
    if (idx === -1) throw new Error('해당 시각 예보 없음');
    temp         = Math.round(data.hourly.temperature_2m[idx]);
    apparentTemp = Math.round(data.hourly.apparent_temperature[idx]);
    code         = data.hourly.weather_code[idx];
    precipProb   = data.hourly.precipitation_probability?.[idx] ?? null;
    windSpeed    = Math.round(data.hourly.wind_speed_10m?.[idx] ?? 0);
  }

  const { condition, emoji } = WMO_MAP[code] ?? { condition: '흐림', emoji: '⛅' };
  return { temp, apparentTemp, condition, emoji, precipProb, windSpeed, source: 'Global' };
}

// ─── 한국 좌표 여부 ───────────────────────────────────────────────────────────
function isKorea(lat, lon) {
  return lat >= 33.0 && lat <= 38.9 && lon >= 124.0 && lon <= 132.0;
}

// ─── 통합 날씨 fetch ──────────────────────────────────────────────────────────
async function fetchWeatherData(lat, lon, targetDate, targetHour) {
  const now      = new Date();
  const todayStr = now.toLocaleDateString('en-CA');
  const curHour  = now.getHours();
  const isCurrent = !targetDate || (targetDate === todayStr && Number(targetHour) === curHour);

  if (KMA_KEY && isKorea(lat, lon)) {
    try {
      const { nx, ny } = latLonToGrid(lat, lon);
      if (isCurrent) {
        return await fetchKmaCurrent(nx, ny);
      } else {
        return await fetchKmaForecast(nx, ny, targetDate, targetHour);
      }
    } catch (e) {
      console.warn('기상청 API 실패, Open-Meteo로 폴백:', e.message);
    }
  }

  return await fetchOpenMeteo(lat, lon, targetDate, targetHour);
}

// ─── 지명 → 좌표 ─────────────────────────────────────────────────────────────
const PROVINCE_CAPITAL = {
  '강원':           { city: '춘천',   label: '강원특별자치도' },
  '강원도':         { city: '춘천',   label: '강원특별자치도' },
  '강원특별자치도': { city: '춘천',   label: '강원특별자치도' },
  '경기':           { city: '수원',   label: '경기도' },
  '경기도':         { city: '수원',   label: '경기도' },
  '충남':           { city: '홍성',   label: '충청남도' },
  '충청남도':       { city: '홍성',   label: '충청남도' },
  '충청남':         { city: '홍성',   label: '충청남도' },
  '충북':           { city: '청주',   label: '충청북도' },
  '충청북도':       { city: '청주',   label: '충청북도' },
  '충청북':         { city: '청주',   label: '충청북도' },
  '전남':           { city: '목포',   label: '전라남도' },
  '전라남도':       { city: '목포',   label: '전라남도' },
  '전라남':         { city: '목포',   label: '전라남도' },
  '전북':           { city: '전주',   label: '전북특별자치도' },
  '전라북도':       { city: '전주',   label: '전북특별자치도' },
  '전라북':         { city: '전주',   label: '전북특별자치도' },
  '전북특별자치도': { city: '전주',   label: '전북특별자치도' },
  '경남':           { city: '창원',   label: '경상남도' },
  '경상남도':       { city: '창원',   label: '경상남도' },
  '경상남':         { city: '창원',   label: '경상남도' },
  '경북':           { city: '안동',   label: '경상북도' },
  '경상북도':       { city: '안동',   label: '경상북도' },
  '경상북':         { city: '안동',   label: '경상북도' },
  '제주':           { city: '제주시', label: '제주특별자치도' },
  '제주도':         { city: '제주시', label: '제주특별자치도' },
  '제주특별자치도': { city: '제주시', label: '제주특별자치도' },
};

export async function geocodeLocation(name) {
  const provinceInfo = PROVINCE_CAPITAL[name];
  const searchName   = provinceInfo ? provinceInfo.city : name;
  const fixedLabel   = provinceInfo ? provinceInfo.label : null;

  const tryFetch = async (n) => {
    const res  = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(n)}&count=5&language=ko&format=json`
    );
    const data = await res.json();
    return data.results || [];
  };

  let results = await tryFetch(searchName);
  if (!results.length) {
    const stripped = searchName.replace(/(?:특별시|광역시|특별자치시|특별자치도|시|도|구|군|읍|면|동)$/, '');
    if (stripped !== searchName && stripped.length >= 1) results = await tryFetch(stripped);
  }
  if (!results.length && searchName.length > 2) results = await tryFetch(searchName.slice(0, 2));
  if (!results.length) throw new Error(`'${name}' 위치를 찾을 수 없습니다.`);

  const nameCore  = searchName.replace(/(?:특별시|광역시|특별자치시|특별자치도|시|도|구|군)$/, '');
  const krResults = results.filter(r => r.country_code === 'KR');
  const result    =
    krResults.find(r => r.admin1?.includes(nameCore)) ||
    krResults[0] || results[0];

  const { latitude, longitude, name: displayName, admin1 } = result;
  let label;
  if (fixedLabel) {
    label = fixedLabel;
  } else if (admin1 && admin1 !== displayName && !admin1.includes(displayName) && !displayName.includes(admin1)) {
    label = `${displayName}, ${admin1}`;
  } else {
    label = displayName;
  }

  return { lat: latitude, lon: longitude, label };
}

// ─── 텍스트에서 지명 추출 ─────────────────────────────────────────────────────
export function extractLocationFromText(text) {
  if (!text || text.trim().length < 2) return null;

  const withParticle = text.match(
    /([가-힣a-zA-Z]{2,8}(?:시|도|구|군|읍|면|동|역|산|섬)?)\s*(?:에서|으로|에|로|에서는|에서도|에서의|으로의)/
  );
  if (withParticle) return withParticle[1].trim();

  const withAction = text.match(
    /([가-힣a-zA-Z]{2,8}(?:시|도|구|군|읍|면|동|역|산|섬)?)\s+(?:여행|출장|방문|행사|결혼식|모임|투어|일정|미팅|바캉스|휴가|나들이|축제|캠핑|등산|데이트|피크닉|워크숍|면접|약속|산책|드라이브|웨딩|돌잔치)/
  );
  if (withAction) return withAction[1].trim();

  const withSuffix = text.match(/([가-힣]{1,6}(?:특별시|광역시|특별자치시|특별자치도|시|도|구|군))/);
  if (withSuffix) return withSuffix[1].trim();

  const MAJOR_CITIES = [
    '서울','부산','대구','인천','광주','대전','울산','세종',
    '수원','성남','고양','용인','청주','전주','천안','안산',
    '부천','남양주','화성','의정부','시흥','파주','김해',
    '제주','강릉','춘천','여수','순천','목포','포항','경주',
    '창원','진주','통영','거제','속초','평창','가평','강화',
    '도쿄','오사카','교토','삿포로','후쿠오카','나고야',
    '뉴욕','파리','런던','방콕','싱가포르','홍콩','상하이','베이징',
    '바르셀로나','로마','밀라노','암스테르담','두바이','시드니','발리',
  ];
  for (const city of MAJOR_CITIES) {
    if (text.includes(city)) return city;
  }
  return null;
}

// ─── 좌표로 직접 날씨 조회 (Home.js에서 geolocation 콜백 내 호출용) ──────────
export async function fetchWeatherFromCoords(lat, lon, targetDate = null, targetHour = null) {
  return await fetchWeatherData(lat, lon, targetDate, targetHour);
}

// ─── 현재 위치 기반 날씨 ──────────────────────────────────────────────────────
export const getWeatherByLocation = (targetDate = null, targetHour = null) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('위치 정보를 지원하지 않는 브라우저예요.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const w = await fetchWeatherData(coords.latitude, coords.longitude, targetDate, targetHour);
          resolve(w);
        } catch (e) {
          reject(new Error(e.message || '날씨 데이터를 가져오지 못했습니다.'));
        }
      },
      (err) => {
        if (err.code === 1) reject(new Error('위치 권한이 필요합니다. 앱 설정에서 위치 정보를 허용해주세요.'));
        else if (err.code === 3) reject(new Error('위치 정보를 가져오는 데 시간이 너무 오래 걸렸어요.'));
        else reject(new Error('현재 위치를 가져올 수 없어요. GPS가 켜져 있는지 확인해주세요.'));
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );
  });

// ─── 지명 기반 날씨 ───────────────────────────────────────────────────────────
export async function getWeatherByLocationName(locationName, targetDate = null, targetHour = null) {
  const { lat, lon, label } = await geocodeLocation(locationName);
  const weather = await fetchWeatherData(lat, lon, targetDate, targetHour);
  return { ...weather, locationLabel: label };
}
