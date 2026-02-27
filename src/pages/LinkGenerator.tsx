import React, { useState } from 'react';
import { Copy, Plus, X, Link as LinkIcon, ExternalLink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function LinkGenerator() {
    const [originUrl, setOriginUrl] = useState('');
    const [subIds, setSubIds] = useState<string[]>(['']); // Inicialmente 1 campo vazio de Sub-ID
    const [isLoading, setIsLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleAddSubId = () => {
        if (subIds.length < 5) {
            setSubIds([...subIds, '']);
        }
    };

    const handleRemoveSubId = (index: number) => {
        const newSubIds = subIds.filter((_, i) => i !== index);
        setSubIds(newSubIds);
    };

    const handleSubIdChange = (index: number, value: string) => {
        const newSubIds = [...subIds];
        newSubIds[index] = value;
        setSubIds(newSubIds);
    };

    const validateOriginUrl = (url: string) => {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname.includes('shopee');
        } catch {
            return false;
        }
    };

    const handleGenerateLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setGeneratedLink('');
        setCopied(false);

        if (!originUrl.trim()) {
            setError('Por favor, informe um URL original da Shopee.');
            return;
        }

        if (!validateOriginUrl(originUrl)) {
            setError('O link original não parece ser de um produto válido da Shopee.');
            return;
        }

        // Filtra sub-IDs vazios
        const activeSubIds = subIds.map(id => id.trim()).filter(id => id !== '');

        setIsLoading(true);

        try {
            // Fetch user's Shopee credentials from encrypted storage
            let shopeeAppId: string | null = null;
            let shopeeSecret: string | null = null;

            try {
                const { data: creds, error: credsError } = await supabase.rpc('get_shopee_credentials');
                if (credsError) throw credsError;
                if (creds && creds.length > 0) {
                    shopeeAppId = creds[0].shopee_app_id;
                    shopeeSecret = creds[0].shopee_secret;
                }
            } catch (err) {
                console.error('Error fetching Shopee credentials:', err);
            }

            if (!shopeeAppId || !shopeeSecret) {
                setError('Credenciais da Shopee não configuradas. Vá em Configurações → Shopee API para adicionar.');
                setIsLoading(false);
                return;
            }

            const response = await fetch('/api/generate-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    originUrl,
                    subIds: activeSubIds,
                    shopeeAppId,
                    shopeeSecret
                })
            });

            if (!response.ok) {
                let errorMsg = `Erro do servidor (${response.status})`;
                try {
                    const data = await response.json();
                    if (data.error) errorMsg = data.error;
                } catch {
                    // Response body is not JSON (e.g. 404 HTML page)
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            setGeneratedLink(data.shortLink);

        } catch (err: any) {
            setError(err.message || 'Erro inesperado ao gerar link.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Gerador de Links
                </h1>
                <p className="text-text-secondary mt-2">
                    Crie links curtos de afiliado da Shopee e adicione Sub-IDs dinâmicos para rastrear e escalar suas comissões.
                </p>
            </div>

            {/* Main Form Box */}
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                {/* Decorative Pattern Background */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-orange-400 to-amber-300 opacity-50"></div>

                <form onSubmit={handleGenerateLink} className="flex flex-col gap-6 z-10 relative">

                    {/* Link Original Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-neutral-300 pl-1 flex items-center justify-between">
                            <span>Link do Produto (Shopee)</span>
                        </label>
                        <div className="relative flex items-center">
                            <LinkIcon className="absolute left-4 w-5 h-5 text-neutral-500" />
                            <input
                                type="url"
                                required
                                value={originUrl}
                                onChange={(e) => setOriginUrl(e.target.value)}
                                placeholder="https://shopee.com.br/product/..."
                                className="w-full h-14 bg-background-dark border border-border-dark rounded-xl pl-12 pr-4 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-border-dark w-full my-2"></div>

                    {/* Sub-IDs Configurator */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between pl-1">
                            <label className="text-sm font-semibold text-neutral-300">
                                Sub IDs <span className="text-xs text-neutral-500 ml-2 font-normal">(Opcional • Rastreamento)</span>
                            </label>
                            {subIds.length < 5 && (
                                <button
                                    type="button"
                                    onClick={handleAddSubId}
                                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors bg-primary/10 px-2 py-1 rounded shadow"
                                >
                                    <Plus className="w-3 h-3" /> Add Sub-ID
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {subIds.map((subId, index) => (
                                <div key={index} className="relative flex items-center group">
                                    <div className="absolute left-3 w-5 h-5 bg-surface-highlight text-neutral-400 text-xs font-bold rounded-full flex items-center justify-center pointer-events-none">
                                        {index + 1}
                                    </div>
                                    <input
                                        type="text"
                                        value={subId}
                                        onChange={(e) => handleSubIdChange(index, e.target.value)}
                                        placeholder={`Ex: campanhav${index + 1}`}
                                        className="w-full h-11 bg-background-dark border border-border-dark rounded-lg pl-10 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                                    />
                                    {subIds.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSubId(index)}
                                            className="absolute right-2 p-1.5 text-neutral-500 hover:text-red-400 hover:bg-surface-highlight rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                            title="Remover Sub-ID"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-neutral-500 pl-1 mt-1">Você pode adicionar até 5 parâmetros extras para análise de tráfego.</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex gap-3 shadow-lg">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div className="flex flex-col">
                                <span className="font-semibold text-sm">Falha ao Gerar:</span>
                                <span className="text-sm opacity-90">{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Action Button */}
                    <div className="mt-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full h-14 flex items-center justify-center gap-2 font-bold text-background-dark rounded-xl transition-all shadow-lg shadow-primary/20 ${isLoading ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 hover:scale-[1.01]'}`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Gerando Link Curto...
                                </>
                            ) : (
                                <>
                                    Gerar Link Curto
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Generated Link Result Area */}
            {generatedLink && (
                <div className="bg-gradient-to-br from-surface-dark to-surface-highlight border border-primary/30 rounded-2xl p-6 sm:p-8 shadow-2xl animate-fade-in relative overflow-hidden">
                    {/* Decorative glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[100px] rounded-full pointer-events-none"></div>

                    <div className="flex flex-col gap-4 relative z-10 w-full min-w-0">
                        <div className="flex items-center gap-2 text-primary font-bold">
                            <CheckCircle2 className="w-5 h-5" />
                            <span>Sucesso! Link Pronto para Compartilhar</span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-full">
                            <div className="relative flex-1 min-w-0">
                                <input
                                    readOnly
                                    value={generatedLink}
                                    className="w-full h-14 bg-background-dark border border-primary/30 rounded-xl px-4 text-white font-mono text-sm sm:text-base focus:outline-none shadow-inner"
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                                    <a
                                        href={generatedLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-neutral-400 hover:text-white hover:bg-surface-highlight rounded-lg transition-colors shadow-sm"
                                        title="Abrir no navegador"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>

                            <button
                                onClick={handleCopy}
                                className={`h-14 px-6 flex items-center justify-center gap-2 font-bold rounded-xl transition-all min-w-[140px] shadow-lg ${copied
                                        ? 'bg-green-500 text-white shadow-green-500/20'
                                        : 'bg-white text-background-dark hover:bg-neutral-200 shadow-white/10 hover:scale-[1.02]'
                                    }`}
                            >
                                {copied ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-5 h-5" />
                                        Copiar
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
