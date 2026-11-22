import React, { useEffect, useState } from 'react';
import { Fingerprint, X } from 'lucide-react';
import { listPasskeys, registerPasskey, supportsPasskeys } from '../../services/passkeyService';

export function PasskeyEnrollmentModal({ userId, firstLogin }: { userId: string; firstLogin: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setOpen(false);
    if (firstLogin || !supportsPasskeys() || !userId) return;
    const key = `superpwa_passkey_prompt_${userId}`;
    if (localStorage.getItem(key)) return;
    void listPasskeys().then(count => {
      if (!cancelled && count === 0) setOpen(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, firstLogin]);
  if (!open) return null;
  const dismiss = () => {
    localStorage.setItem(`superpwa_passkey_prompt_${userId}`, 'dismissed');
    setOpen(false);
  };
  const enroll = async () => {
    setBusy(true);
    setError('');
    try {
      await registerPasskey();
      localStorage.setItem(`superpwa_passkey_prompt_${userId}`, 'enabled');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar a chave.');
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="passkey-title">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-start">
          <Fingerprint className="w-10 h-10 text-emerald-600" aria-hidden="true" />
          <button type="button" onClick={dismiss} aria-label="Agora não"><X /></button>
        </div>
        <h2 id="passkey-title" className="text-xl font-bold">Deseja ativar sua chave de acesso?</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Nos próximos acessos, use a digital, o rosto ou o desbloqueio seguro do aparelho, sem digitar sua senha.</p>
        <p className="text-xs text-slate-500">A ativação é opcional. Seus dados biométricos permanecem no dispositivo. Mantenha um método de recuperação de conta.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="button" onClick={() => void enroll()} disabled={busy} className="w-full rounded-xl bg-emerald-600 p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Aguardando confirmação...' : 'Ativar chave de acesso'}</button>
        <button type="button" onClick={dismiss} disabled={busy} className="w-full rounded-xl p-2 text-sm text-slate-600 dark:text-slate-300">Agora não</button>
      </div>
    </div>
  );
}
