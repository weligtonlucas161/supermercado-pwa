import React from 'react';
import { Home, Calendar, Package, ClipboardCheck, Settings, Building2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TabId } from '../../types';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, badge }) => {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-14 sm:w-16 py-1.5 rounded-2xl transition-all relative ${
        active
          ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <div className="relative">
        {icon}
        {typeof badge === 'number' && badge > 0 && (
          <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-xs">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight">{label}</span>
    </button>
  );
};

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, validities, products, isGerente, currentUser } = useApp();

  const urgentValiditiesCount = validities.filter(v => v.status === 'urgent').length;
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const hasStoreAccess = isGerente || currentUser?.cargo === 'gerente' || currentUser?.cargo === 'adm';

  return (
    <div className="fixed bottom-3 sm:bottom-4 left-3 right-3 sm:left-4 sm:right-4 z-40 max-w-xl mx-auto pointer-events-none">
      <nav className="pointer-events-auto rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-2 py-1.5 shadow-2xl shadow-slate-900/15 dark:shadow-black/50 transition-all flex justify-around items-center ring-1 ring-black/5 dark:ring-white/10">
        <NavItem
          icon={<Home className="w-5 h-5" />}
          label="Início"
          active={activeTab === 'inicio'}
          onClick={() => setActiveTab('inicio')}
        />
        <NavItem
          icon={<Calendar className="w-5 h-5" />}
          label="Validade"
          active={activeTab === 'validade'}
          badge={urgentValiditiesCount}
          onClick={() => setActiveTab('validade')}
        />
        <NavItem
          icon={<Package className="w-5 h-5" />}
          label="Estoque"
          active={activeTab === 'estoque'}
          badge={lowStockCount}
          onClick={() => setActiveTab('estoque')}
        />
        <NavItem
          icon={<ClipboardCheck className="w-5 h-5" />}
          label="Auditoria"
          active={activeTab === 'auditoria'}
          onClick={() => setActiveTab('auditoria')}
        />
        {hasStoreAccess && (
          <NavItem
            icon={<Building2 className="w-5 h-5" />}
            label="Loja"
            active={activeTab === 'loja'}
            onClick={() => setActiveTab('loja')}
          />
        )}
        <NavItem
          icon={<Settings className="w-5 h-5" />}
          label="Ajustes"
          active={activeTab === 'configuracoes'}
          onClick={() => setActiveTab('configuracoes')}
        />
      </nav>
    </div>
  );
};

