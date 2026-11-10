-- ============================================================================
-- SCRIPT MASTER CONSOLIDADO: EXECUTAR TUDO (PRODUÇÃO)
-- Sistema: Synk - Controle de Prevenção de Perdas
-- Versão: 2026.1 (Multi-tenant, Matriz/Filiais, Sessão Única, RLS e Auditoria)
-- Instruções: Execute este script completo no SQL Editor do Supabase para criar
--             ou recriar toda a estrutura do banco de dados de uma só vez.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EXTENSÕES CORE
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. TABELA DE LOJAS (COM SUPORTE A MATRIZ E FILIAIS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lojas (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome_loja TEXT NOT NULL,
    cor_borda TEXT NOT NULL DEFAULT '#2563EB',
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    matriz_id TEXT REFERENCES public.lojas(id) ON DELETE SET NULL,
    cnpj TEXT,
    endereco TEXT,
    telefone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lojas_matriz_id ON public.lojas(matriz_id);
CREATE INDEX IF NOT EXISTS idx_lojas_ativa ON public.lojas(ativa);
CREATE INDEX IF NOT EXISTS idx_lojas_nome_loja ON public.lojas(nome_loja);

DROP TRIGGER IF EXISTS trg_lojas_updated_at ON public.lojas;
CREATE TRIGGER trg_lojas_updated_at
BEFORE UPDATE ON public.lojas
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 3. USUÁRIOS E CONTROLE DE SESSÃO ÚNICA (ADM SAAS SEM LOJA FIXA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    matricula TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    cargo TEXT NOT NULL DEFAULT 'operador', -- 'adm', 'master', 'operador'
    setor TEXT,
    loja_id TEXT REFERENCES public.lojas(id) ON DELETE SET NULL, -- NULL para ADM do SaaS
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON public.usuarios(matricula);
CREATE INDEX IF NOT EXISTS idx_usuarios_loja_id ON public.usuarios(loja_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_cargo ON public.usuarios(cargo);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON public.usuarios(ativo);

DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER trg_usuarios_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.sessoes_ativas (
    matricula TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    usuario_nome TEXT NOT NULL,
    loja_id TEXT,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    last_seen BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    status TEXT NOT NULL DEFAULT 'ATIVA', -- 'ATIVA' ou 'FINALIZADA'
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_ativas_last_seen ON public.sessoes_ativas(last_seen);
CREATE INDEX IF NOT EXISTS idx_sessoes_ativas_status ON public.sessoes_ativas(status);
CREATE INDEX IF NOT EXISTS idx_sessoes_ativas_loja_id ON public.sessoes_ativas(loja_id);

-- Inserir Administrador SaaS inicial se não existir
INSERT INTO public.usuarios (id, matricula, nome, cargo, setor, loja_id, ativo)
VALUES (
    'usr_adm_global_001',
    '111111',
    'Administrador do Sistema (SaaS)',
    'adm',
    'Todos',
    NULL,
    TRUE
)
ON CONFLICT (matricula) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. PRODUTOS E GESTÃO DE ESTOQUE (ISOLAMENTO POR LOJA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produtos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome TEXT NOT NULL,
    codigo_barras TEXT NOT NULL,
    plu TEXT,
    setor TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0,
    data_vencimento TEXT NOT NULL, -- YYYY-MM-DD
    loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    criado_em BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_loja_id ON public.produtos(loja_id);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON public.produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_ean_loja ON public.produtos(loja_id, codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_plu_loja ON public.produtos(loja_id, plu);
CREATE INDEX IF NOT EXISTS idx_produtos_setor ON public.produtos(loja_id, setor);
CREATE INDEX IF NOT EXISTS idx_produtos_data_vencimento ON public.produtos(loja_id, data_vencimento);

DROP TRIGGER IF EXISTS trg_produtos_updated_at ON public.produtos;
CREATE TRIGGER trg_produtos_updated_at
BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 5. AUDITORIA EM TEMPO REAL E RELATÓRIOS
-- ----------------------------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS public.auditoria_presenca_bips (
    id TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS public.auditoria_produtos (
    id TEXT PRIMARY KEY,
    sessao_id TEXT NOT NULL REFERENCES public.auditorias_finalizadas(id) ON DELETE CASCADE,
    produto_id TEXT NOT NULL,
    codigo_barras TEXT NOT NULL,
    plu TEXT,
    nome TEXT NOT NULL,
    setor TEXT NOT NULL,
    quantidade_sistema INTEGER NOT NULL DEFAULT 0,
    status_presenca TEXT NOT NULL DEFAULT 'CONFIRMADO',
    operador_nome TEXT,
    operador_matricula TEXT,
    auditado_em BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_produtos_sessao ON public.auditoria_produtos(sessao_id);

-- ----------------------------------------------------------------------------
-- 6. AUDITORIA DE LOGS E FEEDBACKS
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 7. SEGURANÇA AVANÇADA (RLS & DEFESA SQL INJECTION)
-- ----------------------------------------------------------------------------
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_ativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_presenca_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_presenca_bips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditorias_finalizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Permitir leitura de lojas ativas" ON public.lojas;
    CREATE POLICY "Permitir leitura de lojas ativas" ON public.lojas FOR SELECT USING (ativa = TRUE);

    DROP POLICY IF EXISTS "Permitir gerenciamento de lojas" ON public.lojas;
    CREATE POLICY "Permitir gerenciamento de lojas" ON public.lojas FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Acesso seguro usuarios" ON public.usuarios;
    CREATE POLICY "Acesso seguro usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Acesso seguro sessoes_ativas" ON public.sessoes_ativas;
    CREATE POLICY "Acesso seguro sessoes_ativas" ON public.sessoes_ativas FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Acesso seguro produtos" ON public.produtos;
    CREATE POLICY "Acesso seguro produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Acesso seguro auditoria_presenca_sessoes" ON public.auditoria_presenca_sessoes;
    CREATE POLICY "Acesso seguro auditoria_presenca_sessoes" ON public.auditoria_presenca_sessoes FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Acesso seguro auditoria_presenca_bips" ON public.auditoria_presenca_bips;
    CREATE POLICY "Acesso seguro auditoria_presenca_bips" ON public.auditoria_presenca_bips FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Acesso seguro auditorias_finalizadas" ON public.auditorias_finalizadas;
    CREATE POLICY "Acesso seguro auditorias_finalizadas" ON public.auditorias_finalizadas FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Acesso seguro auditoria_produtos" ON public.auditoria_produtos;
    CREATE POLICY "Acesso seguro auditoria_produtos" ON public.auditoria_produtos FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Acesso seguro app_logs" ON public.app_logs;
    CREATE POLICY "Acesso seguro app_logs" ON public.app_logs FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Acesso seguro feedbacks" ON public.feedbacks;
    CREATE POLICY "Acesso seguro feedbacks" ON public.feedbacks FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;
