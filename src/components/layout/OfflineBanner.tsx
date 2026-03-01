import React from 'react';
import { WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OfflineBannerProps {
    isOffline: boolean;
    lastSync: Date | null;
    onRefresh?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOffline, lastSync, onRefresh }) => {
    if (!isOffline && !lastSync) return null;

    return (
        <div className={`w-full py-2 px-4 flex items-center justify-between text-xs sm:text-sm transition-colors duration-300 ${isOffline
                ? 'bg-red-500/10 text-red-500 border-b border-red-500/20'
                : 'bg-green-500/10 text-green-500 border-b border-green-500/20'
            }`}>
            <div className="flex items-center gap-2">
                {isOffline ? (
                    <>
                        <WifiOff className="w-4 h-4" />
                        <span>Você está offline. Usando dados salvos localmente.</span>
                    </>
                ) : (
                    <>
                        <AlertCircle className="w-4 h-4" />
                        <span>
                            Sincronizado em: {lastSync ? format(lastSync, "HH:mm 'de' dd/MM", { locale: ptBR }) : 'Pendente'}
                        </span>
                    </>
                )}
            </div>

            {onRefresh && !isOffline && (
                <button
                    onClick={onRefresh}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors flex items-center gap-1"
                    title="Sincronizar agora"
                >
                    <RefreshCw className="w-3 h-3" />
                    <span className="hidden sm:inline">Sincronizar</span>
                </button>
            )}
        </div>
    );
};
