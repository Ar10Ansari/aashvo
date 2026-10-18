import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2 } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast } = useApp();

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 bg-charcoal-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-charcoal-700 flex items-center space-x-3 text-sm animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
      <span className="font-medium text-ivory-100">{toast}</span>
    </div>
  );
};
