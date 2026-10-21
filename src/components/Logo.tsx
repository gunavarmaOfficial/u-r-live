import React from 'react';

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
  // Dimension definitions
  const dimensions = {
    sm: { icon: 26, text: 'text-base', dot: 'w-1.5 h-1.5', gap: 'gap-2' },
    md: { icon: 34, text: 'text-xl', dot: 'w-2 h-2', gap: 'gap-2.5' },
    lg: { icon: 44, text: 'text-2xl', dot: 'w-2.5 h-2.5', gap: 'gap-3' },
    xl: { icon: 56, text: 'text-3xl', dot: 'w-3 h-3', gap: 'gap-3.5' },
  }[size];

  const iconPx = dimensions.icon;

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${dimensions.gap} select-none ${
        onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''
      } ${className}`}
    >
      {/* Colourful Streaming Emblem */}
      <div className="relative shrink-0 flex items-center justify-center">
        {/* Ambient Glow behind the logo */}
        <div
          className="absolute inset-0 rounded-full blur-md opacity-40 bg-gradient-to-tr from-[#FF007A] via-[#7928CA] to-[#00DFD8]"
          style={{ width: iconPx, height: iconPx }}
        />

        <svg
          width={iconPx}
          height={iconPx}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative drop-shadow-md"
        >
          <defs>
            {/* Vivid multi-stop gradients matching the colourful streaming logo */}
            <linearGradient id="urLiveGradPink" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF385C" />
              <stop offset="50%" stopColor="#FF007A" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>

            <linearGradient id="urLiveGradPurple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7928CA" />
              <stop offset="50%" stopColor="#9333EA" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>

            <linearGradient id="urLiveGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F2FE" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>

            <linearGradient id="urLiveGradOrange" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF8A00" />
              <stop offset="60%" stopColor="#FF385C" />
              <stop offset="100%" stopColor="#FF007A" />
            </linearGradient>

            {/* Glowing filter for highlights */}
            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#FF007A" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Rounded base badge background */}
          <rect
            x="4"
            y="4"
            width="92"
            height="92"
            rx="26"
            fill="#121216"
            stroke="url(#urLiveGradPink)"
            strokeWidth="1.5"
            strokeOpacity="0.35"
          />

          {/* Ribbon 1: Left dynamic curve (Cyan / Teal to Blue) */}
          <path
            d="M 26 28 C 38 18, 54 22, 60 34 C 64 42, 60 52, 50 56 C 36 62, 22 50, 26 28 Z"
            fill="url(#urLiveGradCyan)"
            opacity="0.9"
          />

          {/* Ribbon 2: Sweeping energetic ribbon (Orange to Hot Pink) */}
          <path
            d="M 74 72 C 62 82, 46 78, 40 66 C 36 58, 40 48, 50 44 C 64 38, 78 50, 74 72 Z"
            fill="url(#urLiveGradOrange)"
            opacity="0.95"
          />

          {/* Ribbon 3: Violet / Magenta overlapping wave */}
          <path
            d="M 32 68 C 22 54, 26 36, 42 26 C 56 18, 74 24, 76 40 C 78 58, 58 78, 32 68 Z"
            fill="url(#urLiveGradPurple)"
            opacity="0.8"
            style={{ mixBlendMode: 'screen' }}
          />

          {/* Center Streaming Play / Signal Beacon Mark */}
          <g filter="url(#glowEffect)">
            {/* Play triangle with rounded vertices */}
            <path
              d="M 45 38 C 45 35.8, 47.4 34.4, 49.3 35.6 L 65 46.2 C 66.8 47.4, 66.8 50.1, 65 51.3 L 49.3 61.9 C 47.4 63.1, 45 61.7, 45 59.5 Z"
              fill="#FFFFFF"
            />
          </g>

          {/* Pulsing broadcast ripples in the corner */}
          <circle cx="76" cy="24" r="5" fill="#FF385C" />
          <circle cx="76" cy="24" r="8" stroke="#FF385C" strokeWidth="1.5" opacity="0.6" />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight text-white font-sans ${dimensions.text} flex items-center`}
            >
              <span>U-R-</span>
              <span className="bg-gradient-to-r from-[#FF385C] via-[#FF007A] to-[#A855F7] bg-clip-text text-transparent">
                LIVE
              </span>
            </span>
            {/* Live indicator dot */}
            <span className="relative flex items-center justify-center">
              <span
                className={`${dimensions.dot} rounded-full bg-[#FF385C] animate-ping absolute opacity-75`}
              />
              <span className={`${dimensions.dot} rounded-full bg-[#FF385C] relative`} />
            </span>
          </div>
          <span className="text-[9px] tracking-wider uppercase font-semibold text-neutral-400 mt-0.5">
            Stream • Connect
          </span>
        </div>
      )}
    </div>
  );
};
