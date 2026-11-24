import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getDbClient } from '../../services/db/client';

type State = 'checking' | 'ready' | 'setup' | 'verify' | 'error';

export function SecondFactorGate({ children, logout }: { children: ReactNode; logout: () => void }) {
  const [state, setState] = useState<State>('checking');
  const [retry, setRetry] = useState(0);
  const [factor, setFactor] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const db = getDbClient();
        if (!db) throw new Error();
        const [{ data: identity, error: identityError }, { data: assurance, error: assuranceError }] =
          await Promise.all([db.auth.getUser(), db.auth.mfa.getAuthenticatorAssuranceLevel()]);
        if (identityError || assuranceError || !identity.user || !assurance) throw new Error();
        if (!active) return;
        const required = identity.user.app_metadata?.require_mfa === true;
        if (assurance.currentLevel === 'aal2' || (!required && assurance.nextLevel !== 'aal2')) {
          setState('ready');
          return;
        }
        const { data, error } = await db.auth.mfa.listFactors();
        if (error) throw error;
        if (!active) return;
        const verified = data.totp.find(item => item.status === 'verified');
        if (verified) {
          setFactor(verified.id);
          setState('verify');
        } else if (assurance.nextLevel === 'aal2') {
          setError('Esta conta tem outro tipo de segundo fator. Consulte o administrador.');
          setState('error');
        } else {
          setState('setup');
        }
      } catch {
        if (!active) return;
        setError('Não foi possível verificar a segurança da sessão. Confira sua conexão e tente novamente.');
        setState('error');
      }
    };
    void check();
    return () => { active = false; };
  }, [retry]);

  const enroll = async () => {
    const db = getDbClient();
    if (!db || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data: list, error: listError } = await db.auth.mfa.listFactors();
      if (listError || !list) throw listError ?? new Error();
      for (const item of list.all) {
        if (item.factor_type !== 'totp' || item.status !== 'unverified') continue;
        const { error } = await db.auth.mfa.unenroll({ factorId: item.id });
        if (error) throw error;
      }
      const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', issuer: 'SuperPWA OpSys' });
      if (error || !data) throw error ?? new Error();
      setFactor(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setState('verify');
    } catch {
      setError('Não foi possível preparar o autenticador. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    const db = getDbClient();
    if (!db || busy || !factor || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError('');
    try {
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor, code });
      if (error) throw error;
      setQr('');
      setSecret('');
      setCode('');
      setState('ready');
    } catch {
      setError('Código inválido ou expirado. Informe o código atual do autenticador.');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'ready') return <>{children}</>;

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 p-4">
      <section className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <ShieldCheck className="h-7 w-7 text-emerald-600" aria-hidden="true" />
        <h1 className="text-lg font-black text-slate-900">Autenticação de dois fatores</h1>
        {state === 'checking' && <p role="status">Verificando sessão…</p>}
        {state === 'setup' && <>
          <p className="text-sm text-slate-600">Use um aplicativo autenticador para adicionar a conta do SuperPWA.</p>
          <button type="button" disabled={busy} onClick={() => void enroll()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Configurar autenticador</button>
        </>}
        {state === 'verify' && <>
          {qr && <>
            <p className="text-sm text-slate-600">Leia o QR Code no autenticador e digite o código de seis dígitos.</p>
            <img src={qr} width={172} height={172} alt="QR Code do autenticador" />
            <details><summary className="cursor-pointer text-sm font-bold">Digitar chave no autenticador</summary><code className="break-all text-xs">{secret}</code></details>
          </>}
          <form onSubmit={verify} className="space-y-2">
            <label className="block text-sm font-semibold">Código do autenticador
              <input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6}
                value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <button disabled={busy || code.length !== 6} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Verificar código</button>
          </form>
        </>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex gap-3 text-sm font-bold">
          {state === 'error' && <button onClick={() => { setError(''); setState('checking'); setRetry(value => value + 1); }}>Tentar novamente</button>}
          <button type="button" disabled={busy} onClick={logout} className="text-slate-600">Sair</button>
        </div>
      </section>
    </main>
  );
}
