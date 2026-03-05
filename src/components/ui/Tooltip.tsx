import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
    children: React.ReactNode;
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, title, description, position = 'top' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-t-neutral-900',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-neutral-900',
        left: 'left-full top-1/2 -translate-y-1/2 border-l-neutral-900',
        right: 'right-full top-1/2 -translate-y-1/2 border-r-neutral-900',
    };

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 5 : position === 'bottom' ? -5 : 0, x: position === 'left' ? 5 : position === 'right' ? -5 : 0 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 5 : position === 'bottom' ? -5 : 0, x: position === 'left' ? 5 : position === 'right' ? -5 : 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={`absolute z-[100] w-64 p-3 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl pointer-events-none ${positionClasses[position]}`}
                    >
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-white tracking-wide uppercase">{title}</span>
                            <span className="text-[11px] leading-relaxed text-neutral-400">{description}</span>
                        </div>
                        <div className={`absolute border-4 border-transparent ${arrowClasses[position]}`} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
