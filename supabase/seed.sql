-- ==============================================================================
-- SUPABASE SEED DATA: Catálogo Inicial de Supermercado
-- ==============================================================================

-- Inserir produtos de teste
INSERT INTO public.products (ean, name, category, stock, min_stock, price, location)
VALUES
    ('7891000100011', 'Leite Integral 1L', 'Laticínios', 142, 50, 4.89, 'Corredor 2 - Prateleira A'),
    ('7891000100028', 'Iogurte Natural 170g', 'Laticínios', 18, 30, 3.29, 'Geladeira 4'),
    ('7891000100035', 'Arroz Tipo 1 5kg', 'Mercearia', 85, 40, 24.90, 'Corredor 5 - Palete 1'),
    ('7891000100042', 'Feijão Preto 1kg', 'Mercearia', 12, 25, 7.49, 'Corredor 5 - Prateleira C'),
    ('7891000100059', 'Café Torrado 500g', 'Mercearia', 64, 20, 16.99, 'Corredor 4 - Prateleira B'),
    ('7891000100066', 'Sabão em Pó 1kg', 'Limpeza', 30, 15, 12.50, 'Corredor 8 - Prateleira A'),
    ('7891000100073', 'Azeite de Oliva Extra Virgem 500ml', 'Mercearia', 19, 20, 38.90, 'Corredor 3 - Prateleira B'),
    ('7891000100080', 'Queijo Mussarela Fatiado 200g', 'Laticínios', 14, 25, 11.90, 'Geladeira 2')
ON CONFLICT (ean) DO NOTHING;

-- Inserir lotes e validades vinculadas aos produtos inseridos
INSERT INTO public.validities (product_id, product_name, batch, due_date, quantity)
SELECT id, 'Iogurte Natural 170g', 'L-9942', CURRENT_DATE, 18 FROM public.products WHERE ean = '7891000100028'
UNION ALL
SELECT id, 'Queijo Mussarela Fatiado 200g', 'L-3310', CURRENT_DATE + INTERVAL '1 day', 14 FROM public.products WHERE ean = '7891000100080'
UNION ALL
SELECT id, 'Feijão Preto 1kg', 'L-5541', CURRENT_DATE + INTERVAL '3 days', 12 FROM public.products WHERE ean = '7891000100042'
UNION ALL
SELECT id, 'Leite Integral 1L', 'L-8821', CURRENT_DATE + INTERVAL '12 days', 45 FROM public.products WHERE ean = '7891000100011'
UNION ALL
SELECT id, 'Café Torrado 500g', 'L-1022', CURRENT_DATE + INTERVAL '30 days', 20 FROM public.products WHERE ean = '7891000100059';

-- Inserir auditorias iniciais
INSERT INTO public.audits (title, audit_date, department, auditor_name, status, items_count, discrepancies_count)
VALUES
    ('Auditoria Matinal - Laticínios', CURRENT_DATE, 'Laticínios', 'Carlos Silva', 'Concluída', 24, 1),
    ('Conferência de Ruptura - Corredor 5', CURRENT_DATE, 'Mercearia', 'Ana Maria', 'Em Andamento', 15, 3),
    ('Auditoria Semanal - Limpeza', CURRENT_DATE - INTERVAL '2 days', 'Limpeza', 'Carlos Silva', 'Concluída', 40, 0);
