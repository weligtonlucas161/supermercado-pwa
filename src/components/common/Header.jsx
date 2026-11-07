import React from 'react';
import { Wifi, WifiOff, Bell } from 'lucide-react';

export default function Header({ isOnline, notifications }) {
  return (
    <header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b bg-white/95 border-slate-200 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-emerald-500/20">
          S
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-tight">SuperPWA</h1>
          <p className="text-xs text-slate-500">Gestão Operacional</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
          isOnline ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
        }`}>
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Modo Offline'}</span>
        </div>

        <button className="p-2 rounded-xl relative hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          {notifications > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          )}
        </button>
      </div>
    </header>
  );
}