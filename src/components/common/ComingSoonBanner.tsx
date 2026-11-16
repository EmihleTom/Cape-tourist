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
    <div className="rounded-lg border border-blue-200 bg-[#EFF6FF] px-4 py-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 h-4 w-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-display text-sm font-semibold text-[#111827]">
              {moduleName} — Preview & Planned Expansion
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
              Interactive frontend preview using demonstration records. Planned backend integration: {plannedIntegration}.
            </p>
          </div>
        </div>
        <span className="font-mono text-xs font-medium text-[#1D4ED8] whitespace-nowrap shrink-0">
          Phase 2 Roadmap
        </span>
      </div>
    </div>
  );
};
