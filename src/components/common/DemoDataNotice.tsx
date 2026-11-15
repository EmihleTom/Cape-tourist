import React from 'react';
import { Database } from 'lucide-react';

interface DemoDataNoticeProps {
  scope?: string;
  compact?: boolean;
}

export const DemoDataNotice: React.FC<DemoDataNoticeProps> = ({
  scope = 'Simulated Cape Town schedules, advisories, and sample accounts',
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-slate-600">
        <Database className="h-3.5 w-3.5 text-[#0D9488] shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-[#0B1F3A]">Demonstration Data</strong>
          <span aria-hidden="true"> · </span>
          <span>{scope}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5 sm:items-center">
        <Database className="mt-0.5 h-4 w-4 text-[#0D9488] shrink-0 sm:mt-0" aria-hidden="true" />
        <p className="text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-[#0B1F3A]">Demonstration Environment:</span>{' '}
          {scope}. Live municipal feeds and Firebase persistence connect in backend integration phase.
        </p>
      </div>
      <span className="font-mono text-xs text-slate-500 whitespace-nowrap shrink-0">
        Origin: Demo Dataset
      </span>
    </div>
  );
};
