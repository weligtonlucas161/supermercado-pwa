import React from 'react';
import { Home, Calendar, Package, ClipboardCheck, Settings } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab, urgentCount }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 border-slate-200 backdrop-blur-md px-2 py-2">
      <div className="max-w-md mx-auto flex justify-around items-center">
        <NavItem icon={<Home className="w-5 h-5" />} label="Início" active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} />
        <NavItem icon={<Calendar className="w-5 h-5" />} label="Validade" active={activeTab === 'validade'} badge={urgentCount} onClick={() => setActiveTab('validade')} />
        <NavItem icon={<Package className="w-5 h-5" />} label="Estoque" active={activeTab === 'estoque'} onClick={() => setActiveTab('estoque')} />
        <NavItem icon={<ClipboardCheck className="w-5 h-5" />} label="Auditoria" active={activeTab === 'auditoria'} onClick={() => setActiveTab('auditoria')} />
        <NavItem icon={<Settings className="w-5 h-5" />} label="Ajustes" active={activeTab === 'configuracoes'} onClick={() => setActiveTab('configuracoes')} />
      </div>
    </nav>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all relative ${
        active ? 'text-emerald-600 font-semibold scale-105' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      <div className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[11px] mt-1">{label}</span>
    </button>
  );
}