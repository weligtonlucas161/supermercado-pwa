-- ============================================================================
-- SCRIPT 06: AUDITORIA DE LOGS, RASTREABILIDADE E FEEDBACKS
-- Sistema: Synk - Controle de Prevenção de Perdas
-- Objetivo: Registro imutável de todas as ações operacionais, alterações de estoque,
--           bloqueios, logins e mensagens de feedback enviadas ao administrador.
-- ============================================================================

-- 1. Logs de Operações e Rastreabilidade
CREATE TABLE IF NOT EXISTS public.app_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    usuario_matricula TEXT NOT NULL,
    usuario_nome TEXT NOT NULL,
    loja_id TEXT REFERENCES public.lojas(id) ON DELETE SET NULL,
    acao TEXT NOT NULL,
    detalhes TEXT NOT NULL,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_logs_loja_time ON public.app_logs(loja_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_acao ON public.app_logs(acao);
CREATE INDEX IF NOT EXISTS idx_app_logs_matricula ON public.app_logs(usuario_matricula);

-- 2. Feedbacks e Sugestões dos Colaboradores ao ADM do SaaS
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    usuario_matricula TEXT NOT NULL,
    usuario_nome TEXT NOT NULL,
    loja_id TEXT REFERENCES public.lojas(id) ON DELETE SET NULL,
    mensagem TEXT NOT NULL,
    avaliacao INTEGER NOT NULL DEFAULT 5 CHECK (avaliacao BETWEEN 1 AND 5),
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_time ON public.feedbacks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_loja ON public.feedbacks(loja_id);

COMMENT ON TABLE public.app_logs IS 'Trilha de auditoria e segurança de ações realizadas no aplicativo.';
COMMENT ON TABLE public.feedbacks IS 'Feedbacks e comunicações de suporte enviadas ao Administrador do SaaS.';
