export default function BeeEyesSVG() {
  return (
    <svg
      width="100%"
      viewBox="0 0 680 280"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="irisG" cx="40%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#FFD84D" />
          <stop offset="60%"  stopColor="#F5A800" />
          <stop offset="100%" stopColor="#C87A00" />
        </radialGradient>
        <radialGradient id="pupilG" cx="38%" cy="32%" r="55%">
          <stop offset="0%"   stopColor="#5C3A1E" />
          <stop offset="100%" stopColor="#2A1A0A" />
        </radialGradient>
      </defs>

      {/* Olho Esquerdo */}
      <g transform="translate(170, 155)">
        <ellipse rx="78" ry="80" fill="white" stroke="#E0E0E0" strokeWidth="2" />
        <circle cx="0" cy="8" r="50" fill="url(#irisG)" />
        <circle cx="0" cy="8" r="27" fill="url(#pupilG)" />
        <ellipse cx="-12" cy="-4" rx="10" ry="13" fill="white" fillOpacity="0.90" />
        <circle cx="14" cy="18" r="5" fill="white" fillOpacity="0.55" />
        <path d="M-60,-105 Q0,-128 60,-105" stroke="#8B5E1A" strokeWidth="10" strokeLinecap="round" fill="none" />
      </g>

      {/* Olho Direito */}
      <g transform="translate(510, 155)">
        <ellipse rx="78" ry="80" fill="white" stroke="#E0E0E0" strokeWidth="2" />
        <circle cx="0" cy="8" r="50" fill="url(#irisG)" />
        <circle cx="0" cy="8" r="27" fill="url(#pupilG)" />
        <ellipse cx="-12" cy="-4" rx="10" ry="13" fill="white" fillOpacity="0.90" />
        <circle cx="14" cy="18" r="5" fill="white" fillOpacity="0.55" />
        <path d="M-60,-105 Q0,-128 60,-105" stroke="#8B5E1A" strokeWidth="10" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
