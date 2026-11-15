import React, { useState } from 'react';
import { Mountain } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className = 'h-full w-full object-cover',
  fallbackLabel,
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0B1F3A] via-[#102A43] to-[#0D9488] p-4 text-center text-white"
        role="img"
        aria-label={alt}
      >
        <Mountain className="h-8 w-8 text-teal-300" aria-hidden="true" />
        <span className="mt-2 font-display text-xs font-medium text-slate-100">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
