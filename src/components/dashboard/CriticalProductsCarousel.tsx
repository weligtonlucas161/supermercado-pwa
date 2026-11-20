import React from 'react';
import { AlertTriangle, CalendarClock, ChevronRight, PackageX } from 'lucide-react';

export type CriticalItemKind = 'ruptura' | 'vencido';

export interface CriticalProductItem {
  key: string;
  kind: CriticalItemKind;
  name: string;
  sector?: string;
  code?: string;
  stock?: number;
  minStock?: number;
  quantity?: number;
  dueDate?: string;
  batch?: string;
}

interface CriticalProductsCarouselProps {
  title: string;
  subtitle?: string;
  items: CriticalProductItem[];
  onSeeAll: () => void;
  onItemClick: (item: CriticalProductItem) => void;
  emptyMessage: string;
  /** Exibe o selo "Ruptura"/"Vencido" em cada card (usado no carrossel misto). */
  showKindBadge?: boolean;
}

const formatDate = (iso?: string): string => {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
};

const daysUntil = (iso?: string): number | null => {
  if (!iso) return null;
  const due = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const ItemCard: React.FC<{
  item: CriticalProductItem;
  showKindBadge?: boolean;
  onOpen: () => void;
}> = ({ item, showKindBadge, onOpen }) => {
  const isRuptura = item.kind === 'ruptura';
  const isZeroed = isRuptura && (item.stock ?? 0) <= 0;
  const days = isRuptura ? null : daysUntil(item.dueDate);
  const isOverdue = days !== null && days < 0;
  const expiresToday = days === 0;

  const accent = isRuptura
    ? isZeroed
      ? { icon: 'bg-rose-500/15 text-rose-600', badge: 'bg-rose-500/15 text-rose-600 border-rose-500/25', button: 'bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 border-rose-500/30' }
      : { icon: 'bg-amber-500/15 text-amber-600', badge: 'bg-amber-500/15 text-amber-600 border-amber-500/25', button: 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/30' }
    : { icon: 'bg-rose-500/15 text-rose-600', badge: 'bg-rose-500/15 text-rose-600 border-rose-500/25', button: 'bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 border-rose-500/30' };

  const badgeLabel = showKindBadge
    ? isRuptura
      ? isZeroed
        ? 'Ruptura • Zerado'
        : 'Ruptura • Crítico'
      : 'Vencido'
    : isRuptura
    ? isZeroed
      ? 'Zerado'
      : 'Estoque crítico'
    : isOverdue
    ? 'Vencido'
    : expiresToday
    ? 'Vence hoje'
    : 'Vencido';

  const detail = isRuptura
    ? `${item.stock ?? 0}/${item.minStock ?? 0} un em estoque`
    : `Vence ${formatDate(item.dueDate)}${isOverdue && days !== null ? ` • há ${Math.abs(days)}d` : expiresToday ? ' • hoje' : ''}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="snap-start shrink-0 w-[238px] sm:w-[262px] text-left flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-md p-3 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`p-2 rounded-xl ${accent.icon}`}>
          {isRuptura ? <PackageX className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
        </div>
        <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md border ${accent.badge}`}>
          {badgeLabel}
        </span>
      </div>

      <div className="mt-2">
        <h4 className="text-xs font-extrabold text-slate-900 leading-snug line-clamp-2 min-h-[32px]">
          {item.name}
        </h4>
        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
          {item.sector || 'Sem setor'}
          {item.code ? ` • ${item.code}` : ''}
          {!isRuptura && item.batch ? ` • Lote ${item.batch}` : ''}
        </p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold ${isRuptura ? (isZeroed ? 'text-rose-600' : 'text-amber-600') : 'text-rose-600'}`}>
          {detail}
        </span>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border ${accent.button}`}>
          {isRuptura ? 'Repor' : 'Ver lote'}
        </span>
      </div>
    </button>
  );
};

/**
 * Carrossel horizontal de produtos críticos (ruptura e/ou vencidos).
 * Rolagem por toque (snap) no mobile e por mouse/trackpad no desktop.
 */
export const CriticalProductsCarousel: React.FC<CriticalProductsCarouselProps> = ({
  title,
  subtitle,
  items,
  onSeeAll,
  onItemClick,
  emptyMessage,
  showKindBadge = false,
}) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-xl bg-slate-900/5 text-slate-700">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span className="truncate">{title}</span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-slate-900/5 text-slate-600">
                {items.length}
              </span>
            </h3>
            {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={onSeeAll}
          className="shrink-0 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 cursor-pointer"
        >
          Ver todos
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-[11px] text-slate-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-3 flex gap-2.5 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 -mx-1 px-1">
          {items.map(item => (
            <ItemCard
              key={item.key}
              item={item}
              showKindBadge={showKindBadge}
              onOpen={() => onItemClick(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
};
