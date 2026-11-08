import React from 'react';

export interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
  variant?: 'mark' | 'full';
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  onClick,
  variant,
}) => {
  const dimensions = {
    xs: { icon: 24, text: 'text-sm', dot: 'w-1 h-1', gap: 'gap-1.5', sub: 'text-[7px]' },
    sm: { icon: 32, text: 'text-base', dot: 'w-1.5 h-1.5', gap: 'gap-2', sub: 'text-[8px]' },
    md: { icon: 40, text: 'text-xl', dot: 'w-2 h-2', gap: 'gap-2.5', sub: 'text-[9px]' },
    lg: { icon: 52, text: 'text-2xl', dot: 'w-2.5 h-2.5', gap: 'gap-3', sub: 'text-[10px]' },
    xl: { icon: 68, text: 'text-3xl', dot: 'w-3 h-3', gap: 'gap-3.5', sub: 'text-[11px]' },
  }[size];

  const iconPx = dimensions.icon;

  if (variant === 'full') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center select-none ${
          onClick ? 'cursor-pointer active:scale-[0.97] transition-transform' : ''
        } ${className}`}
      >
        <img
          src="/logo.png"
          alt="UR Live"
          className="object-contain drop-shadow-[0_4px_16px_rgba(239,68,68,0.35)]"
          style={{ height: iconPx * 1.5, maxHeight: '100%' }}
          loading="eager"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${dimensions.gap} select-none ${
        onClick ? 'cursor-pointer active:scale-[0.97] transition-transform' : ''
      } ${className}`}
    >
      <div className="relative shrink-0 flex items-center justify-center">
        {/* Brand red ambient glow */}
        <div
          className="absolute inset-0 rounded-2xl blur-md opacity-60 bg-gradient-to-tr from-[#dc2626] via-[#ef4444] to-[#f43f5e]"
          style={{ width: iconPx * 0.9, height: iconPx * 0.9 }}
          aria-hidden="true"
        />

        <img
          src="/logo-icon.png"
          alt="UR Live Logo"
          width={iconPx}
          height={iconPx}
          className="relative drop-shadow-[0_4px_14px_rgba(239,68,68,0.5)] object-contain transition-transform duration-200"
          style={{ width: iconPx, height: iconPx }}
          loading="eager"
          decoding="async"
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className={`font-display font-extrabold tracking-tight text-white ${dimensions.text} flex items-center`}>
              <span>UR</span>
              <span className="ml-1 bg-gradient-to-r from-[#ef4444] via-[#f43f5e] to-[#fb7185] bg-clip-text text-transparent">LIVE</span>
            </span>
            <span className="relative flex items-center justify-center" aria-hidden="true">
              <span className={`${dimensions.dot} rounded-full bg-[#ef4444] animate-ping absolute opacity-75`} />
              <span className={`${dimensions.dot} rounded-full bg-gradient-to-tr from-[#ef4444] to-[#fb7185] relative`} />
            </span>
          </div>
          <span className={`tracking-[0.18em] uppercase font-bold text-neutral-400 mt-1 ${dimensions.sub}`}>
            Live video social
          </span>
        </div>
      )}
    </div>
  );
};
