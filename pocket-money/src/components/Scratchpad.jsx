import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";

// A finger-drawing working-out pad for sums. No save — it's scrap paper.
export function Scratchpad({ color = "#5b2fa8", height = 180, placeholder = "Work it out here with your finger" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [used, setUsed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    setUsed(true);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = point(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setUsed(false);
  };

  return (
    <div className="rounded-xl border border-dashed bg-white overflow-hidden relative" style={{ borderColor: `${color}66` }}>
      <canvas
        ref={canvasRef}
        className="block w-full touch-none"
        style={{ height, backgroundImage: "radial-gradient(#e9ebf2 1px, transparent 1px)", backgroundSize: "16px 16px" }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        aria-label="Working out pad"
      />
      {!used && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[13px] text-ink-muted gap-1.5">
          <PenLine size={14} /> {placeholder}
        </div>
      )}
      <button
        type="button"
        onClick={clear}
        className="absolute top-2 right-2 h-8 px-2.5 rounded-full bg-white/90 border border-line text-[12px] font-semibold text-ink-muted inline-flex items-center gap-1 hover:text-ink"
      >
        <Eraser size={13} /> Clear
      </button>
    </div>
  );
}
