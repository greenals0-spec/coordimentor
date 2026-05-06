import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * ImageEditor
 * - removedUrl: blob URL from remove.bg (PNG with transparency)
 * - onConfirm(blob): called when user confirms the edited image
 * - onCancel: called when user cancels
 *
 * Tools:
 *  🧽 Erase brush – drag to erase pixels
 *  ✨ Restore brush – drag to paint back original pixels
 */
export default function ImageEditor({ removedUrl, onConfirm, onCancel }) {
  const canvasRef    = useRef(null);
  const overlayRef   = useRef(null);   // cursor/touch feedback
  const imgRef       = useRef(null);   // original Image object
  const historyRef   = useRef([]);     // undo stack (ImageData[])

  const [tool, setTool]         = useState('erase');   // 'erase' | 'restore'
  const [brushSize, setBrushSize] = useState(28);       // brush radius (px on screen)
  const [imageScale, setImageScale] = useState(1.0);    // clothing size scale
  const [imagePan, setImagePan]     = useState({ x: 0, y: 0 }); // translation in screen pixels
  const [isDrawing, setIsDrawing] = useState(false);
  const [canUndo, setCanUndo]   = useState(false);
  
  const CANVAS_SIZE = 1024;
  const imgDrawInfoRef = useRef(null);
  const gestureRef     = useRef({ distance: 0, center: { x: 0, y: 0 } });

  const drawInitialImage = useCallback((img) => {
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay || !img) return;
    
    canvas.width  = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    overlay.width  = CANVAS_SIZE;
    overlay.height = CANVAS_SIZE;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
    const baseScale = CANVAS_SIZE / maxDim; 
    
    const w = img.naturalWidth * baseScale;
    const h = img.naturalHeight * baseScale;
    const x = (CANVAS_SIZE - w) / 2;
    const y = (CANVAS_SIZE - h) / 2;
    
    ctx.drawImage(img, x, y, w, h);
    imgDrawInfoRef.current = { x, y, w, h };
    historyRef.current = [];
    setCanUndo(false);
  }, []);

  /* ── Load image ── */
  useEffect(() => {
    if (!removedUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      drawInitialImage(img);
    };
    img.src = removedUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removedUrl]);

  /* ── Handle Gesture Logic ── */
  const handleGestureStart = (touches) => {
    const t1 = touches[0];
    const t2 = touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const center = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };
    gestureRef.current = { distance: dist, center };
  };

  const handleGestureMove = (touches) => {
    const t1 = touches[0];
    const t2 = touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const center = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };

    const prev = gestureRef.current;
    
    // Zoom
    if (prev.distance > 0) {
      const scaleDelta = dist / prev.distance;
      setImageScale(s => Math.min(Math.max(s * scaleDelta, 0.2), 4));
    }
    
    // Pan
    const dx = center.x - prev.center.x;
    const dy = center.y - prev.center.y;
    setImagePan(p => ({ x: p.x + dx, y: p.y + dy }));

    gestureRef.current = { distance: dist, center };
  };

  /* ── Helpers ── */
  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const snap   = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = [...historyRef.current.slice(-19), snap];
    setCanUndo(true);
  }, []);

  const undo = useCallback(() => {
    const stack = historyRef.current;
    if (!stack.length) return;
    const snap = stack[stack.length - 1];
    historyRef.current = stack.slice(0, -1);
    const ctx = canvasRef.current.getContext('2d');
    ctx.putImageData(snap, 0, 0);
    setCanUndo(historyRef.current.length > 0);
  }, []);

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const src    = e.touches ? e.touches[0] : e;
    return {
      x: Math.round((src.clientX - rect.left) * scaleX),
      y: Math.round((src.clientY - rect.top)  * scaleY),
    };
  };

  /* ── Erase brush ── */
  const applyErase = useCallback((x, y) => {
    const canvas  = canvasRef.current;
    const ctx     = canvas.getContext('2d');
    const scaledR = (brushSize / 2) * (canvas.width / canvas.getBoundingClientRect().width);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, scaledR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [brushSize]);

  /* ── Restore brush ── */
  const applyRestore = useCallback((x, y) => {
    const canvas  = canvasRef.current;
    const ctx     = canvas.getContext('2d');
    const img     = imgRef.current;
    if (!img) return;
    const scaledR = (brushSize / 2) * (canvas.width / canvas.getBoundingClientRect().width);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(x, y, scaledR, 0, Math.PI * 2);
    ctx.clip();
    const info = imgDrawInfoRef.current;
    if (info) {
      ctx.drawImage(img, info.x, info.y, info.w, info.h);
    }
    ctx.restore();
  }, [brushSize]);

  /* ── Cursor overlay ── */
  const drawCursor = useCallback((x, y) => {
    const canvas  = canvasRef.current;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx     = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const scaledR = (brushSize / 2) * (canvas.width / canvas.getBoundingClientRect().width);
    
    if (tool === 'erase') {
      ctx.fillStyle = 'rgba(239,68,68,0.4)';
      ctx.beginPath(); ctx.arc(x, y, scaledR, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(99,102,241,0.9)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(x, y, scaledR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [tool, brushSize]);

  const clearCursor = useCallback(() => {
    const overlay = overlayRef.current;
    if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
  }, []);

  /* ── Pointer events ── */
  const handlePointerDown = useCallback((e) => {
    if (e.touches && e.touches.length === 2) {
      setIsDrawing(false);
      handleGestureStart(e.touches);
      return;
    }
    e.preventDefault();
    const pos = getCanvasPos(e);
    saveSnapshot();
    setIsDrawing(true);
    
    if (tool === 'erase') {
      applyErase(pos.x, pos.y);
    } else {
      applyRestore(pos.x, pos.y);
    }
  }, [tool, applyErase, applyRestore, saveSnapshot]);

  const handlePointerMove = useCallback((e) => {
    if (e.touches && e.touches.length === 2) {
      handleGestureMove(e.touches);
      return;
    }
    
    if (isDrawing) {
      e.preventDefault();
      const pos = getCanvasPos(e);
      drawCursor(pos.x, pos.y);
      if (tool === 'erase') applyErase(pos.x, pos.y);
      if (tool === 'restore') applyRestore(pos.x, pos.y);
    } else {
      // Just draw cursor
      const pos = getCanvasPos(e);
      drawCursor(pos.x, pos.y);
    }
  }, [isDrawing, tool, applyErase, applyRestore, drawCursor]);

  const handlePointerUp = useCallback((e) => {
    if (e.touches && e.touches.length > 0) {
      // Re-init gesture if one finger remains? 
      // Actually simpler to just wait for next 2-finger touch
      return;
    }
    setIsDrawing(false);
  }, []);

  /* ── Confirm ── */
  const handleConfirm = useCallback(() => {
    const sourceCanvas = canvasRef.current;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = CANVAS_SIZE;
    finalCanvas.height = CANVAS_SIZE;
    const ctx = finalCanvas.getContext('2d');
    
    // Scale screen-space pan to canvas-space pan
    const rect = sourceCanvas.getBoundingClientRect();
    // rect.width is the current screen width of the transformed canvas.
    // We need the screen width of the canvas at scale 1.0.
    const screenWidthAtScale1 = rect.width / imageScale;
    const scaleFactor = CANVAS_SIZE / screenWidthAtScale1;
    
    const panX = imagePan.x * scaleFactor;
    const panY = imagePan.y * scaleFactor;

    const w = CANVAS_SIZE * imageScale;
    const h = CANVAS_SIZE * imageScale;
    const x = (CANVAS_SIZE - w) / 2 + panX;
    const y = (CANVAS_SIZE - h) / 2 + panY;
    
    ctx.drawImage(sourceCanvas, x, y, w, h);
    
    finalCanvas.toBlob(blob => onConfirm(blob), 'image/png');
  }, [onConfirm, imageScale, imagePan]);

  return (
    <div className="image-editor">

      {/* ── Toolbar ── */}
      <div className="editor-toolbar">
        <div className="tool-group">
          <button
            className={`tool-btn ${tool === 'erase' ? 'active erase' : ''}`}
            onClick={() => setTool('erase')}
          >
            <span className="tool-icon">🧽</span>
            <span>지우개</span>
          </button>
          <button
            className={`tool-btn ${tool === 'restore' ? 'active restore' : ''}`}
            onClick={() => setTool('restore')}
          >
            <span className="tool-icon">✨</span>
            <span>복원</span>
          </button>
        </div>
        <button
          className={`tool-btn undo-btn ${!canUndo ? 'disabled' : ''}`}
          onClick={undo}
          disabled={!canUndo}
        >
          <span className="tool-icon">↩️</span>
          <span>되돌리기</span>
        </button>
      </div>

      <div className="brush-control" style={{ marginTop: '8px' }}>
        <span className="brush-label">브러시 크기</span>
        <input
          type="range" min={8} max={150} value={brushSize}
          onChange={e => setBrushSize(Number(e.target.value))}
          className="brush-slider"
        />
        <span className="brush-size-value">{brushSize}px</span>
      </div>
      
      <div 
        className="canvas-wrapper"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => { setIsDrawing(false); clearCursor(); }}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <div style={{ 
          transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageScale})`, 
          transformOrigin: 'center', 
          width: '100%', 
          height: '100%', 
          pointerEvents: 'none',
          transition: isDrawing ? 'none' : 'transform 0.05s linear' // smooth pan
        }}>
          <canvas
            ref={canvasRef}
            className="editor-canvas"
            style={{ cursor: 'none' }}
          />
          <canvas
            ref={overlayRef}
            className="editor-canvas overlay-canvas"
          />
        </div>
      </div>

      <p className="editor-hint" style={{ marginTop: '12px' }}>
        💡 두 손가락으로 확대/축소 및 이동이 가능합니다.
      </p>

      {/* ── Actions ── */}
      <div className="editor-actions">
        <button className="btn secondary" onClick={onCancel}>취소</button>
        <button className="btn primary" onClick={handleConfirm}>편집 완료</button>
      </div>
    </div>
  );
}
