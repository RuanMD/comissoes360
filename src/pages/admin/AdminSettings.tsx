import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/ToastContext';
import { Loader2, Save, Image } from 'lucide-react';

interface AppSettings {
    id: string;
    whatsapp_number: string;
    whatsapp_message: string;
    hero_image_url: string;
    show_name_field: boolean;
    show_phone_field: boolean;
}

export function AdminSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .limit(1)
                .single();
            if (error) throw error;
            if (data) setSettings(data);
        } catch (error) {
            console.error('Erro ao puxar configurações', error);
            showToast('Erro ao carregar configurações.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('app_settings')
                .update({
                    whatsapp_number: settings.whatsapp_number,
                    whatsapp_message: settings.whatsapp_message,
                    hero_image_url: settings.hero_image_url,
                    show_name_field: settings.show_name_field,
                    show_phone_field: settings.show_phone_field,
                })
                .eq('id', settings.id);
            if (error) throw error;
            showToast('Configurações salvas com sucesso!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar configurações.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="text-center py-10 text-text-secondary">
                Nenhuma configuração encontrada.
            </div>
        );
    }

    return (
        <section className="bg-surface-dark border border-border-dark rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Configurações da Landing Page</h2>

            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary">Número do WhatsApp</label>
                        <input
                            className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors"
                            value={settings.whatsapp_number || ''}
                            onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                            placeholder="5511999999999"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary">URL da Imagem Principal (Hero)</label>
                        <input
                            className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors"
                            value={settings.hero_image_url || ''}
                            onChange={(e) => setSettings({ ...settings, hero_image_url: e.target.value })}
                            placeholder="https://exemplo.com/imagem.png"
                        />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-sm font-medium text-text-secondary">Mensagem padrão do WhatsApp</label>
                        <input
                            className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors"
                            value={settings.whatsapp_message || ''}
                            onChange={(e) => setSettings({ ...settings, whatsapp_message: e.target.value })}
                        />
                        <span className="text-xs text-text-secondary">{(settings.whatsapp_message || '').length} caracteres</span>
                    </div>
                </div>

                {/* Hero Image Preview */}
                {settings.hero_image_url && (
                    <div className="border border-border-dark rounded-xl p-4 bg-background-dark">
                        <div className="flex items-center gap-2 mb-3">
                            <Image className="w-4 h-4 text-text-secondary" />
                            <span className="text-sm font-medium text-text-secondary">Preview da Imagem</span>
                        </div>
                        <img
                            src={settings.hero_image_url}
                            alt="Hero preview"
                            className="max-h-48 rounded-lg object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    </div>
                )}

                <div className="border-t border-border-dark pt-6">
                    <h3 className="text-lg font-bold text-white mb-4">Campos do Pop-up de Assinatura</h3>
                    <div className="flex flex-wrap items-center gap-6">
                        <label className="flex items-center gap-2 text-white cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded accent-primary border-border-dark bg-background-dark"
                                checked={settings.show_name_field}
                                onChange={(e) => setSettings({ ...settings, show_name_field: e.target.checked })}
                            />
                            Pedir Nome
                        </label>
                        <label className="flex items-center gap-2 text-white cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded accent-primary border-border-dark bg-background-dark"
                                checked={true}
                                disabled
                            />
                            <span className="opacity-50">Pedir Email (Obrigatório)</span>
                        </label>
                        <label className="flex items-center gap-2 text-white cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded accent-primary border-border-dark bg-background-dark"
                                checked={settings.show_phone_field}
                                onChange={(e) => setSettings({ ...settings, show_phone_field: e.target.checked })}
                            />
                            Pedir Telefone
                        </label>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-primary text-background-dark font-bold px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-opacity-90 disabled:opacity-50 transition-all"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Salvar Configurações
                    </button>
                </div>
            </div>
        </section>
    );
}
