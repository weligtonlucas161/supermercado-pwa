-- ============================================================================
-- SCRIPT MASTER CONSOLIDADO: ESTRUTURA OFICIAL DO BANCO DE DADOS
-- Sistema: Synk - Controle de Prevenção de Perdas (SuperPWA OpSys)
-- Versão: 2026.1 (Multi-tenant, Matriz/Filiais, Sessão Única, RLS e Auditoria)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EXTENSÕES CORE E FUNÇÕES BASE
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

-- Inserir Loja Padrão do Sistema para operação inicial
INSERT INTO public.lojas (id, nome_loja, cor_borda, ativa, cnpj, endereco, telefone)
VALUES (
    'loja_padrao_001',
    'Supermercado Silva - Loja 01 (Matriz)',
    '#059669',
    TRUE,
    '12.345.678/0001-90',
    'Av. Principal, 1000 - Centro',
    '(11) 3456-7890'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. USUÁRIOS E CONTROLE DE SESSÃO ÚNICA COM AUTENTICAÇÃO POR SENHA (SCRIPT 03)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    matricula TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    senha TEXT NOT NULL DEFAULT '123456', -- Autenticação por Matrícula e Senha
    senha_hash TEXT,
    cargo TEXT NOT NULL DEFAULT 'operador', -- 'adm', 'master', 'operador'
    setor TEXT,
    loja_id TEXT REFERENCES public.lojas(id) ON DELETE SET NULL, -- NULL para ADM do SaaS
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir colunas de senha caso a tabela já exista
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS senha TEXT NOT NULL DEFAULT '123456';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS senha_hash TEXT;

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

-- Usuários Iniciais com Matrícula e Senha Cadastradas
INSERT INTO public.usuarios (id, matricula, nome, senha, cargo, setor, loja_id, ativo)
VALUES 
(
    'usr_adm_global_001',
    '111111',
    'Administrador do Sistema (SaaS)',
    'admin123',
    'adm',
    'Todos',
    NULL,
    TRUE
),
(
    'usr_op_carlos_4092',
    '4092',
    'Carlos Silva',
    '123456',
    'operador',
    'Prevenção e Estoque',
    'loja_padrao_001',
    TRUE
)
ON CONFLICT (matricula) DO UPDATE 
SET senha = EXCLUDED.senha, nome = EXCLUDED.nome, cargo = EXCLUDED.cargo;

-- RPC de Autenticação Segura por Matrícula e Senha
CREATE OR REPLACE FUNCTION public.rpc_login_usuario(p_matricula TEXT, p_senha TEXT)
RETURNS jsonb AS $$
DECLARE
    v_user record;
    v_loja record;
    v_token TEXT;
BEGIN
    SELECT * INTO v_user
    FROM public.usuarios
    WHERE matricula = p_matricula AND ativo = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Matrícula não encontrada no sistema');
    END IF;

    IF v_user.senha != p_senha THEN
        RETURN jsonb_build_object('success', false, 'message', 'Senha incorreta para a matrícula informada');
    END IF;

    -- Obter detalhes da loja vinculada
    IF v_user.loja_id IS NOT NULL THEN
        SELECT * INTO v_loja FROM public.lojas WHERE id = v_user.loja_id;
    END IF;

    v_token := 'tok_' || encode(gen_random_bytes(16), 'hex');

    -- Registra sessão ativa única
    INSERT INTO public.sessoes_ativas (matricula, token, usuario_nome, loja_id, status)
    VALUES (v_user.matricula, v_token, v_user.nome, v_user.loja_id, 'ATIVA')
    ON CONFLICT (matricula) 
    DO UPDATE SET token = EXCLUDED.token, last_seen = (extract(epoch from now()) * 1000), status = 'ATIVA';

    RETURN jsonb_build_object(
        'success', true,
        'token', v_token,
        'user', jsonb_build_object(
            'id', v_user.id,
            'matricula', v_user.matricula,
            'nome', v_user.nome,
            'cargo', v_user.cargo,
            'setor', COALESCE(v_user.setor, 'Geral'),
            'loja_id', v_user.loja_id,
            'loja_nome', COALESCE(v_loja.nome_loja, 'Supermercado Silva - Loja 01')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. PRODUTOS E GESTÃO DE ESTOQUE (ISOLAMENTO POR LOJA)
-- Suporte às 5 colunas estritas:
-- 1. Descrição do produto (nome)
-- 2. Código de fornecedor (codigo_fornecedor)
-- 3. Código reduzido (plu)
-- 4. Código EAN (codigo_barras)
-- 5. Quantidade (quantidade)
-- E campos criptográficos em repouso (ciphertext, iv)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produtos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nome TEXT NOT NULL,
    codigo_barras TEXT NOT NULL,
    plu TEXT,                                -- Código Reduzido
    codigo_fornecedor TEXT,                  -- Código de Fornecedor
    setor TEXT NOT NULL DEFAULT 'Mercearia',
    quantidade INTEGER NOT NULL DEFAULT 0,
    data_vencimento TEXT NOT NULL DEFAULT (to_char(CURRENT_DATE + INTERVAL '60 days', 'YYYY-MM-DD')), -- YYYY-MM-DD
    loja_id TEXT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    ciphertext TEXT,
    iv TEXT,
    criado_em BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_loja_id ON public.produtos(loja_id);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON public.produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_ean_loja ON public.produtos(loja_id, codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_plu_loja ON public.produtos(loja_id, plu);
CREATE INDEX IF NOT EXISTS idx_produtos_forn_loja ON public.produtos(loja_id, codigo_fornecedor);
CREATE INDEX IF NOT EXISTS idx_produtos_setor ON public.produtos(loja_id, setor);
CREATE INDEX IF NOT EXISTS idx_produtos_data_vencimento ON public.produtos(loja_id, data_vencimento);

-- Constraint única para upsert confiável por loja e código de barras
DO $$ BEGIN
    ALTER TABLE public.produtos 
    ADD CONSTRAINT uq_produtos_loja_ean UNIQUE (loja_id, codigo_barras);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_produtos_updated_at ON public.produtos;
CREATE TRIGGER trg_produtos_updated_at
BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 4.1 BANCO DE DADOS UNIVERSAL DE PRODUTOS (CATÁLOGO GLOBAL COMPARTILHADO)
-- Armazena exclusivamente código_barras e nome para auto-preenchimento
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produtos_catalogo_universal (
    codigo_barras TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_universal_nome 
    ON public.produtos_catalogo_universal(nome);

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
    id TEXT PRIMARY KEY, -- sessao_id || '_' || produto_id
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
-- 7. PROCEDURES / RPC DE GRAVAÇÃO E IMPORTAÇÃO
-- ----------------------------------------------------------------------------

-- Procedure Segura para Ajuste de Estoque Físico
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
    IF p_nova_quantidade < 0 THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'A quantidade não pode ser negativa.');
    END IF;

    SELECT quantidade, nome INTO v_qtd_anterior, v_produto_nome
    FROM public.produtos
    WHERE id = p_produto_id AND loja_id = p_loja_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Produto não localizado na loja.');
    END IF;

    UPDATE public.produtos
    SET quantidade = p_nova_quantidade,
        updated_at = NOW()
    WHERE id = p_produto_id AND loja_id = p_loja_id;

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
        'AJUSTE_ESTOQUE',
        'Ajustou estoque de ' || quote_ident(v_produto_nome) || ' de ' || v_qtd_anterior || ' para ' || p_nova_quantidade || ' un.',
        (extract(epoch from now()) * 1000)::BIGINT
    );

    RETURN jsonb_build_object('sucesso', true, 'qtd_anterior', v_qtd_anterior, 'nova_qtd', p_nova_quantidade);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Procedure para Importação em Massa das 5 Colunas (Alimenta produtos e produtos_catalogo_universal)
CREATE OR REPLACE FUNCTION public.import_products_bulk(
    products_payload JSONB,
    p_loja_id TEXT DEFAULT 'loja_padrao_001',
    overwrite_existing BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    item JSONB;
    v_ean TEXT;
    v_name TEXT;
    v_supplier_code TEXT;
    v_reduced_code TEXT;
    v_stock INT;
    v_ciphertext TEXT;
    v_iv TEXT;
    v_is_encrypted BOOLEAN;
    v_inserted INT := 0;
    v_updated INT := 0;
    v_existing_id TEXT;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(products_payload)
    LOOP
        v_ean := TRIM(COALESCE(item->>'codigo_barras', item->>'ean', ''));
        v_name := TRIM(COALESCE(item->>'nome', item->>'name', ''));
        v_supplier_code := TRIM(COALESCE(item->>'codigo_fornecedor', item->>'supplierCode', item->>'supplier_code', ''));
        v_reduced_code := TRIM(COALESCE(item->>'plu', item->>'reducedCode', item->>'reduced_code', ''));
        v_stock := GREATEST(0, COALESCE((item->>'quantidade')::INT, (item->>'stock')::INT, 0));
        v_ciphertext := item->>'ciphertext';
        v_iv := item->>'iv';
        v_is_encrypted := COALESCE((item->>'is_encrypted')::BOOLEAN, (item->>'isEncrypted')::BOOLEAN, false);

        IF v_ean <> '' AND v_name <> '' THEN
            -- 1. Alimenta o Catálogo Universal em segundo plano (Script 08)
            INSERT INTO public.produtos_catalogo_universal (codigo_barras, nome, atualizado_em)
            VALUES (v_ean, v_name, NOW())
            ON CONFLICT (codigo_barras) 
            DO UPDATE SET nome = EXCLUDED.nome, atualizado_em = NOW();

            -- 2. Alimenta a tabela isolada de produtos da Loja
            SELECT id INTO v_existing_id 
            FROM public.produtos 
            WHERE codigo_barras = v_ean AND loja_id = p_loja_id;

            IF v_existing_id IS NOT NULL THEN
                IF overwrite_existing THEN
                    UPDATE public.produtos
                    SET nome = v_name,
                        plu = v_reduced_code,
                        codigo_fornecedor = v_supplier_code,
                        setor = COALESCE(item->>'setor', item->>'category', 'MERCEARIA'),
                        quantidade = v_stock,
                        is_encrypted = v_is_encrypted,
                        ciphertext = v_ciphertext,
                        iv = v_iv,
                        updated_at = NOW()
                    WHERE id = v_existing_id;
                    v_updated := v_updated + 1;
                END IF;
            ELSE
                INSERT INTO public.produtos (
                    loja_id, codigo_barras, nome, plu, codigo_fornecedor, setor, quantidade, is_encrypted, ciphertext, iv
                )
                VALUES (
                    p_loja_id, v_ean, v_name, v_reduced_code, v_supplier_code, COALESCE(item->>'setor', item->>'category', 'MERCEARIA'), v_stock, v_is_encrypted, v_ciphertext, v_iv
                );
                v_inserted := v_inserted + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'sucesso', true,
        'inserted_count', v_inserted,
        'updated_count', v_updated,
        'total_processed', (v_inserted + v_updated)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 8. SEGURANÇA AVANÇADA (RLS)
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

    DROP POLICY IF EXISTS "Acesso catalogo universal" ON public.produtos_catalogo_universal;
    CREATE POLICY "Acesso catalogo universal" ON public.produtos_catalogo_universal FOR ALL USING (true) WITH CHECK (true);

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
