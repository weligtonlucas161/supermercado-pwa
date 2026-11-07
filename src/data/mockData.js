export const initialProducts = [
  { id: 1, name: 'Leite Integral 1L', category: 'Laticínios', ean: '7891000100011', stock: 142, minStock: 50, price: 4.89, location: 'Corredor 2 - A1' },
  { id: 2, name: 'Arroz Branco 5kg', category: 'Mercearia', ean: '7891000100028', stock: 18, minStock: 30, price: 23.90, location: 'Corredor 4 - B2' },
  { id: 3, name: 'Feijão Preto 1kg', category: 'Mercearia', ean: '7891000100035', stock: 65, minStock: 25, price: 7.50, location: 'Corredor 4 - B1' },
  { id: 4, name: 'Café Torrado 500g', category: 'Matinais', ean: '7891000100042', stock: 8, minStock: 15, price: 16.90, location: 'Corredor 1 - C3' }
];

export const initialExpirations = [
  { id: 101, productId: 1, name: 'Leite Integral 1L', lot: 'L2024-08', date: '2026-11-10', quantity: 24, status: 'critical' },
  { id: 102, productId: 4, name: 'Café Torrado 500g', lot: 'C9912', date: '2026-11-18', quantity: 8, status: 'warning' },
  { id: 103, productId: 2, name: 'Arroz Branco 5kg', lot: 'A4410', date: '2026-12-05', quantity: 18, status: 'ok' }
];

export const initialAudits = [
  { id: 201, date: '2026-11-05', sector: 'Hortifrúti', itemsAudited: 45, discrepancies: 3, status: 'Concluída' },
  { id: 202, date: '2026-11-06', sector: 'Mercearia Alta', itemsAudited: 120, discrepancies: 8, status: 'Em Andamento' }
];