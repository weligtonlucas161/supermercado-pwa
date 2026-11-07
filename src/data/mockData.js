export const initialProducts = [
  { id: '1', ean: '7891000100011', name: 'Leite Integral 1L', category: 'Laticínios', stock: 142, minStock: 50, price: 4.89, location: 'Corredor 2 - Prateleira A' },
  { id: '2', ean: '7891000100028', name: 'Iogurte Natural 170g', category: 'Laticínios', stock: 18, minStock: 30, price: 3.29, location: 'Geladeira 4' },
  { id: '3', ean: '7891000100035', name: 'Arroz Tipo 1 5kg', category: 'Mercearia', stock: 85, minStock: 40, price: 24.90, location: 'Corredor 5 - Palete 1' },
  { id: '4', ean: '7891000100042', name: 'Feijão Preto 1kg', category: 'Mercearia', stock: 12, minStock: 25, price: 7.49, location: 'Corredor 5 - Prateleira C' },
  { id: '5', ean: '7891000100059', name: 'Café Torrado 500g', category: 'Mercearia', stock: 64, minStock: 20, price: 16.99, location: 'Corredor 4 - Prateleira B' },
  { id: '6', ean: '7891000100066', name: 'Sabão em Pó 1kg', category: 'Limpeza', stock: 30, minStock: 15, price: 12.50, location: 'Corredor 8 - Prateleira A' },
];

export const initialValidities = [
  { id: 'v1', productId: '2', name: 'Iogurte Natural 170g', batch: 'L-9942', dueDate: '2026-11-10', quantity: 18, status: 'urgent' },
  { id: 'v2', productId: '1', name: 'Leite Integral 1L', batch: 'L-8821', dueDate: '2026-11-18', quantity: 45, status: 'warning' },
  { id: 'v3', productId: '5', name: 'Café Torrado 500g', batch: 'L-1022', dueDate: '2026-12-05', quantity: 20, status: 'ok' },
  { id: 'v4', productId: '4', name: 'Feijão Preto 1kg', batch: 'L-5541', dueDate: '2026-11-12', quantity: 12, status: 'urgent' },
];

export const initialAudits = [
  { id: 'a1', title: 'Auditoria Matinal - Laticínios', date: '2026-11-07', itemsCount: 24, status: 'Concluída', auditor: 'Carlos Silva' },
  { id: 'a2', title: 'Conferência de Ruptura - Corredor 5', date: '2026-11-07', itemsCount: 15, status: 'Em Andamento', auditor: 'Ana Maria' },
  { id: 'a3', title: 'Auditoria Semanal - Limpeza', date: '2026-11-05', itemsCount: 40, status: 'Concluída', auditor: 'Carlos Silva' },
];