@echo off
:: ====================================================================
:: Script de Criação de Estrutura de Pastas e Arquivos - SuperPWA React
:: ====================================================================

echo [1/4] Criando estrutura de pastas...

mkdir public
mkdir src
mkdir src\assets
mkdir src\components
mkdir src\components\common
mkdir src\components\tabs
mkdir src\data
mkdir src\hooks

echo [2/4] Criando arquivos na pasta public...

:: public/manifest.json
(
echo {
echo   "short_name": "SuperPWA",
echo   "name": "Supermercado PWA OpSys",
echo   "icons": [
echo     {
echo       "src": "favicon.ico",
echo       "sizes": "64x64 32x32 24x24 16x16",
echo       "type": "image/x-icon"
echo     },
echo     {
echo       "src": "icon-192.png",
echo       "type": "image/png",
echo       "sizes": "192x192"
echo     },
echo     {
echo       "src": "icon-512.png",
echo       "type": "image/png",
echo       "sizes": "512x512"
echo     }
echo   ],
echo   "start_url": ".",
echo   "display": "standalone",
echo   "theme_color": "#059669",
echo   "background_color": "#f8fafc"
echo }
) > public\manifest.json

echo [3/4] Criando arquivos de configuração base...

:: .gitignore
(
echo node_modules/
echo dist/
echo .env
echo .DS_Store
echo *.log
) > .gitignore

:: README.md
(
echo # Supermercado PWA OpSys
echo Sistema de Gestao Operacional para Supermercados em React + PWA.
echo.
echo ## Modulos
echo - Inicio: Visao geral e metricas da loja.
echo - Validade: Monitoramento e alertas de vencimento.
echo - Estoque: Saldos, busca e locais de prateleiras.
echo - Auditoria: Coleta de dados e inventario fisico.
echo - Configuracoes: Preferencias e instalacao PWA.
) > README.md

:: src/data/mockData.js
(
echo export const initialProducts = [
echo   { id: '1', ean: '7891000100011', name: 'Leite Integral 1L', category: 'Laticinios', stock: 142, minStock: 50, price: 4.89, location: 'Corredor 2 - Prateleira A' },
echo   { id: '2', ean: '7891000100028', name: 'Iogurte Natural 170g', category: 'Laticinios', stock: 18, minStock: 30, price: 3.29, location: 'Geladeira 4' },
echo   { id: '3', ean: '7891000100035', name: 'Arroz Tipo 1 5kg', category: 'Mercearia', stock: 85, minStock: 40, price: 24.90, location: 'Corredor 5 - Palete 1' },
echo   { id: '4', ean: '7891000100042', name: 'Feijao Preto 1kg', category: 'Mercearia', stock: 12, minStock: 25, price: 7.49, location: 'Corredor 5 - Prateleira C' }
echo ];
echo.
echo export const initialValidities = [
echo   { id: 'v1', productId: '2', name: 'Iogurte Natural 170g', batch: 'L-9942', dueDate: '2026-11-10', quantity: 18, status: 'urgent' },
echo   { id: 'v2', productId: '1', name: 'Leite Integral 1L', batch: 'L-8821', dueDate: '2026-11-18', quantity: 45, status: 'warning' }
echo ];
echo.
echo export const initialAudits = [
echo   { id: 'a1', title: 'Auditoria Matinal - Laticinios', date: '2026-11-07', itemsCount: 24, status: 'Concluida', auditor: 'Carlos Silva' }
echo ];
) > src\data\mockData.js

:: src/hooks/useOnlineStatus.js
(
echo import { useState, useEffect } from 'react';
echo.
echo export function useOnlineStatus() {
echo   const [isOnline, setIsOnline] = useState(navigator.onLine);
echo.
echo   useEffect(() => {
echo     const handleOnline = () => setIsOnline(true);
echo     const handleOffline = () => setIsOnline(false);
echo.
echo     window.addEventListener('online', handleOnline);
echo     window.addEventListener('offline', handleOffline);
echo.
echo     return () => {
echo       window.removeEventListener('online', handleOnline);
echo       window.removeEventListener('offline', handleOffline);
echo     };
echo   }, []);
echo.
echo   return isOnline;
echo }
) > src\hooks\useOnlineStatus.js

echo [4/4] Criando arquivos placeholder dos componentes...

type NUL > src\components\common\Header.jsx
type NUL > src\components\common\BottomNav.jsx
type NUL > src\components\tabs\InicioTab.jsx
type NUL > src\components\tabs\ValidadeTab.jsx
type NUL > src\components\tabs\EstoqueTab.jsx
type NUL > src\components\tabs\AuditoriaTab.jsx
type NUL > src\components\tabs\ConfiguracoesTab.jsx

echo.
echo ====================================================================
echo Estrutura criada com sucesso!
echo Execute os comandos Git no terminal para realizar o primeiro commit.
echo ====================================================================
pause