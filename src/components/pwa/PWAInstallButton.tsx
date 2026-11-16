import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'default' | 'subtle';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'default' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'subtle'
            ? 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
          Install on iOS
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
              <h3 id="ios-install-title" className="font-display text-lg font-bold text-[#111827]">
                Install CapeSafe 360 on iOS
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                1. Tap the <strong>Share</strong> icon in the Safari toolbar.
                <br />
                2. Scroll down and select <strong>Add to Home Screen</strong> for offline trail passes and safety tools.
              </p>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#111827] py-2.5 text-sm font-medium text-white hover:bg-[#1E293B] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
