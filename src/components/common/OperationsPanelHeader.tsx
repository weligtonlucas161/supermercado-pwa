import type { LucideIcon } from 'lucide-react';

export function OperationsPanelHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
      <div className="shrink-0 rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
    </header>
  );
}
