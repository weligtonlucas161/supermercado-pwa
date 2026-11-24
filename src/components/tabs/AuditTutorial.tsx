import { BookOpen, ChevronDown } from 'lucide-react';

const tutorials = {
  presenca: {
    title: 'Auditoria de Presença',
    steps: [
      ['Escolha o setor', 'Toque em Iniciar Auditoria de Presença. Se a equipe já estiver conferindo o setor, toque em Entrar na Sessão.'],
      ['Bipe o que está na gôndola', 'Use a câmera ou toque em Coletor Pronto antes de usar o leitor a laser. Um código reconhecido move o produto de Pendentes para Confirmados.'],
      ['Acompanhe o progresso', 'Veja os produtos que faltam na lista de Pendentes. Use Pausar / Sair se precisar voltar mais tarde.'],
      ['Finalize a sessão', 'O anfitrião usa Concluir e Salvar Relatório. A conferência fica disponível em Relatórios.'],
    ],
  },
  inventario: {
    title: 'Inventário Cego',
    steps: [
      ['Escolha o setor', 'Toque em Iniciar Inventário Cego ou use Entrar no Inventário para participar de uma sessão ativa.'],
      ['Bipe e conte as unidades', 'Use a câmera ou o coletor. No pop-up, informe a quantidade física encontrada e confirme. O saldo do sistema fica oculto durante a contagem.'],
      ['Confira o andamento', 'Acompanhe os produtos Contados e Pendentes. O modo restrito bloqueia a troca de aba durante a sessão.'],
      ['Finalize o inventário', 'O anfitrião toca em Concluir e Salvar Inventário. Consulte o resultado e as divergências em Relatórios, conforme sua permissão.'],
    ],
  },
  validade: {
    title: 'Auditoria de Validade',
    steps: [
      ['Escolha o setor e os produtos', 'Toque em Iniciar Auditoria de Validade. Pesquise, marque os cards desejados e toque em Iniciar Auditoria. Os produtos marcados entram em Pendentes.'],
      ['Identifique o produto', 'Bipe com a câmera ou o coletor. Você também pode pesquisar por nome ou código e tocar no produto da lista.'],
      ['Registre a validade', 'No pop-up de Novo Lote, informe a data de vencimento e a quantidade encontrada. Para uma data já registrada, escolha Somar unidades ou Corrigir total.'],
      ['Acompanhe e conclua', 'Os produtos salvos passam para Conferidos e aparecem na aba Validade, agrupados por produto e separados por data nos detalhes. Você pode retomar no mesmo navegador ou tocar em Concluir conferência. A sessão expira após 5 horas do início.'],
    ],
  },
  relatorio: {
    title: 'Relatórios de Auditoria',
    steps: [
      ['Encontre a auditoria concluída', 'Procure na lista de relatórios de Presença e Inventário. Os lançamentos de validade ficam na aba Validade.'],
      ['Consulte os itens', 'Toque em Ver Detalhes para conferir os totais e os produtos auditados.'],
      ['Leve uma cópia', 'Use Exportar PDF ou o botão de Excel do relatório.'],
    ],
  },
} as const;

export type AuditInterface = keyof typeof tutorials;

export function AuditTutorial({ mode }: { mode: AuditInterface }) {
  const { title, steps } = tutorials[mode];
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-white [&::-webkit-details-marker]:hidden">
        <BookOpen className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <span>Como funciona · {title}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ol className="ml-8 list-decimal space-y-3 px-3 pb-4 pt-1 text-xs leading-relaxed marker:font-bold marker:text-emerald-700 dark:marker:text-emerald-400">
        {steps.map(([heading, detail]) => (
          <li key={heading} className="pl-1">
            <p className="font-bold text-slate-900 dark:text-white">{heading}</p>
            <p className="text-slate-600 dark:text-slate-300">{detail}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
