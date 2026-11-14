-- ============================================================================
-- DDL CONSOLIDADO: CLOUD SQL MYSQL 8.4 (Instância: super-opsys)
-- Sistema: SuperPWA OpSys - Controle de Validade, Estoque, Chat e Auditorias
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `super_opsys`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `super_opsys`;

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- ----------------------------------------------------------------------------
-- 1. LOJAS (Multi-tenant: Matriz e Filiais)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lojas` (
  `id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `nome_loja` VARCHAR(150) NOT NULL,
  `cor_borda` VARCHAR(16) NOT NULL DEFAULT '#2563EB',
  `ativa` TINYINT(1) NOT NULL DEFAULT 1,
  `limite_usuarios` INT NOT NULL DEFAULT 15,
  `matriz_id` VARCHAR(64) NULL,
  `cnpj` TEXT NULL,
  `endereco` TEXT NULL,
  `telefone` TEXT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_lojas_matriz_id` (`matriz_id`),
  INDEX `idx_lojas_ativa` (`ativa`),
  INDEX `idx_lojas_nome_loja` (`nome_loja`),
  CONSTRAINT `fk_lojas_matriz` FOREIGN KEY (`matriz_id`) REFERENCES `lojas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. PERFIS / CARGOS POR LOJA (Controle de Acesso e Setores Permitidos)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `perfis` (
  `id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `loja_id` VARCHAR(64) NOT NULL,
  `nome` VARCHAR(80) NOT NULL,
  `descricao` VARCHAR(255) NULL,
  `permissoes` JSON NOT NULL DEFAULT (JSON_OBJECT(
    'setores_permitidos', JSON_ARRAY(),
    'pode_auditar', TRUE,
    'pode_ajustar_estoque', TRUE,
    'pode_importar_planilha', FALSE,
    'pode_gerenciar_validade', TRUE,
    'pode_acessar_chat', TRUE
  )),
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_perfis_loja_nome` (`loja_id`, `nome`),
  INDEX `idx_perfis_loja_id` (`loja_id`),
  CONSTRAINT `fk_perfis_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. USUÁRIOS E SESSÕES ATIVAS (Sessão Única e Isolamento por Loja)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `matricula` VARCHAR(64) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `senha` VARCHAR(512) NOT NULL DEFAULT '',
  `senha_hash` VARCHAR(255) NULL,
  `cargo` VARCHAR(64) NOT NULL DEFAULT 'operador',
  `perfil_id` VARCHAR(64) NULL,
  `setor` VARCHAR(64) NULL,
  `loja_id` VARCHAR(64) NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `primeiro_login` TINYINT(1) NOT NULL DEFAULT 1,
  `permissoes` JSON NOT NULL DEFAULT (JSON_OBJECT(
    'pode_auditar', TRUE,
    'pode_ajustar_estoque', TRUE,
    'pode_importar_planilha', FALSE,
    'pode_gerenciar_validade', TRUE,
    'pode_acessar_chat', TRUE
  )),
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_matricula` (`matricula`),
  INDEX `idx_usuarios_loja_id` (`loja_id`),
  INDEX `idx_usuarios_perfil_id` (`perfil_id`),
  INDEX `idx_usuarios_cargo` (`cargo`),
  INDEX `idx_usuarios_ativo` (`ativo`),
  CONSTRAINT `fk_usuarios_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_usuarios_perfil` FOREIGN KEY (`perfil_id`) REFERENCES `perfis` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessoes_ativas` (
  `matricula` VARCHAR(64) NOT NULL,
  `token` VARCHAR(128) NOT NULL,
  `usuario_nome` VARCHAR(255) NOT NULL,
  `loja_id` VARCHAR(64) NULL,
  `timestamp` BIGINT NOT NULL,
  `last_seen` BIGINT NOT NULL,
  `status` ENUM('ATIVA', 'FINALIZADA') NOT NULL DEFAULT 'ATIVA',
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`matricula`),
  INDEX `idx_sessoes_last_seen` (`last_seen`),
  INDEX `idx_sessoes_status` (`status`),
  INDEX `idx_sessoes_loja_id` (`loja_id`),
  CONSTRAINT `fk_sessoes_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. ESTOQUE, CATÁLOGO UNIVERSAL E AVARIAS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `produtos` (
  `id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `nome` TEXT NOT NULL,
  `codigo_barras` VARCHAR(128) NOT NULL,
  `codigo_barras_secundario` VARCHAR(128) NULL,
  `plu` VARCHAR(128) NULL,
  `codigo_fornecedor` VARCHAR(128) NULL,
  `setor` VARCHAR(64) NOT NULL DEFAULT 'MERCEARIA',
  `quantidade` INT NOT NULL DEFAULT 0,
  `estoque_minimo` INT NOT NULL DEFAULT 10,
  `data_vencimento` VARCHAR(20) NOT NULL,
  `loja_id` VARCHAR(64) NOT NULL,
  `is_encrypted` TINYINT(1) NOT NULL DEFAULT 0,
  `ciphertext` LONGTEXT NULL,
  `iv` VARCHAR(255) NULL,
  `is_locked_for_edit` TINYINT(1) NOT NULL DEFAULT 0,
  `locked_by` VARCHAR(255) NULL,
  `locked_at` DATETIME(3) NULL,
  `criado_em` BIGINT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_produtos_loja_ean` (`loja_id`, `codigo_barras`),
  INDEX `idx_produtos_loja_id` (`loja_id`),
  INDEX `idx_produtos_ean` (`codigo_barras`),
  INDEX `idx_produtos_ean_sec` (`codigo_barras_secundario`),
  INDEX `idx_produtos_plu_loja` (`loja_id`, `plu`),
  INDEX `idx_produtos_forn_loja` (`loja_id`, `codigo_fornecedor`),
  INDEX `idx_produtos_setor` (`loja_id`, `setor`),
  INDEX `idx_produtos_validade` (`loja_id`, `data_vencimento`),
  CONSTRAINT `fk_produtos_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `produtos_catalogo_universal` (
  `codigo_barras` VARCHAR(128) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `criado_em` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atualizado_em` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`codigo_barras`),
  INDEX `idx_catalogo_universal_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `avarias_estoque` (
  `id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `loja_id` VARCHAR(64) NOT NULL,
  `codigo_barras` VARCHAR(128) NOT NULL,
  `codigo_reduzido` VARCHAR(128) NULL,
  `produto_nome` TEXT NOT NULL,
  `quantidade` INT NOT NULL DEFAULT 1,
  `tipo_avaria` VARCHAR(64) NOT NULL DEFAULT 'Outro',
  `para_troca` TINYINT(1) NOT NULL DEFAULT 1,
  `setor` VARCHAR(64) NULL,
  `registrado_por_nome` VARCHAR(255) NOT NULL,
  `registrado_por_matricula` VARCHAR(64) NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_avarias_loja_id` (`loja_id`),
  INDEX `idx_avarias_timestamp` (`loja_id`, `timestamp` DESC),
  CONSTRAINT `fk_avarias_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. CHAT OPERACIONAL COM ISOLAMENTO MULTI-TENANT E CANAL PRIVADO COM LÍDERES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `chat_mensagens` (
  `id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `loja_id` VARCHAR(64) NOT NULL,
  `canal_tipo` ENUM('grupo', 'direto_lider') NOT NULL DEFAULT 'grupo',
  `destinatario_id` VARCHAR(64) NULL,
  `destinatario_nome` VARCHAR(255) NULL,
  `remetente_matricula` VARCHAR(64) NOT NULL,
  `remetente_nome` VARCHAR(255) NOT NULL,
  `remetente_cargo` VARCHAR(64) NULL,
  `is_anonimo` TINYINT(1) NOT NULL DEFAULT 0,
  `conteudo` TEXT NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_chat_loja_timestamp` (`loja_id`, `timestamp`),
  INDEX `idx_chat_canal_isolado` (`loja_id`, `canal_tipo`, `destinatario_id`, `timestamp`),
  INDEX `idx_chat_remetente` (`loja_id`, `remetente_matricula`),
  CONSTRAINT `fk_chat_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_chat_canal_isolamento` CHECK (
    (`canal_tipo` = 'grupo' AND `destinatario_id` IS NULL)
    OR (`canal_tipo` = 'direto_lider' AND `destinatario_id` IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. AUDITORIAS EM TEMPO REAL, INVENTÁRIO CEGO E RELATÓRIOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `auditoria_presenca_sessoes` (
  `id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `loja_id` VARCHAR(64) NOT NULL,
  `setor` VARCHAR(64) NOT NULL,
  `tipo` ENUM('PRESENCA', 'INVENTARIO', 'VALIDADE') NOT NULL DEFAULT 'PRESENCA',
  `iniciada_por_nome` VARCHAR(255) NOT NULL,
  `iniciada_por_matricula` VARCHAR(64) NOT NULL,
  `status` ENUM('ATIVA', 'PAUSADA', 'CONCLUIDA') NOT NULL DEFAULT 'ATIVA',
  `data_auditoria` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `hora_auditoria` VARCHAR(16) NOT NULL,
  `chave_auditoria` VARCHAR(160) NULL,
  `timestamp` BIGINT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_presenca_sessoes_loja_status` (`loja_id`, `status`),
  INDEX `idx_presenca_sessoes_chave` (`chave_auditoria`),
  INDEX `idx_presenca_sessoes_composta` (`loja_id`, `setor`, `data_auditoria` DESC, `hora_auditoria` DESC),
  CONSTRAINT `fk_aud_sessoes_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auditoria_presenca_bips` (
  `id` VARCHAR(128) NOT NULL,
  `sessao_id` VARCHAR(64) NOT NULL,
  `loja_id` VARCHAR(64) NOT NULL,
  `produto_id` VARCHAR(64) NOT NULL,
  `codigo_barras` VARCHAR(128) NOT NULL,
  `produto_nome` TEXT NOT NULL,
  `setor` VARCHAR(64) NOT NULL,
  `quantidade_fisica` INT NULL,
  `operador_matricula` VARCHAR(64) NOT NULL,
  `operador_nome` VARCHAR(255) NOT NULL,
  `data_auditoria` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `hora_auditoria` VARCHAR(16) NOT NULL,
  `chave_auditoria` VARCHAR(160) NULL,
  `timestamp` BIGINT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_presenca_bips_sessao` (`sessao_id`),
  INDEX `idx_presenca_bips_loja` (`loja_id`),
  INDEX `idx_presenca_bips_composta` (`loja_id`, `setor`, `data_auditoria` DESC, `hora_auditoria` DESC),
  CONSTRAINT `fk_aud_bips_sessao` FOREIGN KEY (`sessao_id`) REFERENCES `auditoria_presenca_sessoes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aud_bips_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auditorias_finalizadas` (
  `id` VARCHAR(64) NOT NULL,
  `loja_id` VARCHAR(64) NOT NULL,
  `setor` VARCHAR(64) NOT NULL,
  `tipo` ENUM('PRESENCA', 'INVENTARIO', 'VALIDADE') NOT NULL DEFAULT 'PRESENCA',
  `iniciada_por_nome` VARCHAR(255) NOT NULL,
  `iniciada_por_matricula` VARCHAR(64) NOT NULL,
  `finalizada_por_nome` VARCHAR(255) NOT NULL,
  `finalizada_por_matricula` VARCHAR(64) NOT NULL,
  `total_esperado` INT NOT NULL DEFAULT 0,
  `total_auditado` INT NOT NULL DEFAULT 0,
  `total_divergentes` INT NOT NULL DEFAULT 0,
  `iniciada_em` BIGINT NOT NULL,
  `finalizada_em` BIGINT NOT NULL,
  `data_auditoria` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `hora_auditoria` VARCHAR(16) NOT NULL,
  `chave_auditoria` VARCHAR(160) NULL,
  `participantes` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  `duracao_label` VARCHAR(64) NULL,
  `camera_scans_count` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'CONCLUIDA',
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_aud_fin_loja_data` (`loja_id`, `finalizada_em` DESC),
  INDEX `idx_aud_fin_composta` (`loja_id`, `setor`, `data_auditoria` DESC, `hora_auditoria` DESC),
  INDEX `idx_aud_fin_chave` (`chave_auditoria`),
  CONSTRAINT `fk_aud_fin_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auditoria_produtos` (
  `id` VARCHAR(128) NOT NULL,
  `sessao_id` VARCHAR(64) NOT NULL,
  `loja_id` VARCHAR(64) NOT NULL,
  `produto_id` VARCHAR(64) NOT NULL,
  `codigo_barras` VARCHAR(128) NOT NULL,
  `plu` VARCHAR(128) NULL,
  `nome` TEXT NOT NULL,
  `setor` VARCHAR(64) NOT NULL,
  `quantidade_sistema` INT NOT NULL DEFAULT 0,
  `quantidade_fisica` INT NULL,
  `divergencia` INT NULL,
  `status_presenca` VARCHAR(32) NOT NULL DEFAULT 'CONFIRMADO',
  `operador_nome` VARCHAR(255) NULL,
  `operador_matricula` VARCHAR(64) NULL,
  `data_auditoria` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `hora_auditoria` VARCHAR(16) NOT NULL,
  `chave_auditoria` VARCHAR(160) NULL,
  `auditado_em` BIGINT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_aud_prod_sessao` (`sessao_id`),
  INDEX `idx_aud_prod_composta` (`loja_id`, `setor`, `data_auditoria` DESC, `hora_auditoria` DESC),
  CONSTRAINT `fk_aud_prod_sessao` FOREIGN KEY (`sessao_id`) REFERENCES `auditorias_finalizadas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_aud_prod_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. LOGS DE AUDITORIA DO SISTEMA E FEEDBACKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `app_logs` (
  `id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `usuario_matricula` VARCHAR(64) NOT NULL,
  `usuario_nome` VARCHAR(255) NOT NULL,
  `loja_id` VARCHAR(64) NULL,
  `acao` VARCHAR(120) NOT NULL,
  `detalhes` TEXT NOT NULL,
  `timestamp` BIGINT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_app_logs_loja_time` (`loja_id`, `timestamp` DESC),
  INDEX `idx_app_logs_matricula` (`usuario_matricula`),
  CONSTRAINT `fk_app_logs_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `feedbacks` (
  `id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `usuario_matricula` VARCHAR(64) NOT NULL,
  `usuario_nome` VARCHAR(255) NOT NULL,
  `loja_id` VARCHAR(64) NULL,
  `mensagem` TEXT NOT NULL,
  `avaliacao` INT NOT NULL DEFAULT 5,
  `timestamp` BIGINT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_feedbacks_time` (`timestamp` DESC),
  INDEX `idx_feedbacks_loja` (`loja_id`),
  CONSTRAINT `fk_feedbacks_loja` FOREIGN KEY (`loja_id`) REFERENCES `lojas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_feedbacks_avaliacao` CHECK (`avaliacao` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
