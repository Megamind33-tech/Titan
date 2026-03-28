import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { PlacementValidationResult, PlacementStatus } from '../types/collision';

interface PlacementFeedbackIndicatorProps {
  result: PlacementValidationResult | null;
  objectName?: string;
}

const STATUS_CONFIG: Record<
  PlacementStatus,
  { icon: React.ReactNode; label: string; border: string; bg: string; text: string; glow: string }
> = {
  valid: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    label: 'VALID PLACEMENT',
    border: 'border-green-500/30',
    bg:     'bg-green-500/10',
    text:   'text-green-400',
    glow:   'shadow-[0_0_12px_rgba(74,222,128,0.15)]',
  },
  warning: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: 'PLACEMENT WARNING',
    border: 'border-yellow-500/30',
    bg:     'bg-yellow-500/10',
    text:   'text-yellow-400',
    glow:   'shadow-[0_0_12px_rgba(234,179,8,0.15)]',
  },
  invalid: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: 'INVALID PLACEMENT',
    border: 'border-red-500/30',
    bg:     'bg-red-500/10',
    text:   'text-red-400',
    glow:   'shadow-[0_0_12px_rgba(248,113,113,0.15)]',
  },
};

export default function PlacementFeedbackIndicator({
  result,
  objectName,
}: PlacementFeedbackIndicatorProps) {
  if (!result) return null;

  const cfg = STATUS_CONFIG[result.status];

  // On mobile / small screens keep it compact
  return (
    <div
      className={`pointer-events-none select-none rounded-lg border backdrop-blur-md
                  ${ cfg.bg } ${ cfg.border } ${ cfg.glow }
                  px-3 py-2.5 max-w-[280px] w-full`}
    >
      {/* Status row */}
      <div className={`flex items-center gap-2 ${ cfg.text }`}>
        {cfg.icon}
        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em]">
          {cfg.label}
        </span>
      </div>

      {/* Object name */}
      {objectName && (
        <p className="text-[8px] font-mono text-white/30 mt-0.5 truncate">
          {objectName}
        </p>
      )}

      {/* Violations list */}
      {result.violations.length > 0 && (
        <ul className="mt-2 space-y-1">
          {result.violations.map((v, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span
                className={`mt-[2px] flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                  v.severity === 'error' ? 'bg-red-400' : 'bg-yellow-400'
                }`}
              />
              <span className="text-[8px] font-mono text-white/50 leading-snug">
                {v.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Snap hint */}
      {result.snapTarget && result.status !== 'invalid' && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-1.5">
          <Info className="w-2.5 h-2.5 text-white/20 flex-shrink-0" />
          <span className="text-[8px] font-mono text-white/25">
            Surface snap available at Y = {result.snapTarget.surfaceY.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
