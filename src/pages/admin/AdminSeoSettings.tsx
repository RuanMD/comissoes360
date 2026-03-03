import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/ToastContext';
import { Loader2, Save, Image as ImageIcon, UploadCloud } from 'lucide-react';

interface SeoSettings {
    id: number;
    title: string;
    description: string;
    favicon_url: string;
    banner_url: string;
}

export function AdminSeoSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<'favicon' | 'banner' | null>(null);
    const [settings, setSettings] = useState<SeoSettings>({
        id: 1,
        title: 'Comissões Lab',
        description: 'Maximize seus lucros com análises inteligentes.',
        favicon_url: '/favicon.png',
        banner_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop',
    });

    const { showToast } = useToast();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('site_settings')
                .select('*')
                .eq('id', 1)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) setSettings(data);
        } catch (error) {
            console.error('Erro ao puxar configurações SEO:', error);
            showToast('Erro ao carregar configurações de SEO.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('site_settings')
                .update({
                    title: settings.title,
                    description: settings.description,
                    favicon_url: settings.favicon_url,
                    banner_url: settings.banner_url,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (error) throw error;
            showToast('Configurações SEO salvas com sucesso!');
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Erro ao salvar configurações SEO.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'favicon' | 'banner') => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(type);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${type}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('platform_assets')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('platform_assets')
                .getPublicUrl(fileName);

            if (type === 'favicon') {
                setSettings({ ...settings, favicon_url: data.publicUrl });
            } else {
                setSettings({ ...settings, banner_url: data.publicUrl });
            }

            showToast('Arquivo enviado com sucesso. Lembre de salvar as configurações na página!');
        } catch (error: any) {
            console.error('Upload error', error);
            showToast(error.message || 'Erro ao enviar o arquivo.', 'error');
        } finally {
            setUploading(null);
            event.target.value = '';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <section className="bg-surface-dark border border-border-dark rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-2">Link Preview & SEO</h2>
            <p className="text-sm text-text-secondary mb-8"> Configure como o seu site aparece quando o link for compartilhado no WhatsApp, Facebook, LinkedIn ou Telegram. </p>

            <div className="flex flex-col gap-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Textos */}
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-text-secondary">Título do Site (Title)</label>
                            <input
                                className="w-full bg-background-dark border border-border-dark rounded-xl p-3 text-sm text-white outline-none focus:border-primary transition-colors"
                                value={settings.title}
                                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                                placeholder="Ex: Comissões Lab"
                            />
                            <span className="text-xs text-text-secondary">Aparece na aba do navegador e no título em negrito da mensagem.</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-text-secondary">Descrição Curta</label>
                            <textarea
                                className="w-full bg-background-dark border border-border-dark rounded-xl p-3 text-sm text-white outline-none focus:border-primary transition-colors resize-none h-28"
                                value={settings.description}
                                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                                placeholder="Plataforma avançada para gestão de vendas de afiliados..."
                            />
                            <span className="text-xs text-text-secondary">Subtítulo que aparece logo abaixo na mensagem. Idealmente com até 150 caracteres.</span>
                        </div>
                    </div>

                    {/* Imagens */}
                    <div className="flex flex-col gap-6">
                        {/* Favicon */}
                        <div className="bg-background-dark border border-border-dark rounded-xl p-5 flex gap-4 items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-surface-dark border border-border-dark p-2 flex items-center justify-center shrink-0">
                                    {settings.favicon_url !== '/vite.svg'
                                        ? <img src={settings.favicon_url} alt="favicon" className="max-w-full max-h-full object-contain" />
                                        : <ImageIcon className="w-6 h-6 text-text-secondary" />
                                    }
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white mb-1">Ícone Local (Favicon / App Icon)</p>
                                    <p className="text-xs text-text-secondary">Ícone do navegador e atalho celular (PWA). Formato PNG 1:1.</p>
                                    <p className="text-[10px] text-amber-500 mt-1 leading-tight">Dica: Use uma imagem quadrada de pelo menos 48x48px (ideal 512x512px) para que o Google exiba seu ícone nos resultados.</p>
                                </div>
                            </div>

                            <label className="cursor-pointer">
                                <input type="file" accept="image/png, image/svg+xml, image/jpeg, image/x-icon" className="hidden" onChange={(e) => handleFileUpload(e, 'favicon')} />
                                <div className="px-4 py-2 bg-surface-dark border border-border-dark rounded-lg text-sm font-medium text-white hover:bg-surface-highlight flex items-center gap-2 transition-colors">
                                    {uploading === 'favicon' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Trocar</span>
                                </div>
                            </label>
                        </div>

                        {/* Banner */}
                        <div className="bg-background-dark border border-border-dark rounded-xl overflow-hidden flex flex-col relative group">
                            <div className="h-40 bg-surface-dark border-b border-border-dark relative flex items-center justify-center overflow-hidden">
                                {settings.banner_url ? (
                                    <img src={settings.banner_url} alt="banner" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                ) : (
                                    <ImageIcon className="w-10 h-10 text-text-secondary" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-background-dark/80 to-transparent"></div>
                            </div>
                            <div className="p-5 flex items-center justify-between absolute bottom-0 left-0 right-0">
                                <div>
                                    <p className="text-sm font-medium text-white mb-1">Banner Principal (WhatsApp/Net)</p>
                                    <p className="text-xs text-text-secondary">Recomendado 1200x630px.</p>
                                </div>
                                <label className="cursor-pointer shadow-lg">
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'banner')} />
                                    <div className="px-4 py-2 border border-border-dark bg-background-dark/90 backdrop-blur rounded-lg text-sm text-white font-medium hover:bg-surface-highlight flex items-center gap-2 transition-colors">
                                        {uploading === 'banner' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                        <span className="hidden sm:inline">Atualizar</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border-dark pt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving || uploading !== null}
                        className="bg-primary text-background-dark font-bold px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-opacity-90 disabled:opacity-50 transition-all"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </section>
    );
}
