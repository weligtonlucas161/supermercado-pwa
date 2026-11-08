import React from 'react';
import { ShieldCheck, X, FileText, Check, Lock, Database, Info } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                Termos de Uso & Política Operacional
              </h3>
              <p className="text-[11px] text-slate-400">
                SuperPWA OpSys • Licença de Domínio Público (No-Copyright)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-3.5 overflow-y-auto flex-1 pr-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {/* No Copyright notice box */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-black block text-xs mb-0.5">DECLARAÇÃO DE DOMÍNIO PÚBLICO (NO-COPYRIGHT)</span>
              <p className="text-[11px] opacity-90 leading-relaxed">
                Este sistema operacional de supermercado é disponibilizado sob regime de <strong>Domínio Público (Sem Direitos Autorais Reservados / No Copyright)</strong>. Qualquer organização de varejo ou operador é livre para executar, modificar, distribuir ou integrar esta solução conforme sua conveniência logística.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              1. Identificação e Autenticação de Operadores
            </h4>
            <p className="text-[11px]">
              O acesso ao sistema é pessoal e intransferível através de matrícula operacional e senha de segurança. O operador é responsável pela conferência física correta dos produtos e auditorias bipadas sob sua credencial.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-500" />
              2. Criptografia e Sigilo de Dados em Trânsito
            </h4>
            <p className="text-[11px]">
              Todos os dados de importação de planilhas de estoque (Descrição, Fornecedor, Reduzido, EAN e Quantidades) são submetidos à criptografia local por padrão com padrão militar AES-GCM 256 bits antes do armazenamento em nuvem no Supabase, garantindo integridade e confidencialidade comercial.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-500" />
              3. Isolamento Multi-Loja e Auditoria de Estoque
            </h4>
            <p className="text-[11px]">
              Cada filial física possui isolamento estrito de inventário por <code>loja_id</code>. A conferência às cegas, relatórios de validade e auditorias de presença são registradas em logs auditáveis no banco de dados central.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-500" />
              4. Contingência Offline e Sincronização Local
            </h4>
            <p className="text-[11px]">
              Em caso de perda de conexão de rede ou oscilação do Wi-Fi na loja, o sistema opera de forma contínua salvando as bipagens no armazenamento local seguro e promovendo a consolidação automática ao restabelecer sinal.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs"
          >
            Li e Concordo com os Termos
          </button>
        </div>
      </div>
    </div>
  );
};
