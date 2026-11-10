-- ============================================================================
-- SCRIPT 04: PRODUTOS, ESTOQUE E GESTÃO DE VALIDADE
-- Sistema: Synk - Controle de Prevenção de Perdas
-- Objetivo: Cadastro de produtos estritamente isolado por loja/filial (loja_id),
--           com suporte a código de barras EAN, código interno PLU, setor e validade.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.produtos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome TEXT NOT NULL,
    codigo_barras TEXT NOT NULL,
    plu TEXT,
    setor TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0,
    data_vencimento TEXT NOT NULL, -- Data no formato YYYY-MM-DD
    
    -- Isolamento por Loja/Filial:
    loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    
    criado_em BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de Alta Performance para busca instantânea e bipes em milissegundos
CREATE INDEX IF NOT EXISTS idx_produtos_loja_id ON public.produtos(loja_id);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON public.produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_ean_loja ON public.produtos(loja_id, codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_plu_loja ON public.produtos(loja_id, plu);
CREATE INDEX IF NOT EXISTS idx_produtos_setor ON public.produtos(loja_id, setor);
CREATE INDEX IF NOT EXISTS idx_produtos_data_vencimento ON public.produtos(loja_id, data_vencimento);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_produtos_updated_at ON public.produtos;
CREATE TRIGGER trg_produtos_updated_at
BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.produtos IS 'Estoque de produtos isolado por loja ou filial.';
