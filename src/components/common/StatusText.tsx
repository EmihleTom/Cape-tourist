import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';

type Tone = 'nominal' | 'advisory' | 'alert' | 'neutral';

interface StatusTextProps {
  label: string;
  tone?: Tone;
}

export const StatusText: React.FC<StatusTextProps> = ({ label, tone = 'neutral' }) => {
  const styles: Record<Tone, string> = {
    nominal: 'text-[#15803D]',
    advisory: 'text-amber-700',
    alert: 'text-red-700',
    neutral: 'text-slate-600',
  };

  const Icon =
    tone === 'nominal'
      ? CheckCircle2
      : tone === 'advisory'
      ? Clock
      : tone === 'alert'
      ? AlertTriangle
      : Info;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${styles[tone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};
