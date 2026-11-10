-- =========================================================================
-- 08. BANCO DE DADOS UNIVERSAL DE PRODUTOS (RECURSO OCULTO / CATÁLOGO GLOBAL)
-- =========================================================================
-- Armazena exclusivamente código de barras e nome/descrição do produto.
-- É compartilhado universalmente entre todas as lojas e redes para auto-preenchimento
-- ao escanear código de barras no cadastro de produtos ou importação de planilhas.
-- Previne duplicidades de mesmo código de barras com PRIMARY KEY.

CREATE TABLE IF NOT EXISTS public.produtos_catalogo_universal (
    codigo_barras TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscas rápidas por nome/descrição
CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_universal_nome 
    ON public.produtos_catalogo_universal(nome);

-- Habilitar RLS
ALTER TABLE public.produtos_catalogo_universal ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso universal: leitura e alimentação transparente em segundo plano
DROP POLICY IF EXISTS "Permitir leitura universal do catalogo de produtos" ON public.produtos_catalogo_universal;
CREATE POLICY "Permitir leitura universal do catalogo de produtos"
    ON public.produtos_catalogo_universal FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao universal no catalogo de produtos" ON public.produtos_catalogo_universal;
CREATE POLICY "Permitir insercao universal no catalogo de produtos"
    ON public.produtos_catalogo_universal FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao universal no catalogo de produtos" ON public.produtos_catalogo_universal;
CREATE POLICY "Permitir atualizacao universal no catalogo de produtos"
    ON public.produtos_catalogo_universal FOR UPDATE USING (true);

COMMENT ON TABLE public.produtos_catalogo_universal IS 'Catálogo global universal de produtos contendo código de barras e nome para auto-preenchimento e enriquecimento inteligente de dados.';
