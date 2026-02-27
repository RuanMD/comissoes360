import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import {
    Loader2, Plus, Trash2, Pencil, Save, X,
    DollarSign, ShoppingCart, TrendingUp, MousePointerClick,
    BarChart3, Target, PiggyBank, Percent, ExternalLink,
    Link2, RefreshCw, Calendar, Filter, Eye, EyeOff,
    Link as LinkIcon, AlertCircle, CheckCircle2, Copy,
    PlayCircle, StopCircle, PackageSearch, Truck, Star, Tag
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { FacebookAdsSyncModal } from '../components/FacebookAdsSyncModal';
import { formatBRL, formatPct } from '../utils/format';
import { AdPreviewModal } from '../components/AdPreviewModal';

interface Track {
    id: string;
    user_id: string;
    name: string;
    affiliate_link: string;
    sub_id: string;
    created_at: string;
    funnel_id: string | null;
    status: 'ativo' | 'desativado' | 'validado';
    product_price?: number | null;
    product_shipping?: number | null;
    product_free_shipping?: boolean | null;
    product_reviews?: number | null;
    product_sold?: number | null;
    product_rating?: number | null;
}

interface TrackEntry {
    id: string;
    track_id: string;
    date: string;
    ad_clicks: number;
    shopee_clicks: number;
    cpc: number;
    orders: number;
    commission_value: number;
    investment: number;
}

interface FbLinkedAd {
    id: string;
    track_id: string;
    campaign_id: string;
    campaign_name: string;
    adset_id: string;
    adset_name: string;
    ad_id: string;
    ad_name: string;
}


interface EntryForm {
    date: string;
    ad_clicks: string;
    shopee_clicks: string;
    cpc: string;
    orders: string;
    commission_value: string;
    investment: string;
}

// ── Funnel types for evaluation ──
interface FunnelCondition {
    metric: string;
    operator: string;
    value: number;
}

interface FunnelDay {
    day: number;
    conditions: FunnelCondition[];
}

interface LinkedFunnel {
    id: string;
    name: string;
    days: FunnelDay[];
    maintenance_conditions: FunnelCondition[];
}

const emptyEntryForm: EntryForm = {
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    ad_clicks: '',
    shopee_clicks: '',
    cpc: '',
    orders: '',
    commission_value: '',
    investment: '',
};

export function CreativeTrack() {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [entries, setEntries] = useState<TrackEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);

    const [showNewForm, setShowNewForm] = useState(false);
    const [newTrackName, setNewTrackName] = useState('');
    const [newTrackLink, setNewTrackLink] = useState('');
    const [newTrackSubId, setNewTrackSubId] = useState('');

    // New Track Modal states
    const [modalOriginUrl, setModalOriginUrl] = useState('');
    const [modalSubIds, setModalSubIds] = useState<string[]>(['']);
    const [modalGeneratedLink, setModalGeneratedLink] = useState('');
    const [modalGenerating, setModalGenerating] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [modalCopied, setModalCopied] = useState(false);

    const [editingTrack, setEditingTrack] = useState(false);
    const [editName, setEditName] = useState('');
    const [editLink, setEditLink] = useState('');
    const [editSubId, setEditSubId] = useState('');

    const [entryForm, setEntryForm] = useState<EntryForm>({ ...emptyEntryForm });

    // Inline edit state
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [inlineEditForm, setInlineEditForm] = useState<EntryForm>({ ...emptyEntryForm });

    // Product Details State
    const [editingProduct, setEditingProduct] = useState(false);
    const [productForm, setProductForm] = useState({
        price: '',
        shipping: '',
        free_shipping: false,
        reviews: '',
        sold: '',
        rating: ''
    });

    // Facebook Ads sync state
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [fbLinkedAds, setFbLinkedAds] = useState<FbLinkedAd[]>([]);
    const [syncingFb, setSyncingFb] = useState(false);
    const [fbToken, setFbToken] = useState('');
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [previewAdId, setPreviewAdId] = useState<string | null>(null);

    // Funnel linking state
    const [userFunnels, setUserFunnels] = useState<LinkedFunnel[]>([]);
    const [linkedFunnel, setLinkedFunnel] = useState<LinkedFunnel | null>(null);
    const [showFunnelPicker, setShowFunnelPicker] = useState(false);
    const [hideSensitive, setHideSensitive] = useState(false);

    // ========== FETCH TRACKS ==========
    useEffect(() => {
        if (user) {
            fetchTracks();
            fetchFbToken();
            fetchUserFunnels();
        }
    }, [user]);

    const fetchTracks = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('creative_tracks')
                .select('*')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: true });
            if (error) throw error;
            setTracks(data || []);
        } catch (error) {
            console.error('Erro ao carregar tracks:', error);
            showToast('Erro ao carregar tracks.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchFbToken = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('users')
            .select('facebook_api_key')
            .eq('id', user.id)
            .single();
        if (data?.facebook_api_key) setFbToken(data.facebook_api_key);
    };

    const fetchFbLinkedAds = async (trackId: string) => {
        const { data } = await supabase
            .from('creative_track_fb_ads')
            .select('*')
            .eq('track_id', trackId);
        setFbLinkedAds(data || []);
    };

    const fetchUserFunnels = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('funnels')
            .select('id, name, days, maintenance_conditions')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        setUserFunnels(data || []);
    };

    // ========== CREATE TRACK ==========
    const handleCreateTrack = async () => {
        if (!newTrackName.trim()) {
            showToast('Nome é obrigatório.', 'error');
            return;
        }
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('creative_tracks')
                .insert({
                    user_id: user!.id,
                    name: newTrackName.trim(),
                    affiliate_link: newTrackLink.trim(),
                    sub_id: newTrackSubId.trim(),
                })
                .select()
                .single();
            if (error) throw error;
            setTracks(prev => [...prev, data]);
            resetModal();
            showToast('Track criado com sucesso!');
            handleSelectTrack(data);
        } catch (error) {
            console.error(error);
            showToast('Erro ao criar track.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== NEW TRACK MODAL HELPERS ==========
    const resetModal = () => {
        setShowNewForm(false);
        setNewTrackName('');
        setNewTrackLink('');
        setNewTrackSubId('');
        setModalOriginUrl('');
        setModalSubIds(['']);
        setModalGeneratedLink('');
        setModalError(null);
        setModalCopied(false);
    };

    const handleModalAddSubId = () => {
        if (modalSubIds.length < 5) setModalSubIds([...modalSubIds, '']);
    };

    const handleModalRemoveSubId = (index: number) => {
        setModalSubIds(modalSubIds.filter((_, i) => i !== index));
    };

    const handleModalSubIdChange = (index: number, value: string) => {
        const updated = [...modalSubIds];
        updated[index] = value;
        setModalSubIds(updated);
    };

    const handleModalGenerateLink = async () => {
        setModalError(null);
        setModalGeneratedLink('');

        if (!modalOriginUrl.trim()) {
            setModalError('Informe a URL do produto da Shopee.');
            return;
        }

        try {
            const parsed = new URL(modalOriginUrl);
            if (!parsed.hostname.includes('shopee')) {
                setModalError('O link não parece ser um produto válido da Shopee.');
                return;
            }
        } catch {
            setModalError('URL inválida.');
            return;
        }

        const activeSubIds = modalSubIds.map(id => id.trim()).filter(id => id !== '');

        // Fetch Shopee credentials
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
            setModalError('Credenciais da Shopee não configuradas. Vá em Configurações → Shopee API.');
            return;
        }

        setModalGenerating(true);
        try {
            const response = await fetch('/api/generate-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originUrl: modalOriginUrl,
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
                } catch { /* ignore */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            setModalGeneratedLink(data.shortLink);
            // Auto-fill the track form fields
            setNewTrackLink(data.shortLink);
            // Use the first sub-ID as the track Sub_ID identifier
            if (activeSubIds.length > 0) {
                setNewTrackSubId(activeSubIds.join(', '));
            }
        } catch (err: any) {
            setModalError(err.message || 'Erro ao gerar link.');
        } finally {
            setModalGenerating(false);
        }
    };

    const handleModalCopy = () => {
        if (modalGeneratedLink) {
            navigator.clipboard.writeText(modalGeneratedLink);
            setModalCopied(true);
            setTimeout(() => setModalCopied(false), 2000);
        }
    };

    // ========== DELETE TRACK ==========
    const handleDeleteTrack = async (track: Track) => {
        if (!window.confirm(`Excluir "${track.name}" e todos os seus registros? Esta ação não pode ser desfeita.`)) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('creative_tracks').delete().eq('id', track.id);
            if (error) throw error;
            const remaining = tracks.filter(t => t.id !== track.id);
            setTracks(remaining);
            if (selectedTrack?.id === track.id) {
                if (remaining.length > 0) {
                    handleSelectTrack(remaining[0]);
                } else {
                    setSelectedTrack(null);
                    setEntries([]);
                }
            }
            showToast('Track excluído!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir track.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== UPDATE TRACK ==========
    const handleUpdateTrack = async () => {
        if (!selectedTrack || !editName.trim()) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('creative_tracks')
                .update({
                    name: editName.trim(),
                    affiliate_link: editLink.trim(),
                    sub_id: editSubId.trim(),
                })
                .eq('id', selectedTrack.id);
            if (error) throw error;
            const updated = { ...selectedTrack, name: editName.trim(), affiliate_link: editLink.trim(), sub_id: editSubId.trim() };
            setSelectedTrack(updated);
            setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setEditingTrack(false);
            showToast('Track atualizado!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar track.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== UPDATE STATUS ==========
    const handleUpdateStatus = async (track: Track, newStatus: 'ativo' | 'desativado' | 'validado') => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('creative_tracks')
                .update({ status: newStatus })
                .eq('id', track.id);
            if (error) throw error;
            const updated = { ...track, status: newStatus };
            if (selectedTrack?.id === track.id) {
                setSelectedTrack(updated);
            }
            setTracks(prev => prev.map(t => t.id === track.id ? updated : t));
            showToast(`Status atualizado para ${newStatus}!`);
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar status.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== UPDATE PRODUCT ==========
    const handleUpdateProduct = async () => {
        if (!selectedTrack) return;
        setSaving(true);
        try {
            const payload = {
                product_price: productForm.price ? parseFloat(productForm.price) : null,
                product_shipping: productForm.shipping ? parseFloat(productForm.shipping) : null,
                product_free_shipping: productForm.free_shipping,
                product_reviews: productForm.reviews ? parseInt(productForm.reviews) : null,
                product_sold: productForm.sold ? parseInt(productForm.sold) : null,
                product_rating: productForm.rating ? parseFloat(productForm.rating) : null,
            };

            const { error } = await supabase
                .from('creative_tracks')
                .update(payload)
                .eq('id', selectedTrack.id);

            if (error) throw error;

            const updated = { ...selectedTrack, ...payload };
            setSelectedTrack(updated);
            setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setEditingProduct(false);
            showToast('Dados do produto atualizados!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar dados do produto.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== SELECT TRACK ==========
    const handleSelectTrack = async (track: Track) => {
        setSelectedTrack(track);
        setEditingTrack(false);
        setEntryForm({ ...emptyEntryForm });
        setShowFunnelPicker(false);
        setEditingProduct(false);
        setProductForm({
            price: track.product_price?.toString() || '',
            shipping: track.product_shipping?.toString() || '',
            free_shipping: !!track.product_free_shipping,
            reviews: track.product_reviews?.toString() || '',
            sold: track.product_sold?.toString() || '',
            rating: track.product_rating?.toString() || ''
        });
        // Load linked funnel
        if (track.funnel_id) {
            const found = userFunnels.find(f => f.id === track.funnel_id);
            setLinkedFunnel(found || null);
        } else {
            setLinkedFunnel(null);
        }
        setLoadingEntries(true);
        try {
            const { data, error } = await supabase
                .from('creative_track_entries')
                .select('*')
                .eq('track_id', track.id)
                .order('date', { ascending: false });
            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error(error);
            showToast('Erro ao carregar registros.', 'error');
        } finally {
            setLoadingEntries(false);
        }
        // Fetch FB data
        fetchFbLinkedAds(track.id);
    };

    // ========== FB SYNC ==========
    const handleSyncFb = async (mode: 'all' | 'today') => {
        if (!selectedTrack || !fbToken || fbLinkedAds.length === 0) {
            showToast('Nenhum anúncio vinculado ou token não configurado.', 'error');
            return;
        }
        setSyncingFb(true);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');

            // Collect all daily data across all ads for aggregation
            const dailyAggregate = new Map<string, { clicks: number; spend: number }>();

            for (const linkedAd of fbLinkedAds) {
                let since = today;
                let until = today;

                if (mode === 'all') {
                    // Fetch campaign start date
                    const campRes = await fetch(`https://graph.facebook.com/v21.0/${linkedAd.campaign_id}?access_token=${encodeURIComponent(fbToken)}&fields=start_time`);
                    const campData = await campRes.json();
                    if (campData.start_time) {
                        since = campData.start_time.split('T')[0];
                    } else {
                        since = format(subDays(new Date(), 30), 'yyyy-MM-dd');
                    }
                    until = today;
                }

                const insightsRes = await fetch(
                    `https://graph.facebook.com/v21.0/${linkedAd.ad_id}/insights?` +
                    `access_token=${encodeURIComponent(fbToken)}` +
                    `&fields=clicks,cpc,spend,impressions` +
                    `&time_range={"since":"${since}","until":"${until}"}` +
                    `&time_increment=1` +
                    `&limit=500`
                );
                const insightsData = await insightsRes.json();

                if (insightsData.error) {
                    console.error(`Erro ad ${linkedAd.ad_id}:`, insightsData.error.message);
                    continue;
                }

                const rows = (insightsData.data || []).map((day: any) => ({
                    track_id: selectedTrack.id,
                    ad_id: linkedAd.ad_id,
                    date: day.date_start,
                    clicks: parseInt(day.clicks) || 0,
                    cpc: parseFloat(day.cpc) || 0,
                    spend: parseFloat(day.spend) || 0,
                    impressions: parseInt(day.impressions) || 0,
                }));

                if (rows.length > 0) {
                    const { error: upsertError } = await supabase
                        .from('creative_track_fb_metrics')
                        .upsert(rows, { onConflict: 'track_id,ad_id,date' });
                    if (upsertError) console.error('Upsert error:', upsertError);
                }

                // Aggregate per date for the main entries table
                for (const row of rows) {
                    const existing = dailyAggregate.get(row.date) || { clicks: 0, spend: 0 };
                    existing.clicks += row.clicks;
                    existing.spend += row.spend;
                    dailyAggregate.set(row.date, existing);
                }
            }

            // Upsert aggregated data into creative_track_entries (main history/funnel table)
            for (const [date, agg] of dailyAggregate.entries()) {
                const aggCpc = agg.clicks > 0 ? agg.spend / agg.clicks : 0;
                const { error: entryError } = await supabase
                    .from('creative_track_entries')
                    .upsert({
                        track_id: selectedTrack.id,
                        date,
                        ad_clicks: agg.clicks,
                        cpc: Math.round(aggCpc * 10000) / 10000,
                        investment: Math.round(agg.spend * 100) / 100,
                    }, { onConflict: 'track_id,date' });
                if (entryError) console.error('Entry upsert error:', entryError);
            }

            // Refresh entries
            const { data: refreshedEntries } = await supabase
                .from('creative_track_entries')
                .select('*')
                .eq('track_id', selectedTrack.id)
                .order('date', { ascending: false });
            setEntries(refreshedEntries || []);

            showToast(`Métricas ${mode === 'all' ? 'gerais' : 'do dia'} sincronizadas!`);
        } catch (error: any) {
            console.error(error);
            showToast(`Erro na sincronização: ${error.message}`, 'error');
        } finally {
            setSyncingFb(false);
        }
    };



    // ========== ADD/UPSERT ENTRY ==========
    const handleAddEntry = async () => {
        if (!selectedTrack || !entryForm.date) {
            showToast('Data é obrigatória.', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                track_id: selectedTrack.id,
                date: entryForm.date,
                ad_clicks: parseInt(entryForm.ad_clicks) || 0,
                shopee_clicks: parseInt(entryForm.shopee_clicks) || 0,
                cpc: parseFloat(entryForm.cpc) || 0,
                orders: parseInt(entryForm.orders) || 0,
                commission_value: parseFloat(entryForm.commission_value) || 0,
                investment: parseFloat(entryForm.investment) || 0,
            };
            const { data, error } = await supabase
                .from('creative_track_entries')
                .upsert(payload, { onConflict: 'track_id,date' })
                .select()
                .single();
            if (error) throw error;
            setEntries(prev => {
                const exists = prev.find(e => e.date === data.date);
                if (exists) {
                    return prev.map(e => e.date === data.date ? data : e);
                }
                return [data, ...prev].sort((a, b) => b.date.localeCompare(a.date));
            });
            setEntryForm({ ...emptyEntryForm });
            showToast('Registro salvo!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar registro.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== DELETE ENTRY ==========
    const handleDeleteEntry = async (entry: TrackEntry) => {
        if (!window.confirm('Excluir este registro?')) return;
        try {
            const { error } = await supabase.from('creative_track_entries').delete().eq('id', entry.id);
            if (error) throw error;
            setEntries(prev => prev.filter(e => e.id !== entry.id));
            showToast('Registro excluído!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir registro.', 'error');
        }
    };

    // ========== EDIT INLINE ==========
    const startInlineEdit = (entry: TrackEntry) => {
        setEditingEntryId(entry.id);
        setInlineEditForm({
            date: entry.date,
            ad_clicks: entry.ad_clicks.toString(),
            shopee_clicks: entry.shopee_clicks.toString(),
            cpc: entry.cpc.toString(),
            orders: entry.orders.toString(),
            commission_value: entry.commission_value.toString(),
            investment: entry.investment.toString()
        });
    };

    const handleSaveInlineEdit = async (entry: TrackEntry) => {
        setSaving(true);
        try {
            const payload = {
                ad_clicks: parseInt(inlineEditForm.ad_clicks) || 0,
                shopee_clicks: parseInt(inlineEditForm.shopee_clicks) || 0,
                cpc: parseFloat(inlineEditForm.cpc) || 0,
                orders: parseInt(inlineEditForm.orders) || 0,
                commission_value: parseFloat(inlineEditForm.commission_value) || 0,
                investment: parseFloat(inlineEditForm.investment) || 0,
            };

            const { data, error } = await supabase
                .from('creative_track_entries')
                .update(payload)
                .eq('id', entry.id)
                .select()
                .single();

            if (error) throw error;

            setEntries(prev => prev.map(e => e.id === entry.id ? data : e));
            setEditingEntryId(null);
            showToast('Registro atualizado com sucesso!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar registro.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== COMPUTED KPIs ==========
    const kpis = useMemo(() => {
        if (entries.length === 0) return null;
        const totalCommission = entries.reduce((s, e) => s + Number(e.commission_value), 0);
        const totalInvestment = entries.reduce((s, e) => s + Number(e.investment), 0);
        const totalOrders = entries.reduce((s, e) => s + Number(e.orders), 0);
        const totalShopeeClicks = entries.reduce((s, e) => s + Number(e.shopee_clicks), 0);
        const totalAdClicks = entries.reduce((s, e) => s + Number(e.ad_clicks), 0);
        const totalProfit = totalCommission - totalInvestment;
        const avgOrdersPerDay = entries.length > 0 ? totalOrders / entries.length : 0;
        const profitPct = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

        return { totalProfit, totalOrders, avgOrdersPerDay, totalCommission, totalInvestment, profitPct, totalShopeeClicks, totalAdClicks };
    }, [entries]);

    const entryProfit = (parseFloat(entryForm.commission_value) || 0) - (parseFloat(entryForm.investment) || 0);
    const entryProfitPct = (parseFloat(entryForm.investment) || 0) > 0
        ? (entryProfit / (parseFloat(entryForm.investment) || 1)) * 100
        : 0;

    // ========== RENDER ==========

    // New Track Modal (rendered as overlay, shared across all states)
    const newTrackModal = showNewForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm">
            <div className="bg-surface-dark border border-border-dark rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-orange-400 to-amber-300 opacity-50 rounded-t-2xl"></div>
                <div className="p-6 flex flex-col gap-5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">Novo Track</h2>
                            <p className="text-text-secondary text-sm mt-1">Crie um criativo com link encurtado e Sub-IDs de rastreamento.</p>
                        </div>
                        <button onClick={resetModal} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Track Name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-neutral-300">Nome do Criativo *</label>
                        <input
                            className="bg-background-dark border border-border-dark rounded-xl p-3 text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-sm"
                            value={newTrackName}
                            onChange={e => setNewTrackName(e.target.value)}
                            placeholder="Ex: MOP, TOALHA, UMIDIFICADOR..."
                            autoFocus
                        />
                    </div>

                    <div className="h-px bg-border-dark"></div>

                    {/* Product Link (Shopee) */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-neutral-300">Link do Produto (Shopee)</label>
                        <div className="relative flex items-center">
                            <LinkIcon className="absolute left-3.5 w-4 h-4 text-neutral-500" />
                            <input
                                type="url"
                                value={modalOriginUrl}
                                onChange={e => setModalOriginUrl(e.target.value)}
                                placeholder="https://shopee.com.br/product/..."
                                className="w-full bg-background-dark border border-border-dark rounded-xl pl-10 pr-4 py-3 text-white placeholder-neutral-600 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* Sub IDs */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-neutral-300">
                                Sub IDs <span className="text-xs text-neutral-500 ml-1 font-normal">(Opcional)</span>
                            </label>
                            {modalSubIds.length < 5 && (
                                <button type="button" onClick={handleModalAddSubId} className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-2 py-1 rounded transition-colors">
                                    <Plus className="w-3 h-3" /> Add Sub-ID
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {modalSubIds.map((subId, index) => (
                                <div key={index} className="relative flex items-center group">
                                    <div className="absolute left-2.5 w-5 h-5 bg-surface-highlight text-neutral-400 text-xs font-bold rounded-full flex items-center justify-center pointer-events-none">
                                        {index + 1}
                                    </div>
                                    <input
                                        type="text"
                                        value={subId}
                                        onChange={e => handleModalSubIdChange(index, e.target.value)}
                                        placeholder={`Ex: campanhav${index + 1}`}
                                        className="w-full bg-background-dark border border-border-dark rounded-lg pl-9 pr-9 py-2.5 text-sm text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                                    />
                                    {modalSubIds.length > 1 && (
                                        <button type="button" onClick={() => handleModalRemoveSubId(index)} className="absolute right-2 p-1 text-neutral-500 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-neutral-500">Até 5 Sub-IDs para rastreamento de tráfego.</p>
                    </div>

                    {/* Error message */}
                    {modalError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{modalError}</span>
                        </div>
                    )}

                    {/* Generate Link Button */}
                    <button
                        type="button"
                        onClick={handleModalGenerateLink}
                        disabled={modalGenerating || !modalOriginUrl.trim()}
                        className={`w-full py-3 flex items-center justify-center gap-2 font-bold text-background-dark rounded-xl transition-all shadow-lg shadow-primary/20 text-sm ${modalGenerating ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 hover:scale-[1.01]'}`}
                    >
                        {modalGenerating ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Gerando Link Curto...</>
                        ) : (
                            <>Gerar Link Curto</>
                        )}
                    </button>

                    {/* Generated Link Result */}
                    {modalGeneratedLink && (
                        <div className="bg-surface-highlight/30 border border-primary/30 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-primary font-bold text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Link Gerado!</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    readOnly
                                    value={modalGeneratedLink}
                                    className="flex-1 bg-background-dark border border-primary/20 rounded-lg px-3 py-2 text-white font-mono text-xs outline-none"
                                    onClick={e => (e.target as HTMLInputElement).select()}
                                />
                                <button onClick={handleModalCopy} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${modalCopied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                    {modalCopied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="h-px bg-border-dark"></div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3">
                        <button onClick={resetModal} className="px-5 py-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium">
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreateTrack}
                            disabled={saving || !newTrackName.trim()}
                            className="bg-primary text-background-dark font-bold px-6 py-2.5 rounded-xl hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2 text-sm transition-all"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Criar Track
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // ===== NO TRACKS: EMPTY STATE =====
    if (tracks.length === 0 && !showNewForm) {
        return (
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Criativo Track</h1>
                        <p className="text-text-secondary text-sm mt-1">Acompanhe o desempenho de cada criativo de anúncio</p>
                    </div>
                    <button
                        onClick={() => setShowNewForm(true)}
                        className="bg-primary text-background-dark font-bold px-4 py-2 rounded-xl hover:bg-opacity-90 shadow-[0_0_15px_rgba(242,162,13,0.3)] flex items-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4" /> Novo Track
                    </button>
                </div>
                <div className="text-center py-16 bg-surface-dark rounded-2xl border border-border-dark">
                    <Target className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                    <p className="text-neutral-400 text-sm">Nenhum track criado ainda.</p>
                    <p className="text-neutral-500 text-xs mt-1">Clique em "Novo Track" para começar a rastrear seus criativos.</p>
                </div>
            </div>
        );
    }

    // ===== NEW TRACK FORM (no tracks yet) - render empty state + modal =====
    if (tracks.length === 0 && showNewForm) {
        return (
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Criativo Track</h1>
                        <p className="text-text-secondary text-sm mt-1">Acompanhe o desempenho de cada criativo de anúncio</p>
                    </div>
                </div>
                <div className="text-center py-16 bg-surface-dark rounded-2xl border border-border-dark">
                    <Target className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                    <p className="text-neutral-400 text-sm">Nenhum track criado ainda.</p>
                </div>
                {newTrackModal}
            </div>
        );
    }

    // ===== MAIN LAYOUT: SIDEBAR + DETAIL =====
    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Criativo Track</h1>
                    <p className="text-text-secondary text-sm mt-1">Acompanhe o desempenho de cada criativo de anúncio</p>
                </div>
                <button
                    onClick={() => setShowNewForm(!showNewForm)}
                    className="bg-primary text-background-dark font-bold px-4 py-2 rounded-xl hover:bg-opacity-90 shadow-[0_0_15px_rgba(242,162,13,0.3)] flex items-center gap-2 text-sm"
                >
                    <Plus className="w-4 h-4" /> Novo Track
                </button>
            </div>

            {/* New Track Modal */}
            {newTrackModal}

            {/* Two-column layout: Tracks list + Detail */}
            <div className="flex gap-4 min-h-0">
                {/* Left: Tracks List */}
                <div className="w-48 flex-shrink-0 flex flex-col gap-1 hidden md:flex">
                    {tracks.map(track => {
                        const isActive = selectedTrack?.id === track.id;
                        return (
                            <button
                                key={track.id}
                                onClick={() => handleSelectTrack(track)}
                                className={`text-left px-3 py-2.5 rounded-xl transition-all group flex items-center justify-between gap-2 ${isActive
                                    ? 'bg-primary text-background-dark shadow-lg shadow-primary/20'
                                    : 'text-text-secondary hover:bg-surface-dark hover:text-white'
                                    }`}
                            >
                                <div className="flex flex-col min-w-0">
                                    <span className={`text-sm truncate ${isActive ? 'font-bold' : 'font-medium'}`}>
                                        {track.name}
                                    </span>
                                    {track.sub_id && (
                                        <span className={`text-[10px] font-mono truncate ${isActive ? 'text-background-dark/70' : 'text-text-secondary/50'}`}>
                                            {track.sub_id}
                                        </span>
                                    )}
                                </div>
                                <div
                                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_8px] transition-all ${track.status === 'ativo' ? 'bg-green-500 shadow-green-500/50' :
                                        track.status === 'validado' ? 'bg-blue-500 shadow-blue-500/50' :
                                            'bg-red-500 shadow-red-500/50'
                                        }`}
                                    title={track.status.charAt(0).toUpperCase() + track.status.slice(1)}
                                />
                            </button>
                        );
                    })}
                </div>

                {/* Mobile: horizontal scroll tabs */}
                <div className="flex md:hidden overflow-x-auto gap-2 pb-2 -mx-1 px-1 hide-scrollbar">
                    {tracks.map(track => {
                        const isActive = selectedTrack?.id === track.id;
                        return (
                            <button
                                key={track.id}
                                onClick={() => handleSelectTrack(track)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${isActive
                                    ? 'bg-primary text-background-dark'
                                    : 'bg-surface-dark text-text-secondary border border-border-dark'
                                    }`}
                            >
                                {track.name}
                            </button>
                        );
                    })}
                </div>

                {/* Right: Detail View */}
                <div className="flex-1 min-w-0 flex flex-col gap-5">
                    {!selectedTrack ? (
                        <div className="flex-1 flex items-center justify-center py-16 bg-surface-dark rounded-2xl border border-border-dark">
                            <div className="text-center">
                                <Target className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                                <p className="text-neutral-400 text-sm">Selecione um track à esquerda</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Track Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        {editingTrack ? (
                                            <input
                                                className="bg-background-dark border border-primary rounded-lg p-2 text-white text-xl font-bold outline-none"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                autoFocus
                                            />
                                        ) : (
                                            <h2 className={`text-xl font-bold text-white transition-all ${hideSensitive ? 'blur-md select-none' : ''}`}>
                                                {selectedTrack.name}
                                            </h2>
                                        )}
                                        {selectedTrack.sub_id && !editingTrack && (
                                            <span className={`px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold font-mono transition-all ${hideSensitive ? 'blur-sm select-none' : ''}`}>
                                                {selectedTrack.sub_id}
                                            </span>
                                        )}
                                        {!editingTrack && (
                                            <div className="flex items-center gap-2 ml-2">
                                                <button
                                                    onClick={() => setHideSensitive(!hideSensitive)}
                                                    className={`p-1.5 rounded-lg border transition-all ${hideSensitive
                                                        ? 'bg-primary text-background-dark border-primary shadow-[0_0_10px_rgba(242,162,13,0.3)]'
                                                        : 'bg-surface-highlight text-text-secondary border-border-dark hover:text-white'
                                                        }`}
                                                    title={hideSensitive ? "Mostrar dados sensíveis" : "Ocultar dados sensíveis"}
                                                >
                                                    {hideSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                                {selectedTrack.affiliate_link && (
                                                    <a
                                                        href={selectedTrack.affiliate_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex flex-shrink-0 items-center justify-center p-1.5 rounded-lg bg-primary text-background-dark hover:bg-opacity-90 transition-colors shadow-[0_0_10px_rgba(242,162,13,0.3)]"
                                                        title="Acessar Link do Produto"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {!editingTrack && selectedTrack && (
                                        <div className="flex items-center gap-1 bg-background-dark/50 p-1 rounded-xl border border-border-dark w-fit">
                                            <button
                                                onClick={() => handleUpdateStatus(selectedTrack, 'ativo')}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${selectedTrack.status === 'ativo'
                                                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                                    : 'text-neutral-500 hover:text-green-400 hover:bg-green-500/10'
                                                    }`}
                                                title="Ativar"
                                            >
                                                <PlayCircle className="w-3.5 h-3.5" /> Ativo
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedTrack, 'validado')}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${selectedTrack.status === 'validado'
                                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                                    : 'text-neutral-500 hover:text-blue-400 hover:bg-blue-500/10'
                                                    }`}
                                                title="Validado"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Validado
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedTrack, 'desativado')}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${selectedTrack.status === 'desativado'
                                                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                                    : 'text-neutral-500 hover:text-red-400 hover:bg-red-500/10'
                                                    }`}
                                                title="Desativar"
                                            >
                                                <StopCircle className="w-3.5 h-3.5" /> Off
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {editingTrack ? (
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setEditingTrack(false)} className="px-3 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm"><X className="w-4 h-4" /></button>
                                            <button onClick={handleUpdateTrack} disabled={saving} className="bg-primary text-background-dark font-bold px-4 py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2 text-sm"><Save className="w-4 h-4" /> Salvar</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                onClick={() => setShowSyncModal(true)}
                                                className="px-3 py-2 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors text-sm flex items-center gap-1"
                                            >
                                                <Link2 className="w-4 h-4" /> Vincular Anúncios
                                            </button>
                                            <button
                                                onClick={() => setShowFunnelPicker(!showFunnelPicker)}
                                                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors ${linkedFunnel
                                                    ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                                                    : 'text-neutral-400 hover:text-white hover:bg-white/10'
                                                    }`}
                                            >
                                                <Filter className="w-4 h-4" /> {linkedFunnel ? linkedFunnel.name : 'Vincular Funil'}
                                            </button>
                                            <button
                                                onClick={() => { setEditingTrack(true); setEditName(selectedTrack.name); setEditLink(selectedTrack.affiliate_link); setEditSubId(selectedTrack.sub_id); }}
                                                className="px-3 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm flex items-center gap-1"
                                            >
                                                <Pencil className="w-4 h-4" /> Editar
                                            </button>

                                            <button
                                                onClick={() => handleDeleteTrack(selectedTrack)}
                                                disabled={saving}
                                                className="px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <Trash2 className="w-4 h-4" /> Excluir
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Funnel Picker */}
                            {showFunnelPicker && (
                                <div className="bg-surface-dark border border-primary/30 rounded-2xl p-4">
                                    <h4 className="text-xs font-bold text-text-secondary mb-3">Vincular Funil</h4>
                                    {userFunnels.length === 0 ? (
                                        <p className="text-xs text-text-secondary">Nenhum funil criado. Acesse a aba Funil para criar.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {linkedFunnel && (
                                                <button
                                                    onClick={async () => {
                                                        await supabase.from('creative_tracks').update({ funnel_id: null }).eq('id', selectedTrack!.id);
                                                        setLinkedFunnel(null);
                                                        setSelectedTrack({ ...selectedTrack!, funnel_id: null });
                                                        setShowFunnelPicker(false);
                                                        showToast('Funil desvinculado.');
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    Desvincular
                                                </button>
                                            )}
                                            {userFunnels.map(f => (
                                                <button
                                                    key={f.id}
                                                    onClick={async () => {
                                                        await supabase.from('creative_tracks').update({ funnel_id: f.id }).eq('id', selectedTrack!.id);
                                                        setLinkedFunnel(f);
                                                        setSelectedTrack({ ...selectedTrack!, funnel_id: f.id });
                                                        setShowFunnelPicker(false);
                                                        showToast(`Funil "${f.name}" vinculado!`);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${linkedFunnel?.id === f.id
                                                        ? 'border-primary bg-primary/10 text-primary font-bold'
                                                        : 'border-border-dark text-text-secondary hover:border-primary/50 hover:text-white'
                                                        }`}
                                                >
                                                    {f.name} ({(f.days || []).length}d)
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Edit Fields */}
                            {editingTrack && (
                                <div className="bg-surface-dark border border-border-dark rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-text-secondary">Link de Afiliado</label>
                                        <input className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm" value={editLink} onChange={e => setEditLink(e.target.value)} placeholder="https://..." />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-text-secondary">Sub_ID</label>
                                        <input className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm" value={editSubId} onChange={e => setEditSubId(e.target.value)} placeholder="Ex: MOP" />
                                    </div>
                                </div>
                            )}

                            {/* Product Details Section */}
                            <div className="bg-surface-dark border border-border-dark rounded-2xl p-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <PackageSearch className="w-4 h-4 text-orange-400" />
                                        Dados do Produto <span className="text-xs font-normal text-text-secondary">(Opcional)</span>
                                    </h3>
                                    {!editingProduct && (
                                        <button
                                            onClick={() => setEditingProduct(true)}
                                            className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-xs flex items-center gap-1"
                                        >
                                            <Pencil className="w-3.5 h-3.5" /> Editar Dados
                                        </button>
                                    )}
                                </div>

                                {editingProduct ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Preço do Produto (R$)</label>
                                            <input type="number" step="0.01" className="bg-background-dark border border-border-dark rounded-lg p-2.5 text-white outline-none focus:border-primary transition-colors text-sm" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} placeholder="Ex: 99.90" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Valor do Frete (R$)</label>
                                            <input type="number" step="0.01" className="bg-background-dark border border-border-dark rounded-lg p-2.5 text-white outline-none focus:border-primary transition-colors text-sm" value={productForm.shipping} onChange={e => setProductForm({ ...productForm, shipping: e.target.value })} placeholder="Ex: 15.00" disabled={productForm.free_shipping} />
                                        </div>
                                        <div className="flex flex-col gap-1 justify-center pt-5">
                                            <label className="flex items-center gap-2 text-sm text-white cursor-pointer select-none">
                                                <input type="checkbox" className="w-4 h-4 rounded border-border-dark bg-background-dark checked:bg-primary accent-primary" checked={productForm.free_shipping} onChange={e => setProductForm({ ...productForm, free_shipping: e.target.checked, shipping: e.target.checked ? '0' : productForm.shipping })} />
                                                Frete Grátis
                                            </label>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Quantidade Vendida</label>
                                            <input type="number" className="bg-background-dark border border-border-dark rounded-lg p-2.5 text-white outline-none focus:border-primary transition-colors text-sm" value={productForm.sold} onChange={e => setProductForm({ ...productForm, sold: e.target.value })} placeholder="Ex: 1500" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Quantidade de Avaliações</label>
                                            <input type="number" className="bg-background-dark border border-border-dark rounded-lg p-2.5 text-white outline-none focus:border-primary transition-colors text-sm" value={productForm.reviews} onChange={e => setProductForm({ ...productForm, reviews: e.target.value })} placeholder="Ex: 350" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Nota de Avaliação (1.0 - 5.0)</label>
                                            <input type="number" step="0.1" min="1" max="5" className="bg-background-dark border border-border-dark rounded-lg p-2.5 text-white outline-none focus:border-primary transition-colors text-sm" value={productForm.rating} onChange={e => setProductForm({ ...productForm, rating: e.target.value })} placeholder="Ex: 4.8" />
                                        </div>

                                        <div className="col-span-full flex items-center justify-end gap-2 mt-2">
                                            <button onClick={() => {
                                                setEditingProduct(false);
                                                setProductForm({
                                                    price: selectedTrack.product_price?.toString() || '',
                                                    shipping: selectedTrack.product_shipping?.toString() || '',
                                                    free_shipping: !!selectedTrack.product_free_shipping,
                                                    reviews: selectedTrack.product_reviews?.toString() || '',
                                                    sold: selectedTrack.product_sold?.toString() || '',
                                                    rating: selectedTrack.product_rating?.toString() || ''
                                                });
                                            }} className="px-4 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-xs">Cancelar</button>
                                            <button onClick={handleUpdateProduct} disabled={saving} className="bg-primary text-background-dark font-bold px-5 py-2 rounded-lg hover:brightness-110 disabled:opacity-50 flex items-center gap-2 text-xs">
                                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex items-center gap-2 bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2">
                                            <Tag className="w-4 h-4 text-text-secondary" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-text-secondary uppercase tracking-wider">Preço</span>
                                                <span className="text-sm font-bold text-white transition-all">
                                                    {selectedTrack.product_price != null ? `R$ ${formatBRL(selectedTrack.product_price)}` : <span className="text-neutral-500 font-normal">Não def.</span>}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2">
                                            <Truck className="w-4 h-4 text-text-secondary" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-text-secondary uppercase tracking-wider">Frete</span>
                                                <span className="text-sm font-bold text-white transition-all">
                                                    {selectedTrack.product_free_shipping ? (
                                                        <span className="text-green-400">Grátis</span>
                                                    ) : selectedTrack.product_shipping != null ? (
                                                        `R$ ${formatBRL(selectedTrack.product_shipping)}`
                                                    ) : (
                                                        <span className="text-neutral-500 font-normal">Não def.</span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2">
                                            <PackageSearch className="w-4 h-4 text-text-secondary" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-text-secondary uppercase tracking-wider">Vendidos</span>
                                                <span className="text-sm font-bold text-white transition-all">
                                                    {selectedTrack.product_sold != null ? `${selectedTrack.product_sold} un.` : <span className="text-neutral-500 font-normal">Não def.</span>}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2">
                                            <Star className="w-4 h-4 text-text-secondary" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-text-secondary uppercase tracking-wider">Avaliação</span>
                                                <span className="text-sm font-bold text-white transition-all">
                                                    {selectedTrack.product_rating != null ? (
                                                        <span className="flex items-center gap-1">
                                                            {selectedTrack.product_rating} <span className="text-neutral-500 text-xs font-normal">({selectedTrack.product_reviews || 0})</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-neutral-500 font-normal">Não def.</span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* FB Sync Buttons */}
                            {fbLinkedAds.length > 0 && (
                                <div className="bg-surface-dark border border-blue-500/20 rounded-2xl p-4">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                <Link2 className="w-4 h-4 text-blue-400" />
                                                Facebook Ads ({fbLinkedAds.length} anúncio{fbLinkedAds.length > 1 ? 's' : ''} vinculado{fbLinkedAds.length > 1 ? 's' : ''})
                                            </h3>
                                            <div className={`mt-2 flex flex-wrap gap-2 transition-all ${hideSensitive ? 'blur-sm select-none' : ''}`}>
                                                {fbLinkedAds.map(a => (
                                                    <div key={a.ad_id} className="flex items-center gap-2 bg-background-dark/50 border border-border-dark rounded-lg px-2 py-1">
                                                        <span className="text-xs text-text-secondary truncate max-w-[200px]" title={a.ad_name || a.ad_id}>
                                                            {a.ad_name || a.ad_id}
                                                        </span>
                                                        <button
                                                            onClick={() => setPreviewAdId(a.ad_id)}
                                                            className="p-1 hover:bg-white/10 rounded-md text-primary transition-colors"
                                                            title="Ver Criativo"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleSyncFb('today')}
                                                disabled={syncingFb}
                                                className="flex items-center gap-1.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 px-3 py-2 rounded-lg font-bold hover:bg-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                            >
                                                {syncingFb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                                                Sync Hoje
                                            </button>
                                            <button
                                                onClick={() => handleSyncFb('all')}
                                                disabled={syncingFb}
                                                className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-2 rounded-lg font-bold hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                            >
                                                {syncingFb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                Sync Geral
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* KPIs Dashboard */}
                            {loadingEntries ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                </div>
                            ) : kpis ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Lucro Total', value: `R$ ${formatBRL(kpis.totalProfit)}`, icon: DollarSign, color: kpis.totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
                                        { label: 'Pedidos Totais', value: kpis.totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-400' },
                                        { label: 'Média Pedidos/Dia', value: kpis.avgOrdersPerDay.toFixed(1), icon: BarChart3, color: 'text-purple-400' },
                                        { label: 'Total Comissões', value: `R$ ${formatBRL(kpis.totalCommission)}`, icon: TrendingUp, color: 'text-primary' },
                                        { label: 'Total Investimento', value: `R$ ${formatBRL(kpis.totalInvestment)}`, icon: PiggyBank, color: 'text-orange-400' },
                                        { label: '% Lucro Médio', value: `${formatPct(kpis.profitPct)}%`, icon: Percent, color: kpis.profitPct >= 0 ? 'text-green-400' : 'text-red-400' },
                                        { label: 'Cliques Shopee', value: kpis.totalShopeeClicks.toString(), icon: MousePointerClick, color: 'text-cyan-400' },
                                        { label: 'Cliques Anúncio', value: kpis.totalAdClicks.toString(), icon: Target, color: 'text-pink-400' },
                                    ].map((kpi, i) => (
                                        <div key={i} className="bg-surface-dark border border-border-dark rounded-2xl p-4 flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                                                <span className="text-xs text-text-secondary">{kpi.label}</span>
                                            </div>
                                            <span className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 bg-surface-dark rounded-2xl border border-border-dark text-neutral-400 text-sm">
                                    Nenhum registro ainda. Adicione o primeiro abaixo.
                                </div>
                            )}

                            {/* Manual Entry Button */}
                            <button
                                onClick={() => setShowManualEntry(true)}
                                className="flex items-center gap-2 bg-surface-dark border border-border-dark rounded-xl px-4 py-3 text-neutral-400 hover:text-white hover:border-primary/30 transition-all text-sm w-full sm:w-auto"
                            >
                                <Plus className="w-4 h-4" /> Criar Registro Manual
                            </button>

                            {/* Entries Table */}
                            {entries.length > 0 && (
                                <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                                    <div className="p-4 border-b border-border-dark flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-sm font-bold text-white">Histórico ({entries.length} registros)</h3>
                                            <span className="hidden sm:inline-block text-xs font-normal text-text-secondary bg-background-dark px-2.5 py-1 rounded-md border border-border-dark">
                                                Dê 2 cliques na linha para editar
                                            </span>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border-dark text-text-secondary text-xs">
                                                    {linkedFunnel && <th className="text-center p-3 w-10" title="Status do Funil"><Filter className="w-3.5 h-3.5 mx-auto" /></th>}
                                                    <th className="text-left p-3">Data</th>
                                                    <th className="text-right p-3">Cliq. Anúncio</th>
                                                    <th className="text-right p-3">Cliq. Shopee</th>
                                                    <th className="text-right p-3">CPC</th>
                                                    <th className="text-right p-3">Pedidos</th>
                                                    <th className="text-right p-3">Comissão</th>
                                                    <th className="text-right p-3">Investimento</th>
                                                    <th className="text-right p-3">Lucro</th>
                                                    <th className="text-right p-3">%</th>
                                                    <th className="text-center p-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {entries.map(entry => {
                                                    const isEditing = editingEntryId === entry.id;

                                                    // Funnel evaluation
                                                    const entryIndex = entries.indexOf(entry);
                                                    const dayNumber = entries.length - entryIndex; // Day 1 = oldest entry
                                                    let funnelStatus: 'pass' | 'fail' | 'none' = 'none';
                                                    if (linkedFunnel) {
                                                        const funnelDay = linkedFunnel.days?.find(d => d.day === dayNumber);
                                                        const maxFunnelDay = Math.max(...(linkedFunnel.days || []).map(d => d.day), 0);
                                                        // Use maintenance conditions for days beyond configured ones
                                                        const conditionsToEval = funnelDay
                                                            ? funnelDay.conditions
                                                            : (dayNumber > maxFunnelDay && (linkedFunnel.maintenance_conditions || []).length > 0)
                                                                ? linkedFunnel.maintenance_conditions
                                                                : null;

                                                        if (conditionsToEval && conditionsToEval.length > 0) {
                                                            const eProfit = Number(entry.commission_value) - Number(entry.investment);
                                                            const eRoi = Number(entry.investment) > 0 ? (eProfit / Number(entry.investment)) * 100 : 0;
                                                            const metricMap: Record<string, number> = {
                                                                ad_clicks: Number(entry.ad_clicks),
                                                                shopee_clicks: Number(entry.shopee_clicks),
                                                                cpc: Number(entry.cpc),
                                                                orders: Number(entry.orders),
                                                                commission_value: Number(entry.commission_value),
                                                                investment: Number(entry.investment),
                                                                profit: eProfit,
                                                                roi_percentage: eRoi,
                                                            };
                                                            const allPass = conditionsToEval.every(cond => {
                                                                const actual = metricMap[cond.metric] ?? 0;
                                                                switch (cond.operator) {
                                                                    case '<=': return actual <= cond.value;
                                                                    case '>=': return actual >= cond.value;
                                                                    case '==': return actual === cond.value;
                                                                    case '>': return actual > cond.value;
                                                                    case '<': return actual < cond.value;
                                                                    default: return false;
                                                                }
                                                            });
                                                            funnelStatus = allPass ? 'pass' : 'fail';
                                                        }
                                                    }

                                                    if (isEditing) {
                                                        const editProfit = (parseFloat(inlineEditForm.commission_value) || 0) - (parseFloat(inlineEditForm.investment) || 0);
                                                        const editPct = (parseFloat(inlineEditForm.investment) || 0) > 0 ? (editProfit / (parseFloat(inlineEditForm.investment) || 1)) * 100 : 0;

                                                        return (
                                                            <tr key={entry.id} className="border-b border-border-dark/50 bg-primary/5">
                                                                {linkedFunnel && (
                                                                    <td className="p-3 text-center">
                                                                        {funnelStatus === 'pass' && <Filter className="w-4 h-4 text-green-400 mx-auto" />}
                                                                        {funnelStatus === 'fail' && <Filter className="w-4 h-4 text-red-400 mx-auto" />}
                                                                        {funnelStatus === 'none' && <Filter className="w-4 h-4 text-neutral-600 mx-auto" />}
                                                                    </td>
                                                                )}
                                                                <td className="p-3 text-white whitespace-nowrap">{format(new Date(entry.date + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                                                                <td className="p-2">
                                                                    <input type="number" className="w-full min-w-[70px] bg-background-dark border border-border-dark rounded px-2 py-1.5 text-white outline-none focus:border-primary text-right text-sm" value={inlineEditForm.ad_clicks} onChange={e => setInlineEditForm({ ...inlineEditForm, ad_clicks: e.target.value })} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input type="number" className="w-full min-w-[70px] bg-background-dark border border-border-dark rounded px-2 py-1.5 text-white outline-none focus:border-primary text-right text-sm" value={inlineEditForm.shopee_clicks} onChange={e => setInlineEditForm({ ...inlineEditForm, shopee_clicks: e.target.value })} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input type="number" step="0.01" className="w-full min-w-[70px] bg-background-dark border border-border-dark rounded px-2 py-1.5 text-white outline-none focus:border-primary text-right text-sm" value={inlineEditForm.cpc} onChange={e => setInlineEditForm({ ...inlineEditForm, cpc: e.target.value })} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input type="number" className="w-full min-w-[70px] bg-background-dark border border-border-dark rounded px-2 py-1.5 text-blue-400 font-semibold outline-none focus:border-primary text-right text-sm" value={inlineEditForm.orders} onChange={e => setInlineEditForm({ ...inlineEditForm, orders: e.target.value })} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input type="number" step="0.01" className="w-full min-w-[80px] bg-background-dark border border-border-dark rounded px-2 py-1.5 text-primary font-semibold outline-none focus:border-primary text-right text-sm" value={inlineEditForm.commission_value} onChange={e => setInlineEditForm({ ...inlineEditForm, commission_value: e.target.value })} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input type="number" step="0.01" className="w-full min-w-[80px] bg-background-dark border border-border-dark rounded px-2 py-1.5 text-orange-400 outline-none focus:border-primary text-right text-sm" value={inlineEditForm.investment} onChange={e => setInlineEditForm({ ...inlineEditForm, investment: e.target.value })} />
                                                                </td>
                                                                <td className={`p-3 text-right font-bold ${editProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {formatBRL(editProfit)}</td>
                                                                <td className={`p-3 text-right text-xs ${editPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPct(editPct)}%</td>
                                                                <td className="p-3 text-center">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button onClick={() => handleSaveInlineEdit(entry)} disabled={saving} className="p-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors" title="Salvar">
                                                                            {saving && editingEntryId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                                        </button>
                                                                        <button onClick={() => setEditingEntryId(null)} className="p-1 rounded bg-surface-highlight text-text-secondary hover:text-white transition-colors" title="Cancelar">
                                                                            <X className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    const profit = Number(entry.commission_value) - Number(entry.investment);
                                                    const pct = Number(entry.investment) > 0 ? (profit / Number(entry.investment)) * 100 : 0;
                                                    return (
                                                        <tr key={entry.id} onDoubleClick={() => startInlineEdit(entry)} className="border-b border-border-dark/50 hover:bg-white/5 transition-colors cursor-pointer" title="Dê um duplo clique para editar">
                                                            {linkedFunnel && (
                                                                <td className="p-3 text-center">
                                                                    {funnelStatus === 'pass' && <Filter className="w-4 h-4 text-green-400 mx-auto" />}
                                                                    {funnelStatus === 'fail' && <Filter className="w-4 h-4 text-red-400 mx-auto" />}
                                                                    {funnelStatus === 'none' && <Filter className="w-4 h-4 text-neutral-600 mx-auto" />}
                                                                </td>
                                                            )}
                                                            <td className="p-3 text-white whitespace-nowrap">{format(new Date(entry.date + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                                                            <td className="p-3 text-right text-neutral-300">{entry.ad_clicks}</td>
                                                            <td className="p-3 text-right text-neutral-300">{entry.shopee_clicks}</td>
                                                            <td className="p-3 text-right text-neutral-300">R$ {formatBRL(Number(entry.cpc))}</td>
                                                            <td className="p-3 text-right text-blue-400 font-semibold">{entry.orders}</td>
                                                            <td className="p-3 text-right text-primary font-semibold">R$ {formatBRL(Number(entry.commission_value))}</td>
                                                            <td className="p-3 text-right text-orange-400">R$ {formatBRL(Number(entry.investment))}</td>
                                                            <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {formatBRL(profit)}</td>
                                                            <td className={`p-3 text-right text-xs ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPct(pct)}%</td>
                                                            <td className="p-3 text-center">
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry); }} className="text-red-400/50 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Facebook Ads Sync Modal */}
                    {selectedTrack && (
                        <FacebookAdsSyncModal
                            isOpen={showSyncModal}
                            onClose={() => setShowSyncModal(false)}
                            trackId={selectedTrack.id}
                            trackName={selectedTrack.name}
                            onSyncComplete={() => {
                                fetchFbLinkedAds(selectedTrack.id);
                            }}
                        />
                    )}

                    {/* Ad Preview Modal */}
                    <AdPreviewModal
                        isOpen={!!previewAdId}
                        onClose={() => setPreviewAdId(null)}
                        adId={previewAdId || ''}
                        fbToken={fbToken}
                    />

                    {/* Manual Entry Modal */}
                    {showManualEntry && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm">
                            <div className="bg-surface-dark border border-border-dark rounded-2xl shadow-xl w-full max-w-lg">
                                <div className="flex items-center justify-between p-4 border-b border-border-dark">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Plus className="w-5 h-5 text-primary" />
                                        Registro Manual
                                    </h2>
                                    <button onClick={() => setShowManualEntry(false)} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Data</label>
                                            <input type="date" className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm" value={entryForm.date} onChange={e => setEntryForm({ ...entryForm, date: e.target.value })} />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Cliques Anúncio</label>
                                            <input type="number" className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm" value={entryForm.ad_clicks} onChange={e => setEntryForm({ ...entryForm, ad_clicks: e.target.value })} placeholder="0" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Cliques Shopee</label>
                                            <input type="number" className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm" value={entryForm.shopee_clicks} onChange={e => setEntryForm({ ...entryForm, shopee_clicks: e.target.value })} placeholder="0" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">CPC (R$)</label>
                                            <input type="number" step="0.01" className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm" value={entryForm.cpc} onChange={e => setEntryForm({ ...entryForm, cpc: e.target.value })} placeholder="0.00" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Qtd Pedidos</label>
                                            <input type="number" className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm" value={entryForm.orders} onChange={e => setEntryForm({ ...entryForm, orders: e.target.value })} placeholder="0" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Valor Comissão (R$)</label>
                                            <input type="number" step="0.01" className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm" value={entryForm.commission_value} onChange={e => setEntryForm({ ...entryForm, commission_value: e.target.value })} placeholder="0.00" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Investimento (R$)</label>
                                            <input type="number" step="0.01" className="bg-background-dark border border-border-dark rounded-lg p-3 text-white outline-none focus:border-primary transition-colors text-sm" value={entryForm.investment} onChange={e => setEntryForm({ ...entryForm, investment: e.target.value })} placeholder="0.00" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs text-text-secondary">Lucro / %</label>
                                            <div className="flex items-center gap-2 h-[46px]">
                                                <span className={`text-sm font-bold ${entryProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {formatBRL(entryProfit)}</span>
                                                <span className={`text-xs ${entryProfitPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>({formatPct(entryProfitPct)}%)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-2 p-4 border-t border-border-dark">
                                    <button onClick={() => setShowManualEntry(false)} className="px-4 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm">Cancelar</button>
                                    <button onClick={() => { handleAddEntry(); setShowManualEntry(false); }} disabled={saving} className="bg-primary text-background-dark font-bold px-5 py-2 rounded-lg hover:brightness-110 disabled:opacity-50 flex items-center gap-2 text-sm">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salvar Registro
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
