-- ============================================================================
-- SCRIPT DE POLÍTICAS DE ROW LEVEL SECURITY (RLS) & REPLICAÇÃO EM TEMPO REAL
-- Sistema: Synk SuperPWA OpSys (Controle de Estoque e Prevenção de Perdas)
-- Solução: Visibilidade Multi-Sessão & Sincronização em Tempo Real entre Dispositivos
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. HABILITAR REPLICAÇÃO EM TEMPO REAL (REALTIME PUBLICATION)
-- Permite que quando a Sessão A fizer upload, a Sessão B receba o evento instantaneamente
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
  -- Garante réplica completa das linhas para eventos realtime
  ALTER TABLE public.produtos REPLICA IDENTITY FULL;
  ALTER TABLE public.lojas REPLICA IDENTITY FULL;
  ALTER TABLE public.auditoria_presenca_sessoes REPLICA IDENTITY FULL;
  ALTER TABLE public.auditoria_presenca_bips REPLICA IDENTITY FULL;
  ALTER TABLE public.auditorias_finalizadas REPLICA IDENTITY FULL;
  ALTER TABLE public.sessoes_ativas REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN 
  RAISE NOTICE 'Aviso replica identity: %', SQLERRM;
END $$;

-- Adiciona as tabelas à publicação realtime do Supabase (ignora erro se já estiverem adicionadas)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lojas;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auditoria_presenca_sessoes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auditoria_presenca_bips;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auditorias_finalizadas;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessoes_ativas;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ----------------------------------------------------------------------------
-- 2. HABILITAR RLS NAS TABELAS PRINCIPAIS
-- ----------------------------------------------------------------------------
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_ativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_catalogo_universal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_presenca_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_presenca_bips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditorias_finalizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS DE ACESSO MULTI-SESSÃO (PERMITE VISIBILIDADE PARA TODOS OS OPERADORES)
-- ----------------------------------------------------------------------------

-- PRODUTOS: Todas as sessões da mesma loja (e usuários autenticados/anon com chave pública)
-- podem consultar e sincronizar os produtos importados
DROP POLICY IF EXISTS "produtos_select_multisession" ON public.produtos;
CREATE POLICY "produtos_select_multisession" ON public.produtos
    FOR SELECT
    USING (
        -- Permite acesso total para leitura a qualquer sessão conectada
        true
    );

DROP POLICY IF EXISTS "produtos_insert_multisession" ON public.produtos;
CREATE POLICY "produtos_insert_multisession" ON public.produtos
    FOR INSERT
    WITH CHECK (
        true
    );

DROP POLICY IF EXISTS "produtos_update_multisession" ON public.produtos;
CREATE POLICY "produtos_update_multisession" ON public.produtos
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "produtos_delete_multisession" ON public.produtos;
CREATE POLICY "produtos_delete_multisession" ON public.produtos
    FOR DELETE
    USING (true);

-- CATÁLOGO UNIVERSAL: Compartilhado globalmente entre todas as lojas e sessões
DROP POLICY IF EXISTS "catalogo_universal_all" ON public.produtos_catalogo_universal;
CREATE POLICY "catalogo_universal_all" ON public.produtos_catalogo_universal
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- LOJAS: Leitura aberta para identificação das unidades da rede
DROP POLICY IF EXISTS "lojas_select_all" ON public.lojas;
CREATE POLICY "lojas_select_all" ON public.lojas
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- USUÁRIOS E SESSÕES
DROP POLICY IF EXISTS "usuarios_access_all" ON public.usuarios;
CREATE POLICY "usuarios_access_all" ON public.usuarios
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "sessoes_ativas_access_all" ON public.sessoes_ativas;
CREATE POLICY "sessoes_ativas_access_all" ON public.sessoes_ativas
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- AUDITORIAS DE PRESENÇA, BIPS E FINALIZADAS: Sincronização multi-operador
DROP POLICY IF EXISTS "auditoria_sessoes_access_all" ON public.auditoria_presenca_sessoes;
CREATE POLICY "auditoria_sessoes_access_all" ON public.auditoria_presenca_sessoes
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "auditoria_bips_access_all" ON public.auditoria_presenca_bips;
CREATE POLICY "auditoria_bips_access_all" ON public.auditoria_presenca_bips
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "auditorias_finalizadas_access_all" ON public.auditorias_finalizadas;
CREATE POLICY "auditorias_finalizadas_access_all" ON public.auditorias_finalizadas
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "app_logs_access_all" ON public.app_logs;
CREATE POLICY "app_logs_access_all" ON public.app_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. CONCEDER PRIVILÉGIOS (GRANTS) PARA ANON E AUTHENTICATED
-- Garante que clientes usando a Anon Key possam ler e gravar sem 403 Forbidden
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

COMMIT;
