import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenTool, Upload } from 'lucide-react';

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
}

export function SignaturePad({
  value,
  onChange,
  label = 'Tanda Tangan Digital (Gambar atau Unggah PNG/JPG)',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = value;
    }
  }, [value]);

  const getPointerPos = (
    e: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const pos = getPointerPos(e, canvas);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPointerPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const commitCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDrawing(false);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length <= 190000) {
      onChange(dataUrl);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    onChange('');
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 420;
        offCanvas.height = 150;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, offCanvas.width, offCanvas.height);
        const ratio = Math.min(offCanvas.width / img.width, offCanvas.height / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (offCanvas.width - w) / 2;
        const y = (offCanvas.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        const pngData = offCanvas.toDataURL('image/png');
        if (pngData.length <= 190000) {
          onChange(pngData);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-emerald-800" />
          <span>{label}</span>
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
          >
            <Upload className="w-3 h-3" /> Unggah Gambar
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
          >
            <Eraser className="w-3 h-3" /> Bersihkan
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleUploadImage}
        className="hidden"
      />

      <div className="relative border border-dashed border-slate-300 rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={420}
          height={150}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={commitCanvas}
          onPointerCancel={commitCanvas}
          className="w-full h-32 touch-none cursor-crosshair block"
        />
        {!value && !drawing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-slate-400">
            Goreskan tanda tangan pengawas / supervisor di sini
          </div>
        )}
      </div>
    </div>
  );
}
