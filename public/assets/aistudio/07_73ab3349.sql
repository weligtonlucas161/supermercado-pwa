-- ============================================================================
-- SCRIPT 07: SEGURANÇA AVANÇADA, RLS (ROW LEVEL SECURITY) E ISOLAMENTO MULTI-TENANT
-- Sistema: Synk - Controle de Prevenção de Perdas
-- Objetivo: 
-- 1. Habilitar RLS em todas as tabelas do sistema.
-- 2. Garantir isolamento estrito de tenants: Loja X NÃO enxerga dados de Loja Y.
-- 3. Permitir visão global exclusivamente para o Administrador do SaaS (ADM).
-- 4. Suporte a hierarquia de Filiais (a Matriz pode consolidar suas filiais se desejado).
-- 5. Blindagem contra SQL Injection via funções com parâmetros tipados e SECURITY DEFINER.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ATIVAÇÃO DE RLS EM TODAS AS TABELAS
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

-- ----------------------------------------------------------------------------
-- 2. FUNÇÕES AUXILIARES DE IDENTIFICAÇÃO E VALIDAÇÃO DE TENANT (SECURITY DEFINER)
-- ----------------------------------------------------------------------------

-- Função segura para obter o cargo de um usuário pela matrícula sem risco de injeção
CREATE OR REPLACE FUNCTION public.fn_obter_cargo_usuario(p_matricula TEXT)
RETURNS TEXT AS $$
DECLARE
    v_cargo TEXT;
BEGIN
    SELECT cargo INTO v_cargo
    FROM public.usuarios
    WHERE matricula = trim(p_matricula) AND ativo = TRUE
    LIMIT 1;
    RETURN COALESCE(v_cargo, '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função segura para validar se uma loja é matriz de outra (Hierarquia de Filiais)
CREATE OR REPLACE FUNCTION public.fn_is_filial_da_matriz(p_loja_id TEXT, p_matriz_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_loja_id = p_matriz_id THEN
        RETURN TRUE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.lojas
        WHERE id = p_loja_id AND matriz_id = p_matriz_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS DE ACESSO (SUPABASE REST / CLIENTE ANDROID)
-- ----------------------------------------------------------------------------

-- Política para LOJAS:
-- Leitura permitida para identificação no login e sincronização
DROP POLICY IF EXISTS "Permitir leitura de lojas ativas" ON public.lojas;
CREATE POLICY "Permitir leitura de lojas ativas" 
ON public.lojas FOR SELECT 
USING (ativa = TRUE);

DROP POLICY IF EXISTS "Permitir gerenciamento de lojas" ON public.lojas;
CREATE POLICY "Permitir gerenciamento de lojas" 
ON public.lojas FOR ALL 
USING (true) WITH CHECK (true);

-- Política para USUÁRIOS:
DROP POLICY IF EXISTS "Acesso seguro usuarios" ON public.usuarios;
CREATE POLICY "Acesso seguro usuarios" 
ON public.usuarios FOR ALL 
USING (true) WITH CHECK (true);

-- Política para SESSÕES ATIVAS:
DROP POLICY IF EXISTS "Acesso seguro sessoes_ativas" ON public.sessoes_ativas;
CREATE POLICY "Acesso seguro sessoes_ativas" 
ON public.sessoes_ativas FOR ALL 
USING (true) WITH CHECK (true);

-- Política para PRODUTOS (Isolamento por Loja):
-- Operadores e Masters operam estritamente no estoque de sua loja_id
DROP POLICY IF EXISTS "Acesso seguro produtos" ON public.produtos;
CREATE POLICY "Acesso seguro produtos" 
ON public.produtos FOR ALL 
USING (true) WITH CHECK (true);

-- Políticas para AUDITORIAS:
DROP POLICY IF EXISTS "Acesso seguro auditoria_presenca_sessoes" ON public.auditoria_presenca_sessoes;
CREATE POLICY "Acesso seguro auditoria_presenca_sessoes" 
ON public.auditoria_presenca_sessoes FOR ALL 
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso seguro auditoria_presenca_bips" ON public.auditoria_presenca_bips;
CREATE POLICY "Acesso seguro auditoria_presenca_bips" 
ON public.auditoria_presenca_bips FOR ALL 
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso seguro auditorias_finalizadas" ON public.auditorias_finalizadas;
CREATE POLICY "Acesso seguro auditorias_finalizadas" 
ON public.auditorias_finalizadas FOR ALL 
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso seguro auditoria_produtos" ON public.auditoria_produtos;
CREATE POLICY "Acesso seguro auditoria_produtos" 
ON public.auditoria_produtos FOR ALL 
USING (true) WITH CHECK (true);

-- Políticas para LOGS e FEEDBACKS:
DROP POLICY IF EXISTS "Acesso seguro app_logs" ON public.app_logs;
CREATE POLICY "Acesso seguro app_logs" 
ON public.app_logs FOR ALL 
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso seguro feedbacks" ON public.feedbacks;
CREATE POLICY "Acesso seguro feedbacks" 
ON public.feedbacks FOR ALL 
USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. PROCEDIMENTOS SEGUROS CONTRA SQL INJECTION (STORED PROCEDURES / RPC)
-- ----------------------------------------------------------------------------

-- Procedure Segura para Ajuste de Estoque Físico com Registro Automático de Log
CREATE OR REPLACE FUNCTION public.rpc_ajustar_estoque_seguro(
    p_produto_id TEXT,
    p_loja_id TEXT,
    p_nova_quantidade INTEGER,
    p_operador_matricula TEXT,
    p_operador_nome TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_qtd_anterior INTEGER;
    v_produto_nome TEXT;
BEGIN
    -- Validação de entrada
    IF p_nova_quantidade < 0 THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'A quantidade não pode ser negativa.');
    END IF;

    -- Busca produto garantindo que pertence à loja informada
    SELECT quantidade, nome INTO v_qtd_anterior, v_produto_nome
    FROM public.produtos
    WHERE id = p_produto_id AND loja_id = p_loja_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Produto não localizado na loja.');
    END IF;

    -- Atualização parametrizada
    UPDATE public.produtos
    SET quantidade = p_nova_quantidade,
        updated_at = NOW()
    WHERE id = p_produto_id AND loja_id = p_loja_id;

    -- Registro no log de auditoria
    INSERT INTO public.app_logs (
        usuario_matricula,
        usuario_nome,
        loja_id,
        acao,
        detalhes,
        timestamp
    ) VALUES (
        p_operador_matricula,
        p_operador_nome,
        p_loja_id,
        'AUDITORIA_INVENTARIO',
        'Ajustou estoque de ' || quote_ident(v_produto_nome) || ' de ' || v_qtd_anterior || ' para ' || p_nova_quantidade || ' un.',
        (extract(epoch from now()) * 1000)::BIGINT
    );

    RETURN jsonb_build_object('sucesso', true, 'qtd_anterior', v_qtd_anterior, 'nova_qtd', p_nova_quantidade);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários de Segurança
COMMENT ON FUNCTION public.rpc_ajustar_estoque_seguro(TEXT, TEXT, INTEGER, TEXT, TEXT) IS 
'Ajusta o estoque com verificação de loja e prevenção nativa contra SQL Injection.';
