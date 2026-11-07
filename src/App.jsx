import React, { useState } from 'react';
import Header from './components/common/Header';
import BottomNav from './components/common/BottomNav';
import InicioTab from './components/tabs/InicioTab';
import ValidadeTab from './components/tabs/ValidadeTab';
import EstoqueTab from './components/tabs/EstoqueTab';
import AuditoriaTab from './components/tabs/AuditoriaTab';
import ConfiguracoesTab from './components/tabs/ConfiguracoesTab';

import { useOnlineStatus } from './hooks/useOnlineStatus';
import { initialProducts, initialValidities, initialAudits } from './data/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');
  const isOnline = useOnlineStatus();
  const [products, setProducts] = useState(initialProducts);
  const [validities, setValidities] = useState(initialValidities);
  const [audits, setAudits] = useState(initialAudits);
  const [notifications] = useState(3);

  const urgentCount = validities.filter(v => v.status === 'urgent').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Header isOnline={isOnline} notifications={notifications} />

      <main className="flex-1 p-4 pb-24 max-w-5xl mx-auto w-full">
        {activeTab === 'inicio' && (
          <InicioTab products={products} validities={validities} audits={audits} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'validade' && (
          <ValidadeTab validities={validities} setValidities={setValidities} />
        )}
        {activeTab === 'estoque' && (
          <EstoqueTab products={products} setProducts={setProducts} />
        )}
        {activeTab === 'auditoria' && (
          <AuditoriaTab audits={audits} setAudits={setAudits} />
        )}
        {activeTab === 'configuracoes' && (
          <ConfiguracoesTab isOnline={isOnline} />
        )}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} urgentCount={urgentCount} />
    </div>
  );
}