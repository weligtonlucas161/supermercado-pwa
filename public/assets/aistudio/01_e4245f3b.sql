-- ============================================================================
-- SCRIPT 01: EXTENSÕES E CONFIGURAÇÕES CORE
-- Sistema: Synk - Controle de Prevenção de Perdas
-- Objetivo: Inicializar extensões essenciais de criptografia, UUID e funções base
-- ============================================================================

-- Extensões para UUID e Criptografia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função utilitária para atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário explicativo
COMMENT ON FUNCTION public.handle_updated_at() IS 'Trigger segura para manter o campo updated_at atualizado.';
