"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#2d5a3d", "#67a67d", "#b8834a"];
const PARTICLE_COUNT = 70;

interface Particle {
  x: number;
  y: number;
  phase1: number;
  phase2: number;
  freq1: number;
  freq2: number;
  radius: number;
  colorIndex: number;
}

export function AmbientFlowField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      phase1: (i * 0.618) % (Math.PI * 2),
      phase2: (i * 1.303) % (Math.PI * 2),
      freq1: 0.15 + (i % 5) * 0.03,
      freq2: 0.08 + (i % 7) * 0.02,
      radius: 1 + ((i * 37) % 10) / 10,
      colorIndex: i % COLORS.length,
    }));

    let raf = 0;
    let t = 0;

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      for (const p of particles) {
        const angle =
          Math.sin(t * p.freq1 + p.phase1) * 1.4 +
          Math.sin(t * p.freq2 + p.phase2) * 1.1;
        const speed = 0.35;
        p.x += Math.cos(angle) * speed;
        p.y += Math.sin(angle) * speed;

        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = COLORS[p.colorIndex];
        ctx!.globalAlpha = 0.22;
        ctx!.fill();
      }
      t += 0.016;
      if (!reduceMotion) {
        raf = requestAnimationFrame(draw);
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
