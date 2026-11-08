-- ============================================================================
-- SCRIPT 02: LOJAS, MATRIZ E FILIAIS (MULTI-TENANCY)
-- Sistema: Synk - Controle de Prevenção de Perdas
-- Objetivo: Estruturar as organizações com total fidelidade ao aplicativo,
--           permitindo lojas independentes, matrizes e redes com múltiplas filiais.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lojas (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome_loja TEXT NOT NULL,
    cor_borda TEXT NOT NULL DEFAULT '#2563EB',
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Suporte a Matriz e Filiais:
    -- Se matriz_id for NULL -> Loja Independente ou Loja Matriz (Sede da Rede)
    -- Se matriz_id apontar para outra loja -> Filial vinculada à Matriz
    matriz_id TEXT REFERENCES public.lojas(id) ON DELETE SET NULL,
    
    cnpj TEXT,
    endereco TEXT,
    telefone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_lojas_matriz_id ON public.lojas(matriz_id);
CREATE INDEX IF NOT EXISTS idx_lojas_ativa ON public.lojas(ativa);
CREATE INDEX IF NOT EXISTS idx_lojas_nome_loja ON public.lojas(nome_loja);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_lojas_updated_at ON public.lojas;
CREATE TRIGGER trg_lojas_updated_at
BEFORE UPDATE ON public.lojas
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Comentários
COMMENT ON TABLE public.lojas IS 'Cadastro de lojas com suporte hierárquico (Matriz e Filiais).';
COMMENT ON COLUMN public.lojas.matriz_id IS 'Chave que aponta para a Loja Matriz quando esta for uma filial.';
