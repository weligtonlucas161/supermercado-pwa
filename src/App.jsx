import React, { useState } from 'react';
import Header from './components/common/Header';
import BottomNav from './components/common/BottomNav';
import InicioTab from './components/tabs/InicioTab';
import ValidadeTab from './components/tabs/ValidadeTab';
import EstoqueTab from './components/tabs/EstoqueTab';
import AuditoriaTab from './components/tabs/AuditoriaTab';
import ConfiguracoesTab from './components/tabs/ConfiguracoesTab';

import { useOnlineStatus } from './hooks/useOnlineStatus';
import { initialProducts, initialExpirations, initialAudits } from './data/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [storeName, setStoreName] = useState('Loja 01 - Centro');
  const isOnline = useOnlineStatus();

  const [products] = useState(initialProducts);
  const [expirations] = useState(initialExpirations);
  const [audits] = useState(initialAudits);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 font-sans">
      <Header isOnline={isOnline} storeName={storeName} />

      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'inicio' && (
          <InicioTab 
            expirations={expirations} 
            products={products} 
            audits={audits} 
            setActiveTab={setActiveTab} 
          />
        )}
        {activeTab === 'validade' && <ValidadeTab expirations={expirations} />}
        {activeTab === 'estoque' && <EstoqueTab products={products} />}
        {activeTab === 'auditoria' && <AuditoriaTab audits={audits} />}
        {activeTab === 'configuracoes' && (
          <ConfiguracoesTab storeName={storeName} setStoreName={setStoreName} />
        )}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}