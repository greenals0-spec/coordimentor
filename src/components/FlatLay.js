import React from 'react';

function Item({ item, label, size = 'md' }) {
  if (!item) return <div className={`fl-slot fl-slot--${size} fl-slot--empty`} />;
  return (
    <div className={`fl-slot fl-slot--${size}`}>
      <img src={item.imageUrl} alt={item.name} />
      <span className="fl-label">{label}</span>
    </div>
  );
}

export default function FlatLay({ items }) {
  const {
    아우터,
    상의,
    하의,
    신발,
    액세서리_얼굴머리: face,
    액세서리_손목팔: wrist,
  } = items;

  return (
    <div className="flatlay-board">

      {/* 얼굴/머리 액세서리 */}
      {face && (
        <div className="fl-row fl-row--center">
          <Item item={face} label="얼굴/머리" size="sm" />
        </div>
      )}

      {/* 아우터 */}
      {아우터 && (
        <div className="fl-row fl-row--center">
          <Item item={아우터} label="아우터" size="lg" />
        </div>
      )}

      {/* 상의 + 손목 액세서리 */}
      <div className="fl-row fl-row--middle">
        <Item item={wrist} label="손목/팔" size="sm" />
        <Item item={상의} label="상의" size="lg" />
        <Item item={wrist ? null : null} label="" size="sm" />
      </div>

      {/* 하의 */}
      {하의 && (
        <div className="fl-row fl-row--center">
          <Item item={하의} label="하의" size="lg" />
        </div>
      )}

      {/* 신발 */}
      {신발 && (
        <div className="fl-row fl-row--center">
          <Item item={신발} label="신발" size="md" />
        </div>
      )}
    </div>
  );
}
