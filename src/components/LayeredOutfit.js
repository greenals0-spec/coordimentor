import React from 'react';

const CANVAS_W = 200;

const BASE = {
  face:   { w: 60,  h: 60  },
  outer:  { w: 136, h: 134 },
  top:    { w: 114, h: 122 },
  wrist:  { w: 27,  h: 27  },
  bottom: { w: 96,  h: 162 },
  shoes:  { w: 77,  h: 53  },
};

function cx(itemW) {
  return Math.round((CANVAS_W - itemW) / 2);
}

export default function LayeredOutfit({ items, userProfile, style }) {
  const {
    아우터,
    상의,
    하의,
    신발,
    액세서리_얼굴머리: face,
    액세서리_손목팔:   wrist,
  } = items;

  // 키/몸무게 스케일
  let sx = 1, sy = 1;
  if (userProfile?.height) sy = Math.max(0.7, Math.min(1.3, userProfile.height / 165));
  if (userProfile?.weight) sx = Math.max(0.7, Math.min(1.3, Math.pow(userProfile.weight / 60, 0.45)));

  const sw = (b) => Math.round(b * sx);
  const sh = (b) => Math.round(b * sy);

  // 각 아이템 크기
  const fW  = sw(BASE.face.w),   fH  = sh(BASE.face.h);
  const oW  = sw(BASE.outer.w),  oH  = sh(BASE.outer.h);
  const tW  = sw(BASE.top.w),    tH  = sh(BASE.top.h);
  const wrW = sw(BASE.wrist.w),  wrH = sh(BASE.wrist.h);
  const bW  = sw(BASE.bottom.w), bH  = sh(BASE.bottom.h);
  const sW  = sw(BASE.shoes.w),  sH  = sh(BASE.shoes.h);

  // 상체 기준값
  const torsoRefH = 아우터 ? oH : (상의 ? tH : 0);
  const torsoRefW = 아우터 ? oW : (상의 ? tW : 0);

  // 세로 위치
  const faceTop   = 0;
  const torsoTop  = face ? fH - 6 : 0;
  const bottomTop = 하의  ? torsoTop + torsoRefH - 18 : 0;
  const shoesTop  = 신발  ? bottomTop + bH - 10 : 0;

  // 캔버스 전체 높이
  let canvasH = 20;
  if (신발)         canvasH = shoesTop + sH + 12;
  else if (하의)    canvasH = bottomTop + bH + 12;
  else if (torsoRefH > 0) canvasH = torsoTop + torsoRefH + 12;
  if (face && canvasH < fH + 10) canvasH = fH + 10;

  // 손목 위치 (소매 끝)
  const wristY     = torsoTop + Math.round(torsoRefH * 0.42);
  const wristLeftX = cx(torsoRefW) - wrW + 14;
  const wristRightX = cx(torsoRefW) + torsoRefW - 14;

  return (
    <div style={{ position: 'relative', width: CANVAS_W, height: canvasH, margin: '0 auto', ...style }}>

      {/* 얼굴/머리 */}
      {face && (
        <img src={face.imageUrl} alt={face.name}
          style={{ position: 'absolute', top: faceTop, left: cx(fW), width: fW, height: fH, objectFit: 'contain', zIndex: 6 }}
        />
      )}

      {/* 아우터 — 상의 위에 */}
      {아우터 && (
        <img src={아우터.imageUrl} alt={아우터.name}
          style={{ position: 'absolute', top: torsoTop, left: cx(oW), width: oW, height: oH, objectFit: 'contain', zIndex: 4 }}
        />
      )}

      {/* 상의 — 아우터 아래 */}
      {상의 && (
        <img src={상의.imageUrl} alt={상의.name}
          style={{ position: 'absolute', top: torsoTop, left: cx(tW), width: tW, height: tH, objectFit: 'contain', zIndex: 3 }}
        />
      )}

      {/* 손목/팔 — 좌우 소매 끝 */}
      {wrist && torsoRefW > 0 && (
        <>
          <img src={wrist.imageUrl} alt=""
            style={{ position: 'absolute', top: wristY, left: wristLeftX, width: wrW, height: wrH, objectFit: 'contain', zIndex: 5 }}
          />
          <img src={wrist.imageUrl} alt=""
            style={{ position: 'absolute', top: wristY, left: wristRightX, width: wrW, height: wrH, objectFit: 'contain', zIndex: 5, transform: 'scaleX(-1)' }}
          />
        </>
      )}

      {/* 하의 — 상의 아래 겹침 */}
      {하의 && (
        <img src={하의.imageUrl} alt={하의.name}
          style={{ position: 'absolute', top: bottomTop, left: cx(bW), width: bW, height: bH, objectFit: 'contain', zIndex: 2 }}
        />
      )}

      {/* 신발 — 하의 아래 겹침 */}
      {신발 && (
        <img src={신발.imageUrl} alt={신발.name}
          style={{ position: 'absolute', top: shoesTop, left: cx(sW), width: sW, height: sH, objectFit: 'contain', zIndex: 1 }}
        />
      )}
    </div>
  );
}
