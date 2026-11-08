import React, { useId } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  onClick,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const brandId = `brand-${uid}`;
  const glowId = `glow-${uid}`;
  const shineId = `shine-${uid}`;

  const dimensions = {
    sm: { icon: 30, text: 'text-base', dot: 'w-1.5 h-1.5', gap: 'gap-2', sub: 'text-[8px]' },
    md: { icon: 38, text: 'text-xl', dot: 'w-2 h-2', gap: 'gap-2.5', sub: 'text-[9px]' },
    lg: { icon: 48, text: 'text-2xl', dot: 'w-2.5 h-2.5', gap: 'gap-3', sub: 'text-[10px]' },
    xl: { icon: 64, text: 'text-3xl', dot: 'w-3 h-3', gap: 'gap-3.5', sub: 'text-[11px]' },
  }[size];

  const iconPx = dimensions.icon;

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${dimensions.gap} select-none ${
        onClick ? 'cursor-pointer active:scale-[0.97] transition-transform' : ''
      } ${className}`}
    >
      <div className="relative shrink-0 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-[30%] blur-lg opacity-60 bg-gradient-to-tr from-[#f472b6] via-[#8b5cf6] to-[#22d3ee]"
          style={{ width: iconPx * 0.86, height: iconPx * 0.86 }}
          aria-hidden="true"
        />

        <svg
          width={iconPx}
          height={iconPx}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative drop-shadow-[0_6px_18px_rgba(99,102,241,0.45)]"
          role="img"
          aria-label="U-R-LIVE"
        >
          <defs>
            <linearGradient id={brandId} x1="10" y1="8" x2="92" y2="94" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="46%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient id={shineId} x1="20" y1="12" x2="70" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Deep glass tile */}
          <rect x="5" y="5" width="90" height="90" rx="27" fill="#0b0917" />
          <rect x="5.6" y="5.6" width="88.8" height="88.8" rx="26.5" stroke={`url(#${brandId})`} strokeWidth="1.4" strokeOpacity="0.85" />

          {/* Orbital signal sweeps */}
          <g opacity="0.9">
            <path
              d="M24 51c0-14.9 12.1-27 27-27"
              stroke={`url(#${brandId})`}
              strokeWidth="3.2"
              strokeLinecap="round"
              opacity="0.55"
            />
            <path
              d="M32 51c0-10.5 8.5-19 19-19"
              stroke={`url(#${brandId})`}
              strokeWidth="2.6"
              strokeLinecap="round"
              opacity="0.8"
            />
            <circle cx="76" cy="26" r="4.2" fill="#22d3ee" />
            <circle cx="76" cy="26" r="8.6" stroke="#22d3ee" strokeWidth="1.3" opacity="0.35" />
          </g>

          {/* Live beacon / play core */}
          <g filter={`url(#${glowId})`}>
            <circle cx="51" cy="54" r="21" fill={`url(#${brandId})`} fillOpacity="0.18" stroke={`url(#${brandId})`} strokeWidth="1.6" />
            <path
              d="M45.5 44.6c0-2.4 2.6-3.9 4.7-2.6l14.6 9.3c2 1.3 2 4.2 0 5.5l-14.6 9.3c-2.1 1.3-4.7-.2-4.7-2.6V44.6Z"
              fill="#ffffff"
            />
          </g>

          {/* Top sheen */}
          <path d="M20 34c4-12 15-20 30-20" stroke={`url(#${shineId})`} strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className={`font-display font-extrabold tracking-tight text-white ${dimensions.text} flex items-center`}>
              <span>U-R-</span>
              <span className="text-gradient-brand">LIVE</span>
            </span>
            <span className="relative flex items-center justify-center" aria-hidden="true">
              <span className={`${dimensions.dot} rounded-full bg-[#f472b6] animate-ping absolute opacity-70`} />
              <span className={`${dimensions.dot} rounded-full bg-gradient-to-tr from-[#f472b6] to-[#22d3ee] relative`} />
            </span>
          </div>
          <span className={`tracking-[0.18em] uppercase font-bold text-neutral-500 mt-1 ${dimensions.sub}`}>
            Live video social
          </span>
        </div>
      )}
    </div>
  );
};
