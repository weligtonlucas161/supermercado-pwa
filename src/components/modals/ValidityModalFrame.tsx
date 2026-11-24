import type { ReactNode } from 'react';
import { Calendar, X } from 'lucide-react';

export function ValidityModalFrame({ title, description, onClose, busy, children }: {
  title: string; description: string; onClose: () => void; busy?: boolean; children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">{description}</p>
            </div>
          </div>
          <button type="button" aria-label="Fechar" disabled={busy} onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
