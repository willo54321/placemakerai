'use client';

import { useRef, useEffect, useCallback } from 'react';

const DOT_SPACING = 24;
const DOT_RADIUS = 1;
const MAX_GROW = 1.5;
const HOVER_RADIUS = 100;
const BASE_COLOR = 'rgba(11, 40, 24, 0.12)';

// Brand colors for hover effect
const ORANGE = { r: 255, g: 131, b: 0 };   // #16A34A
const BLUE = { r: 22, g: 9, b: 62 };        // #0B2818

function lerpColor(t: number): string {
  // t = 0 → orange (closest), t = 1 → blue (furthest)
  const r = Math.round(ORANGE.r + (BLUE.r - ORANGE.r) * t);
  const g = Math.round(ORANGE.g + (BLUE.g - ORANGE.g) * t);
  const b = Math.round(ORANGE.b + (BLUE.b - ORANGE.b) * t);
  return `${r}, ${g}, ${b}`;
}

export default function InteractiveDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animRef = useRef<number>(0);
  const dotsRef = useRef<{ x: number; y: number; glow: number }[]>([]);

  const initDots = useCallback((width: number, height: number) => {
    const dots: { x: number; y: number; glow: number }[] = [];
    const cols = Math.ceil(width / DOT_SPACING) + 1;
    const rows = Math.ceil(height / DOT_SPACING) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({ x: c * DOT_SPACING, y: r * DOT_SPACING, glow: 0 });
      }
    }
    dotsRef.current = dots;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x: mx, y: my } = mouseRef.current;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // First pass: draw base dots
    ctx.fillStyle = BASE_COLOR;
    for (const dot of dotsRef.current) {
      const dx = dot.x - mx;
      const dy = dot.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const targetGlow = dist < HOVER_RADIUS ? 1 - dist / HOVER_RADIUS : 0;
      dot.glow += (targetGlow - dot.glow) * 0.12;

      if (dot.glow <= 0.01) {
        ctx.beginPath();
        ctx.arc(dot.x * dpr, dot.y * dpr, DOT_RADIUS * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Second pass: draw growing dots near cursor with gradient colors
    for (const dot of dotsRef.current) {
      const g = dot.glow;
      if (g <= 0.01) continue;

      const radius = (DOT_RADIUS + g * MAX_GROW) * dpr;
      const cx = dot.x * dpr;
      const cy = dot.y * dpr;
      const alpha = 0.25 + g * 0.6;

      // g = 1 means closest to cursor (orange), g → 0 means further (blue)
      const colorT = 1 - g; // 0 = orange, 1 = blue
      const rgb = lerpColor(colorT);

      ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      initDots(w, h);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Only track if cursor is within the canvas bounds
      if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        mouseRef.current = { x, y };
      } else {
        mouseRef.current = { x: -1000, y: -1000 };
      }
    };

    resize();
    window.addEventListener('resize', resize);
    // Listen on window so we get events even when other elements are on top
    window.addEventListener('mousemove', handleMouseMove);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw, initDots]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: 'var(--putty)' }}
    />
  );
}
