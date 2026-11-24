import { isSectorManager } from '../../utils/sectorManager';
import React, { useState } from 'react';
import { Home, Calendar, Package, ClipboardCheck, Settings, Building2, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TabId } from '../../types';

interface NavItemProps {
  tabId: TabId;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  zoomed: boolean;
  onClick: () => void;
  badge?: number;
}

const NavItem: React.FC<NavItemProps> = ({ tabId, icon, label, active, zoomed, onClick, badge }) => {
  return (
    <button
      type="button"
      data-nav-tab={tabId}
      onClick={onClick}
      className={`nav-dock-item flex flex-col items-center justify-center w-14 sm:w-16 py-1.5 rounded-2xl relative select-none cursor-pointer ${
        zoomed ? 'nav-dock-zoomed' : ''
      } ${
        active
          ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <div className="relative pointer-events-none">
        {icon}
        {typeof badge === 'number' && badge > 0 && (
          <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-xs">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight pointer-events-none">{label}</span>
    </button>
  );
};

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, validities, products, isGerente, currentUser, storeColor, isInventoryLocked } = useApp();
  const [touchedTab, setTouchedTab] = useState<TabId | null>(null);

  if (isInventoryLocked) {
    return (
      <div className="fixed bottom-3 sm:bottom-4 left-3 right-3 sm:left-4 sm:right-4 z-40 max-w-xl mx-auto pointer-events-none">
        <div className="pointer-events-auto rounded-2xl border border-amber-500/40 bg-amber-500/95 text-slate-950 px-4 py-2.5 shadow-2xl text-center text-xs font-black">
          Modo Restrito Ativo — Aguarde a conclusão do Inventário Cego para navegar
        </div>
      </div>
    );
  }

  const urgentValiditiesCount = validities.filter(v => v.status === 'urgent').length;
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const hasStoreAccess = isGerente || currentUser?.cargo === 'gerente' || currentUser?.cargo === 'adm';

  const updateTouchedTabFromEvent = (e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = el?.closest('[data-nav-tab]') as HTMLElement | null;
    const nextTab = target?.getAttribute('data-nav-tab') as TabId | null;
    setTouchedTab(nextTab || null);
  };

  return (
    <div className="fixed bottom-3 sm:bottom-4 left-3 right-3 sm:left-4 sm:right-4 z-40 max-w-xl mx-auto pointer-events-none">
      <nav
        onTouchStart={updateTouchedTabFromEvent}
        onTouchMove={updateTouchedTabFromEvent}
        onTouchEnd={() => setTouchedTab(null)}
        onTouchCancel={() => setTouchedTab(null)}
        className="pointer-events-auto rounded-3xl border border-slate-200/90 bg-white dark:bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-xl px-2 py-1.5 shadow-2xl shadow-slate-900/15 transition-all flex justify-around items-center ring-1 ring-black/5"
        style={{ borderColor: `${storeColor}35` }}
      >
        <NavItem
          tabId="inicio"
          icon={<Home className="w-5 h-5" />}
          label="Início"
          active={activeTab === 'inicio'}
          zoomed={touchedTab === 'inicio'}
          onClick={() => setActiveTab('inicio')}
        />
        <NavItem
          tabId="validade"
          icon={<Calendar className="w-5 h-5" />}
          label="Validade"
          active={activeTab === 'validade'}
          zoomed={touchedTab === 'validade'}
          badge={urgentValiditiesCount}
          onClick={() => setActiveTab('validade')}
        />
        <NavItem
          tabId="estoque"
          icon={<Package className="w-5 h-5" />}
          label="Estoque"
          active={activeTab === 'estoque'}
          zoomed={touchedTab === 'estoque'}
          badge={lowStockCount}
          onClick={() => setActiveTab('estoque')}
        />
        <NavItem
          tabId="auditoria"
          icon={<ClipboardCheck className="w-5 h-5" />}
          label="Auditoria"
          active={activeTab === 'auditoria'}
          zoomed={touchedTab === 'auditoria'}
          onClick={() => setActiveTab('auditoria')}
        />
        {hasStoreAccess && (
          <NavItem
            tabId="loja"
            icon={<Building2 className="w-5 h-5" />}
            label="Loja"
            active={activeTab === 'loja'}
            zoomed={touchedTab === 'loja'}
            onClick={() => setActiveTab('loja')}
          />
        )}
        {isSectorManager(currentUser) && (
          <NavItem tabId="equipe" icon={<Users className="w-5 h-5" />} label="Equipe"
            active={activeTab === 'equipe'} zoomed={touchedTab === 'equipe'} onClick={() => setActiveTab('equipe')} />
        )}
        <NavItem
          tabId="configuracoes"
          icon={<Settings className="w-5 h-5" />}
          label="Ajustes"
          active={activeTab === 'configuracoes'}
          zoomed={touchedTab === 'configuracoes'}
          onClick={() => setActiveTab('configuracoes')}
        />
      </nav>
    </div>
  );
};

