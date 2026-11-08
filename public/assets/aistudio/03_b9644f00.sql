-- ============================================================================
-- SCRIPT 03: USUÁRIOS, AUTENTICAÇÃO E SESSÃO ÚNICA
-- Sistema: Synk - Controle de Prevenção de Perdas
-- Objetivo: Gestão de colaboradores com controle de matrícula, permissões por cargo,
--           suporte a Administrador do SaaS (sem loja fixa) e mecanismo de Sessão Única.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usuarios (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    matricula TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    cargo TEXT NOT NULL DEFAULT 'operador', -- 'adm' (SaaS Admin), 'master' (Gerente de Loja), 'operador'
    setor TEXT, -- Setor padrão ('Frios', 'Mercearia', etc. ou 'Todos' / NULL)
    
    -- Isolamento de Tenant:
    -- Usuários operacionais e Masters são vinculados à sua respectiva loja (ou filial).
    -- O Administrador do SaaS (cargo = 'adm') NÃO possui loja fixa (loja_id IS NULL),
    -- tendo visão e acesso global na interface administrativa do SaaS.
    loja_id TEXT REFERENCES public.lojas(id) ON DELETE SET NULL,
    
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de Autenticação e Busca Rápida
CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON public.usuarios(matricula);
CREATE INDEX IF NOT EXISTS idx_usuarios_loja_id ON public.usuarios(loja_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_cargo ON public.usuarios(cargo);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON public.usuarios(ativo);

-- Trigger para updated_at em usuarios
DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER trg_usuarios_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- TABELA DE SESSÕES ATIVAS (PREVENÇÃO DE LOGIN DUPLO SIMULTÂNEO)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessoes_ativas (
    matricula TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    usuario_nome TEXT NOT NULL,
    loja_id TEXT,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    last_seen BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000), -- Timestamp em milissegundos do último ping (renovado a cada 1 minuto)
    status TEXT NOT NULL DEFAULT 'ATIVA', -- 'ATIVA' ou 'FINALIZADA'
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_ativas_last_seen ON public.sessoes_ativas(last_seen);
CREATE INDEX IF NOT EXISTS idx_sessoes_ativas_status ON public.sessoes_ativas(status);
CREATE INDEX IF NOT EXISTS idx_sessoes_ativas_loja_id ON public.sessoes_ativas(loja_id);

-- Inserção segura do Administrador padrão do SaaS (se ainda não existir)
-- O ADM possui loja_id NULL pois opera em nível global de SaaS
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

COMMENT ON TABLE public.usuarios IS 'Usuários do sistema. O ADM do SaaS não possui loja vinculada (loja_id = NULL).';
COMMENT ON TABLE public.sessoes_ativas IS 'Mecanismo em tempo real de controle de sessão única por colaborador.';
