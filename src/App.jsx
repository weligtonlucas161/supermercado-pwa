import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Calendar, 
  Package, 
  ClipboardCheck, 
  Settings, 
  Search, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  TrendingUp, 
  Barcode, 
  Filter,
  Download,
  Trash2,
  Edit,
  User,
  Bell,
  Moon,
  Sun,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  Check
} from 'lucide-react';

// ==========================================
// DADOS INICIAIS DE EXEMPLO (MOCK DATA)
// ==========================================
const initialProducts = [
  { id: '1', ean: '7891000100011', name: 'Leite Integral 1L', category: 'Laticínios', stock: 142, minStock: 50, price: 4.89, location: 'Corredor 2 - Prateleira A' },
  { id: '2', ean: '7891000100028', name: 'Iogurte Natural 170g', category: 'Laticínios', stock: 18, minStock: 30, price: 3.29, location: 'Geladeira 4' },
  { id: '3', ean: '7891000100035', name: 'Arroz Tipo 1 5kg', category: 'Mercearia', stock: 85, minStock: 40, price: 24.90, location: 'Corredor 5 - Palete 1' },
  { id: '4', ean: '7891000100042', name: 'Feijão Preto 1kg', category: 'Mercearia', stock: 12, minStock: 25, price: 7.49, location: 'Corredor 5 - Prateleira C' },
  { id: '5', ean: '7891000100059', name: 'Café Torrado 500g', category: 'Mercearia', stock: 64, minStock: 20, price: 16.99, location: 'Corredor 4 - Prateleira B' },
  { id: '6', ean: '7891000100066', name: 'Sabão em Pó 1kg', category: 'Limpeza', stock: 30, minStock: 15, price: 12.50, location: 'Corredor 8 - Prateleira A' },
];

const initialValidities = [
  { id: 'v1', productId: '2', name: 'Iogurte Natural 170g', batch: 'L-9942', dueDate: '2026-11-10', quantity: 18, status: 'urgent' },
  { id: 'v2', productId: '1', name: 'Leite Integral 1L', batch: 'L-8821', dueDate: '2026-11-18', quantity: 45, status: 'warning' },
  { id: 'v3', productId: '5', name: 'Café Torrado 500g', batch: 'L-1022', dueDate: '2026-12-05', quantity: 20, status: 'ok' },
  { id: 'v4', productId: '4', name: 'Feijão Preto 1kg', batch: 'L-5541', dueDate: '2026-11-12', quantity: 12, status: 'urgent' },
];

const initialAudits = [
  { id: 'a1', title: 'Auditoria Matinal - Laticínios', date: '2026-11-07', itemsCount: 24, status: 'Concluída', auditor: 'Carlos Silva' },
  { id: 'a2', title: 'Conferência de Ruptura - Corredor 5', date: '2026-11-07', itemsCount: 15, status: 'Em Andamento', auditor: 'Ana Maria' },
  { id: 'a3', title: 'Auditoria Semanal - Limpeza', date: '2026-11-05', itemsCount: 40, status: 'Concluída', auditor: 'Carlos Silva' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [isOnline, setIsOnline] = useState(true);
  const [products, setProducts] = useState(initialProducts);
  const [validities, setValidities] = useState(initialValidities);
  const [audits, setAudits] = useState(initialAudits);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(3);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* HEADER SUPERIOR */}
      <header className={`sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b ${
        darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200'
      } backdrop-blur-md`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-emerald-500/20">
            S
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">SuperPWA</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gestão Operacional</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
            isOnline 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Modo Offline'}</span>
          </div>

          <button className={`p-2 rounded-xl relative ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}>
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            {notifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-4 pb-24 max-w-5xl mx-auto w-full">
        {activeTab === 'inicio' && (
          <InicioTab 
            products={products} 
            validities={validities} 
            audits={audits}
            setActiveTab={setActiveTab}
            darkMode={darkMode}
          />
        )}
        {activeTab === 'validade' && (
          <ValidadeTab 
            validities={validities} 
            setValidities={setValidities} 
            darkMode={darkMode}
          />
        )}
        {activeTab === 'estoque' && (
          <EstoqueTab 
            products={products} 
            setProducts={setProducts} 
            darkMode={darkMode}
          />
        )}
        {activeTab === 'auditoria' && (
          <AuditoriaTab 
            audits={audits} 
            setAudits={setAudits} 
            darkMode={darkMode}
          />
        )}
        {activeTab === 'configuracoes' && (
          <ConfiguracoesTab 
            darkMode={darkMode} 
            setDarkMode={setDarkMode} 
            isOnline={isOnline}
          />
        )}
      </main>

      {/* NAVEGAÇÃO INFERIOR */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t ${
        darkMode ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-slate-200'
      } backdrop-blur-md px-2 py-2`}>
        <div className="max-w-md mx-auto flex justify-around items-center">
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
            badge={validities.filter(v => v.status === 'urgent').length}
            onClick={() => setActiveTab('validade')} 
          />
          <NavItem 
            icon={<Package className="w-5 h-5" />} 
            label="Estoque" 
            active={activeTab === 'estoque'} 
            onClick={() => setActiveTab('estoque')} 
          />
          <NavItem 
            icon={<ClipboardCheck className="w-5 h-5" />} 
            label="Auditoria" 
            active={activeTab === 'auditoria'} 
            onClick={() => setActiveTab('auditoria')} 
          />
          <NavItem 
            icon={<Settings className="w-5 h-5" />} 
            label="Ajustes" 
            active={activeTab === 'configuracoes'} 
            onClick={() => setActiveTab('configuracoes')} 
          />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all relative ${
        active 
          ? 'text-emerald-600 dark:text-emerald-400 font-semibold scale-105' 
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
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

function InicioTab({ products, validities, audits, setActiveTab, darkMode }) {
  const urgentValidities = validities.filter(v => v.status === 'urgent');
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-600/15">
        <span className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Turno Atual - Manhã</span>
        <h2 className="text-2xl font-bold mt-1">Supermercado Silva</h2>
        <p className="text-emerald-100 text-sm mt-1">3 alertas críticos precisam da sua atenção hoje.</p>
        
        <div className="mt-4 flex gap-2">
          <button 
            onClick={() => setActiveTab('validade')}
            className="bg-white text-emerald-700 px-3.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-emerald-50 transition-colors shadow-sm"
          >
            Ver Validades
          </button>
          <button 
            onClick={() => setActiveTab('estoque')}
            className="bg-emerald-700/50 text-white border border-emerald-400/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-emerald-700/70 transition-colors"
          >
            Repor Estoque
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Produtos em Alerta</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold">{lowStockProducts.length}</div>
          <span className="text-[11px] text-amber-600 font-medium">Estoque Baixo</span>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Vencem em 3 dias</span>
            <Calendar className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold">{urgentValidities.length}</div>
          <span className="text-[11px] text-rose-600 font-medium">Ação Imediata</span>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Auditorias Hoje</span>
            <ClipboardCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold">{audits.length}</div>
          <span className="text-[11px] text-emerald-600 font-medium">1 Pendente</span>
        </div>

        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total de Itens</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold">{products.length}</div>
          <span className="text-[11px] text-blue-600 font-medium">Cadastrados</span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 text-slate-500 uppercase tracking-wider">Ações Rápidas</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setActiveTab('estoque')}
            className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
              darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-750' : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
              <Barcode className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold">Bipar Produto</div>
              <div className="text-[10px] text-slate-400">Consultar preço/estoque</div>
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('validade')}
            className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
              darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-750' : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold">Lançar Validade</div>
              <div className="text-[10px] text-slate-400">Novo lote recebido</div>
            </div>
          </button>
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm">Vencimentos Próximos (Oferta Urgente)</h3>
          <button 
            onClick={() => setActiveTab('validade')} 
            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 hover:underline"
          >
            Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          {urgentValidities.map(item => (
            <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400">Vence em: {item.dueDate} ({item.quantity} un)</p>
              </div>
              <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-1 rounded-md uppercase">
                Aplicar Desconto
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ValidadeTab({ validities, setValidities, darkMode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = validities.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.batch.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'urgent') return matchesSearch && item.status === 'urgent';
    if (filter === 'warning') return matchesSearch && item.status === 'warning';
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Controle de Validades</h2>
          <p className="text-xs text-slate-500">Monitore itens próximos ao vencimento para reagir rápido.</p>
        </div>
        <button className="bg-emerald-600 text-white p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Lote</span>
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por produto ou lote..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}
          />
        </div>
        <select 
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className={`px-3 py-2 rounded-xl text-xs border focus:outline-none ${
            darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <option value="all">Todos os Status</option>
          <option value="urgent">Urgentes (&lt; 5 dias)</option>
          <option value="warning">Atenção (&lt; 15 dias)</option>
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map(item => (
          <div 
            key={item.id} 
            className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                item.status === 'urgent' ? 'bg-rose-500/10 text-rose-500' : 
                item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold">{item.name}</h4>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <span>Lote: {item.batch}</span>
                  <span>•</span>
                  <span>Qtd: {item.quantity} un</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className={`text-xs font-bold ${
                item.status === 'urgent' ? 'text-rose-500' : 
                item.status === 'warning' ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                Vence: {item.dueDate}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {item.status === 'urgent' ? 'Ação Urgente' : item.status === 'warning' ? 'Monitorar' : 'Regular'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EstoqueTab({ products, setProducts, darkMode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', ...new Set(products.map(p => p.category))];

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.ean.includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Consulta de Estoque</h2>
          <p className="text-xs text-slate-500">Localização, saldos e consulta de código EAN.</p>
        </div>
        <button className="bg-emerald-600 text-white p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Cadastrar Produto</span>
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input 
            type="text" 
            placeholder="Nome ou EAN (ex: 7891...)" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}
          />
        </div>
        <button className={`p-2 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Barcode className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat 
                ? 'bg-emerald-600 text-white' 
                : darkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {cat === 'all' ? 'Todas Categorias' : cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(product => {
          const isLow = product.stock <= product.minStock;
          return (
            <div 
              key={product.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold">{product.name}</h4>
                  {isLow && (
                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-semibold border border-amber-500/20">
                      Ruptura Próxima
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">EAN: {product.ean} • {product.location}</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">R$ {product.price.toFixed(2)}</p>
              </div>

              <div className="text-right">
                <div className={`text-base font-extrabold ${isLow ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>
                  {product.stock} <span className="text-[10px] font-normal text-slate-400">un</span>
                </div>
                <div className="text-[10px] text-slate-400">Mín: {product.minStock} un</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuditoriaTab({ audits, setAudits, darkMode }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Auditoria de Loja</h2>
          <p className="text-xs text-slate-500">Conferência física de estoque e relatórios de discrepâncias.</p>
        </div>
        <button className="bg-emerald-600 text-white p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nova Auditoria</span>
        </button>
      </div>

      <div className={`p-4 rounded-2xl border border-dashed ${
        darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-100/70 border-slate-300'
      } text-center space-y-2`}>
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <h3 className="text-xs font-bold">Pronto para iniciar uma contagem?</h3>
        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">Escaneie os corredores e compare o estoque físico com o sistema em tempo real.</p>
        <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm hover:bg-emerald-700 transition-colors">
          Abrir Coletor de Dados
        </button>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Auditorias Recentes</h3>
        <div className="space-y-2">
          {audits.map(audit => (
            <div 
              key={audit.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <div className="space-y-1">
                <h4 className="text-xs font-bold">{audit.title}</h4>
                <p className="text-[11px] text-slate-400">
                  Data: {audit.date} • Auditor: {audit.auditor}
                </p>
              </div>

              <div className="text-right">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  audit.status === 'Concluída' 
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                }`}>
                  {audit.status}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">{audit.itemsCount} itens validados</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfiguracoesTab({ darkMode, setDarkMode, isOnline }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Configurações & PWA</h2>
        <p className="text-xs text-slate-500">Ajustes do dispositivo, sincronização e preferências do operador.</p>
      </div>

      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-bold">Aplicativo PWA OpSys</h3>
            <p className="text-[11px] text-slate-300">Instale na tela inicial para usar o scanner e trabalhar sem internet.</p>
          </div>
        </div>
        <button 
          onClick={handleInstallClick}
          disabled={!deferredPrompt && !isInstalled}
          className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
            deferredPrompt 
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isInstalled ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {isInstalled ? 'Aplicativo Instalado' : deferredPrompt ? 'Instalar App no Dispositivo' : 'Já Instalado / PWA Pronto'}
        </button>
      </div>

      <div className={`rounded-2xl border divide-y ${
        darkMode ? 'bg-slate-800 border-slate-700 divide-slate-700' : 'bg-white border-slate-200 divide-slate-100'
      }`}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {darkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
            <div>
              <p className="text-xs font-bold">Modo Escuro</p>
              <p className="text-[11px] text-slate-400">Economize bateria em coletores OLED</p>
            </div>
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              darkMode ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
            }`}
          >
            <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform"></div>
          </button>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-xs font-bold">Sincronização Offline</p>
              <p className="text-[11px] text-slate-400">
                {isOnline ? 'Banco local sincronizado com a nuvem' : 'Alterações serão salvas localmente'}
              </p>
            </div>
          </div>
          <RefreshCw className={`w-4 h-4 text-slate-400 ${isOnline ? 'animate-spin' : ''}`} />
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-xs font-bold">Operador Conectado</p>
              <p className="text-[11px] text-slate-400">Carlos Silva (Matrícula: #4092)</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      <div className="text-center pt-4">
        <p className="text-[10px] text-slate-400">SuperPWA Version 1.0.4 • Modelo para Supermercados</p>
      </div>
    </div>
  );
}