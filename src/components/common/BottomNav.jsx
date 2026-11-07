import React from 'react';
import { Home, Calendar, Package, ClipboardCheck, Settings } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'validade', label: 'Validade', icon: Calendar },
    { id: 'estoque', label: 'Estoque', icon: Package },
    { id: 'auditoria', label: 'Auditoria', icon: ClipboardCheck },
    { id: 'configuracoes', label: 'Ajustes', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-10">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
              isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}