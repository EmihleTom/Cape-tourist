import React from 'react';
import { Layers } from 'lucide-react';

interface ComingSoonBannerProps {
  moduleName: string;
  plannedIntegration: string;
}

export const ComingSoonBanner: React.FC<ComingSoonBannerProps> = ({
  moduleName,
  plannedIntegration,
}) => {
  return (
    <div className="rounded-lg border border-teal-200 bg-[#F0FDFA] px-4 py-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 h-4 w-4 text-[#0D9488] shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-display text-sm font-semibold text-[#0B1F3A]">
              {moduleName} — Preview & Planned Expansion
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
              Interactive frontend preview using demonstration records. Planned backend integration: {plannedIntegration}.
            </p>
          </div>
        </div>
        <span className="font-mono text-xs font-medium text-[#0D9488] whitespace-nowrap shrink-0">
          Phase 2 Roadmap
        </span>
      </div>
    </div>
  );
};
