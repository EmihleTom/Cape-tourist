import React, { useEffect, useState } from 'react';
import { Car } from 'lucide-react';

interface VehiclePhotoProps {
  src?: string;
  alt: string;
  tierName?: string;
  variant?: 'card' | 'thumb';
  className?: string;
}

export const VehiclePhoto: React.FC<VehiclePhotoProps> = ({
  src,
  alt,
  tierName = 'Touring Vehicle',
  variant = 'card',
  className = '',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const showFallback = !src || failed;
  const aspectClass = variant === 'thumb' ? 'aspect-[4/3]' : 'aspect-[4/3]';
  const lowerTier = tierName.toLowerCase();
  const isMpv = lowerTier.includes('mpv') || lowerTier.includes('van') || lowerTier.includes('shuttle');
  const isSuv = lowerTier.includes('suv');

  return (
    <div
      className={`relative overflow-hidden bg-slate-100 ${aspectClass} ${className}`}
    >
      {/* Subtle loading placeholder backdrop while photo loads */}
      {!loaded && !showFallback && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/50 to-slate-100 text-slate-400"
        >
          <Car className="h-5 w-5 animate-pulse text-[#1D4ED8]/60" />
          {variant === 'card' && (
            <span className="mt-1 text-[10px] font-medium text-slate-500">
              Loading vehicle photo…
            </span>
          )}
        </div>
      )}

      {showFallback ? (
        <div
          role="img"
          aria-label={alt}
          className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200/70 px-3 text-center text-slate-600"
        >
          <svg
            viewBox="0 0 120 56"
            className={variant === 'thumb' ? 'h-8 w-14 text-[#1D4ED8]' : 'h-12 w-24 text-[#1D4ED8]'}
            fill="none"
            aria-hidden="true"
          >
            {isMpv ? (
              <path
                d="M12 36V22c0-4 3-7 7-7h55c6 0 12 4 17 10l9 4c4 1 6 4 6 7v4H96m-58 0h40M12 36H8c-2 0-3-1.5-3-3.5V29"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : isSuv ? (
              <path
                d="M12 37V24c0-4 4-8 10-8h40c5 0 9 3 13 7l15 3c5 1 9 4 9 9v2h-8m-53 0h37M12 37H7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M10 37V28c0-3 3-5 7-6l12-7h34c6 0 11 4 16 9l15 3c4 1 7 4 7 8v2h-8m-55 0h39M10 37H6"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <circle cx="30" cy="39" r="7" fill="#FFFFFF" stroke="#111827" strokeWidth="3" />
            <circle cx="88" cy="39" r="7" fill="#FFFFFF" stroke="#111827" strokeWidth="3" />
          </svg>
          {variant === 'card' && (
            <span className="mt-1.5 text-[11px] font-semibold text-[#111827]">
              {tierName}
            </span>
          )}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover object-center transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};
