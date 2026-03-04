import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/ToastContext';
import { X, User, Mail, Lock, Phone, Calendar, Package, Loader2, Save, AlertCircle } from 'lucide-react';

interface PlanOption {
    id: string;
    name: string;
}

interface AddUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    plans: PlanOption[];
    onSuccess: () => void;
}

export function AddUserModal({ isOpen, onClose, plans, onSuccess }: AddUserModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        planId: '',
        days: '30'
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!formData.email || !formData.password) {
            setError('E-mail e senha são obrigatórios.');
            setLoading(false);
            return;
        }

        try {
            // Call our custom Edge Function
            // Note: We need to use the session token for authorization
            const { data, error: functionError } = await supabase.functions.invoke('create-user-admin', {
                body: {
                    full_name: formData.fullName,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    plan_id: formData.planId || null,
                    days: parseInt(formData.days) || 30
                }
            });

            if (functionError) throw functionError;
            if (data?.error) throw new Error(data.error);

            showToast('Usuário criado com sucesso!', 'success');
            onSuccess();
            onClose();
            // Reset form
            setFormData({
                fullName: '',
                email: '',
                phone: '',
                password: '',
                planId: '',
                days: '30'
            });
        } catch (err: any) {
            console.error('Error creating user:', err);
            setError(err.message || 'Erro ao criar usuário. Tente novamente.');
            showToast('Erro ao criar usuário.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm">
            <div className="bg-surface-dark border border-border-dark rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-border-dark flex items-center justify-between bg-surface-highlight/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Novo Usuário</h2>
                            <p className="text-text-secondary text-xs">Crie um acesso manual para um cliente</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex gap-3 text-sm animate-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Nome Completo */}
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                <User className="w-3.5 h-3.5" /> Nome Completo
                            </label>
                            <input
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Ex: João Silva"
                                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all placeholder:text-neutral-600"
                            />
                        </div>

                        {/* E-mail (Obrigatório) */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5" /> E-mail <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="email@exemplo.com"
                                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all placeholder:text-neutral-600"
                            />
                        </div>

                        {/* WhatsApp */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5" /> WhatsApp (com DDD)
                            </label>
                            <input
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="5511999999999"
                                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all placeholder:text-neutral-600"
                            />
                        </div>

                        {/* Senha */}
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5" /> Senha Inicial <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                name="password"
                                required
                                minLength={6}
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all placeholder:text-neutral-600"
                            />
                        </div>

                        {/* Plano */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                <Package className="w-3.5 h-3.5" /> Vincular Plano
                            </label>
                            <select
                                name="planId"
                                required
                                value={formData.planId}
                                onChange={handleChange}
                                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                            >
                                <option value="" disabled>Selecione um plano...</option>
                                {plans.map(plan => (
                                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Dias */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" /> Duração (em dias)
                            </label>
                            <input
                                type="number"
                                name="days"
                                min="1"
                                value={formData.days}
                                onChange={handleChange}
                                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all placeholder:text-neutral-600"
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-border-dark bg-surface-highlight/5 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl border border-border-dark text-white font-medium hover:bg-surface-highlight transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-[2] bg-primary text-background-dark font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                    >
                        {loading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Criando...</>
                        ) : (
                            <><Save className="w-5 h-5" /> Criar Usuário</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
