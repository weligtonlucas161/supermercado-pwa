import React, { useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Bell, 
  Barcode, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  X,
  LogOut,
  MessageSquare
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Header: React.FC = () => {
  const { 
    effectiveOnline, 
    offlineQueue, 
    syncOfflineQueue, 
    notifications, 
    unreadCount, 
    markAllNotificationsAsRead,
    openScanner,
    openChat,
    unreadChatCount,
    operator,
    logout
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base leading-tight tracking-tight text-slate-900 dark:text-white">
                SuperPWA
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                OpSys
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px] sm:max-w-none">
              {operator.store} • {operator.name.split(' ')[0]} {operator.role ? `(${operator.role})` : ''}
            </p>
          </div>
        </div>



        {/* Right action controls */}
        <div className="flex items-center gap-2">
          {/* Quick Barcode Scanner trigger */}
          <button
            onClick={() => openScanner()}
            className="p-2 rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-750 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Abrir Scanner / Bipar"
          >
            <Barcode className="w-4 h-4 text-emerald-500" />
            <span className="hidden md:inline">Bipar</span>
          </button>

          {/* Real Online / Offline status badge (sem simulação) */}
          <div
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
              effectiveOnline
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
            }`}
          >
            {effectiveOnline ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="text-[11px] hidden sm:inline">
              {effectiveOnline ? 'Online' : 'Offline'}
            </span>
            {offlineQueue.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1 rounded-full font-bold">
                {offlineQueue.length}
              </span>
            )}
          </div>

          {/* Sync Button if queue exists */}
          {offlineQueue.length > 0 && effectiveOnline && (
            <button
              onClick={syncOfflineQueue}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1 shadow-sm transition"
              title="Sincronizar alterações pendentes"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[10px] hidden sm:inline">Sincronizar ({offlineQueue.length})</span>
            </button>
          )}

          {/* Operational Chat Button */}
          <button
            onClick={() => openChat()}
            className="p-2 rounded-xl relative text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
            aria-label="Chat Operacional da Loja"
            title="Chat Operacional da Loja"
          >
            <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            {unreadChatCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Notifications Button */}
          <button
            onClick={() => setShowNotifications(true)}
            className="p-2 rounded-xl relative text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Notificações"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
            )}
          </button>

          {/* Logout / Trocar Usuário */}
          <button
            onClick={logout}
            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
            title="Sair / Trocar Usuário"
            aria-label="Sair da Conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Notifications Drawer Modal */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-xs p-3 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 mt-12 animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Notificações Operacionais</h3>
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-3 space-y-2 max-h-80 overflow-y-auto">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-2xl border text-xs transition ${
                    notif.type === 'urgent'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200'
                      : notif.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      {notif.type === 'urgent' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      {notif.title}
                    </span>
                    <span className="text-[10px] font-normal opacity-70">{notif.timestamp}</span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">{notif.message}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <button
                onClick={markAllNotificationsAsRead}
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                Marcar lidas
              </button>
              <button
                onClick={() => setShowNotifications(false)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
