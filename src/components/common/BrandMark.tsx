import React from 'react';

interface BrandMarkProps {
  inverted?: boolean;
  compact?: boolean;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ inverted = false, compact = false }) => {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width="28"
        height="28"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="36" height="36" rx="9" fill={inverted ? '#1E293B' : '#111827'} />
        <path
          d="M18 5.5L29 10V18.2C29 25 24.3 30.6 18 32.5C11.7 30.6 7 25 7 18.2V10L18 5.5Z"
          stroke="#3B82F6"
          strokeWidth="1.75"
          fill="#1E293B"
        />
        <path d="M10.5 21L14 16.5H22L25.5 21H10.5Z" fill="#3B82F6" />
        <path
          d="M11.5 24C13.8 22.7 15.8 25.3 18 24C20.2 22.7 22.2 25.3 24.5 24"
          stroke="#F8FAFC"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="18" cy="11.5" r="1.8" fill="#22C55E" />
      </svg>
      <span
        className={`font-display text-base font-bold tracking-tight ${
          inverted ? 'text-white' : 'text-[#111827]'
        }`}
      >
        {compact ? 'CapeSafe 360' : 'CapeSafe Connect 360'}
      </span>
    </span>
  );
};
