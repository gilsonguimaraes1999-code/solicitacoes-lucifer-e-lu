"use client";

import { useEffect, useRef } from "react";

export function StarfieldBackground({ density = .7 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const surface = canvas;
    const drawing = context;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stars: { x: number; y: number; z: number; size: number; gold: boolean; phase: number }[] = [];
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const maxDepth = 1500;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let focal = 600;
    let frame = 0;

    function reset(star: (typeof stars)[number], scatter = false) {
      const spread = Math.max(width, height, 900);
      star.x = (Math.random() - .5) * spread * 2.2;
      star.y = (Math.random() - .5) * spread * 1.55;
      star.z = scatter ? 50 + Math.random() * maxDepth : maxDepth;
      star.size = .5 + Math.random() * 1.5;
      star.gold = Math.random() > .7;
      star.phase = Math.random() * Math.PI * 2;
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      focal = Math.min(width, height) * .9;
      surface.width = Math.floor(width * dpr);
      surface.height = Math.floor(height * dpr);
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      drawing.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(760, Math.max(320, (width * height) / 2600)) * density);
      while (stars.length < count) { const star = { x: 0, y: 0, z: 0, size: 0, gold: false, phase: 0 }; reset(star, true); stars.push(star); }
      stars.length = count;
    }

    function draw(now: number, animate = true) {
      pointer.x += (pointer.targetX - pointer.x) * .025;
      pointer.y += (pointer.targetY - pointer.y) * .025;
      drawing.clearRect(0, 0, width, height);
      for (const star of stars) {
        if (!reduceMotion) star.z -= .65;
        const perspective = focal / Math.max(10, star.z);
        const x = width / 2 + pointer.x * 38 + star.x * perspective;
        const y = height / 2 + pointer.y * 28 + star.y * perspective;
        if (star.z < 10 || x < -120 || x > width + 120 || y < -120 || y > height + 120) { reset(star); continue; }
        const closeness = 1 - star.z / maxDepth;
        const alpha = Math.min(.95, .16 + closeness) * (.8 + Math.sin(now * .003 + star.phase) * .18);
        drawing.beginPath();
        drawing.arc(x, y, Math.max(.45, star.size * (.5 + closeness * 2.7)), 0, Math.PI * 2);
        drawing.fillStyle = star.gold ? `rgba(212,175,55,${alpha})` : `rgba(255,255,255,${alpha})`;
        drawing.fill();
      }
      if (animate) frame = requestAnimationFrame(draw);
    }

    function move(event: PointerEvent) {
      pointer.targetX = (event.clientX / Math.max(width, 1) - .5) * 2;
      pointer.targetY = (event.clientY / Math.max(height, 1) - .5) * 2;
    }

    resize();
    const onResize = () => { resize(); if (reduceMotion) draw(0, false); };
    window.addEventListener("resize", onResize);
    if (reduceMotion) draw(0, false);
    else {
      window.addEventListener("pointermove", move);
      frame = requestAnimationFrame(draw);
    }
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", onResize); window.removeEventListener("pointermove", move); };
  }, [density]);

  return <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true"><div className="absolute inset-0 bg-[linear-gradient(180deg,#050505_0%,#0a0a0a_58%,#020202_100%)]" /><canvas ref={canvasRef} className="absolute inset-0 h-full w-full" /></div>;
}
