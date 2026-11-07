import React from 'react';
import { Store, Wifi, WifiOff } from 'lucide-react';

export default function Header({ isOnline, storeName }) {
  return (
    <header className="bg-blue-700 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <Store className="w-6 h-6" />
        <div>
          <h1 className="font-bold leading-tight">SuperPWA</h1>
          <p className="text-xs text-blue-200">{storeName}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs bg-blue-800 px-2.5 py-1 rounded-full">
        {isOnline ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-300">Online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
            <span className="text-red-300">Offline</span>
          </>
        )}
      </div>
    </header>
  );
}