import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: () => void;
}

const config = {
    success: {
        icon: CheckCircle,
        bg: 'bg-green-500/10 border-green-500/30',
        text: 'text-green-400',
    },
    error: {
        icon: XCircle,
        bg: 'bg-red-500/10 border-red-500/30',
        text: 'text-red-400',
    },
    info: {
        icon: Info,
        bg: 'bg-primary/10 border-primary/30',
        text: 'text-primary',
    },
};

export function Toast({ message, type, onClose }: ToastProps) {
    const { icon: Icon, bg, text } = config[type];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg min-w-[280px] max-w-[400px] ${bg}`}
        >
            <Icon className={`w-5 h-5 flex-shrink-0 ${text}`} />
            <span className={`text-sm font-medium flex-1 ${text}`}>{message}</span>
            <button onClick={onClose} className={`flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ${text}`}>
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
}
