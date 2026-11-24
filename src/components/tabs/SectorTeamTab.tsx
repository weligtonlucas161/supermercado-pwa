import { useEffect, useRef, useState, type FormEvent } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getDbClient } from '../../services/db/client';
import { SETORES_DE_EQUIPE, type AuthUser } from '../../types';
import { decryptSingleField, encryptSingleField } from '../../utils/encryptionUtils';
import { isSectorManager } from '../../utils/sectorManager';
import { OperationsPanelHeader } from '../common/OperationsPanelHeader';

interface SectorEmployee {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
  ativo: boolean;
}

export function SectorTeamTab() {
  const { currentUser } = useApp();
  if (!currentUser || !isSectorManager(currentUser)) return <p role="alert">Área reservada aos gestores de setor.</p>;
  return <SectorTeam key={JSON.stringify([currentUser.id, currentUser.loja_id, currentUser.setor])} user={currentUser} />;
}

function SectorTeam({ user }: { user: AuthUser }) {
  const assigned = user.setor!.trim();
  const all = assigned.toUpperCase() === 'TODOS';
  const [sector, setSector] = useState(all ? SETORES_DE_EQUIPE[0] : assigned);
  const [sectors, setSectors] = useState<string[]>(SETORES_DE_EQUIPE);
  const [name, setName] = useState('');
  const [users, setUsers] = useState<SectorEmployee[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [revision, refresh] = useState(0);
  const [pending, setPending] = useState(true);
  const [listError, setListError] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<{ matricula: string; password: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!all) return;
    const db = getDbClient();
    if (!db) return;
    let active = true;
    void db.from('setores_loja').select('nome').eq('loja_id', user.loja_id).then(({ data }) => {
      if (active && data) setSectors([...new Set([...SETORES_DE_EQUIPE,
        ...data.map(row => String(row.nome || '').trim().toUpperCase()).filter(name => name && !['TODOS', 'GERAL'].includes(name))])]);
    });
    return () => { active = false; };
  }, [all, user.loja_id]);

  useEffect(() => {
    let active = true;
    setPending(true);
    setListError(false);
    const load = async () => {
      const db = getDbClient();
      try {
        if (!db) throw new Error('Sem conexão');
        const { data, error } = await db.functions.invoke('create-store-user', {
          body: { action: 'list-sector-users', loja_id: user.loja_id, setor: sector, page },
        });
        if (error || !data?.success || !Array.isArray(data.users)) throw new Error('Falha na consulta');
        if (active) {
          setUsers(data.users);
          setHasMore(data.hasMore === true);
        }
      } catch {
        if (active) setListError(true);
      } finally {
        if (active) setPending(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user.loja_id, sector, page, revision]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || name.trim().length < 2) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    setCredentials(null);
    try {
      const db = getDbClient();
      if (!db) throw new Error('Sem conexão');
      const { data, error } = await db.functions.invoke('create-store-user', {
        body: { action: 'create-sector-user', loja_id: user.loja_id, setor: sector, cargo: 'Operador de Loja',
          nome: name.trim(), nome_cifrado: encryptSingleField(name.trim()) },
      });
      if (error || !data?.success || !data.matricula || !data.password) throw new Error('Falha no cadastro');
      setCredentials({ matricula: data.matricula, password: data.password });
      setName('');
      setPage(0);
      refresh(value => value + 1);
    } catch {
      setError('Não foi possível cadastrar. Confira a conexão, as permissões e o limite de usuários da loja.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <OperationsPanelHeader icon={Users} title="Equipe do Setor" />
      {all ? <label className="block space-y-1 text-sm">Setor
        <select value={sector} disabled={saving} className={field} onChange={event => {
          setSector(event.target.value); setPage(0); setCredentials(null); setPending(true);
        }}>{sectors.map(item => <option key={item}>{item}</option>)}</select>
      </label> : <p className="text-sm font-semibold">{sector}</p>}
      <form onSubmit={save} className="space-y-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
        <label className="block space-y-1 text-sm font-semibold">Nome do novo operador
          <input className={field} value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={120} />
        </label>
        <button disabled={saving || name.trim().length < 2} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          <UserPlus size={16} /> {saving ? 'Cadastrando…' : 'Adicionar usuário'}
        </button>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </form>
      {credentials && <div role="status" className="space-y-1 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
        <p className="font-bold">Usuário cadastrado</p>
        <p>Matrícula: <code>{credentials.matricula}</code></p>
        <p className="break-all">Senha inicial: <code>{credentials.password}</code></p>
        <button type="button" className="font-bold underline" onClick={() => setCredentials(null)}>Ocultar credenciais</button>
      </div>}
      {pending ? <p role="status" className="text-sm">Carregando equipe…</p> : listError ?
        <p role="alert" className="text-sm text-rose-700">Não foi possível consultar a equipe. <button type="button" className="underline" onClick={() => refresh(value => value + 1)}>Tentar novamente</button></p> :
        users.length === 0 ? <p className="text-sm text-slate-500">Nenhum usuário encontrado neste setor.</p> :
        <ul className="space-y-2">{users.map(employee => <li key={employee.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
          <p className="font-bold">{decryptSingleField(employee.nome)}</p>
          <p className="text-xs text-slate-500">{employee.matricula} · {employee.cargo} · {employee.ativo ? 'Ativo' : 'Inativo'}</p>
        </li>)}</ul>}
      {(page > 0 || hasMore) && <div className="flex gap-3 text-sm font-bold text-emerald-700">
        <button type="button" disabled={pending || page === 0} onClick={() => { setPending(true); setPage(value => value - 1); }}>Anterior</button>
        <button type="button" disabled={pending || !hasMore} onClick={() => { setPending(true); setPage(value => value + 1); }}>Próxima</button>
      </div>}
    </section>
  );
}
