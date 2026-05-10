import React, { useEffect, useRef, useState } from 'react';

export type BeeEmotion = 'idle' | 'happy' | 'thinking' | 'surprised' | 'sleepy' | 'excited' | 'focused';

interface BeeEyesProps {
  emotion?: BeeEmotion;
  size?: number;
  isDark?: boolean;
}

const PUPIL_TRAVEL = 0.12; // fraction of iris radius the pupil can travel

export function BeeEyes({ emotion = 'idle', size = 52, isDark = true }: BeeEyesProps) {
  const leftRef  = useRef<SVGCircleElement>(null);
  const rightRef = useRef<SVGCircleElement>(null);
  const mouse    = useRef({ x: 0, y: 0 });
  const raf      = useRef(0);

  const [lPupil, setLPupil] = useState({ x: 0, y: 0 });
  const [rPupil, setRPupil] = useState({ x: 0, y: 0 });
  const [blink,  setBlink]  = useState(false);

  // Mouse tracking
  useEffect(() => {
    const mv = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', mv);
    return () => window.removeEventListener('mousemove', mv);
  }, []);

  // Pupil follow loop
  useEffect(() => {
    const irisR = size * 0.36;
    const maxTravel = irisR * PUPIL_TRAVEL * 3.5;

    const tick = () => {
      const getOffset = (ref: React.RefObject<SVGCircleElement>) => {
        if (!ref.current) return { x: 0, y: 0 };
        const r = ref.current.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        const dx = mouse.current.x - cx;
        const dy = mouse.current.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const t = Math.min(dist, maxTravel);
        return { x: (dx / dist) * t, y: (dy / dist) * t };
      };
      setLPupil(getOffset(leftRef));
      setRPupil(getOffset(rightRef));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [size]);

  // Random blink
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); schedule(); }, 130);
      }, 2500 + Math.random() * 4000);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  // --- Geometry ---
  const W  = size;
  const H  = size * 1.05;
  const cx = W / 2;
  const cy = H / 2 + size * 0.02;

  const outerR = size * 0.46;   // white sclera
  const irisR  = size * 0.30;   // colored iris
  const pupilR = size * 0.175;  // black pupil
  const glintR = size * 0.072;  // main sparkle
  const glint2 = size * 0.038;  // small sparkle

  // Eyelid clip: top=open, bottom=for squinting / blinking
  // We draw a rect clipping the top portion off based on squint
  const blinkScaleY = blink ? 0.04 : 1;

  // Squint (eyelid descends from top)
  const squintFrac: Record<BeeEmotion, number> = {
    idle:      0,
    happy:     0.28,
    thinking:  0.12,
    surprised: 0,
    sleepy:    0.55,
    excited:   0.15,
    focused:   0.08,
  };
  const sq = squintFrac[emotion];

  // Brow shape per emotion — described as a quadratic bezier curve
  // Each brow: start (sx,sy), control (cx,cy), end (ex,ey) in local eye coords
  // Positive y = down in SVG space
  const browH = size * 0.11;  // thickness
  type BrowCurve = { sx: number; sy: number; mx: number; my: number; ex: number; ey: number; yOff: number };

  const browConfigs: Record<BeeEmotion, { l: BrowCurve; r: BrowCurve }> = {
    idle: {
      l: { sx: cx - outerR * 0.75, sy: 0, mx: cx,             my: -size * 0.04, ex: cx + outerR * 0.75, ey: 0,            yOff: 0 },
      r: { sx: cx - outerR * 0.75, sy: 0, mx: cx,             my: -size * 0.04, ex: cx + outerR * 0.75, ey: 0,            yOff: 0 },
    },
    happy: {
      l: { sx: cx - outerR * 0.75, sy: size * 0.04, mx: cx,   my: -size * 0.10, ex: cx + outerR * 0.75, ey: size * 0.04, yOff: -size * 0.03 },
      r: { sx: cx - outerR * 0.75, sy: size * 0.04, mx: cx,   my: -size * 0.10, ex: cx + outerR * 0.75, ey: size * 0.04, yOff: -size * 0.03 },
    },
    thinking: {
      l: { sx: cx - outerR * 0.75, sy: -size * 0.06, mx: cx,  my: -size * 0.14, ex: cx + outerR * 0.75, ey: size * 0.02, yOff: -size * 0.05 },
      r: { sx: cx - outerR * 0.75, sy: size * 0.02,  mx: cx,  my: -size * 0.04, ex: cx + outerR * 0.75, ey: size * 0.02, yOff:  size * 0.02 },
    },
    surprised: {
      l: { sx: cx - outerR * 0.75, sy: 0, mx: cx,             my: -size * 0.18, ex: cx + outerR * 0.75, ey: 0,            yOff: -size * 0.08 },
      r: { sx: cx - outerR * 0.75, sy: 0, mx: cx,             my: -size * 0.18, ex: cx + outerR * 0.75, ey: 0,            yOff: -size * 0.08 },
    },
    sleepy: {
      l: { sx: cx - outerR * 0.75, sy: size * 0.08, mx: cx,   my:  size * 0.02, ex: cx + outerR * 0.75, ey: size * 0.08, yOff:  size * 0.04 },
      r: { sx: cx - outerR * 0.75, sy: size * 0.08, mx: cx,   my:  size * 0.02, ex: cx + outerR * 0.75, ey: size * 0.08, yOff:  size * 0.04 },
    },
    excited: {
      l: { sx: cx - outerR * 0.75, sy: size * 0.02, mx: cx,   my: -size * 0.16, ex: cx + outerR * 0.75, ey: size * 0.02, yOff: -size * 0.06 },
      r: { sx: cx - outerR * 0.75, sy: size * 0.02, mx: cx,   my: -size * 0.16, ex: cx + outerR * 0.75, ey: size * 0.02, yOff: -size * 0.06 },
    },
    focused: {
      l: { sx: cx - outerR * 0.75, sy: -size * 0.02, mx: cx,  my: -size * 0.10, ex: cx + outerR * 0.75, ey: size * 0.04, yOff: -size * 0.02 },
      r: { sx: cx - outerR * 0.75, sy: size * 0.04,  mx: cx,  my: -size * 0.10, ex: cx + outerR * 0.75, ey: -size * 0.02, yOff: -size * 0.02 },
    },
  };

  const browTopOffset = -outerR * 1.12; // brow sits above the eye

  const renderEye = (
    circleRef: React.RefObject<SVGCircleElement>,
    pupil: { x: number; y: number },
    browsConfig: BrowCurve
  ) => {
    const eyeId = Math.random().toString(36).slice(2); // unique for clip
    const clipId = `blinkclip-${eyeId}`;
    const gradId = `irisg-${eyeId}`;
    const glowId = `glow-${eyeId}`;

    // Eyelid descends by squint fraction from top of eye
    const lidClipY = cy - outerR + (outerR * 2 * sq);

    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Iris gradient */}
          <radialGradient id={gradId} cx="40%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#FFE566" />
            <stop offset="45%"  stopColor="#F5A623" />
            <stop offset="100%" stopColor="#D4851A" />
          </radialGradient>
          {/* Soft outer glow */}
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Blink / squint clip */}
          <clipPath id={clipId}>
            <rect
              x={cx - outerR - 2}
              y={lidClipY}
              width={(outerR + 2) * 2}
              height={(outerR + 2) * 2}
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: `scaleY(${blinkScaleY})`,
                transition: 'transform 0.07s ease',
              }}
            />
          </clipPath>
        </defs>

        {/* Sclera (white/cream — very soft) */}
        <circle
          cx={cx} cy={cy} r={outerR}
          fill={isDark ? '#F5EED8' : '#FFFCF0'}
          style={{ filter: `drop-shadow(0 3px 10px rgba(0,0,0,0.22))` }}
        />

        {/* Everything below clips for blinking/squinting */}
        <g clipPath={`url(#${clipId})`}>
          {/* Iris */}
          <circle
            ref={circleRef}
            cx={cx} cy={cy} r={irisR}
            fill={`url(#${gradId})`}
          />
          {/* Iris inner ring (depth) */}
          <circle cx={cx} cy={cy} r={irisR * 0.62} fill="#D4851A" opacity="0.25" />

          {/* Pupil */}
          <circle
            cx={cx + pupil.x}
            cy={cy + pupil.y}
            r={pupilR}
            fill="#1A1005"
          />

          {/* Main sparkle highlight */}
          <circle
            cx={cx + pupil.x + pupilR * 0.42}
            cy={cy + pupil.y - pupilR * 0.50}
            r={glintR}
            fill="white"
            opacity="0.95"
          />
          {/* Small secondary sparkle */}
          <circle
            cx={cx + pupil.x - pupilR * 0.30}
            cy={cy + pupil.y - pupilR * 0.62}
            r={glint2}
            fill="white"
            opacity="0.6"
          />
        </g>

        {/* Top eyelid curve (upper lid shadow for depth) */}
        <path
          d={`M ${cx - outerR} ${cy} A ${outerR} ${outerR} 0 0 1 ${cx + outerR} ${cy}`}
          fill="rgba(0,0,0,0.07)"
          clipPath={`url(#${clipId})`}
        />

        {/* Sclera rim */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />

        {/* BROW — drawn above eye using absolute y offset */}
        <g
          style={{
            transform: `translateY(${browTopOffset + browsConfig.yOff}px)`,
            transition: 'transform 0.4s cubic-bezier(0.34,1.4,0.64,1)',
          }}
        >
          <path
            d={`M ${browsConfig.sx} ${browsConfig.sy} Q ${browsConfig.mx} ${browsConfig.my} ${browsConfig.ex} ${browsConfig.ey}`}
            fill="none"
            stroke={isDark ? '#8B5E0A' : '#7A4E05'}
            strokeWidth={browH}
            strokeLinecap="round"
            style={{ transition: 'd 0.4s cubic-bezier(0.34,1.4,0.64,1), stroke 0.3s' }}
          />
        </g>
      </svg>
    );
  };

  const gap = size * 0.42;
  const bc = browConfigs[emotion];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap,
        userSelect: 'none',
        paddingTop: size * 0.32, // room for brows above
      }}
    >
      <div style={{ position: 'relative', width: W, height: H }}>
        {renderEye(leftRef,  lPupil, bc.l)}
      </div>
      <div style={{ position: 'relative', width: W, height: H }}>
        {renderEye(rightRef, rPupil, bc.r)}
      </div>
    </div>
  );
}
