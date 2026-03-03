import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { X, Search, Loader2, ChevronRight, Check, Link2, Trash2, Eye, Image as ImageIcon } from 'lucide-react';

const extractFbAdLink = (creative: any): string | null => {
    if (!creative) return null;
    let link = creative.call_to_action?.value?.link;
    if (link) return link;
    link = creative.object_story_spec?.link_data?.link;
    if (link) return link;
    link = creative.object_story_spec?.video_data?.call_to_action?.value?.link;
    if (link) return link;
    link = creative.object_story_spec?.template_data?.call_to_action?.value?.link;
    if (link) return link;
    link = creative.asset_feed_spec?.link_urls?.[0]?.website_url;
    if (link) return link;
    return null;
};

interface FbAdsSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    trackId: string;
    trackName: string;
    onSyncComplete: () => void;
}

interface FbCampaign { id: string; name: string; status: string; }
interface FbAdSet { id: string; name: string; status: string; campaign_id: string; }
interface FbAd { id: string; name: string; status: string; adset_id: string; creative?: { object_story_spec?: { link_data?: { link?: string } } } }
interface LinkedAd {
    id: string;
    track_id: string;
    campaign_id: string;
    campaign_name: string;
    adset_id: string;
    adset_name: string;
    ad_id: string;
    ad_name: string;
    ad_link: string;
}

export function FacebookAdsSyncModal({ isOpen, onClose, trackId, trackName, onSyncComplete }: FbAdsSyncModalProps) {
    const { user } = useAuth();

    const [fbToken, setFbToken] = useState('');
    const [adAccounts, setAdAccounts] = useState<{ id: string; name: string }[]>([]);
    const [selectedAccount, setSelectedAccount] = useState('');

    const [campaigns, setCampaigns] = useState<FbCampaign[]>([]);
    const [adSets, setAdSets] = useState<FbAdSet[]>([]);
    const [ads, setAds] = useState<FbAd[]>([]);

    const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
    const [selectedAdSets, setSelectedAdSets] = useState<Set<string>>(new Set());
    const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());

    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);
    const [loadingAdSets, setLoadingAdSets] = useState(false);
    const [loadingAds, setLoadingAds] = useState(false);
    const [saving, setSaving] = useState(false);

    const [linkedAds, setLinkedAds] = useState<LinkedAd[]>([]);



    const [searchCampaign, setSearchCampaign] = useState('');
    const [searchAdSet, setSearchAdSet] = useState('');
    const [searchAd, setSearchAd] = useState('');
    const [error, setError] = useState('');

    const [previewAdId, setPreviewAdId] = useState<string | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const [mobileStep, setMobileStep] = useState<'campaigns' | 'adsets' | 'ads' | 'preview'>('campaigns');

    useEffect(() => {
        if (previewAdId) {
            fetchPreview(previewAdId);
        } else {
            setPreviewHtml(null);
            setPreviewError(null);
        }
    }, [previewAdId]);

    useEffect(() => {
        if (isOpen && user) {
            fetchToken();
            fetchLinkedAds();
            // Reset selections
            setSelectedCampaigns(new Set());
            setSelectedAdSets(new Set());
            setSelectedAds(new Set());
            setCampaigns([]);
            setAdSets([]);
            setAds([]);
            setAdAccounts([]);
            setSelectedAccount('');
            setError('');
            setPreviewAdId(null);
            setPreviewHtml(null);
            setMobileStep('campaigns');
        }
    }, [isOpen, user]);

    const fetchToken = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('users')
            .select('facebook_api_key')
            .eq('id', user.id)
            .single();
        if (data?.facebook_api_key) {
            setFbToken(data.facebook_api_key);
            fetchAdAccounts(data.facebook_api_key);
        } else {
            setError('Nenhum token do Facebook configurado. Vá em Configurações → Facebook API para adicionar.');
        }
    };

    const fetchLinkedAds = async () => {
        const { data } = await supabase
            .from('creative_track_fb_ads')
            .select('*')
            .eq('track_id', trackId);
        setLinkedAds(data || []);
    };

    const fetchAdAccounts = async (token: string) => {
        setLoadingAccounts(true);
        try {
            const res = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${encodeURIComponent(token)}&fields=name,account_status&limit=50`);
            const json = await res.json();
            if (json.error) throw new Error(json.error.message);
            const accounts = (json.data || [])
                .filter((a: any) => a.account_status === 1)
                .map((a: any) => ({ id: a.id, name: a.name || a.id }));
            setAdAccounts(accounts);
            if (accounts.length === 1) {
                setSelectedAccount(accounts[0].id);
                fetchCampaigns(token, accounts[0].id);
            }
        } catch (err: any) {
            setError(`Erro ao carregar contas: ${err.message}`);
        } finally {
            setLoadingAccounts(false);
        }
    };

    const fetchCampaigns = async (token: string, accountId: string) => {
        setLoadingCampaigns(true);
        setCampaigns([]);
        setAdSets([]);
        setAds([]);
        setSelectedCampaigns(new Set());
        setSelectedAdSets(new Set());
        setSelectedAds(new Set());
        try {
            const res = await fetch(`https://graph.facebook.com/v21.0/${accountId}/campaigns?access_token=${encodeURIComponent(token)}&fields=name,status&limit=100`);
            const json = await res.json();
            if (json.error) throw new Error(json.error.message);
            setCampaigns((json.data || []).map((c: any) => ({ id: c.id, name: c.name, status: c.status })));
        } catch (err: any) {
            setError(`Erro ao carregar campanhas: ${err.message}`);
        } finally {
            setLoadingCampaigns(false);
        }
    };

    const fetchAdSetsForCampaigns = async (campaignIds: Set<string>) => {
        setLoadingAdSets(true);
        setAdSets([]);
        setAds([]);
        setSelectedAdSets(new Set());
        setSelectedAds(new Set());
        try {
            const allAdSets: FbAdSet[] = [];
            for (const cId of campaignIds) {
                const res = await fetch(`https://graph.facebook.com/v21.0/${cId}/adsets?access_token=${encodeURIComponent(fbToken)}&fields=name,status&limit=100`);
                const json = await res.json();
                if (json.data) {
                    allAdSets.push(...json.data.map((a: any) => ({ id: a.id, name: a.name, status: a.status, campaign_id: cId })));
                }
            }
            setAdSets(allAdSets);
        } catch (err: any) {
            setError(`Erro ao carregar conjuntos: ${err.message}`);
        } finally {
            setLoadingAdSets(false);
        }
    };

    const fetchAdsForAdSets = async (adsetIds: Set<string>) => {
        setLoadingAds(true);
        setAds([]);
        setSelectedAds(new Set());
        try {
            const allAds: FbAd[] = [];
            for (const asId of adsetIds) {
                const res = await fetch(`https://graph.facebook.com/v21.0/${asId}/ads?access_token=${encodeURIComponent(fbToken)}&fields=name,status,creative{object_story_spec,asset_feed_spec,call_to_action}&limit=100`);
                const json = await res.json();
                if (json.data) {
                    allAds.push(...json.data.map((a: any) => ({ id: a.id, name: a.name, status: a.status, adset_id: asId, creative: a.creative })));
                }
            }
            setAds(allAds);
        } catch (err: any) {
            setError(`Erro ao carregar anúncios: ${err.message}`);
        } finally {
            setLoadingAds(false);
        }
    };

    const fetchPreview = async (adId: string) => {
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewHtml(null);
        try {
            const url = `https://graph.facebook.com/v21.0/${adId}/previews?ad_format=DESKTOP_FEED_STANDARD&access_token=${fbToken}`;
            const res = await fetch(url);
            const json = await res.json();

            if (json.error) throw new Error(json.error.message);
            if (json.data && json.data.length > 0) {
                setPreviewHtml(json.data[0].body);
            } else {
                setPreviewError('Nenhum preview disponível');
            }
        } catch (err: any) {
            setPreviewError(`Erro ao carregar preview: ${err.message}`);
        } finally {
            setPreviewLoading(false);
        }
    };

    const toggleCampaign = (id: string) => {
        const next = new Set(selectedCampaigns);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedCampaigns(next);
        if (next.size > 0) {
            fetchAdSetsForCampaigns(next);
            setMobileStep('adsets');
        } else { setAdSets([]); setAds([]); setSelectedAdSets(new Set()); setSelectedAds(new Set()); }
    };

    const toggleAdSet = (id: string) => {
        const next = new Set(selectedAdSets);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedAdSets(next);
        if (next.size > 0) {
            fetchAdsForAdSets(next);
            setMobileStep('ads');
        } else { setAds([]); setSelectedAds(new Set()); }
    };

    const toggleAd = (id: string) => {
        const next = new Set(selectedAds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedAds(next);
    };

    const handleLink = async () => {
        if (selectedAds.size === 0) return;
        setSaving(true);
        setError('');
        try {
            const rows = Array.from(selectedAds).map(adId => {
                const ad = ads.find(a => a.id === adId);
                const adset = adSets.find(as => as.id === ad?.adset_id);
                const campaign = campaigns.find(c => c.id === adset?.campaign_id);
                return {
                    track_id: trackId,
                    campaign_id: campaign?.id || '',
                    campaign_name: campaign?.name || '',
                    adset_id: adset?.id || '',
                    adset_name: adset?.name || '',
                    ad_id: adId,
                    ad_name: ad?.name || '',
                    ad_link: extractFbAdLink(ad?.creative) || '',
                };
            });

            const { error: insertError } = await supabase
                .from('creative_track_fb_ads')
                .upsert(rows, { onConflict: 'track_id,ad_id' });

            if (insertError) throw insertError;

            await fetchLinkedAds();
            setSelectedAds(new Set());
            onSyncComplete();
        } catch (err: any) {
            setError(`Erro ao vincular: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleUnlink = async (linkedAd: LinkedAd) => {
        try {
            await supabase.from('creative_track_fb_ads').delete().eq('id', linkedAd.id);
            await supabase.from('creative_track_fb_metrics').delete().eq('track_id', trackId).eq('ad_id', linkedAd.ad_id);
            setLinkedAds(prev => prev.filter(a => a.id !== linkedAd.id));
            onSyncComplete();
        } catch (err: any) {
            setError(`Erro ao desvincular: ${err.message}`);
        }
    };

    if (!isOpen) return null;

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/20',
            PAUSED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        };
        return colors[status] || 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
    };

    const filteredCampaigns = campaigns.filter(c => c.name.toLowerCase().includes(searchCampaign.toLowerCase()));
    const filteredAdSets = adSets.filter(a => a.name.toLowerCase().includes(searchAdSet.toLowerCase()));
    const filteredAds = ads.filter(a => a.name.toLowerCase().includes(searchAd.toLowerCase()));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm">
            <div className="bg-surface-dark border border-border-dark rounded-2xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border-dark shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Link2 className="w-5 h-5 text-blue-400" />
                            Vincular Anúncios Facebook
                        </h2>
                        <p className="text-text-secondary text-xs mt-0.5">Track: <span className="text-primary font-semibold">{trackName}</span></p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-w-0">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
                    )}

                    {/* Already linked ads */}
                    {linkedAds.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-white">Anúncios Vinculados ({linkedAds.length})</h3>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {linkedAds.map(la => (
                                    <div key={la.id} className="flex items-center justify-between gap-2 bg-background-dark rounded-lg px-3 py-2 border border-border-dark">
                                        <div className="min-w-0">
                                            <p className="text-xs text-white truncate">{la.ad_name || la.ad_id}</p>
                                            <p className="text-[10px] text-text-secondary truncate">{la.campaign_name} → {la.adset_name}</p>
                                        </div>
                                        <button onClick={() => handleUnlink(la)} className="text-red-400/50 hover:text-red-400 transition-colors shrink-0 p-1">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Account selector */}
                    {adAccounts.length > 1 && (
                        <div>
                            <label className="text-xs font-medium text-text-secondary mb-1 block">Conta de Anúncio</label>
                            <select
                                value={selectedAccount}
                                onChange={(e) => {
                                    setSelectedAccount(e.target.value);
                                    if (e.target.value) fetchCampaigns(fbToken, e.target.value);
                                }}
                                className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                            >
                                <option value="">Selecione uma conta...</option>
                                {adAccounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {loadingAccounts && (
                        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    )}

                    {/* Step Tabs for Mobile */}
                    <div className="md:hidden flex items-center bg-background-dark rounded-xl p-1 border border-border-dark mb-2">
                        {(['campaigns', 'adsets', 'ads', 'preview'] as const).map((step) => (
                            <button
                                key={step}
                                onClick={() => setMobileStep(step)}
                                disabled={(step === 'adsets' && selectedCampaigns.size === 0) || (step === 'ads' && selectedAdSets.size === 0) || (step === 'preview' && !previewAdId)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 ${mobileStep === step ? 'bg-primary text-background-dark shadow-sm' : 'text-text-secondary'}`}
                            >
                                {step === 'campaigns' ? 'Camp' : step === 'adsets' ? 'Conj' : step === 'ads' ? 'Anún' : 'Prev'}
                            </button>
                        ))}
                    </div>

                    {/* 4-column cascading selector */}
                    {(campaigns.length > 0 || loadingCampaigns) && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {/* Campaigns */}
                            <div className={`bg-background-dark rounded-xl border border-border-dark overflow-hidden flex flex-col h-[512px] max-h-[512px] ${mobileStep !== 'campaigns' ? 'hidden md:flex' : 'flex'}`}>
                                <div className="p-2 border-b border-border-dark shrink-0">
                                    <div className="flex items-center gap-2 bg-surface-dark rounded-lg px-2 py-1.5 border border-border-dark">
                                        <Search className="w-3.5 h-3.5 text-neutral-500" />
                                        <input
                                            type="text"
                                            value={searchCampaign}
                                            onChange={e => setSearchCampaign(e.target.value)}
                                            className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-neutral-600 min-w-0"
                                            placeholder="Buscar campanha..."
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-1">
                                    {loadingCampaigns ? (
                                        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                                    ) : filteredCampaigns.length === 0 ? (
                                        <p className="text-xs text-neutral-500 p-2 text-center">Nenhuma campanha</p>
                                    ) : filteredCampaigns.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => toggleCampaign(c.id)}
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${selectedCampaigns.has(c.id) ? 'bg-blue-500/10 text-blue-400' : 'text-neutral-300 hover:bg-surface-highlight'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedCampaigns.has(c.id) ? 'bg-blue-500 border-blue-500' : 'border-neutral-600'
                                                }`}>
                                                {selectedCampaigns.has(c.id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="truncate min-w-0">{c.name}</span>
                                            <span className={`ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded border ${statusBadge(c.status)}`}>{c.status}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Ad Sets */}
                            <div className={`bg-background-dark rounded-xl border border-border-dark overflow-hidden flex flex-col h-[512px] max-h-[512px] ${mobileStep !== 'adsets' ? 'hidden md:flex' : 'flex'}`}>
                                <div className="p-2 border-b border-border-dark shrink-0">
                                    <div className="flex items-center gap-2 bg-surface-dark rounded-lg px-2 py-1.5 border border-border-dark">
                                        <Search className="w-3.5 h-3.5 text-neutral-500" />
                                        <input
                                            type="text"
                                            value={searchAdSet}
                                            onChange={e => setSearchAdSet(e.target.value)}
                                            className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-neutral-600 min-w-0"
                                            placeholder="Buscar conjunto..."
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-1">
                                    {loadingAdSets ? (
                                        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                                    ) : selectedCampaigns.size === 0 ? (
                                        <p className="text-xs text-neutral-500 p-2 text-center flex items-center gap-1 justify-center"><ChevronRight className="w-3 h-3" /> Selecione campanhas</p>
                                    ) : filteredAdSets.length === 0 ? (
                                        <p className="text-xs text-neutral-500 p-2 text-center">Nenhum conjunto</p>
                                    ) : filteredAdSets.map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => toggleAdSet(a.id)}
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${selectedAdSets.has(a.id) ? 'bg-blue-500/10 text-blue-400' : 'text-neutral-300 hover:bg-surface-highlight'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedAdSets.has(a.id) ? 'bg-blue-500 border-blue-500' : 'border-neutral-600'
                                                }`}>
                                                {selectedAdSets.has(a.id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="truncate min-w-0">{a.name}</span>
                                            <span className={`ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded border ${statusBadge(a.status)}`}>{a.status}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Ads */}
                            <div className={`bg-background-dark rounded-xl border border-border-dark overflow-hidden flex flex-col h-[512px] max-h-[512px] ${mobileStep !== 'ads' ? 'hidden md:flex' : 'flex'}`}>
                                <div className="p-2 border-b border-border-dark shrink-0">
                                    <div className="flex items-center gap-2 bg-surface-dark rounded-lg px-2 py-1.5 border border-border-dark">
                                        <Search className="w-3.5 h-3.5 text-neutral-500" />
                                        <input
                                            type="text"
                                            value={searchAd}
                                            onChange={e => setSearchAd(e.target.value)}
                                            className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-neutral-600 min-w-0"
                                            placeholder="Buscar anúncio..."
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-1">
                                    {loadingAds ? (
                                        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                                    ) : selectedAdSets.size === 0 ? (
                                        <p className="text-xs text-neutral-500 p-2 text-center flex items-center gap-1 justify-center"><ChevronRight className="w-3 h-3" /> Selecione conjuntos</p>
                                    ) : filteredAds.length === 0 ? (
                                        <p className="text-xs text-neutral-500 p-2 text-center">Nenhum anúncio</p>
                                    ) : filteredAds.map(a => (
                                        <div
                                            key={a.id}
                                            className={`w-full group/ad text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors ${selectedAds.has(a.id) ? 'bg-green-500/10 text-green-400' : 'text-neutral-300 hover:bg-surface-highlight'
                                                } ${previewAdId === a.id ? 'ring-1 ring-primary/50 bg-primary/5' : ''}`}
                                        >
                                            <button
                                                onClick={() => toggleAd(a.id)}
                                                className="flex-1 flex items-center gap-2 min-w-0"
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedAds.has(a.id) ? 'bg-green-500 border-green-500' : 'border-neutral-600'
                                                    }`}>
                                                    {selectedAds.has(a.id) && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className="truncate min-w-0">{a.name}</span>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setPreviewAdId(a.id);
                                                    setMobileStep('preview');
                                                }}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${previewAdId === a.id ? 'text-primary' : 'text-neutral-500 hover:text-white'}`}
                                                title="Ver Preview"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border ${statusBadge(a.status)}`}>{a.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Preview Column */}
                            <div className={`bg-background-dark/30 rounded-xl border border-border-dark overflow-hidden flex flex-col h-[512px] max-h-[512px] shadow-inner backdrop-blur-[2px] ${mobileStep !== 'preview' ? 'hidden md:flex' : 'flex'}`}>
                                <div className="p-2 border-b border-border-dark shrink-0 flex items-center justify-between bg-surface-dark/40">
                                    <h3 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 leading-none">
                                        <ImageIcon className="w-3 h-3 text-primary" />
                                        Preview do Anúncio
                                    </h3>
                                    {previewAdId && (
                                        <span className="text-[8px] text-neutral-500 font-mono truncate max-w-[80px]">ID: {previewAdId}</span>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar flex flex-col scroll-smooth">
                                    {!previewAdId ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-4">
                                            <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-3">
                                                <Eye className="w-6 h-6 text-neutral-500" />
                                            </div>
                                            <p className="text-[10px] text-neutral-400 max-w-[120px]">Selecione o <Eye className="w-3 h-3 inline pb-0.5 mx-0.5" /> no anúncio para ver</p>
                                        </div>
                                    ) : previewLoading ? (
                                        <div className="h-full flex flex-col items-center justify-center py-4 gap-3">
                                            <div className="relative">
                                                <div className="absolute inset-0 blur-sm bg-primary/20 animate-pulse rounded-full" />
                                                <Loader2 className="w-6 h-6 animate-spin text-primary relative z-10" />
                                            </div>
                                            <span className="text-[10px] text-neutral-400 font-medium tracking-wide">Buscando preview...</span>
                                        </div>
                                    ) : previewError ? (
                                        <div className="h-full flex items-center justify-center p-4 text-center">
                                            <p className="text-[10px] text-red-400 leading-tight bg-red-500/5 p-3 rounded-lg border border-red-500/10">{previewError}</p>
                                        </div>
                                    ) : previewHtml ? (
                                        <div className="w-full flex justify-center scale-[0.85] origin-top transform transition-all duration-300">
                                            <div
                                                className="w-full bg-white rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/5"
                                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
                                            />

                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-neutral-500 text-[10px] italic">
                                            Conteúdo não disponível
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-border-dark shrink-0">
                    <p className="text-xs text-neutral-500">
                        {selectedAds.size > 0 ? `${selectedAds.size} anúncio(s) selecionado(s)` : 'Selecione anúncios para vincular'}
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm">
                            Fechar
                        </button>
                        <button
                            onClick={handleLink}
                            disabled={saving || selectedAds.size === 0}
                            className="flex items-center gap-2 bg-primary text-background-dark px-5 py-2 rounded-lg font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                            Vincular ({selectedAds.size})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
