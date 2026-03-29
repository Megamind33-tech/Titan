import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface InspectorSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

export function InspectorSection({ title, children, defaultOpen = false, badge }: InspectorSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10">
      <button
        className="w-full text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest flex justify-between items-center hover:bg-white/5 transition-colors group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="group-hover:text-white transition-colors">{title}</span>
          {badge && (
            <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-[2px] text-[7px] font-bold tracking-tighter">
              {badge}
            </span>
          )}
        </div>
        <span className="text-[8px] opacity-50">
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </button>
      {isOpen && <div className="p-4 pt-0 space-y-4">{children}</div>}
    </div>
  );
}
