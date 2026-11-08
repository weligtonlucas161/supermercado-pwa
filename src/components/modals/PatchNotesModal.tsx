import React from 'react';
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  ShieldCheck, 
  Layers, 
  Barcode, 
  Database,
  Lock,
  Cpu,
  ArrowRight
} from 'lucide-react';

interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Notas da Última Atualização
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                  v2026.1.4
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Lançamento Oficial Synk OpSys • Build 2026.1.4-Release
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

        {/* Conteúdo com scroll */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
          {/* Card Destacado: Importação de Planilha com 6 Setores */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-50 dark:to-slate-850 border border-emerald-500/20">
            <div className="flex items-center gap-2 font-extrabold text-emerald-800 dark:text-emerald-300 text-xs mb-1.5">
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Importação em 4 Etapas com 6 Setores Oficiais</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] mb-2.5">
              O módulo de carga de planilhas foi aprimorado para um assistente passo-a-passo estruturado:
            </p>
            <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">1.</span>
                <span><strong>Upload & Preview:</strong> Leitura imediata de arquivos .xlsx, .xls e .csv com pré-visualização das linhas.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">2.</span>
                <span><strong>Mapeamento & Setores:</strong> Mapeamento das 5 colunas estritas com seletor direto dos 6 setores permitidos (<code>FRIOS</code>, <code>AÇOUGUE</code>, <code>PEIXARIA</code>, <code>MERCEARIA</code>, <code>PADARIA</code>, <code>BAZAR</code>).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">3.</span>
                <span><strong>Criptografia Local:</strong> Processamento seguro com Web Crypto API AES-GCM 256 bits antes do envio em nuvem.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">4.</span>
                <span><strong>Sincronização & Visualização:</strong> Upload em realtime para Supabase e exibição descriptografada instantânea no software.</span>
              </li>
            </ul>
          </div>

          {/* Item 2: Autenticação por Usuário e Senha */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Autenticação Segura por Senha (Script 03)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Integração completa com o Script 03 do banco de dados Synk. O login agora exige matrícula e senha com validação via procedure <code>rpc_login_usuario</code> e persistência de sessão única em <code>public.sessoes_ativas</code>.
            </p>
          </div>

          {/* Item 3: Barcode Detector API */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Barcode className="w-3.5 h-3.5 text-emerald-500" />
              <span>Câmera Celular com Barcode Detector API</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Leitura por hardware usando o mecanismo acelerado do Google Play Services e Chromium, com linha guia laser, alternância de lanterna, vibração hápitca e bipe operacional.
            </p>
          </div>

          {/* Item 4: No Copyright & Termos de Uso */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Domínio Público & Política de No-Copyright</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Software de domínio público sem restrições de direitos autorais, garantindo total liberdade para adaptação da cadeia de varejo e auditoria de código.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
          <span className="text-[11px] text-slate-400">
            Atualizado em 08 de Novembro de 2026
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
