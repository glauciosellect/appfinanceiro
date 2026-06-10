-- ============================================================
-- LIMPEZA DO MÓDULO FISCAL - PREMIUM
-- Syncromoney — Minhas Finanças
-- Gerado em: 2026-05-14
-- ============================================================
-- ⚠️  ATENÇÃO: Esta operação é IRREVERSÍVEL.
--     Execute apenas no Supabase SQL Editor com permissão de
--     service_role (aba "SQL Editor" do painel Supabase).
-- ============================================================

-- ============================================================
-- PASSO 1: VERIFICAR O QUE EXISTE ANTES DE DELETAR
-- (Execute primeiro este bloco para conferir os dados)
-- ============================================================

SELECT 'nfse'          AS tabela, COUNT(*) AS total, COUNT(*) FILTER (WHERE ambiente = 'homologacao') AS homologacao, COUNT(*) FILTER (WHERE ambiente = 'producao') AS producao FROM public.nfse
UNION ALL
SELECT 'fiscal_config' AS tabela, COUNT(*) AS total, NULL, NULL FROM public.fiscal_config;

-- ============================================================
-- PASSO 2: LIMPAR TODAS AS NFS-e (testes de homologação)
-- ============================================================
-- Apaga TODOS os registros da tabela nfse (emissões de teste
-- e de produção). Se quiser apagar APENAS as de homologação,
-- descomente a versão filtrada abaixo.
-- ============================================================

-- Opção A: Apagar TUDO (recomendado para ambiente de testes)
DELETE FROM public.nfse;

-- Opção B: Apagar SOMENTE as de homologação (descomente se preferir)
-- DELETE FROM public.nfse WHERE ambiente = 'homologacao';

-- ============================================================
-- PASSO 3: LIMPAR CONFIGURAÇÃO FISCAL
-- ============================================================
-- Apaga as configurações fiscais (CNPJ, certificado, ambiente,
-- integração Focus NFe, etc.). Execute se quiser recomeçar do zero.
-- Deixe comentado se quiser MANTER a configuração da empresa.
-- ============================================================

DELETE FROM public.fiscal_config;

-- ============================================================
-- PASSO 4: CONFIRMAR QUE FICOU VAZIO
-- ============================================================

SELECT 'nfse'          AS tabela, COUNT(*) AS registros_restantes FROM public.nfse
UNION ALL
SELECT 'fiscal_config' AS tabela, COUNT(*) AS registros_restantes FROM public.fiscal_config;

-- ============================================================
-- OBSERVAÇÃO: NF-e DE ENTRADA (localStorage)
-- ============================================================
-- As NF-e de entrada importadas por XML são armazenadas no
-- localStorage do navegador, NÃO no banco de dados.
-- Para limpá-las, execute no console do navegador (F12):
--
--   localStorage.removeItem('syncromoney_nfe_entradas_v2');
--
-- Ou limpe todo o localStorage da aplicação:
--   localStorage.clear();
-- ============================================================
