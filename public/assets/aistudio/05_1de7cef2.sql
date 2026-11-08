-- ============================================================================
-- SCRIPT 05: AUDITORIA EM TEMPO REAL E RELATÓRIOS CONSOLIDADOS
-- Sistema: Synk - Controle de Prevenção de Perdas
-- Objetivo: Suporte completo para:
--           1. Sessões de Presença ao vivo por setor com bloqueio de bip duplo.
--           2. Bips individuais sincronizados em tempo real entre operadores.
--           3. Histórico de auditorias finalizadas e relatórios em PDF.
--           4. Listagem analítica de produtos auditados.
-- ============================================================================

-- 1. Sessões de Auditoria de Presença em Tempo Real
CREATE TABLE IF NOT EXISTS public.auditoria_presenca_sessoes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    setor TEXT NOT NULL,
    iniciada_por_nome TEXT NOT NULL,
    iniciada_por_matricula TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'PAUSADA', 'CONCLUIDA')),
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presenca_sessoes_loja_status ON public.auditoria_presenca_sessoes(loja_id, status);
CREATE INDEX IF NOT EXISTS idx_presenca_sessoes_timestamp ON public.auditoria_presenca_sessoes(timestamp DESC);

-- 2. Itens Bipados em Tempo Real (Garante que ninguém bipe duas vezes)
CREATE TABLE IF NOT EXISTS public.auditoria_presenca_bips (
    id TEXT PRIMARY KEY, -- Padrão: sessao_id || '_' || produto_id
    sessao_id TEXT NOT NULL REFERENCES public.auditoria_presenca_sessoes(id) ON DELETE CASCADE,
    loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    produto_id TEXT NOT NULL,
    codigo_barras TEXT NOT NULL,
    produto_nome TEXT NOT NULL,
    setor TEXT NOT NULL,
    operador_matricula TEXT NOT NULL,
    operador_nome TEXT NOT NULL,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presenca_bips_sessao ON public.auditoria_presenca_bips(sessao_id);
CREATE INDEX IF NOT EXISTS idx_presenca_bips_loja ON public.auditoria_presenca_bips(loja_id);
CREATE INDEX IF NOT EXISTS idx_presenca_bips_produto ON public.auditoria_presenca_bips(produto_id);

-- 3. Cabeçalho de Auditorias Finalizadas (Histórico de Relatórios)
CREATE TABLE IF NOT EXISTS public.auditorias_finalizadas (
    id TEXT PRIMARY KEY,
    loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    setor TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'PRESENCA',
    iniciada_por_nome TEXT NOT NULL,
    iniciada_por_matricula TEXT NOT NULL,
    finalizada_por_nome TEXT NOT NULL,
    finalizada_por_matricula TEXT NOT NULL,
    total_esperado INTEGER NOT NULL DEFAULT 0,
    total_auditado INTEGER NOT NULL DEFAULT 0,
    total_divergentes INTEGER NOT NULL DEFAULT 0,
    iniciada_em BIGINT NOT NULL,
    finalizada_em BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONCLUIDA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditorias_finalizadas_loja_data ON public.auditorias_finalizadas(loja_id, finalizada_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditorias_finalizadas_tipo ON public.auditorias_finalizadas(tipo);

-- 4. Itens Vinculados à Auditoria Finalizada (Detalhamento do Relatório)
CREATE TABLE IF NOT EXISTS public.auditoria_produtos (
    id TEXT PRIMARY KEY, -- Padrão: sessao_id || '_' || produto_id
    sessao_id TEXT NOT NULL REFERENCES public.auditorias_finalizadas(id) ON DELETE CASCADE,
    produto_id TEXT NOT NULL,
    codigo_barras TEXT NOT NULL,
    plu TEXT,
    nome TEXT NOT NULL,
    setor TEXT NOT NULL,
    quantidade_sistema INTEGER NOT NULL DEFAULT 0,
    status_presenca TEXT NOT NULL DEFAULT 'CONFIRMADO', -- 'CONFIRMADO' ou 'AUSENTE'
    operador_nome TEXT,
    operador_matricula TEXT,
    auditado_em BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_produtos_sessao ON public.auditoria_produtos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_produtos_status ON public.auditoria_produtos(status_presenca);

COMMENT ON TABLE public.auditoria_presenca_sessoes IS 'Sessões ativas de conferência ao vivo compartilhada.';
COMMENT ON TABLE public.auditoria_presenca_bips IS 'Bips registrados em tempo real com controle de prevenção dupla.';
COMMENT ON TABLE public.auditorias_finalizadas IS 'Relatórios consolidados de auditorias finalizadas.';
COMMENT ON TABLE public.auditoria_produtos IS 'Linhas de itens de cada relatório de auditoria gerado.';
