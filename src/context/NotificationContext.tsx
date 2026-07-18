import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationContextProps {
  showAlert: (message: string, type?: NotificationType) => void;
  showConfirm: (message: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<{ message: string; type: NotificationType } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ message: string; resolve: (value: boolean) => void } | null>(null);

  const showAlert = (message: string, type: NotificationType = 'info') => {
    setAlertConfig({ message, type });
  };

  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmConfig({ message, resolve });
    });
  };

  const closeAlert = () => setAlertConfig(null);

  const handleConfirm = (result: boolean) => {
    if (confirmConfig) {
      confirmConfig.resolve(result);
      setConfirmConfig(null);
    }
  };

  const getAlertIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-12 h-12 text-emerald-500 mb-4" />;
      case 'error': return <XCircle className="w-12 h-12 text-red-500 mb-4" />;
      case 'warning': return <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />;
      case 'info':
      default: return <Info className="w-12 h-12 text-brand-dark mb-4" />;
    }
  };

  const getAlertTitle = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'Éxito';
      case 'error': return 'Error';
      case 'warning': return 'Advertencia';
      case 'info':
      default: return 'Aviso';
    }
  };

  return (
    <NotificationContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Alert Modal */}
      {alertConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            {getAlertIcon(alertConfig.type)}
            <h3 className="text-xl font-bold text-gray-800 mb-2">{getAlertTitle(alertConfig.type)}</h3>
            <p className="text-gray-600 mb-6">{alertConfig.message}</p>
            <button
              onClick={closeAlert}
              className="w-full py-2.5 px-4 bg-brand-dark hover:bg-brand-hover text-white font-semibold rounded-xl transition-colors"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmación</h3>
            <p className="text-gray-600 mb-6">{confirmConfig.message}</p>
            <div className="flex w-full gap-3">
              <button
                onClick={() => handleConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className="flex-1 py-2.5 px-4 bg-brand-dark hover:bg-brand-hover text-white font-semibold rounded-xl transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
