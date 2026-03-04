import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    rectSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../lib/supabase';
import { syncService } from '../lib/syncService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import { generateShopeeLink, fetchShopeeProduct, resolveShopeeUrl, fetchConversionReport } from '../lib/shopeeApi';
import {
    Loader2, Plus, Trash2, Pencil, Save, X, Edit2,
    DollarSign, ShoppingCart, TrendingUp, MousePointerClick,
    BarChart3, Target, PiggyBank, Percent, ExternalLink,
    Link2, RefreshCw, Calendar, Filter, Eye, EyeOff,
    Link as LinkIcon, AlertCircle, CheckCircle2, Copy,
    PlayCircle, StopCircle, PackageSearch, Truck, Star, Tag,
    Video, Store, Image as ImageIcon, ShieldCheck, ShieldAlert, AlertTriangle,
    ChevronDown, ChevronRight, FileEdit, Archive, ArchiveRestore,
    Clock, XCircle, LayoutList, Kanban
} from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { FacebookAdsSyncModal } from '../components/FacebookAdsSyncModal';
import { formatBRL, formatPct } from '../utils/format';
import { extractShopeeIds } from '../utils/shopee';
import { AdPreviewModal } from '../components/AdPreviewModal';
import { useData } from '../hooks/useData';
import { DateFilter } from '../components/ui/DateFilter';
import { KanbanBoard } from '../components/KanbanBoard';

const TRACK_STATUSES = [
    { slug: 'rascunho', name: 'Rascunho', color: '#ffffff', icon: 'FileEdit' },
    { slug: 'ativo', name: 'Ativo', color: '#22c55e', icon: 'PlayCircle' },
    { slug: 'validado', name: 'Validado', color: '#3b82f6', icon: 'CheckCircle2' },
    { slug: 'desativado', name: 'Desativado', color: '#ef4444', icon: 'StopCircle' },
];

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

const getLinkIntegrity = (affiliateLink: string, linkedAds: { ad_link?: string | null }[]) => {
    if (!affiliateLink || linkedAds.length === 0) return 'none';

    // Normalize links: remove protocol, www, and trailing slashes for comparison
    const normalize = (url: string) => url.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .split('?')[0]; // Ignore UTMs for match

    const normAff = normalize(affiliateLink);
    const matches = linkedAds.some(ad => ad.ad_link && normalize(ad.ad_link) === normAff);

    return matches ? 'valid' : 'error';
};

interface Track {
    id: string;
    user_id: string;
    name: string;
    affiliate_link: string;
    sub_id: string;
    created_at: string;
    funnel_id: string | null;
    status: 'ativo' | 'desativado' | 'validado' | 'rascunho';
    is_archived?: boolean;
    // Manual product fields (schema_14)
    product_price?: number | null;
    product_shipping?: number | null;
    product_free_shipping?: boolean | null;
    product_reviews?: number | null;
    product_sold?: number | null;
    product_rating?: number | null;
    // Auto-fetched fields (schema_16)
    product_item_id?: number | null;
    product_name?: string | null;
    product_image_url?: string | null;
    product_link?: string | null;
    product_offer_link?: string | null;
    product_price_min?: number | null;
    product_price_max?: number | null;
    product_discount_rate?: number | null;
    product_commission?: number | null;
    product_commission_rate?: number | null;
    product_seller_commission_rate?: number | null;
    product_shopee_commission_rate?: number | null;
    product_category_ids?: string | null;
    product_shop_id?: number | null;
    product_shop_name?: string | null;
    product_shop_type?: string | null;
    product_shop_rating?: number | null;
    product_shop_image_url?: string | null;
    product_fetched_at?: string | null;
    custom_fields?: Record<string, string> | null;
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
    is_direct?: boolean;
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
    ad_link: string;
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

interface FunnelConditionGroup {
    id: string;
    conditions: FunnelCondition[];
}

interface FunnelDay {
    day: number;
    condition_groups?: FunnelConditionGroup[];
    /** @deprecated use condition_groups */
    conditions?: FunnelCondition[];
}

interface LinkedFunnel {
    id: string;
    name: string;
    days: FunnelDay[];
    /** @deprecated Antiga estrutura ou nova em coluna única conforme DB */
    maintenance_conditions?: (FunnelCondition[] | FunnelConditionGroup[]) & any;
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

// ── Shopee Conversion type (from DB) ──
interface ShopeeConversion {
    id: string;
    track_id: string;
    conversion_id: string;
    click_time: string | null;
    purchase_time: string | null;
    conversion_status: string | null;
    net_commission: number;
    total_commission: number;
    seller_commission: number;
    shopee_commission: number;
    buyer_type: string | null;
    device: string | null;
    utm_content: string | null;
    referrer: string | null;
    order_id: string | null;
    order_status: string | null;
    item_id: number | null;
    item_name: string | null;
    item_price: number | null;
    qty: number;
    actual_amount: number | null;
    refund_amount: number | null;
    image_url: string | null;
    item_total_commission: number;
    item_seller_commission_rate: number | null;
    item_shopee_commission_rate: number | null;
    attribution_type: string | null;
    fraud_status: string | null;
    global_category_lv1: string | null;
    is_validated: boolean;
    is_direct?: boolean;
    synced_at: string;
}

function SortableKpiCard({ id, kpi, compact }: { id: string; kpi: { label: string; value: string; icon: any; color: string }; compact?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
    };

    const Icon = kpi.icon;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`bg-surface-dark border border-border-dark rounded-2xl flex flex-col cursor-grab active:cursor-grabbing select-none ${compact ? 'p-3 sm:p-4 gap-1.5 sm:gap-2' : 'p-4 gap-2'
                }`}
        >
            <div className={`flex items-center ${compact ? 'gap-1.5 sm:gap-2' : 'gap-2'}`}>
                <Icon className={`${compact ? 'w-3.5 h-3.5 sm:w-4 sm:h-4' : 'w-4 h-4'} ${kpi.color}`} />
                <span className={`${compact ? 'text-[10px] sm:text-xs' : 'text-xs'} text-text-secondary`}>{kpi.label}</span>
            </div>
            <span className={`${compact ? 'text-sm sm:text-lg' : 'text-lg'} font-bold ${kpi.color}`}>{kpi.value}</span>
        </div>
    );
}

export function CreativeTrack() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { dateFilter, customRange } = useData();

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

    const [showArchived, setShowArchived] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
        const saved = localStorage.getItem('creativeTrack_viewMode');
        return saved === 'kanban' ? 'kanban' : 'list';
    });
    const [showKanbanModal, setShowKanbanModal] = useState(false);

    const creativeTracks = useMemo(() => {
        return tracks
            .filter(t => !t.name.startsWith('Orgânico -'))
            .filter(t => !!t.is_archived === showArchived)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }));
    }, [tracks, showArchived]);

    const nextSubId = useMemo(() => {
        const numbers = tracks
            .filter(t => !t.name.startsWith('Orgânico -'))
            .map(t => {
                const match = t.name.match(/^(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            });

        const maxNumber = Math.max(0, ...numbers);
        const count = maxNumber + 1;
        return count.toString().padStart(3, '0');
    }, [tracks]);

    useEffect(() => {
        if (showNewForm) {
            setModalSubIds([nextSubId]);
            setNewTrackName(`${nextSubId} - `);
        }
    }, [showNewForm, nextSubId]);

    const handleNewTrackNameChange = (val: string) => {
        setNewTrackName(val);

        // Auto-fill Sub-ID 2 based on product name
        // Example: "008 - Calça Legging" -> Sub-ID 2: "CalcaLegging"
        const parts = val.split(' - ');
        if (parts.length > 1) {
            const productName = parts.slice(1).join(' - ');
            // Sanitize: remove accents, spaces, and special chars
            const cleanedSlug = productName.normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remove accents
                .replace(/[^a-zA-Z0-9]/g, ""); // Keep only letters and numbers

            const truncatedSlug = cleanedSlug.substring(0, 50);

            setModalSubIds(prev => {
                const next = [...prev];
                if (next.length < 2) {
                    while (next.length < 2) next.push('');
                }
                next[1] = truncatedSlug;
                return next;
            });
        } else {
            // If name is cleared or doesn't have a product part, clear sub_id[1]
            setModalSubIds(prev => {
                const next = [...prev];
                if (next.length > 1) {
                    next[1] = '';
                }
                return next;
            });
        }
    };

    const handleModalCheckUrl = async () => {
        if (!modalOriginUrl.trim()) {
            setModalError('Informe o link do produto.');
            return;
        }

        setModalFetchingProduct(true);
        setModalProductError(null);
        setModalError(null);

        try {
            // 1. Get credentials
            const { data: creds, error: credsError } = await supabase.rpc('get_shopee_credentials');
            if (credsError) throw credsError;
            if (!creds || creds.length === 0) {
                throw new Error('Credenciais da Shopee não configuradas.');
            }
            const { shopee_app_id: appId, shopee_secret: secret } = creds[0];

            // 2. Extract IDs
            let ids = extractShopeeIds(modalOriginUrl);
            if (!ids) {
                // Try resolving if it's a short link
                const resolved = await resolveShopeeUrl(modalOriginUrl);
                ids = extractShopeeIds(resolved);
            }

            if (!ids) {
                throw new Error('Link inválido ou não reconhecido como Shopee.');
            }

            // 3. Fetch product
            const { product, shop } = await fetchShopeeProduct({
                shopId: ids.shopId,
                itemId: ids.itemId,
                shopeeAppId: appId,
                shopeeSecret: secret,
            });

            if (product) {
                setModalProductData(product);
                setModalShopData(shop);

                // Update Track Name: keep prefix but add product name
                // Example: "009 - " -> "009 - Calça Legging..."
                const parts = newTrackName.split(' - ');
                const prefix = parts[0] || nextSubId;
                const newName = `${prefix} - ${product.productName}`;
                handleNewTrackNameChange(newName);
            } else {
                throw new Error('Produto não encontrado na Shopee.');
            }
        } catch (e: any) {
            console.error('Error in modal check:', e);
            setModalProductError(e.message || 'Erro ao buscar dados do produto');
        } finally {
            setModalFetchingProduct(false);
        }
    };

    // New Track Modal states
    const [modalOriginUrl, setModalOriginUrl] = useState('');
    const [modalSubIds, setModalSubIds] = useState<string[]>(['']);
    const [modalGenerating, setModalGenerating] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    // Product data fetched from API during modal flow
    const [modalProductData, setModalProductData] = useState<any | null>(null);
    const [modalShopData, setModalShopData] = useState<any | null>(null);
    const [modalFetchingProduct, setModalFetchingProduct] = useState(false);
    const [modalProductError, setModalProductError] = useState<string | null>(null);
    const [modalCustomFields, setModalCustomFields] = useState<{ key: string, value: string }[]>([]);

    const [editingTrack, setEditingTrack] = useState(false);
    const [editName, setEditName] = useState('');
    const [editLink, setEditLink] = useState('');
    const [editSubIds, setEditSubIds] = useState<string[]>(['']);
    const [trackLinkCopied, setTrackLinkCopied] = useState(false);

    const handleCopyTrackLink = (link: string) => {
        navigator.clipboard.writeText(link);
        setTrackLinkCopied(true);
        setTimeout(() => setTrackLinkCopied(false), 2000);
    };

    const [entryForm, setEntryForm] = useState<EntryForm>({ ...emptyEntryForm });

    // Inline edit state
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [inlineEditForm, setInlineEditForm] = useState<EntryForm>({ ...emptyEntryForm });

    // Tabs Navigation State
    const [activeTab, setActiveTab] = useState<'metrics' | 'product' | 'conversions' | 'custom'>('metrics');

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

    // Fetch product data for existing track
    const [fetchingProductData, setFetchingProductData] = useState(false);
    const [fetchProductError, setFetchProductError] = useState<string | null>(null);

    // Facebook Ads sync state
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [fbLinkedAds, setFbLinkedAds] = useState<FbLinkedAd[]>([]);
    const [syncingFb, setSyncingFb] = useState(false);

    // Global Sync state
    const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
    const [showGlobalSyncMenu, setShowGlobalSyncMenu] = useState(false);
    const globalSyncMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (globalSyncMenuRef.current && !globalSyncMenuRef.current.contains(event.target as Node)) {
                setShowGlobalSyncMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const [fbToken, setFbToken] = useState('');
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [previewAdId, setPreviewAdId] = useState<string | null>(null);
    const [fbMetrics, setFbMetrics] = useState<any[]>([]);

    // Funnel linking state
    const [userFunnels, setUserFunnels] = useState<LinkedFunnel[]>([]);
    const [linkedFunnel, setLinkedFunnel] = useState<LinkedFunnel | null>(null);
    const [showFunnelPicker, setShowFunnelPicker] = useState(false);
    const [hideSensitive, setHideSensitive] = useState(false);
    const [allEntries, setAllEntries] = useState<TrackEntry[]>([]);

    const trackEntryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        allEntries.forEach(entry => {
            counts[entry.track_id] = (counts[entry.track_id] || 0) + 1;
        });
        return counts;
    }, [allEntries]);

    // Shopee Conversions state
    const [shopeeConversions, setShopeeConversions] = useState<ShopeeConversion[]>([]);
    const [allUserConversions, setAllUserConversions] = useState<ShopeeConversion[]>([]);
    const [syncingConversions, setSyncingConversions] = useState(false);
    const [syncingValidated, setSyncingValidated] = useState(false);

    // ========== FETCH TRACKS ==========
    const DEFAULT_GLOBAL_KPI_ORDER = [
        'profit', 'orders', 'completed', 'pending', 'cancelled', 'avgOrders',
        'commission', 'investment', 'profitPct', 'shopeeClicks', 'adClicks', 'cpc'
    ];

    const DEFAULT_TRACK_KPI_ORDER = [
        'profit', 'orders', 'completed', 'pending', 'cancelled', 'avgOrders',
        'commission', 'investment', 'profitPct', 'shopeeClicks', 'adClicks', 'cpc'
    ];

    const [globalKpiOrder, setGlobalKpiOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('shopee_analisar_global_kpi_order');
        return saved ? JSON.parse(saved) : DEFAULT_GLOBAL_KPI_ORDER;
    });

    const [trackKpiOrder, setTrackKpiOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('shopee_analisar_track_kpi_order');
        return saved ? JSON.parse(saved) : DEFAULT_TRACK_KPI_ORDER;
    });

    type RankingSortCol = 'name' | 'status' | 'adClicks' | 'shopeeClicks' | 'cpc' | 'orders' | 'commission' | 'investment' | 'profit' | 'pct';
    const [rankingSortCol, setRankingSortCol] = useState<RankingSortCol>(() => {
        try { const s = localStorage.getItem('shopee_analisar_ranking_sort_col'); return (s as RankingSortCol) || 'profit'; } catch { return 'profit'; }
    });
    const [rankingSortDir, setRankingSortDir] = useState<'asc' | 'desc'>(() => {
        try { const s = localStorage.getItem('shopee_analisar_ranking_sort_dir'); return (s as 'asc' | 'desc') || 'desc'; } catch { return 'desc'; }
    });

    const handleRankingSort = (col: RankingSortCol) => {
        const newDir = rankingSortCol === col ? (rankingSortDir === 'desc' ? 'asc' : 'desc') : 'desc';
        setRankingSortCol(col);
        setRankingSortDir(newDir);
        localStorage.setItem('shopee_analisar_ranking_sort_col', col);
        localStorage.setItem('shopee_analisar_ranking_sort_dir', newDir);
        saveRankingSortToSupabase(col, newDir);
    };

    const prefsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const savePrefsToSupabase = useCallback((globalOrder: string[], trackOrder: string[]) => {
        if (!user) return;
        if (prefsDebounceRef.current) clearTimeout(prefsDebounceRef.current);
        prefsDebounceRef.current = setTimeout(async () => {
            const { data } = await supabase.from('users').select('user_preferences').eq('id', user.id).single();
            const current = (data?.user_preferences as Record<string, unknown>) ?? {};
            await supabase
                .from('users')
                .update({ user_preferences: { ...current, global_kpi_order: globalOrder, track_kpi_order: trackOrder } })
                .eq('id', user.id);
        }, 500);
    }, [user?.id]);

    const saveRankingSortToSupabase = useCallback((col: string, dir: string) => {
        if (!user) return;
        setTimeout(async () => {
            const { data } = await supabase.from('users').select('user_preferences').eq('id', user.id).single();
            const current = (data?.user_preferences as Record<string, unknown>) ?? {};
            await supabase
                .from('users')
                .update({ user_preferences: { ...current, ranking_sort: { column: col, dir } } })
                .eq('id', user.id);
        }, 500);
    }, [user?.id]);

    // Load preferences from Supabase on mount
    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data } = await supabase
                .from('users')
                .select('user_preferences')
                .eq('id', user.id)
                .single();
            const prefs = data?.user_preferences as { global_kpi_order?: string[]; track_kpi_order?: string[]; ranking_sort?: { column?: string; dir?: string } } | null;
            if (prefs?.global_kpi_order?.length) {
                setGlobalKpiOrder(prefs.global_kpi_order);
                localStorage.setItem('shopee_analisar_global_kpi_order', JSON.stringify(prefs.global_kpi_order));
            }
            if (prefs?.track_kpi_order?.length) {
                setTrackKpiOrder(prefs.track_kpi_order);
                localStorage.setItem('shopee_analisar_track_kpi_order', JSON.stringify(prefs.track_kpi_order));
            }
            if (prefs?.ranking_sort?.column) {
                setRankingSortCol(prefs.ranking_sort.column as RankingSortCol);
                setRankingSortDir((prefs.ranking_sort.dir as 'asc' | 'desc') || 'desc');
                localStorage.setItem('shopee_analisar_ranking_sort_col', prefs.ranking_sort.column);
                localStorage.setItem('shopee_analisar_ranking_sort_dir', prefs.ranking_sort.dir || 'desc');
            }
        })();
    }, [user?.id]);

    const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
    const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
    const dndSensors = useSensors(pointerSensor, touchSensor);

    const handleGlobalKpiDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setGlobalKpiOrder((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                savePrefsToSupabase(newOrder, trackKpiOrder);
                return newOrder;
            });
        }
    };

    const handleTrackKpiDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setTrackKpiOrder((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                savePrefsToSupabase(globalKpiOrder, newOrder);
                return newOrder;
            });
        }
    };

    useEffect(() => {
        localStorage.setItem('shopee_analisar_global_kpi_order', JSON.stringify(globalKpiOrder));
    }, [globalKpiOrder]);

    useEffect(() => {
        localStorage.setItem('shopee_analisar_track_kpi_order', JSON.stringify(trackKpiOrder));
    }, [trackKpiOrder]);

    useEffect(() => {
        if (user) {
            fetchTracks();
            fetchFbToken();
            fetchUserFunnels();
            fetchAllEntries();
            fetchAllUserConversions();
        }
    }, [user?.id]);

    const fetchTracks = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('creative_tracks')
                .select('*')
                .eq('user_id', user!.id)
                .order('name', { ascending: true });
            if (error) throw error;
            setTracks(data || []);
        } catch (error) {
            console.error('Erro ao carregar tracks:', error);
            showToast('Erro ao carregar tracks.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllEntries = async () => {
        if (!user) return;
        const { data: userTracks } = await supabase
            .from('creative_tracks')
            .select('id')
            .eq('user_id', user.id);
        if (userTracks && userTracks.length > 0) {
            const trackIds = userTracks.map(t => t.id);
            const { data } = await supabase
                .from('creative_track_entries')
                .select('*')
                .in('track_id', trackIds);
            setAllEntries(data || []);
        }
    };

    const fetchAllUserConversions = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('shopee_conversions')
            .select('*')
            .eq('user_id', user.id);
        if (error) {
            console.error('Erro ao buscar conversões do usuário:', error);
            return;
        }
        setAllUserConversions(data || []);
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

    const fetchFbMetrics = async (trackId: string) => {
        const { data } = await supabase
            .from('creative_track_fb_metrics')
            .select('*')
            .eq('track_id', trackId);
        setFbMetrics(data || []);
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
            let affiliateLink = newTrackLink.trim();
            let subId = newTrackSubId.trim();
            let finalProductData = modalProductData;
            let finalShopData = modalShopData;

            // IF modalOriginUrl is provided, we auto-generate the link and fetch product data
            if (modalOriginUrl.trim()) {
                setModalGenerating(true);
                try {
                    // 1. Fetch Shopee credentials
                    const { data: creds, error: credsError } = await supabase.rpc('get_shopee_credentials');
                    if (credsError) throw credsError;
                    if (!creds || creds.length === 0) {
                        throw new Error('Credenciais da Shopee não configuradas.');
                    }
                    const { shopee_app_id: appId, shopee_secret: secret } = creds[0];

                    // 2. Generate link
                    const activeSubIds = modalSubIds.map(id => id.trim()).filter(id => id !== '');
                    const { shortLink } = await generateShopeeLink({
                        originUrl: modalOriginUrl,
                        subIds: activeSubIds,
                        shopeeAppId: appId,
                        shopeeSecret: secret,
                    });
                    affiliateLink = shortLink;
                    if (activeSubIds.length > 0) subId = activeSubIds.join('-');

                    // 3. Fetch product info
                    const ids = extractShopeeIds(modalOriginUrl);
                    if (ids) {
                        try {
                            const { product, shop } = await fetchShopeeProduct({
                                shopId: ids.shopId,
                                itemId: ids.itemId,
                                shopeeAppId: appId,
                                shopeeSecret: secret,
                            });
                            finalProductData = product;
                            finalShopData = shop;
                        } catch (e) {
                            console.warn('Failed to fetch product data, continuing without it:', e);
                        }
                    }
                } catch (e: any) {
                    setModalError(e.message || 'Erro ao processar link da Shopee');
                    setSaving(false);
                    setModalGenerating(false);
                    return;
                } finally {
                    setModalGenerating(false);
                }
            }

            const insertPayload: Record<string, any> = {
                user_id: user!.id,
                name: newTrackName.trim(),
                affiliate_link: affiliateLink,
                sub_id: subId,
            };

            // Merge auto-fetched product data
            if (finalProductData) {
                const p = finalProductData;
                Object.assign(insertPayload, {
                    product_item_id: p.itemId ?? null,
                    product_name: p.productName || null,
                    product_image_url: p.imageUrl || null,
                    product_link: p.productLink || null,
                    product_offer_link: p.offerLink || null,
                    product_price: p.price ? parseFloat(p.price) : null,
                    product_price_min: p.priceMin ? parseFloat(p.priceMin) : null,
                    product_price_max: p.priceMax ? parseFloat(p.priceMax) : null,
                    product_discount_rate: p.priceDiscountRate ?? null,
                    product_commission: p.commission ? parseFloat(p.commission) : null,
                    product_commission_rate: p.commissionRate ? parseFloat(p.commissionRate) : null,
                    product_seller_commission_rate: p.sellerCommissionRate ? parseFloat(p.sellerCommissionRate) : null,
                    product_shopee_commission_rate: p.shopeeCommissionRate ? parseFloat(p.shopeeCommissionRate) : null,
                    product_sold: p.sales ?? null,
                    product_rating: p.ratingStar ? parseFloat(p.ratingStar) : null,
                    product_category_ids: p.productCatIds ? JSON.stringify(p.productCatIds) : null,
                    product_shop_id: p.shopId ?? null,
                    product_shop_name: p.shopName || null,
                    product_shop_type: p.shopType ? JSON.stringify(p.shopType) : null,
                    product_fetched_at: new Date().toISOString(),
                });
            }

            // Convert modalCustomFields back to record object
            const customFieldsObj: Record<string, string> = {};
            modalCustomFields.forEach(f => {
                if (f.key.trim()) customFieldsObj[f.key.trim()] = f.value;
            });

            // Merge shop data if available
            if (finalShopData) {
                const s = finalShopData;
                Object.assign(insertPayload, {
                    product_shop_rating: s.ratingStar ? parseFloat(s.ratingStar) : null,
                    product_shop_image_url: s.imageUrl || null,
                });
                if (s.shopName) insertPayload.product_shop_name = s.shopName;
                if (s.shopType) insertPayload.product_shop_type = JSON.stringify(s.shopType);
            }

            const newTrackId = crypto.randomUUID(); // Valid UUID for local and DB use
            const fullPayload = {
                ...insertPayload,
                id: newTrackId,
                custom_fields: customFieldsObj,
                created_at: new Date().toISOString(),
                status: 'rascunho'
            };

            // Optimistic update
            setTracks(prev => [...prev, fullPayload as any]);
            resetModal();
            showToast('Track criado! (Sincronização pendente se offline)');
            handleSelectTrack(fullPayload as any);

            // Queue sync
            await syncService.addToQueue({
                type: 'CREATE_TRACK',
                payload: fullPayload
            });

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
        setModalError(null);
        setModalProductData(null);
        setModalShopData(null);
        setModalFetchingProduct(false);
        setModalProductError(null);
        setModalCustomFields([]);
    };

    const handleModalAddCustomField = () => {
        if (modalCustomFields.length < 10) {
            setModalCustomFields([...modalCustomFields, { key: '', value: '' }]);
        }
    };

    const handleModalRemoveCustomField = (index: number) => {
        setModalCustomFields(modalCustomFields.filter((_, i) => i !== index));
    };

    const handleModalCustomFieldChange = (index: number, field: 'key' | 'value', val: string) => {
        const updated = [...modalCustomFields];
        updated[index][field] = val;
        setModalCustomFields(updated);
    };

    const handleModalAddSubId = () => {
        if (modalSubIds.length < 5) setModalSubIds([...modalSubIds, '']);
    };

    const handleModalRemoveSubId = (index: number) => {
        setModalSubIds(modalSubIds.filter((_, i) => i !== index));
    };

    const handleModalSubIdChange = (index: number, value: string) => {
        const sanitized = value.replace(/[^a-zA-Z0-9]/g, '');
        const updated = [...modalSubIds];
        updated[index] = sanitized;
        setModalSubIds(updated);
    };


    // ========== DELETE TRACK ==========
    const handleDeleteTrack = async (track: Track) => {
        if (!track.is_archived) {
            showToast('Arquive o track antes de excluí-lo permanentemente.', 'info');
            return;
        }

        if (!window.confirm(`ATENÇÃO: Excluir "${track.name}" e todos os seus registros permanentemente? Esta ação NÃO PODE SER DESFEITA e você perderá todo o histórico de métricas.`)) return;
        setSaving(true);
        try {
            // Optimistic 
            const remaining = tracks.filter(t => t.id !== track.id);
            setTracks(remaining);
            if (selectedTrack?.id === track.id) {
                if (remaining.length > 0) handleSelectTrack(remaining[0]);
                else {
                    setSelectedTrack(null);
                    setEntries([]);
                }
            }

            showToast('Track excluído permanentemente!');

            // Queue sync
            await syncService.addToQueue({
                type: 'DELETE_TRACK',
                payload: { id: track.id }
            });
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir track.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== ARCHIVE TRACK ==========
    const handleArchiveTrack = async (track: Track, archive: boolean) => {
        setSaving(true);
        try {
            const updates = { is_archived: archive };
            const updated = { ...track, ...updates };

            // Optimistic
            setTracks(prev => prev.map(t => t.id === track.id ? updated : t));
            if (selectedTrack?.id === track.id) {
                // If archiving the currently selected track, deselect it since it will disappear from the current view
                setSelectedTrack(null);
                setEntries([]);
            }

            showToast(archive ? 'Track arquivado!' : 'Track restaurado!');

            // Queue sync
            await syncService.addToQueue({
                type: 'UPDATE_TRACK',
                payload: { id: track.id, updates }
            });
        } catch (error) {
            console.error(error);
            showToast('Erro ao alterar status de arquivamento.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== UPDATE TRACK ==========
    const handleUpdateTrack = async () => {
        if (!selectedTrack || !editName.trim()) return;
        setSaving(true);
        try {
            const updates = {
                name: editName.trim(),
                affiliate_link: editLink.trim(),
                sub_id: editSubIds.map(s => s.trim()).filter(Boolean).join('-'),
            };

            const updated = { ...selectedTrack, ...updates };

            // Optimistic
            setSelectedTrack(updated);
            setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setEditingTrack(false);
            showToast('Track atualizado localmente!');

            // Queue sync
            await syncService.addToQueue({
                type: 'UPDATE_TRACK',
                payload: { id: selectedTrack.id, updates }
            });
        } catch (error) {
            console.error(error);
            showToast('Erro ao atualizar track.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const [tabCustomFields, setTabCustomFields] = useState<{ key: string; value: string }[]>([]);
    const [editingCustomFields, setEditingCustomFields] = useState(false);

    const handleTabAddCustomField = () => {
        if (tabCustomFields.length < 10) {
            setTabCustomFields([...tabCustomFields, { key: '', value: '' }]);
        }
    };

    const handleTabRemoveCustomField = (index: number) => {
        setTabCustomFields(tabCustomFields.filter((_, i) => i !== index));
    };

    const handleTabCustomFieldChange = (index: number, field: 'key' | 'value', val: string) => {
        const updated = [...tabCustomFields];
        updated[index][field] = val;
        setTabCustomFields(updated);
    };

    const handleUpdateCustomFields = async () => {
        if (!selectedTrack) return;
        setSaving(true);
        try {
            const customFieldsObj: Record<string, string> = {};
            tabCustomFields.forEach(f => {
                if (f.key.trim() && f.value.trim()) {
                    customFieldsObj[f.key.trim()] = f.value.trim();
                }
            });

            const { error } = await supabase
                .from('creative_tracks')
                .update({ custom_fields: customFieldsObj })
                .eq('id', selectedTrack.id);

            if (error) throw error;

            const updated = { ...selectedTrack, custom_fields: customFieldsObj };
            setSelectedTrack(updated);
            setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setEditingCustomFields(false);
            showToast('Campos personalizados salvos!');
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar campos.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ========== UPDATE STATUS ==========
    const handleUpdateStatus = async (track: Track, newStatus: 'ativo' | 'desativado' | 'validado' | 'rascunho') => {
        setSaving(true);
        try {
            const updates = { status: newStatus };
            const updated = { ...track, status: newStatus };

            // Optimistic
            if (selectedTrack?.id === track.id) {
                setSelectedTrack(updated);
            }
            setTracks(prev => prev.map(t => t.id === track.id ? updated : t));
            showToast(`Status atualizado para ${newStatus}!`);

            // Queue sync
            await syncService.addToQueue({
                type: 'UPDATE_TRACK',
                payload: { id: track.id, updates }
            });
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

    // ========== FETCH PRODUCT DATA FOR EXISTING TRACK ==========
    const handleFetchProductData = async () => {
        if (!selectedTrack || !selectedTrack.affiliate_link) {
            setFetchProductError('Este track não possui link de afiliado.');
            return;
        }

        // Get credentials
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
            setFetchProductError('Credenciais da Shopee não configuradas. Vá em Configurações → Shopee API.');
            return;
        }

        setFetchingProductData(true);
        setFetchProductError(null);
        try {
            // 1. Try extracting IDs directly from the affiliate link
            let ids = extractShopeeIds(selectedTrack.affiliate_link);

            // 2. If not a direct product URL, resolve the shortened link
            if (!ids) {
                const resolvedUrl = await resolveShopeeUrl(selectedTrack.affiliate_link);
                ids = extractShopeeIds(resolvedUrl);
            }

            if (!ids) {
                setFetchProductError('Não foi possível extrair dados do produto a partir do link.');
                return;
            }

            // 3. Fetch product data from Shopee API
            const { product, shop } = await fetchShopeeProduct({
                shopId: ids.shopId,
                itemId: ids.itemId,
                shopeeAppId,
                shopeeSecret,
            });

            if (!product) {
                setFetchProductError('Produto não encontrado na Shopee.');
                return;
            }

            const p = product;
            const updatePayload: Record<string, any> = {
                product_item_id: p.itemId ?? null,
                product_name: p.productName || null,
                product_image_url: p.imageUrl || null,
                product_link: p.productLink || null,
                product_offer_link: p.offerLink || null,
                product_price: p.price ? parseFloat(p.price) : null,
                product_price_min: p.priceMin ? parseFloat(p.priceMin) : null,
                product_price_max: p.priceMax ? parseFloat(p.priceMax) : null,
                product_discount_rate: p.priceDiscountRate ?? null,
                product_commission: p.commission ? parseFloat(p.commission) : null,
                product_commission_rate: p.commissionRate ? parseFloat(p.commissionRate) : null,
                product_seller_commission_rate: p.sellerCommissionRate ? parseFloat(p.sellerCommissionRate) : null,
                product_shopee_commission_rate: p.shopeeCommissionRate ? parseFloat(p.shopeeCommissionRate) : null,
                product_sold: p.sales ?? null,
                product_rating: p.ratingStar ? parseFloat(p.ratingStar) : null,
                product_category_ids: p.productCatIds ? JSON.stringify(p.productCatIds) : null,
                product_shop_id: p.shopId ?? null,
                product_shop_name: p.shopName || null,
                product_shop_type: p.shopType ? JSON.stringify(p.shopType) : null,
                product_fetched_at: new Date().toISOString(),
            };

            if (shop) {
                if (shop.ratingStar) updatePayload.product_shop_rating = parseFloat(shop.ratingStar);
                if (shop.imageUrl) updatePayload.product_shop_image_url = shop.imageUrl;
                if (shop.shopName) updatePayload.product_shop_name = shop.shopName;
                if (shop.shopType) updatePayload.product_shop_type = JSON.stringify(shop.shopType);
            }

            const { error } = await supabase
                .from('creative_tracks')
                .update(updatePayload)
                .eq('id', selectedTrack.id);

            if (error) throw error;

            const updated = { ...selectedTrack, ...updatePayload } as Track;
            setSelectedTrack(updated);
            setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setProductForm({
                price: updated.product_price?.toString() || '',
                shipping: updated.product_shipping?.toString() || '',
                free_shipping: !!updated.product_free_shipping,
                reviews: updated.product_reviews?.toString() || '',
                sold: updated.product_sold?.toString() || '',
                rating: updated.product_rating?.toString() || ''
            });
            showToast('Dados do produto atualizados com sucesso!');
        } catch (err: any) {
            console.error('Fetch product error:', err);
            setFetchProductError(err.message || 'Erro ao buscar dados do produto.');
        } finally {
            setFetchingProductData(false);
        }
    };

    // ========== SELECT TRACK ==========
    const handleSelectTrack = async (track: Track) => {
        setSelectedTrack(track);
        setEditingTrack(false);
        if (viewMode === 'kanban') {
            setShowKanbanModal(true);
        }
        setEntryForm({ ...emptyEntryForm });
        setShowFunnelPicker(false);
        setEditingProduct(false);
        setFetchProductError(null);
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
        fetchFbMetrics(track.id);
        // Fetch Shopee conversions
        fetchShopeeConversions(track.id);
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
                // Fetch missing link if applicable
                if (!linkedAd.ad_link) {
                    try {
                        const adRes = await fetch(`https://graph.facebook.com/v21.0/${linkedAd.ad_id}?access_token=${encodeURIComponent(fbToken)}&fields=creative{object_story_spec,asset_feed_spec,call_to_action}`);
                        const adData = await adRes.json();
                        const extracted_link = extractFbAdLink(adData.creative);
                        if (extracted_link) {
                            await supabase.from('creative_track_fb_ads').update({ ad_link: extracted_link }).eq('id', linkedAd.id);
                            linkedAd.ad_link = extracted_link; // optimistically update local state
                        }
                    } catch (e) {
                        console.error('Error fetching missing ad_link:', e);
                    }
                }

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
                    `&fields=inline_link_clicks,cost_per_inline_link_click,spend,impressions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p95_watched_actions` +
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
                    clicks: parseInt(day.inline_link_clicks) || 0,
                    cpc: parseFloat(day.cost_per_inline_link_click) || 0,
                    spend: parseFloat(day.spend) || 0,
                    impressions: parseInt(day.impressions) || 0,
                    video_thruplay: parseInt(day.video_thruplay_watched_actions?.[0]?.value) || 0,
                    video_p25: parseInt(day.video_p25_watched_actions?.[0]?.value) || 0,
                    video_p50: parseInt(day.video_p50_watched_actions?.[0]?.value) || 0,
                    video_p95: parseInt(day.video_p95_watched_actions?.[0]?.value) || 0,
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

            // Refresh fb_metrics for video KPIs
            if (selectedTrack) fetchFbMetrics(selectedTrack.id);
        } catch (error: any) {
            console.error(error);
            showToast(`Erro na sincronização: ${error.message}`, 'error');
        } finally {
            setSyncingFb(false);
        }
    };



    // ========== SHOPEE CONVERSION HELPERS ==========
    const getShopeeCredentials = async () => {
        try {
            const { data: creds, error } = await supabase.rpc('get_shopee_credentials');
            if (error) throw error;
            if (creds && creds.length > 0) {
                return { shopeeAppId: creds[0].shopee_app_id as string, shopeeSecret: creds[0].shopee_secret as string };
            }
        } catch (err) {
            console.error('Error fetching Shopee credentials:', err);
        }
        return null;
    };

    const fetchShopeeConversions = async (trackId: string) => {
        const { data } = await supabase
            .from('shopee_conversions')
            .select('*')
            .eq('track_id', trackId)
            .order('purchase_time', { ascending: false });
        setShopeeConversions(data || []);
        return data || [];
    };

    const syncEntriesFromConversions = async (trackId: string, allConversions: ShopeeConversion[]) => {
        if (!allConversions || allConversions.length === 0) return;

        const dateMap = new Map<string, { orders: Set<string>, commission: number }>();
        for (const row of allConversions) {
            if (!row.purchase_time || row.conversion_status === 'CANCELLED') continue;
            const date = format(new Date(row.purchase_time), 'yyyy-MM-dd');
            if (!dateMap.has(date)) {
                dateMap.set(date, { orders: new Set(), commission: 0 });
            }
            const data = dateMap.get(date)!;
            if (row.order_id) data.orders.add(row.order_id);
            data.commission += (row.item_total_commission || 0);
        }

        const datesToUpdate = Array.from(dateMap.keys());
        if (datesToUpdate.length === 0) return;

        const { data: existingEntries } = await supabase
            .from('creative_track_entries')
            .select('*')
            .eq('track_id', trackId)
            .in('date', datesToUpdate);

        const entriesUpsert = datesToUpdate.map(date => {
            const agg = dateMap.get(date)!;
            const existing = existingEntries?.find((e: any) => e.date === date);
            const entry: any = {
                track_id: trackId,
                date: date,
                orders: agg.orders.size,
                commission_value: agg.commission,
                ad_clicks: existing?.ad_clicks ?? 0,
                shopee_clicks: existing?.shopee_clicks ?? 0,
                cpc: existing?.cpc ?? 0,
                investment: existing?.investment ?? 0,
            };
            if (existing?.id) {
                entry.id = existing.id;
            }
            return entry;
        });

        await supabase
            .from('creative_track_entries')
            .upsert(entriesUpsert, { onConflict: 'track_id,date' });

        await fetchAllEntries();
        await fetchAllUserConversions();
    };

    // ========== SYNC CONVERSIONS ==========
    const handleSyncConversions = async () => {
        if (!selectedTrack) return;
        const creds = await getShopeeCredentials();
        if (!creds) {
            showToast('Credenciais da Shopee não configuradas.', 'error');
            return;
        }

        setSyncingConversions(true);
        try {
            const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
            const allNodes: any[] = [];
            let hasNext = true;
            let scrollId: string | undefined = undefined;
            while (hasNext) {
                const res: any = await fetchConversionReport({
                    ...creds,
                    purchaseTimeStart: thirtyDaysAgo,
                    limit: 100,
                    scrollId,
                });
                allNodes.push(...res.nodes);
                hasNext = res.hasNextPage;
                scrollId = res.scrollId;
                if (allNodes.length > 1000) break;
            }
            const nodes = allNodes;

            // Denormalize nodes → flat rows per item
            const rows: any[] = [];
            for (const node of nodes) {
                for (const order of (node.orders || [])) {
                    for (const item of (order.items || [])) {
                        // Match by itemId OR utmContent (normalize separators for comparison)
                        const matchByItem = selectedTrack.product_item_id && item.itemId && Number(item.itemId) === Number(selectedTrack.product_item_id);
                        const normTrackSubId = selectedTrack.sub_id ? selectedTrack.sub_id.replace(/[-,\s]+/g, '').toLowerCase() : '';
                        const normUtm = node.utmContent ? node.utmContent.replace(/[-,\s]+/g, '').toLowerCase() : '';
                        const matchByUtm = normTrackSubId && normUtm && normUtm.includes(normTrackSubId);
                        if (!matchByItem && !matchByUtm) continue;

                        rows.push({
                            track_id: selectedTrack.id,
                            user_id: user!.id,
                            conversion_id: node.conversionId || `${node.checkoutId}-${item.itemId}`,
                            click_time: node.clickTime ? new Date(node.clickTime * 1000).toISOString() : null,
                            purchase_time: node.purchaseTime ? new Date(node.purchaseTime * 1000).toISOString() : null,
                            conversion_status: node.conversionStatus || null,
                            checkout_id: node.checkoutId || null,
                            gross_commission: node.grossCommission || 0,
                            capped_commission: node.cappedCommission || 0,
                            total_brand_commission: node.totalBrandCommission || 0,
                            estimated_total_commission: node.estimatedTotalCommission || 0,
                            net_commission: node.netCommission || 0,
                            total_commission: node.totalCommission || 0,
                            seller_commission: node.sellerCommission || 0,
                            shopee_commission: node.shopeeCommissionCapped || 0,
                            mcn_management_fee_rate: node.mcnManagementFeeRate != null ? String(node.mcnManagementFeeRate) : null,
                            mcn_management_fee: node.mcnManagementFee || 0,
                            mcn_contract_id: node.mcnContractId || null,
                            linked_mcn_name: node.linkedMcnName || null,
                            buyer_type: node.buyerType || null,
                            device: node.device || null,
                            utm_content: node.utmContent || null,
                            referrer: node.referrer || null,
                            product_type: node.productType || null,
                            order_id: order.orderId || null,
                            order_status: order.orderStatus || null,
                            shop_type: order.shopType || null,
                            shop_id: item.shopId || null,
                            complete_time: item.completeTime ? new Date(item.completeTime * 1000).toISOString() : null,
                            promotion_id: item.promotionId ? String(item.promotionId) : null,
                            model_id: item.modelId || null,
                            item_id: item.itemId || null,
                            item_name: item.itemName || null,
                            item_price: item.itemPrice || null,
                            qty: item.qty || 1,
                            actual_amount: item.actualAmount || null,
                            refund_amount: item.refundAmount || null,
                            image_url: item.imageUrl || null,
                            item_commission: item.itemCommission || 0,
                            gross_brand_commission: item.grossBrandCommission || 0,
                            item_total_commission: item.itemTotalCommission || 0,
                            item_seller_commission: item.itemSellerCommission || 0,
                            item_seller_commission_rate: item.itemSellerCommissionRate ? parseFloat(String(item.itemSellerCommissionRate).replace('%', '')) : null,
                            item_shopee_commission: item.itemShopeeCommissionCapped || 0,
                            item_shopee_commission_rate: item.itemShopeeCommissionRate ? parseFloat(String(item.itemShopeeCommissionRate).replace('%', '')) : null,
                            display_item_status: item.displayItemStatus || null,
                            item_notes: item.itemNotes || null,
                            attribution_type: item.attributionType || null,
                            channel_type: item.channelType || null,
                            campaign_type: item.campaignType || null,
                            campaign_partner_name: item.campaignPartnerName || null,
                            category_lv1_name: item.categoryLv1Name || null,
                            category_lv2_name: item.categoryLv2Name || null,
                            category_lv3_name: item.categoryLv3Name || null,
                            global_category_lv1: item.globalCategoryLv1Name || null,
                            global_category_lv2: item.globalCategoryLv2Name || null,
                            global_category_lv3: item.globalCategoryLv3Name || null,
                            fraud_status: item.fraudStatus || null,
                            fraud_reason: item.fraudReason || null,
                            is_validated: false,
                            synced_at: new Date().toISOString(),
                        });
                    }
                }
            }

            if (rows.length === 0) {
                showToast(`Nenhuma conversão encontrada para este track nos últimos 30 dias. (${nodes.length} conversões totais na conta)`, 'info');
            } else {
                const { error } = await supabase
                    .from('shopee_conversions')
                    .upsert(rows, { onConflict: 'user_id,conversion_id,item_id' });
                if (error) throw error;
                showToast(`${rows.length} conversão(ões) sincronizada(s)!`);
            }

            const freshConversions = await fetchShopeeConversions(selectedTrack.id);
            await syncEntriesFromConversions(selectedTrack.id, freshConversions);
        } catch (err: any) {
            console.error('Sync conversions error:', err);
            showToast(err.message || 'Erro ao sincronizar conversões.', 'error');
        } finally {
            setSyncingConversions(false);
        }
    };

    // ========== SYNC VALIDATED ==========
    // Uses conversionReport with conversionStatus filter (validatedReport requires validationId which we don't have)
    const handleSyncValidated = async () => {
        if (!selectedTrack) return;
        const creds = await getShopeeCredentials();
        if (!creds) {
            showToast('Credenciais da Shopee não configuradas.', 'error');
            return;
        }

        setSyncingValidated(true);
        try {
            const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
            const allNodes: any[] = [];
            let hasNext = true;
            let scrollId: string | undefined = undefined;
            while (hasNext) {
                const res: any = await fetchConversionReport({
                    ...creds,
                    purchaseTimeStart: thirtyDaysAgo,
                    limit: 100,
                    scrollId,
                });
                allNodes.push(...res.nodes);
                hasNext = res.hasNextPage;
                scrollId = res.scrollId;
                if (allNodes.length > 1000) break;
            }

            // Filter only validated/paid conversions
            const validatedStatuses = ['PAID', 'COMPLETED', 'SETTLED'];
            const nodes = allNodes.filter(n => validatedStatuses.includes(n.conversionStatus));

            const rows: any[] = [];
            for (const node of nodes) {
                for (const order of (node.orders || [])) {
                    for (const item of (order.items || [])) {
                        const matchByItem = selectedTrack.product_item_id && item.itemId && Number(item.itemId) === Number(selectedTrack.product_item_id);
                        const matchByUtm = selectedTrack.sub_id && node.utmContent && node.utmContent.includes(selectedTrack.sub_id);
                        if (!matchByItem && !matchByUtm) continue;

                        rows.push({
                            track_id: selectedTrack.id,
                            user_id: user!.id,
                            conversion_id: node.conversionId || `validated-${order.orderId}-${item.itemId}`,
                            click_time: node.clickTime ? new Date(node.clickTime * 1000).toISOString() : null,
                            purchase_time: node.purchaseTime ? new Date(node.purchaseTime * 1000).toISOString() : null,
                            conversion_status: node.conversionStatus || 'COMPLETED',
                            checkout_id: node.checkoutId || null,
                            gross_commission: node.grossCommission || 0,
                            capped_commission: node.cappedCommission || 0,
                            total_brand_commission: node.totalBrandCommission || 0,
                            estimated_total_commission: node.estimatedTotalCommission || 0,
                            net_commission: node.netCommission || 0,
                            total_commission: node.totalCommission || 0,
                            seller_commission: node.sellerCommission || 0,
                            shopee_commission: node.shopeeCommissionCapped || 0,
                            mcn_management_fee_rate: node.mcnManagementFeeRate != null ? String(node.mcnManagementFeeRate) : null,
                            mcn_management_fee: node.mcnManagementFee || 0,
                            mcn_contract_id: node.mcnContractId || null,
                            linked_mcn_name: node.linkedMcnName || null,
                            buyer_type: node.buyerType || null,
                            device: node.device || null,
                            utm_content: node.utmContent || null,
                            referrer: node.referrer || null,
                            product_type: node.productType || null,
                            order_id: order.orderId || null,
                            order_status: order.orderStatus || null,
                            shop_type: order.shopType || null,
                            shop_id: item.shopId || null,
                            complete_time: item.completeTime ? new Date(item.completeTime * 1000).toISOString() : null,
                            promotion_id: item.promotionId ? String(item.promotionId) : null,
                            model_id: item.modelId || null,
                            item_id: item.itemId || null,
                            item_name: item.itemName || null,
                            item_price: item.itemPrice || null,
                            qty: item.qty || 1,
                            actual_amount: item.actualAmount || null,
                            refund_amount: item.refundAmount || null,
                            image_url: item.imageUrl || null,
                            item_commission: item.itemCommission || 0,
                            gross_brand_commission: item.grossBrandCommission || 0,
                            item_total_commission: item.itemTotalCommission || 0,
                            item_seller_commission: item.itemSellerCommission || 0,
                            item_seller_commission_rate: item.itemSellerCommissionRate ? parseFloat(String(item.itemSellerCommissionRate).replace('%', '')) : null,
                            item_shopee_commission: item.itemShopeeCommissionCapped || 0,
                            item_shopee_commission_rate: item.itemShopeeCommissionRate ? parseFloat(String(item.itemShopeeCommissionRate).replace('%', '')) : null,
                            display_item_status: item.displayItemStatus || null,
                            item_notes: item.itemNotes || null,
                            attribution_type: item.attributionType || null,
                            channel_type: item.channelType || null,
                            campaign_type: item.campaignType || null,
                            campaign_partner_name: item.campaignPartnerName || null,
                            category_lv1_name: item.categoryLv1Name || null,
                            category_lv2_name: item.categoryLv2Name || null,
                            category_lv3_name: item.categoryLv3Name || null,
                            global_category_lv1: item.globalCategoryLv1Name || null,
                            global_category_lv2: item.globalCategoryLv2Name || null,
                            global_category_lv3: item.globalCategoryLv3Name || null,
                            fraud_status: item.fraudStatus || null,
                            fraud_reason: item.fraudReason || null,
                            is_validated: true,
                            synced_at: new Date().toISOString(),
                        });
                    }
                }
            }

            if (rows.length === 0) {
                showToast(`Nenhuma conversão validada encontrada para este track. (${allNodes.length} conversões totais, ${nodes.length} validadas)`, 'info');
            } else {
                const { error } = await supabase
                    .from('shopee_conversions')
                    .upsert(rows, { onConflict: 'user_id,conversion_id,item_id' });
                if (error) throw error;
                showToast(`${rows.length} conversão(ões) validada(s) sincronizada(s)!`);
            }

            const freshConversions = await fetchShopeeConversions(selectedTrack.id);
            await syncEntriesFromConversions(selectedTrack.id, freshConversions);
        } catch (err: any) {
            console.error('Sync validated error:', err);
            showToast(err.message || 'Erro ao sincronizar validadas.', 'error');
        } finally {
            setSyncingValidated(false);
        }
    };

    // ========== ADD/UPSERT ENTRY ==========

    // ========== GLOBAL SYNC ==========
    const handleGlobalSync = async (mode: 'all' | 'meta' | 'shopee') => {
        setIsGlobalSyncing(true);
        setShowGlobalSyncMenu(false);
        try {
            const globalEntriesMap = new Map<string, {
                ad_clicks?: number;
                shopee_clicks?: number;
                cpc?: number;
                orders?: number;
                commission_value?: number;
                investment?: number;
                orderIds?: Set<string>;
                clickIds?: Set<string>;
            }>();

            // 1. Process Shopee Data
            if (mode === 'all' || mode === 'shopee') {
                const creds = await getShopeeCredentials();
                if (!creds) {
                    showToast('Credenciais da Shopee não configuradas.', 'error');
                } else {
                    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
                    showToast('Buscando dados globais da Shopee...', 'info');

                    // Fetch all conversions (conversionReport has all data including status)
                    const allNodes: any[] = [];
                    let hasNext = true;
                    let scrollId: string | undefined = undefined;
                    while (hasNext) {
                        const res: any = await fetchConversionReport({ ...creds, purchaseTimeStart: thirtyDaysAgo, limit: 100, scrollId });
                        allNodes.push(...res.nodes);
                        hasNext = res.hasNextPage;
                        scrollId = res.scrollId;
                        if (allNodes.length > 1000) break;
                    }

                    const shopeeRowsMap = new Map<string, any>();
                    let unmatchedCount = 0;

                    for (const node of allNodes) {
                        if (!node.orders) continue;

                        for (const order of node.orders) {
                            if (!order.items) continue;
                            for (const item of order.items) {
                                // Match by product_item_id OR sub_id in utmContent (normalize separators)
                                const normUtmContent = node.utmContent ? node.utmContent.replace(/[-,\s]+/g, '').toLowerCase() : '';
                                const matchedTrack = tracks.find(t => {
                                    if (t.product_item_id && item.itemId && Number(item.itemId) === Number(t.product_item_id)) return true;
                                    if (!t.sub_id || !normUtmContent) return false;
                                    const normTSub = t.sub_id.replace(/[-,\s]+/g, '').toLowerCase();
                                    return normUtmContent.includes(normTSub);
                                });

                                const conversionId = node.conversionId || `${node.checkoutId || 'unknown'}-${item.itemId}`;
                                const trackId = matchedTrack?.id || null;
                                const rowKey = trackId ? `${trackId}_${conversionId}_${item.itemId}` : `unmatched_${conversionId}_${item.itemId}`;
                                if (!matchedTrack) unmatchedCount++;

                                // Determine validation from conversionStatus
                                const status = node.conversionStatus || '';
                                const isValidated = status === 'PAID' || status === 'COMPLETED' || status === 'SETTLED';

                                shopeeRowsMap.set(rowKey, {
                                    track_id: trackId,
                                    user_id: user!.id,
                                    conversion_id: conversionId,
                                    click_time: node.clickTime ? new Date(node.clickTime * 1000).toISOString() : null,
                                    purchase_time: node.purchaseTime ? new Date(node.purchaseTime * 1000).toISOString() : null,
                                    conversion_status: node.conversionStatus || null,
                                    checkout_id: node.checkoutId || null,
                                    gross_commission: node.grossCommission || 0,
                                    capped_commission: node.cappedCommission || 0,
                                    total_brand_commission: node.totalBrandCommission || 0,
                                    estimated_total_commission: node.estimatedTotalCommission || 0,
                                    net_commission: node.netCommission || 0,
                                    total_commission: node.totalCommission || 0,
                                    seller_commission: node.sellerCommission || 0,
                                    shopee_commission: node.shopeeCommissionCapped || 0,
                                    mcn_management_fee_rate: node.mcnManagementFeeRate != null ? String(node.mcnManagementFeeRate) : null,
                                    mcn_management_fee: node.mcnManagementFee || 0,
                                    mcn_contract_id: node.mcnContractId || null,
                                    linked_mcn_name: node.linkedMcnName || null,
                                    buyer_type: node.buyerType || null,
                                    device: node.device || null,
                                    utm_content: node.utmContent || null,
                                    referrer: node.referrer || null,
                                    product_type: node.productType || null,
                                    order_id: order.orderId || null,
                                    order_status: order.orderStatus || null,
                                    shop_type: order.shopType || null,
                                    shop_id: item.shopId || null,
                                    complete_time: item.completeTime ? new Date(item.completeTime * 1000).toISOString() : null,
                                    promotion_id: item.promotionId ? String(item.promotionId) : null,
                                    model_id: item.modelId || null,
                                    item_id: item.itemId || null,
                                    item_name: item.itemName || null,
                                    item_price: item.itemPrice || null,
                                    qty: item.qty || 1,
                                    actual_amount: item.actualAmount || null,
                                    refund_amount: item.refundAmount || null,
                                    image_url: item.imageUrl || null,
                                    item_commission: item.itemCommission || 0,
                                    gross_brand_commission: item.grossBrandCommission || 0,
                                    item_total_commission: item.itemTotalCommission || 0,
                                    item_seller_commission: item.itemSellerCommission || 0,
                                    item_seller_commission_rate: item.itemSellerCommissionRate ? parseFloat(String(item.itemSellerCommissionRate).replace('%', '')) : null,
                                    item_shopee_commission: item.itemShopeeCommissionCapped || 0,
                                    item_shopee_commission_rate: item.itemShopeeCommissionRate ? parseFloat(String(item.itemShopeeCommissionRate).replace('%', '')) : null,
                                    display_item_status: item.displayItemStatus || null,
                                    item_notes: item.itemNotes || null,
                                    attribution_type: item.attributionType || null,
                                    channel_type: item.channelType || null,
                                    campaign_type: item.campaignType || null,
                                    campaign_partner_name: item.campaignPartnerName || null,
                                    category_lv1_name: item.categoryLv1Name || null,
                                    category_lv2_name: item.categoryLv2Name || null,
                                    category_lv3_name: item.categoryLv3Name || null,
                                    global_category_lv1: item.globalCategoryLv1Name || null,
                                    global_category_lv2: item.globalCategoryLv2Name || null,
                                    global_category_lv3: item.globalCategoryLv3Name || null,
                                    fraud_status: item.fraudStatus || null,
                                    fraud_reason: item.fraudReason || null,
                                    is_validated: isValidated,
                                    synced_at: new Date().toISOString(),
                                });

                                // Aggregate for entries only for matched tracks (use purchaseTime for date)
                                if (matchedTrack) {
                                    const orderStatus = order.orderStatus || node.conversionStatus || '';
                                    if (node.purchaseTime && orderStatus !== 'CANCELLED') {
                                        const dateStr = format(new Date(node.purchaseTime * 1000), 'yyyy-MM-dd');
                                        const aggKey = `${matchedTrack.id}_${dateStr}`;
                                        const curr = globalEntriesMap.get(aggKey) || { orderIds: new Set(), clickIds: new Set(), commission_value: 0, shopee_clicks: 0 };
                                        if (order.orderId) curr.orderIds!.add(order.orderId);
                                        curr.commission_value = (curr.commission_value || 0) + (Number(item.itemTotalCommission) || 0);
                                        globalEntriesMap.set(aggKey, curr);
                                    }

                                    // Count shopee clicks (unique clicks per day per track)
                                    if (node.clickTime) {
                                        const clickDateStr = format(new Date(node.clickTime * 1000), 'yyyy-MM-dd');
                                        const clickAggKey = `${matchedTrack.id}_${clickDateStr}`;
                                        const clickCurr = globalEntriesMap.get(clickAggKey) || { orderIds: new Set(), clickIds: new Set(), commission_value: 0, shopee_clicks: 0 };
                                        const clickUniqueId = `${node.conversionId || node.checkoutId}_${node.clickTime}`;
                                        clickCurr.clickIds!.add(clickUniqueId);
                                        clickCurr.shopee_clicks = clickCurr.clickIds!.size;
                                        globalEntriesMap.set(clickAggKey, clickCurr);
                                    }
                                }
                            }
                        }
                    }

                    const rows = Array.from(shopeeRowsMap.values());
                    if (rows.length > 0) {
                        // Upsert ALL rows (matched + unmatched) using user_id-based unique constraint
                        const batchSize = 100;
                        for (let i = 0; i < rows.length; i += batchSize) {
                            const batch = rows.slice(i, i + batchSize);
                            const { error } = await supabase.from('shopee_conversions').upsert(batch, { onConflict: 'user_id,conversion_id,item_id' });
                            if (error) throw error;
                        }
                    }

                    const matchedCount = rows.length - unmatchedCount;
                    console.log(`[Global Sync] Shopee: ${allNodes.length} conversões encontradas, ${matchedCount} vinculadas a tracks, ${unmatchedCount} sem track (salvas para análise)`);
                }
            }

            // 2. Process Meta Data
            if ((mode === 'all' || mode === 'meta') && tracks.length > 0) {
                if (!fbToken) {
                    showToast('Token do Facebook não configurado.', 'error');
                } else {
                    showToast('Buscando dados globais do Facebook...', 'info');
                    const { data: allLinkedAds } = await supabase.from('creative_track_fb_ads').select('*');

                    if (allLinkedAds && allLinkedAds.length > 0) {
                        const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
                        const today = format(new Date(), 'yyyy-MM-dd');

                        const batchSize = 5;
                        for (let i = 0; i < allLinkedAds.length; i += batchSize) {
                            const batch = allLinkedAds.slice(i, i + batchSize);
                            await Promise.all(batch.map(async (linkedAd) => {
                                try {
                                    const insightsRes = await fetch(
                                        `https://graph.facebook.com/v21.0/${linkedAd.ad_id}/insights?access_token=${encodeURIComponent(fbToken)}&fields=inline_link_clicks,cost_per_inline_link_click,spend,impressions&time_range={"since":"${thirtyDaysAgo}","until":"${today}"}&time_increment=1&limit=500`
                                    );
                                    const insightsData = await insightsRes.json();
                                    if (!insightsData.data || insightsData.data.length === 0) return;

                                    const metricsRows = insightsData.data.map((day: any) => ({
                                        track_id: linkedAd.track_id,
                                        ad_id: linkedAd.ad_id,
                                        date: day.date_start,
                                        clicks: parseInt(day.inline_link_clicks) || 0,
                                        cpc: parseFloat(day.cost_per_inline_link_click) || 0,
                                        spend: parseFloat(day.spend) || 0,
                                        impressions: parseInt(day.impressions) || 0,
                                    }));

                                    await supabase.from('creative_track_fb_metrics').upsert(metricsRows, { onConflict: 'track_id,ad_id,date' });

                                    for (const row of metricsRows) {
                                        const aggKey = `${row.track_id}_${row.date}`;
                                        const curr = globalEntriesMap.get(aggKey) || {};
                                        curr.ad_clicks = (curr.ad_clicks || 0) + row.clicks;
                                        curr.investment = (curr.investment || 0) + row.spend;
                                        globalEntriesMap.set(aggKey, curr);
                                    }
                                } catch (e) { /* ignore */ }
                            }));
                        }
                    }
                }
            }

            // 3. Final Unified Entries Upsert
            if (globalEntriesMap.size > 0) {
                const keys = Array.from(globalEntriesMap.keys());
                const updateTrackIds = [...new Set(keys.map(k => k.split('_')[0]))];
                const updateDates = [...new Set(keys.map(k => k.split('_')[1]))];

                const { data: existingEntries } = await supabase
                    .from('creative_track_entries')
                    .select('*')
                    .in('track_id', updateTrackIds)
                    .in('date', updateDates);

                const finalUpsertData = keys.map(key => {
                    const [trackId, date] = key.split('_');
                    const agg = globalEntriesMap.get(key)!;
                    const existing = existingEntries?.find(e => e.track_id === trackId && e.date === date);

                    const ordersVal = agg.orderIds && agg.orderIds.size > 0 ? agg.orderIds.size : (existing?.orders ?? 0);
                    const commRaw = agg.commission_value !== undefined && Number(agg.commission_value) > 0 ? Number(agg.commission_value) : Number(existing?.commission_value ?? 0);
                    const commVal = Number.isFinite(commRaw) ? commRaw : 0;
                    const clicksVal = agg.ad_clicks !== undefined ? agg.ad_clicks : (existing?.ad_clicks ?? 0);
                    const investVal = agg.investment !== undefined ? Number(agg.investment) : Number(existing?.investment ?? 0);
                    const shopeeClicksVal = agg.shopee_clicks !== undefined && agg.shopee_clicks > 0 ? agg.shopee_clicks : (existing?.shopee_clicks ?? 0);

                    const calculatedCpc = (clicksVal > 0 && investVal > 0) ? investVal / clicksVal : 0;

                    return {
                        track_id: trackId,
                        date,
                        orders: ordersVal,
                        commission_value: Number.isFinite(commVal) ? Math.round(commVal * 100) / 100 : 0,
                        ad_clicks: clicksVal,
                        investment: Number.isFinite(investVal) ? Math.round(investVal * 100) / 100 : 0,
                        shopee_clicks: shopeeClicksVal,
                        cpc: Number.isFinite(calculatedCpc) ? Math.round(calculatedCpc * 10000) / 10000 : 0
                    };
                });

                if (finalUpsertData.length > 0) {
                    const { error: upsertError } = await supabase.from('creative_track_entries').upsert(finalUpsertData, { onConflict: 'track_id,date' });
                    if (upsertError) throw upsertError;
                }
            }

            await fetchAllEntries();
            await fetchAllUserConversions();
            if (selectedTrack) {
                const { data: trackEntries } = await supabase.from('creative_track_entries').select('*').eq('track_id', selectedTrack.id).order('date', { ascending: false });
                setEntries(trackEntries || []);
                fetchShopeeConversions(selectedTrack.id);
                fetchFbMetrics(selectedTrack.id);
            }

            showToast('Sincronização global concluída!', 'success');
        } catch (err: any) {
            console.error('Global sync error:', err);
            showToast(`Erro na sincronização: ${err.message || 'Consulte o console'}`, 'error');
        } finally {
            setIsGlobalSyncing(false);
        }
    };

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

    // ========== FILTERED DATA ==========
    const filteredEntries = useMemo(() => {
        if (!entries.length) return [];
        if (dateFilter === 'all') return entries;

        const now = new Date();
        let start: Date = new Date(0);
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today':
                start = startOfDay(now);
                break;
            case 'yesterday':
                start = startOfDay(subDays(now, 1));
                end = endOfDay(subDays(now, 1));
                break;
            case 'anteontem':
                start = startOfDay(subDays(now, 2));
                end = endOfDay(subDays(now, 2));
                break;
            case '7days':
                start = startOfDay(subDays(now, 7));
                break;
            case '30days':
                start = startOfDay(subDays(now, 30));
                break;
            case 'custom':
                if (customRange?.start) start = startOfDay(new Date(customRange.start));
                if (customRange?.end) end = endOfDay(new Date(customRange.end));
                break;
            default:
                return entries;
        }

        return entries.filter(item => {
            const dateObj = new Date(item.date + 'T00:00:00');
            if (isNaN(dateObj.getTime())) return true;
            return isWithinInterval(dateObj, { start, end });
        });
    }, [user?.id, dateFilter, customRange]);

    const filteredAllEntries = useMemo(() => {
        if (!allEntries.length) return [];
        if (dateFilter === 'all') return allEntries;

        const now = new Date();
        let start: Date = new Date(0);
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today':
                start = startOfDay(now);
                break;
            case 'yesterday':
                start = startOfDay(subDays(now, 1));
                end = endOfDay(subDays(now, 1));
                break;
            case 'anteontem':
                start = startOfDay(subDays(now, 2));
                end = endOfDay(subDays(now, 2));
                break;
            case '7days':
                start = startOfDay(subDays(now, 7));
                break;
            case '30days':
                start = startOfDay(subDays(now, 30));
                break;
            case 'custom':
                if (customRange?.start) start = startOfDay(new Date(customRange.start));
                if (customRange?.end) end = endOfDay(new Date(customRange.end));
                break;
            default:
                return allEntries;
        }

        return allEntries.filter(item => {
            const dateObj = new Date(item.date + 'T00:00:00');
            if (isNaN(dateObj.getTime())) return true;
            return isWithinInterval(dateObj, { start, end });
        });
    }, [allEntries, dateFilter, customRange]);

    // Unmatched conversions (track_id is null) filtered by date
    const filteredUnmatchedConversions = useMemo(() => {
        const unmatched = allUserConversions.filter(c => !c.track_id);
        if (!unmatched.length) return [];
        if (dateFilter === 'all') return unmatched;

        const now = new Date();
        let start: Date = new Date(0);
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today': start = startOfDay(now); break;
            case 'yesterday': start = startOfDay(subDays(now, 1)); end = endOfDay(subDays(now, 1)); break;
            case 'anteontem': start = startOfDay(subDays(now, 2)); end = endOfDay(subDays(now, 2)); break;
            case '7days': start = startOfDay(subDays(now, 7)); break;
            case '30days': start = startOfDay(subDays(now, 30)); break;
            case 'custom':
                if (customRange?.start) start = startOfDay(new Date(customRange.start));
                if (customRange?.end) end = endOfDay(new Date(customRange.end));
                break;
            default: return unmatched;
        }

        return unmatched.filter(c => {
            if (!c.purchase_time) return false;
            const dateObj = new Date(c.purchase_time);
            if (isNaN(dateObj.getTime())) return false;
            return isWithinInterval(dateObj, { start, end });
        });
    }, [allUserConversions, dateFilter, customRange]);

    const filteredConversions = useMemo(() => {
        if (!shopeeConversions.length) return [];
        if (dateFilter === 'all') return shopeeConversions;

        const now = new Date();
        let start: Date = new Date(0);
        let end: Date = endOfDay(now);

        switch (dateFilter) {
            case 'today':
                start = startOfDay(now);
                break;
            case 'yesterday':
                start = startOfDay(subDays(now, 1));
                end = endOfDay(subDays(now, 1));
                break;
            case 'anteontem':
                start = startOfDay(subDays(now, 2));
                end = endOfDay(subDays(now, 2));
                break;
            case '7days':
                start = startOfDay(subDays(now, 7));
                break;
            case '30days':
                start = startOfDay(subDays(now, 30));
                break;
            case 'custom':
                if (customRange?.start) start = startOfDay(new Date(customRange.start));
                if (customRange?.end) end = endOfDay(new Date(customRange.end));
                break;
            default:
                return shopeeConversions;
        }

        return shopeeConversions.filter(item => {
            if (!item.purchase_time) return true;
            const dateObj = new Date(item.purchase_time);
            if (isNaN(dateObj.getTime())) return true;
            return isWithinInterval(dateObj, { start, end });
        });
    }, [shopeeConversions, dateFilter, customRange]);

    // ========== COMPUTED KPIs ==========
    const kpis = useMemo(() => {
        if (filteredEntries.length === 0) return null;
        const totalCommission = filteredEntries.reduce((s, e) => s + Number(e.commission_value), 0);
        const totalInvestment = filteredEntries.reduce((s, e) => s + Number(e.investment), 0);
        const totalOrders = filteredEntries.reduce((s, e) => s + Number(e.orders), 0);
        const totalShopeeClicks = filteredEntries.reduce((s, e) => s + Number(e.shopee_clicks), 0);
        const totalAdClicks = filteredEntries.reduce((s, e) => s + Number(e.ad_clicks), 0);
        const totalProfit = totalCommission - totalInvestment;

        // Status-based KPIs for specific track
        const completedConversions = filteredConversions.filter(c => ['PAID', 'COMPLETED', 'SETTLED'].includes(c.conversion_status || ''));
        const pendingConversions = filteredConversions.filter(c => c.conversion_status === 'PENDING');
        const cancelledConversions = filteredConversions.filter(c => c.conversion_status === 'CANCELLED');

        const completedOrders = new Set(completedConversions.map(c => c.order_id || c.conversion_id)).size;
        const pendingOrders = new Set(pendingConversions.map(c => c.order_id || c.conversion_id)).size;
        const cancelledOrders = new Set(cancelledConversions.map(c => c.order_id || c.conversion_id)).size;

        const completedValue = completedConversions.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);
        const pendingValue = pendingConversions.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);
        const cancelledValue = cancelledConversions.reduce((s, c) => {
            const potentialComm = Number(c.refund_amount || 0) * ((Number(c.item_seller_commission_rate || 0) + Number(c.item_shopee_commission_rate || 0)) / 100);
            return s + (Number(c.item_total_commission) || potentialComm);
        }, 0);

        const totalCpc = totalAdClicks > 0 ? totalInvestment / totalAdClicks : 0;
        const avgOrdersPerDay = filteredEntries.length > 0 ? totalOrders / filteredEntries.length : 0;
        const profitPct = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

        // Sales attribution Breakdown (Specific Track)
        const trackedConvs = filteredConversions.filter(c => !!c.track_id);
        const untrackedConvs = filteredConversions.filter(c => !c.track_id);
        const trackedOrders = new Set(trackedConvs.map(c => c.order_id || c.conversion_id)).size;
        const untrackedOrders = totalOrders - trackedOrders;

        // Direct/Indirect breakdown for tracked conversions (specific track)
        const trackedDirectConvs = trackedConvs.filter(c => c.attribution_type === 'DIRECT' || c.attribution_type === 'direct');
        const trackedIndirectConvs = trackedConvs.filter(c => c.attribution_type !== 'DIRECT' && c.attribution_type !== 'direct' && c.attribution_type);
        const trackedDirectOrders = new Set(trackedDirectConvs.map(c => c.order_id || c.conversion_id)).size;
        const trackedIndirectOrders = new Set(trackedIndirectConvs.map(c => c.order_id || c.conversion_id)).size;
        const trackedDirectValue = trackedDirectConvs.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);
        const trackedIndirectValue = trackedIndirectConvs.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);

        // Direct/Indirect breakdown for untracked conversions (specific track)
        const untrackedDirectConvs = untrackedConvs.filter(c => c.attribution_type === 'DIRECT' || c.attribution_type === 'direct');
        const untrackedIndirectConvs = untrackedConvs.filter(c => c.attribution_type !== 'DIRECT' && c.attribution_type !== 'direct' && c.attribution_type);
        const untrackedDirectOrders = new Set(untrackedDirectConvs.map(c => c.order_id || c.conversion_id)).size;
        const untrackedIndirectOrders = new Set(untrackedIndirectConvs.map(c => c.order_id || c.conversion_id)).size;
        const untrackedDirectValue = untrackedDirectConvs.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);
        const untrackedIndirectValue = untrackedIndirectConvs.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);

        return {
            totalProfit, totalOrders, avgOrdersPerDay, totalCommission, totalInvestment, profitPct, totalShopeeClicks, totalAdClicks, totalCpc,
            trackedSales: trackedOrders, untrackedSales: untrackedOrders,
            trackedDirectOrders, trackedIndirectOrders, trackedDirectValue, trackedIndirectValue,
            untrackedDirectOrders, untrackedIndirectOrders, untrackedDirectValue, untrackedIndirectValue,
            completedOrders, completedValue, pendingOrders, pendingValue, cancelledOrders, cancelledValue
        };
    }, [filteredEntries, filteredConversions]);

    // ========== VIDEO KPIs ==========
    const videoKpis = useMemo(() => {
        if (fbMetrics.length === 0) return null;

        // Since fbMetrics are daily, we should also filter them by date if possible.
        // Let's see if fbMetrics have a date field.
        const filteredFbMetrics = dateFilter === 'all' ? fbMetrics : fbMetrics.filter(item => {
            const now = new Date();
            let start: Date = new Date(0);
            let end: Date = endOfDay(now);

            switch (dateFilter) {
                case 'today': start = startOfDay(now); break;
                case 'yesterday': start = startOfDay(subDays(now, 1)); end = endOfDay(subDays(now, 1)); break;
                case 'anteontem': start = startOfDay(subDays(now, 2)); end = endOfDay(subDays(now, 2)); break;
                case '7days': start = startOfDay(subDays(now, 7)); break;
                case '30days': start = startOfDay(subDays(now, 30)); break;
                case 'custom':
                    if (customRange?.start) start = startOfDay(new Date(customRange.start));
                    if (customRange?.end) end = endOfDay(new Date(customRange.end));
                    break;
                default: return true;
            }

            const dateObj = new Date(item.date + 'T00:00:00');
            if (isNaN(dateObj.getTime())) return true;
            return isWithinInterval(dateObj, { start, end });
        });

        if (filteredFbMetrics.length === 0) return null;

        const totalThruplay = filteredFbMetrics.reduce((s, m) => s + Number(m.video_thruplay || 0), 0);
        const totalP25 = filteredFbMetrics.reduce((s, m) => s + Number(m.video_p25 || 0), 0);
        const totalP50 = filteredFbMetrics.reduce((s, m) => s + Number(m.video_p50 || 0), 0);
        const totalP95 = filteredFbMetrics.reduce((s, m) => s + Number(m.video_p95 || 0), 0);
        if (totalThruplay === 0 && totalP25 === 0) return null; // Not a video ad
        const retentionRate = totalP25 > 0 ? (totalP95 / totalP25) * 100 : 0;
        return { totalThruplay, totalP25, totalP50, totalP95, retentionRate };
    }, [fbMetrics, dateFilter, customRange]);

    // ========== GLOBAL KPIs (all tracks + unmatched) ==========
    const globalKpis = useMemo(() => {
        // Get IDs of visible tracks (active or archived)
        const visibleTrackIds = new Set(creativeTracks.map(t => t.id));

        // Filter all_entries to only include visible tracks
        const visibleEntries = filteredAllEntries.filter(e => visibleTrackIds.has(e.track_id));

        // Get purchase dates for filtering conversions
        const now = new Date();
        let start: Date = new Date(0);
        let end: Date = endOfDay(now);
        switch (dateFilter) {
            case 'today': start = startOfDay(now); break;
            case 'yesterday': start = startOfDay(subDays(now, 1)); end = endOfDay(subDays(now, 1)); break;
            case 'anteontem': start = startOfDay(subDays(now, 2)); end = endOfDay(subDays(now, 2)); break;
            case '7days': start = startOfDay(subDays(now, 7)); break;
            case '30days': start = startOfDay(subDays(now, 30)); break;
            case 'custom':
                if (customRange?.start) start = startOfDay(new Date(customRange.start));
                if (customRange?.end) end = endOfDay(new Date(customRange.end));
                break;
        }

        // Filter conversions to only include those belonging to visible tracks
        // USER REQUEST: Completely remove unmatched (Sem Track) from this analysis
        const filteredConversionsForKpis = allUserConversions.filter(c => {
            if (!c.purchase_time) return false;

            // Only include conversions with a track_id that is currently visible
            if (!c.track_id || !visibleTrackIds.has(c.track_id)) return false;

            const dateObj = new Date(c.purchase_time);
            if (isNaN(dateObj.getTime())) return false;
            if (dateFilter === 'all') return true;
            return isWithinInterval(dateObj, { start, end });
        });

        if (visibleEntries.length === 0 && filteredConversionsForKpis.length === 0) return null;

        // Total Commission from all RAW conversions
        const totalCommission = filteredConversionsForKpis.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);

        // Investment, Ad Clicks, Shopee Clicks from aggregate table (entries)
        const totalInvestment = visibleEntries.reduce((s, e) => s + Number(e.investment), 0);
        const totalShopeeClicks = visibleEntries.reduce((s, e) => s + Number(e.shopee_clicks), 0);
        const totalAdClicks = visibleEntries.reduce((s, e) => s + Number(e.ad_clicks), 0);

        // Unique orders by conversion_id (or order_id) from raw conversions
        const uniqueOrderIds = new Set(filteredConversionsForKpis.map(c => c.order_id || c.conversion_id));
        const totalOrders = uniqueOrderIds.size;

        const totalProfit = totalCommission - totalInvestment;
        const totalCpc = totalAdClicks > 0 ? totalInvestment / totalAdClicks : 0;

        const uniqueDates = new Set([
            ...visibleEntries.map(e => e.date),
            ...filteredConversionsForKpis.map(c => c.purchase_time ? format(new Date(c.purchase_time), 'yyyy-MM-dd') : '').filter(Boolean),
        ]);
        const avgOrdersPerDay = uniqueDates.size > 0 ? totalOrders / uniqueDates.size : 0;
        const profitPct = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

        // Sales attribution Breakdown
        const trackedConversions = filteredConversionsForKpis.filter(c => !!c.track_id);
        const untrackedConversions = filteredConversionsForKpis.filter(c => !c.track_id);
        const trackedOrders = new Set(trackedConversions.map(c => c.order_id || c.conversion_id)).size;
        const untrackedOrders = totalOrders - trackedOrders;

        // Direct/Indirect breakdown for tracked conversions
        const trackedDirectConversions = trackedConversions.filter(c => c.attribution_type === 'DIRECT' || c.attribution_type === 'direct');
        const trackedIndirectConversions = trackedConversions.filter(c => c.attribution_type !== 'DIRECT' && c.attribution_type !== 'direct' && c.attribution_type);
        const trackedDirectOrders = new Set(trackedDirectConversions.map(c => c.order_id || c.conversion_id)).size;
        const trackedIndirectOrders = new Set(trackedIndirectConversions.map(c => c.order_id || c.conversion_id)).size;
        const trackedDirectValue = trackedDirectConversions.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);
        const trackedIndirectValue = trackedIndirectConversions.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);

        // Direct/Indirect breakdown for untracked conversions
        const untrackedDirectConversions = untrackedConversions.filter(c => c.attribution_type === 'DIRECT' || c.attribution_type === 'direct');
        const untrackedIndirectConversions = untrackedConversions.filter(c => c.attribution_type !== 'DIRECT' && c.attribution_type !== 'direct' && c.attribution_type);
        const untrackedDirectOrders = new Set(untrackedDirectConversions.map(c => c.order_id || c.conversion_id)).size;
        const untrackedIndirectOrders = new Set(untrackedIndirectConversions.map(c => c.order_id || c.conversion_id)).size;
        const untrackedDirectValue = untrackedDirectConversions.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);
        const untrackedIndirectValue = untrackedIndirectConversions.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);

        // Status-based breakdown (Global)
        const completedConversions = filteredConversionsForKpis.filter(c => ['PAID', 'COMPLETED', 'SETTLED'].includes(c.conversion_status || ''));
        const pendingConversions = filteredConversionsForKpis.filter(c => c.conversion_status === 'PENDING');
        const cancelledConversions = filteredConversionsForKpis.filter(c => c.conversion_status === 'CANCELLED');

        const completedOrders = new Set(completedConversions.map(c => c.order_id || c.conversion_id)).size;
        const pendingOrders = new Set(pendingConversions.map(c => c.order_id || c.conversion_id)).size;
        const cancelledOrders = new Set(cancelledConversions.map(c => c.order_id || c.conversion_id)).size;

        const completedValue = completedConversions.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);
        const pendingValue = pendingConversions.reduce((s, c) => s + Number(c.item_total_commission || 0), 0);
        const cancelledValue = cancelledConversions.reduce((s, c) => {
            const potentialComm = Number(c.refund_amount || 0) * ((Number(c.item_seller_commission_rate || 0) + Number(c.item_shopee_commission_rate || 0)) / 100);
            return s + (Number(c.item_total_commission) || potentialComm);
        }, 0);

        return {
            totalProfit, totalOrders, avgOrdersPerDay, totalCommission, totalInvestment, profitPct, totalShopeeClicks, totalAdClicks, totalCpc,
            trackedSales: trackedOrders, untrackedSales: untrackedOrders,
            trackedDirectOrders, trackedIndirectOrders, trackedDirectValue, trackedIndirectValue,
            untrackedDirectOrders, untrackedIndirectOrders, untrackedDirectValue, untrackedIndirectValue,
            completedOrders, completedValue, pendingOrders, pendingValue, cancelledOrders, cancelledValue
        };
    }, [filteredAllEntries, allUserConversions, dateFilter, customRange, creativeTracks, showArchived]);

    // ========== TRACK RANKING ==========
    const trackRanking = useMemo(() => {
        const hasEntries = filteredAllEntries.length > 0;
        const hasUnmatched = filteredUnmatchedConversions.length > 0;
        if (!hasEntries && !hasUnmatched) return [];

        const ranked = hasEntries ? creativeTracks.map(track => {
            const trackEntries = filteredAllEntries.filter(e => e.track_id === track.id);
            const commission = trackEntries.reduce((s, e) => s + Number(e.commission_value), 0);
            const investment = trackEntries.reduce((s, e) => s + Number(e.investment), 0);
            const orders = trackEntries.reduce((s, e) => s + Number(e.orders), 0);
            const adClicks = trackEntries.reduce((s, e) => s + Number(e.ad_clicks), 0);
            const shopeeClicks = trackEntries.reduce((s, e) => s + Number(e.shopee_clicks), 0);
            const profit = commission - investment;
            const pct = investment > 0 ? (profit / investment) * 100 : 0;
            const cpc = adClicks > 0 ? investment / adClicks : 0;
            return { track, orders, commission, investment, profit, pct, adClicks, shopeeClicks, cpc, isUnmatched: false };
        }).filter(r => r.orders > 0 || r.investment > 0 || r.commission > 0 || r.adClicks > 0)
            .sort((a, b) => {
                const dir = rankingSortDir === 'asc' ? 1 : -1;
                if (rankingSortCol === 'name') return dir * a.track.name.localeCompare(b.track.name, 'pt-BR');
                if (rankingSortCol === 'status') return dir * (a.track.status || '').localeCompare(b.track.status || '', 'pt-BR');
                const valA = (a as any)[rankingSortCol] ?? 0;
                const valB = (b as any)[rankingSortCol] ?? 0;
                return dir * (valA - valB);
            }) as { track: Track; orders: number; commission: number; investment: number; profit: number; pct: number; adClicks: number; shopeeClicks: number; cpc: number; isUnmatched: boolean }[] : [];

        return ranked;
    }, [filteredAllEntries, creativeTracks, rankingSortCol, rankingSortDir]);

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
                                className="w-full bg-background-dark border border-border-dark rounded-xl pl-10 pr-24 py-3 text-white placeholder-neutral-600 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-sm"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={handleModalCheckUrl}
                                disabled={modalFetchingProduct || !modalOriginUrl.trim()}
                                className="absolute right-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all border border-primary/20 flex items-center gap-1.5"
                            >
                                {modalFetchingProduct ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-3.5 h-3.5" />
                                )}
                                Verificar
                            </button>
                        </div>
                    </div>

                    {/* Progress feedback for unified flow */}
                    {modalGenerating && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-primary">Processando Track...</span>
                                <span className="text-[10px] text-neutral-400">Gerando link encurtado e buscando dados do produto...</span>
                            </div>
                        </div>
                    )}

                    {/* Product Preview (auto-fetched) */}
                    {modalFetchingProduct && (
                        <div className="flex items-center gap-3 p-4 bg-surface-highlight/20 rounded-xl border border-border-dark">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className="text-sm text-neutral-400">Buscando dados do produto...</span>
                        </div>
                    )}

                    {modalProductError && !modalFetchingProduct && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-3 rounded-xl flex gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{modalProductError}</span>
                        </div>
                    )}

                    {modalProductData && !modalFetchingProduct && (
                        <div className="bg-surface-highlight/20 border border-primary/20 rounded-xl p-4">
                            <div className="flex gap-4">
                                {modalProductData.imageUrl && (
                                    <img
                                        src={modalProductData.imageUrl}
                                        alt={modalProductData.productName}
                                        className="w-20 h-20 rounded-lg object-cover border border-border-dark flex-shrink-0"
                                    />
                                )}
                                <div className="flex flex-col gap-1.5 min-w-0">
                                    <h4 className="text-sm font-bold text-white line-clamp-2">
                                        {modalProductData.productName}
                                    </h4>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                        <span className="text-primary font-bold">
                                            R$ {parseFloat(modalProductData.price || 0).toFixed(2)}
                                        </span>
                                        {modalProductData.priceDiscountRate > 0 && (
                                            <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">
                                                -{modalProductData.priceDiscountRate}%
                                            </span>
                                        )}
                                        {modalProductData.ratingStar && (
                                            <div className="flex items-center gap-1 text-amber-400">
                                                <span>⭐ {parseFloat(modalProductData.ratingStar).toFixed(1)}</span>
                                            </div>
                                        )}
                                        {modalProductData.sales > 0 && (
                                            <span className="text-neutral-500">{modalProductData.sales} vendidos</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-0.5 mt-1 border-t border-white/5 pt-1.5">
                                        {modalProductData.commissionRate > 0 && (
                                            <p className="text-[11px] font-bold text-green-400">
                                                Comissao: {formatPct(modalProductData.commissionRate < 1 ? modalProductData.commissionRate * 100 : modalProductData.commissionRate)}%
                                                <span className="ml-1 text-green-500/70 font-normal">
                                                    (R$ {parseFloat(modalProductData.commission || 0).toFixed(2)})
                                                </span>
                                            </p>
                                        )}
                                        {modalShopData?.shopName && (
                                            <p className="text-[10px] text-neutral-500">Loja: {modalShopData.shopName}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Track Name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-neutral-300">Nome do Criativo *</label>
                        <input
                            className="bg-background-dark border border-border-dark rounded-xl p-3 text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all text-sm"
                            value={newTrackName}
                            onChange={e => handleNewTrackNameChange(e.target.value)}
                            placeholder="Ex: MOP, TOALHA, UMIDIFICADOR..."
                        />
                    </div>

                    <div className="h-px bg-border-dark"></div>

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
                                        maxLength={50}
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

                    {/* Campos Personalizados */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-neutral-500 uppercase flex items-center gap-1.5">
                                <Tag className="w-3 h-3" /> Campos Personalizados
                            </label>
                            <button
                                type="button"
                                onClick={handleModalAddCustomField}
                                className="text-[10px] text-primary hover:text-primary/80 font-bold flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Adicionar
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {modalCustomFields.map((field, idx) => (
                                <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                        <input
                                            placeholder="Nome (ex: Campanha)"
                                            value={field.key}
                                            onChange={(e) => handleModalCustomFieldChange(idx, 'key', e.target.value)}
                                            className="bg-background-dark border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none transition-all placeholder:text-neutral-600"
                                        />
                                        <input
                                            placeholder="Valor"
                                            value={field.value}
                                            onChange={(e) => handleModalCustomFieldChange(idx, 'value', e.target.value)}
                                            className="bg-background-dark border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:border-primary/50 outline-none transition-all placeholder:text-neutral-600"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleModalRemoveCustomField(idx)}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {modalCustomFields.length === 0 && (
                                <p className="text-[10px] text-neutral-600 italic">Nenhum campo adicional definido.</p>
                            )}
                        </div>
                    </div>

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
                        <h1 className="text-xl sm:text-2xl font-bold text-white">Criativo Track</h1>
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
                        <h1 className="text-xl sm:text-2xl font-bold text-white">Criativo Track</h1>
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
                    <h1 className="text-xl sm:text-2xl font-bold text-white">Criativo Track</h1>
                    <p className="text-text-secondary text-sm mt-1">Acompanhe o desempenho de cada criativo de anúncio</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end w-full sm:w-auto">
                    {/* View Toggle */}
                    <div className="flex items-center bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
                        <button
                            onClick={() => {
                                setViewMode('list');
                                localStorage.setItem('creativeTrack_viewMode', 'list');
                            }}
                            className={`p-2 transition-all ${viewMode === 'list' ? 'bg-primary text-background-dark' : 'text-text-secondary hover:text-white'}`}
                            title="Visualização Lista"
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setViewMode('kanban');
                                localStorage.setItem('creativeTrack_viewMode', 'kanban');
                            }}
                            className={`p-2 transition-all ${viewMode === 'kanban' ? 'bg-primary text-background-dark' : 'text-text-secondary hover:text-white'}`}
                            title="Visualização Kanban"
                        >
                            <Kanban className="w-4 h-4" />
                        </button>
                    </div>

                    {/* DateFilter (Ontem) */}
                    <div className="flex-1 sm:flex-none min-w-0">
                        <DateFilter />
                    </div>

                    {/* Novo Track Button */}
                    <button
                        onClick={() => setShowNewForm(!showNewForm)}
                        className="bg-primary text-background-dark font-bold px-3 py-2 sm:px-4 sm:py-2 rounded-xl hover:bg-opacity-90 shadow-[0_0_15px_rgba(242,162,13,0.3)] flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Novo Track</span>
                    </button>

                    {/* Global Sync Dropdown (Reload) */}
                    <div className="relative" ref={globalSyncMenuRef}>
                        <button
                            onClick={() => setShowGlobalSyncMenu(!showGlobalSyncMenu)}
                            disabled={isGlobalSyncing}
                            className="px-2.5 py-2 border border-primary/50 text-xs sm:text-sm font-semibold text-primary rounded-xl hover:bg-primary hover:text-background-dark transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isGlobalSyncing ? 'animate-spin' : ''}`} />
                            <span className="hidden lg:inline">{isGlobalSyncing ? 'Sincronizando...' : 'Sync Global'}</span>
                            {!isGlobalSyncing && <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        </button>

                        {showGlobalSyncMenu && !isGlobalSyncing && (
                            <div className="absolute right-0 mt-2 w-56 bg-surface-dark rounded-xl shadow-xl border border-border-dark py-2 z-50">
                                <button
                                    onClick={() => handleGlobalSync('all')}
                                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors font-semibold"
                                >
                                    🚀 Sincronização Total
                                </button>
                                <div className="h-px w-full bg-border-dark my-1"></div>
                                <button
                                    onClick={() => handleGlobalSync('meta')}
                                    className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between"
                                >
                                    Apenas Meta Ads
                                </button>
                                <button
                                    onClick={() => handleGlobalSync('shopee')}
                                    className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between"
                                >
                                    Apenas Shopee
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* New Track Modal */}
            {newTrackModal}

            {viewMode === 'kanban' ? (
                <KanbanBoard
                    tracks={creativeTracks}
                    statuses={TRACK_STATUSES}
                    trackEntryCounts={trackEntryCounts}
                    onSelectTrack={handleSelectTrack}
                    onUpdateStatus={(track: any, newStatus: string) => handleUpdateStatus(track, newStatus as any)}
                    selectedTrackId={selectedTrack?.id || null}
                />
            ) : (
                <>
                    {/* Mobile: horizontal scroll tabs - MOVED HERE */}
                    <div className="flex md:hidden items-center mb-2 overflow-hidden w-full">
                        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar shrink-0 min-w-0 flex-1 px-1">
                            <button
                                onClick={() => setShowArchived(!showArchived)}
                                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${showArchived
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                    : 'bg-surface-dark border-border-dark text-text-secondary'
                                    }`}
                            >
                                {showArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                                {showArchived ? 'Ver Ativos' : 'Arquivados'}
                            </button>
                            {creativeTracks.map(track => {
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
                                        {trackEntryCounts[track.id] > 0 && (
                                            <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? 'bg-background-dark/20 text-background-dark' : 'bg-primary/10 text-primary'}`}>
                                                {trackEntryCounts[track.id]}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Two-column layout: Tracks list + Detail */}
                    <div className="flex gap-4 min-h-0">
                        {/* Left: Tracks List */}
                        <div className="w-48 flex-shrink-0 flex flex-col gap-3 hidden md:flex">
                            <button
                                onClick={() => setShowArchived(!showArchived)}
                                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${showArchived
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
                                    : 'bg-surface-dark border-border-dark text-text-secondary hover:border-primary/30 hover:text-white'
                                    }`}
                            >
                                {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                {showArchived ? 'Ver Ativos' : 'Ver Arquivados'}
                            </button>
                            <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                                {creativeTracks.map(track => {
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
                                                        track.status === 'rascunho' ? 'bg-white shadow-white/50' :
                                                            'bg-red-500 shadow-red-500/50'
                                                    }`}
                                                title={track.status.charAt(0).toUpperCase() + track.status.slice(1)}
                                            />
                                            {trackEntryCounts[track.id] > 0 && (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors ${isActive ? 'bg-background-dark/20 text-background-dark' : 'bg-primary/10 text-primary group-hover:bg-primary/20'}`}>
                                                    {trackEntryCounts[track.id]}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right: Detail View */}
                        <div className="flex-1 min-w-0 flex flex-col gap-5">
                            {!selectedTrack ? (
                                <div className="flex-1 flex flex-col gap-5">
                                    {/* General Overview Header */}
                                    <div className="flex items-center justify-between gap-3 hidden md:flex">
                                        <div>
                                            <h2 className="text-xl font-bold text-white">Visão Geral</h2>
                                            <p className="text-text-secondary text-sm">Compilado de todos os criativos</p>
                                        </div>
                                    </div>

                                    {/* Global KPIs */}
                                    {globalKpis ? (
                                        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleGlobalKpiDragEnd}>
                                            <SortableContext items={globalKpiOrder} strategy={rectSortingStrategy}>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {globalKpiOrder.map((id) => {
                                                        const kpiMap: Record<string, any> = {
                                                            profit: { label: 'Lucro Total', value: `R$ ${formatBRL(globalKpis.totalProfit)}`, icon: DollarSign, color: globalKpis.totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
                                                            orders: { label: 'Pedidos Totais', value: globalKpis.totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-400' },
                                                            completed: { label: 'Pedidos Concluídos', value: `${globalKpis.completedOrders} (R$ ${formatBRL(globalKpis.completedValue)})`, icon: CheckCircle2, color: 'text-green-400' },
                                                            pending: { label: 'Pedidos Pendentes', value: `${globalKpis.pendingOrders} (R$ ${formatBRL(globalKpis.pendingValue)})`, icon: Clock, color: 'text-yellow-400' },
                                                            cancelled: { label: 'Pedidos Cancelados', value: `${globalKpis.cancelledOrders} (R$ ${formatBRL(globalKpis.cancelledValue)})`, icon: XCircle, color: 'text-red-400' },
                                                            avgOrders: { label: 'Média Pedidos/Dia', value: globalKpis.avgOrdersPerDay.toFixed(1), icon: BarChart3, color: 'text-purple-400' },
                                                            commission: { label: 'Total Comissões', value: `R$ ${formatBRL(globalKpis.totalCommission)}`, icon: TrendingUp, color: 'text-primary' },
                                                            investment: { label: 'Total Investimento', value: `R$ ${formatBRL(globalKpis.totalInvestment)}`, icon: PiggyBank, color: 'text-orange-400' },
                                                            profitPct: { label: 'Lucro Médio', value: `${formatPct(globalKpis.profitPct)}%`, icon: Percent, color: globalKpis.profitPct >= 0 ? 'text-green-400' : 'text-red-400' },
                                                            shopeeClicks: { label: 'Cliques Shopee', value: globalKpis.totalShopeeClicks.toLocaleString('pt-BR'), icon: MousePointerClick, color: 'text-cyan-400' },
                                                            adClicks: { label: 'Cliques Anúncio', value: globalKpis.totalAdClicks.toLocaleString('pt-BR'), icon: Target, color: 'text-pink-400' },
                                                            cpc: { label: 'CPC Médio', value: `R$ ${formatBRL(globalKpis.totalCpc)}`, icon: MousePointerClick, color: 'text-amber-400' },
                                                        };
                                                        const kpi = kpiMap[id];
                                                        if (!kpi) return null;
                                                        return <SortableKpiCard key={id} id={id} kpi={kpi} compact />;
                                                    })}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    ) : (
                                        <div className="text-center py-8 bg-surface-dark rounded-2xl border border-border-dark text-neutral-400 text-sm">
                                            Nenhum registro encontrado. Sincronize ou crie registros em cada track.
                                        </div>
                                    )}

                                    {/* Pedidos com Track / sem Track - Diretas vs Indiretas */}
                                    {/* Sales attribution blocks removed by user request (Criativo Track focus) */}

                                    {/* Track Ranking Table */}
                                    {trackRanking.length > 0 && (
                                        <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                                            <div className="p-4 border-b border-border-dark flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-white">Ranking de Criativos</h3>
                                                <div className="text-[10px] text-text-secondary uppercase tracking-widest font-bold md:hidden">
                                                    Clique para Detalhes
                                                </div>
                                            </div>

                                            {/* Desktop Table View */}
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-border-dark text-text-secondary text-xs">
                                                            {([
                                                                { key: 'name', label: 'Criativo', align: 'text-left' },
                                                                { key: 'status', label: 'Status', align: 'text-center' },
                                                                { key: 'adClicks', label: 'Cliq. Anúncio', align: 'text-right' },
                                                                { key: 'shopeeClicks', label: 'Cliq. Shopee', align: 'text-right' },
                                                                { key: 'cpc', label: 'CPC', align: 'text-right' },
                                                                { key: 'orders', label: 'Pedidos', align: 'text-right' },
                                                                { key: 'commission', label: 'Comissão', align: 'text-right' },
                                                                { key: 'investment', label: 'Investimento', align: 'text-right' },
                                                                { key: 'profit', label: 'Lucro', align: 'text-right' },
                                                                { key: 'pct', label: '%', align: 'text-right' },
                                                            ] as { key: RankingSortCol; label: string; align: string }[]).map(col => (
                                                                <th
                                                                    key={col.key}
                                                                    className={`${col.align} p-3 cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap`}
                                                                    onClick={() => handleRankingSort(col.key)}
                                                                >
                                                                    {col.label}
                                                                    {rankingSortCol === col.key && (
                                                                        <span className="ml-1 text-primary">{rankingSortDir === 'desc' ? '▼' : '▲'}</span>
                                                                    )}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {trackRanking.map((row) => {
                                                            const isUnmatched = row.isUnmatched;
                                                            const statusColor = isUnmatched ? 'bg-red-500' : row.track.status === 'ativo' ? 'bg-green-500' : row.track.status === 'validado' ? 'bg-blue-500' : 'bg-red-500';
                                                            return (
                                                                <tr
                                                                    key={row.track.id}
                                                                    onClick={() => !isUnmatched && handleSelectTrack(row.track)}
                                                                    className={`border-b border-border-dark/50 hover:bg-white/[0.03] transition-colors ${isUnmatched ? 'opacity-80 bg-red-500/[0.03]' : 'cursor-pointer'}`}
                                                                >
                                                                    <td className="p-3">
                                                                        <div className="flex flex-col">
                                                                            <span className={`font-medium text-sm ${isUnmatched ? 'text-red-400 italic' : 'text-white'}`}>{row.track.name}</span>
                                                                            {row.track.sub_id && <span className="text-[10px] text-text-secondary font-mono">{row.track.sub_id}</span>}
                                                                            {isUnmatched && <span className="text-[10px] text-red-400/70">Conversões não vinculadas a nenhum criativo</span>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
                                                                    </td>
                                                                    <td className="p-3 text-right text-neutral-300">{row.adClicks.toLocaleString('pt-BR')}</td>
                                                                    <td className="p-3 text-right text-neutral-300">{row.shopeeClicks.toLocaleString('pt-BR')}</td>
                                                                    <td className="p-3 text-right text-amber-400 font-mono text-xs">R$ {formatBRL(row.cpc)}</td>
                                                                    <td className="p-3 text-right text-neutral-300">{row.orders}</td>
                                                                    <td className="p-3 text-right text-primary font-semibold">R$ {formatBRL(row.commission)}</td>
                                                                    <td className="p-3 text-right text-orange-400">R$ {formatBRL(row.investment)}</td>
                                                                    <td className={`p-3 text-right font-bold ${row.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {formatBRL(row.profit)}</td>
                                                                    <td className={`p-3 text-right text-xs ${row.pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPct(row.pct)}%</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Mobile Card View */}
                                            <div className="md:hidden flex flex-col gap-3 p-3 bg-background-dark/30 w-full min-w-0">
                                                {trackRanking.map((row) => {
                                                    const isUnmatched = row.isUnmatched;
                                                    const statusColor = isUnmatched ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                                        row.track.status === 'ativo' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                            row.track.status === 'validado' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                                row.track.status === 'rascunho' ? 'bg-white/10 text-white border-white/20' :
                                                                    'bg-red-500/20 text-red-400 border-red-500/30';

                                                    return (
                                                        <div
                                                            key={row.track.id}
                                                            onClick={() => !isUnmatched && handleSelectTrack(row.track)}
                                                            className={`bg-surface-dark border rounded-2xl p-3 sm:p-4 shadow-lg transition-all flex flex-col gap-3 sm:gap-4 w-full min-w-0 ${isUnmatched ? 'border-red-500/30 opacity-80' : 'border-border-dark active:scale-[0.98]'}`}
                                                        >
                                                            {/* Card Header: Title & Status */}
                                                            <div className="flex justify-between items-start gap-2 w-full min-w-0">
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <h4 className={`font-bold text-base sm:text-lg leading-tight truncate ${isUnmatched ? 'text-red-400 italic' : 'text-white'}`}>
                                                                        {row.track.name}
                                                                    </h4>
                                                                    {row.track.sub_id && (
                                                                        <span className="text-[10px] text-text-secondary font-mono mt-1 px-1.5 py-0.5 bg-background-dark/50 rounded inline-block w-fit truncate max-w-full">
                                                                            {row.track.sub_id}
                                                                        </span>
                                                                    )}
                                                                    {isUnmatched && (
                                                                        <span className="text-[10px] text-red-400/70 mt-1">Conversões não vinculadas</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                                    <span className={`text-[9px] px-2 py-0.5 rounded-full border uppercase font-bold tracking-wider whitespace-nowrap ${statusColor}`}>
                                                                        {isUnmatched ? 'sem track' : row.track.status}
                                                                    </span>
                                                                    {!isUnmatched && <ChevronRight className="w-4 h-4 text-text-secondary/30" />}
                                                                </div>
                                                            </div>

                                                            {/* Card Body: Metrics Grid */}
                                                            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0">
                                                                {/* Primary Group: Financials */}
                                                                <div className="bg-background-dark/40 rounded-xl p-2.5 sm:p-3 flex flex-col gap-0.5 sm:gap-1 border border-border-dark/50 min-w-0">
                                                                    <div className="flex justify-between items-center gap-1">
                                                                        <span className="text-[9px] sm:text-[10px] text-text-secondary uppercase font-bold tracking-wider truncate">Lucro</span>
                                                                        <DollarSign className="w-3 h-3 text-text-secondary/50 shrink-0" />
                                                                    </div>
                                                                    <span className={`text-sm sm:text-base font-black truncate ${row.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        R$ {formatBRL(row.profit)}
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold truncate ${row.pct >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                                                        {formatPct(row.pct)}% ROI
                                                                    </span>
                                                                </div>

                                                                {/* Secondary Group: Volume */}
                                                                <div className="bg-background-dark/40 rounded-xl p-2.5 sm:p-3 flex flex-col gap-0.5 sm:gap-1 border border-border-dark/50 min-w-0">
                                                                    <div className="flex justify-between items-center gap-1">
                                                                        <span className="text-[9px] sm:text-[10px] text-text-secondary uppercase font-bold tracking-wider truncate">Shopee</span>
                                                                        <ShoppingCart className="w-3 h-3 text-text-secondary/50 shrink-0" />
                                                                    </div>
                                                                    <div className="flex items-baseline gap-1 min-w-0">
                                                                        <span className="text-sm sm:text-base font-bold text-blue-400 truncate">{row.orders}</span>
                                                                        <span className="text-[10px] text-text-secondary font-medium truncate">pedidos</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-primary truncate">
                                                                        R$ {formatBRL(row.commission)} comissão
                                                                    </span>
                                                                </div>

                                                                {/* Traffic Group */}
                                                                <div className="col-span-2 bg-background-dark/20 rounded-xl px-3 py-2 flex items-center justify-between border border-border-dark/30 w-full min-w-0">
                                                                    <div className="flex items-center gap-4 min-w-0">
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[9px] text-text-secondary uppercase font-bold truncate">Cliques Ads</span>
                                                                            <span className="text-xs font-bold text-neutral-300 truncate">{row.adClicks.toLocaleString('pt-BR')}</span>
                                                                        </div>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[9px] text-text-secondary uppercase font-bold truncate">Cliques Shopee</span>
                                                                            <span className="text-xs font-bold text-neutral-300 truncate">{row.shopeeClicks.toLocaleString('pt-BR')}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col text-right shrink-0">
                                                                        <span className="text-[9px] text-text-secondary uppercase font-bold">CPC Médio</span>
                                                                        <span className="text-xs font-mono font-bold text-amber-400">R$ {formatBRL(row.cpc)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Track Header */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="flex flex-col gap-1">
                                                    {editingTrack ? (
                                                        <input
                                                            className="bg-background-dark border border-primary rounded-lg p-2 text-white text-lg sm:text-xl font-bold outline-none w-full"
                                                            value={editName}
                                                            onChange={e => setEditName(e.target.value)}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-2 group">
                                                            <h2 className={`text-lg sm:text-xl font-bold text-white transition-all ${hideSensitive ? 'blur-md select-none' : ''}`}>
                                                                {selectedTrack.name}
                                                            </h2>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            await navigator.clipboard.writeText(selectedTrack.name);
                                                                            showToast('Nome copiado para a área de transferência!', 'success');
                                                                        } catch (err) {
                                                                            showToast('Erro ao copiar nome.', 'error');
                                                                        }
                                                                    }}
                                                                    className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                                                    title="Copiar Nome"
                                                                >
                                                                    <Copy className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingTrack(true);
                                                                        setEditName(selectedTrack.name);
                                                                        setEditLink(selectedTrack.affiliate_link || '');
                                                                        setEditSubIds(selectedTrack.sub_id
                                                                            ? selectedTrack.sub_id.split(/[-,]/).map((s: string) => s.trim()).filter(Boolean)
                                                                            : ['']);
                                                                    }}
                                                                    className="p-1 rounded-md text-neutral-500 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                                                                    title="Editar Criativo"
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {selectedTrack.sub_id && !editingTrack && (
                                                        <span className={`w-fit px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold font-mono transition-all ${hideSensitive ? 'blur-sm select-none' : ''}`}>
                                                            {selectedTrack.sub_id}
                                                        </span>
                                                    )}
                                                    {selectedTrack.affiliate_link && !editingTrack && (
                                                        <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-surface-highlight/50 border border-border-dark rounded-lg w-fit">
                                                            <span className={`text-[10px] sm:text-xs text-text-secondary font-mono truncate max-w-[150px] sm:max-w-[250px] transition-all ${hideSensitive ? 'blur-sm select-none' : ''}`}>
                                                                {selectedTrack.affiliate_link}
                                                            </span>
                                                            <button
                                                                onClick={() => handleCopyTrackLink(selectedTrack.affiliate_link)}
                                                                className="text-primary hover:text-primary-light transition-colors p-0.5"
                                                                title="Copiar Link"
                                                            >
                                                                {trackLinkCopied ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                                            </button>
                                                            <a
                                                                href={selectedTrack.affiliate_link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary hover:text-primary-light transition-colors p-0.5"
                                                                title="Acessar Link do Produto"
                                                            >
                                                                <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                            </a>

                                                            {/* Link Verification Shield */}
                                                            {(() => {
                                                                const status = getLinkIntegrity(selectedTrack.affiliate_link, fbLinkedAds);
                                                                if (status === 'valid') return (
                                                                    <div className="group relative flex items-center ml-1">
                                                                        <div className="flex items-center text-green-500 cursor-help">
                                                                            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-green-500/10" />
                                                                        </div>
                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-900 border border-green-500/20 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl text-center leading-relaxed">
                                                                            <span className="font-bold text-green-400 block mb-0.5">Link Verificado ✅</span>
                                                                            O mesmo link configurado aqui está presente nos seus anúncios do Facebook.
                                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900"></div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                                if (status === 'error') return (
                                                                    <div className="group relative flex items-center ml-1">
                                                                        <div className="flex items-center text-red-500 cursor-help">
                                                                            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-red-500/10" />
                                                                        </div>
                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-neutral-900 border border-red-500/20 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl text-center leading-relaxed">
                                                                            <span className="font-bold text-red-400 block mb-0.5">Links Divergentes! ⚠️</span>
                                                                            O link desta track no MOP NÃO é o mesmo usado nos anúncios do Facebook. Verifique para não perder o rastreio.
                                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900"></div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                                return null;
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
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
                                                    </div>
                                                )}
                                            </div>

                                            {!editingTrack && selectedTrack && (
                                                <div className="flex items-center gap-1 bg-background-dark/50 p-1 rounded-xl border border-border-dark w-fit">
                                                    <button
                                                        onClick={() => handleUpdateStatus(selectedTrack, 'rascunho')}
                                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${selectedTrack.status === 'rascunho'
                                                            ? 'bg-white text-background-dark shadow-lg shadow-white/20'
                                                            : 'text-neutral-500 hover:text-white hover:bg-white/10'
                                                            }`}
                                                        title="Marcar como Rascunho"
                                                    >
                                                        <FileEdit className="w-3.5 h-3.5" /> Rascunho
                                                    </button>
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
                                                        onClick={() => handleArchiveTrack(selectedTrack, !selectedTrack.is_archived)}
                                                        disabled={saving}
                                                        className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors border disabled:opacity-50 ${selectedTrack.is_archived
                                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:text-emerald-300'
                                                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:text-amber-300'
                                                            }`}
                                                    >
                                                        {selectedTrack.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                                        {selectedTrack.is_archived ? 'Desarquivar' : 'Arquivar'}
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteTrack(selectedTrack)}
                                                        disabled={saving}
                                                        className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors disabled:opacity-50 ${selectedTrack.is_archived
                                                            ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                                            : 'text-neutral-500 cursor-not-allowed'
                                                            }`}
                                                        title={selectedTrack.is_archived ? 'Excluir permanentemente' : 'Arquive antes de excluir'}
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Excluir
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tabs Navigation */}
                                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border-dark scrollbar-track-transparent mt-2">
                                        <button
                                            onClick={() => setActiveTab('metrics')}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'metrics' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' : 'bg-surface-dark text-text-secondary border border-border-dark hover:text-white hover:border-primary/50'}`}
                                        >
                                            <BarChart3 className="w-4 h-4" /> Métricas
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('product')}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'product' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' : 'bg-surface-dark text-text-secondary border border-border-dark hover:text-white hover:border-primary/50'}`}
                                        >
                                            <PackageSearch className="w-4 h-4" /> Dados do Produto
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('custom')}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'custom' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' : 'bg-surface-dark text-text-secondary border border-border-dark hover:text-white hover:border-primary/50'}`}
                                        >
                                            <Tag className="w-4 h-4" /> Campos
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('conversions')}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'conversions' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' : 'bg-surface-dark text-text-secondary border border-border-dark hover:text-white hover:border-primary/50'}`}
                                        >
                                            <ShoppingCart className="w-4 h-4" /> Conversões
                                        </button>
                                    </div>

                                    <div className={activeTab === 'metrics' ? 'flex flex-col gap-4' : 'hidden'}>
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
                                                <div className="flex flex-col gap-1 sm:col-span-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs text-text-secondary">Sub IDs (separados por -)</label>
                                                        {editSubIds.length < 5 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditSubIds([...editSubIds, ''])}
                                                                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                                                            >
                                                                <Plus className="w-3 h-3" /> Adicionar Sub ID
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {editSubIds.map((sid, idx) => (
                                                            <div key={idx} className="flex items-center gap-1">
                                                                {idx > 0 && <span className="text-text-secondary text-sm font-bold">-</span>}
                                                                <input
                                                                    className="bg-background-dark border border-border-dark rounded-lg p-2.5 text-white outline-none focus:border-primary transition-colors text-sm w-40"
                                                                    value={sid}
                                                                    onChange={e => {
                                                                        const updated = [...editSubIds];
                                                                        updated[idx] = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                                                                        setEditSubIds(updated);
                                                                    }}
                                                                    placeholder={`Sub ID ${idx + 1}`}
                                                                />
                                                                {editSubIds.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditSubIds(editSubIds.filter((_, i) => i !== idx))}
                                                                        className="text-neutral-500 hover:text-red-400 transition-colors p-0.5"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-start gap-1.5 mt-1 text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-lg px-2.5 py-2">
                                                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                                        <span className="text-[11px] leading-relaxed">Alterar os Sub IDs pode desvincular conversões já sincronizadas com a Shopee e/ou Meta Ads. Recomenda-se gerar um novo link após a alteração.</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    </div>

                                    <div className={activeTab === 'product' ? 'flex flex-col gap-4' : 'hidden'}>
                                        {/* Product Details Section */}
                                        <div className="bg-surface-dark border border-border-dark rounded-2xl p-4">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                    <PackageSearch className="w-4 h-4 text-orange-400" />
                                                    Dados do Produto {!selectedTrack.product_name && <span className="text-xs font-normal text-text-secondary">(Opcional)</span>}
                                                </h3>
                                                {!editingProduct && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => { setFetchProductError(null); handleFetchProductData(); }}
                                                            disabled={fetchingProductData || !selectedTrack.affiliate_link}
                                                            className="px-3 py-1.5 rounded-lg text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 border border-orange-500/20 transition-colors text-xs flex items-center gap-1.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {fetchingProductData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                            {fetchingProductData ? 'Buscando...' : 'Buscar Dados Shopee'}
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingProduct(true)}
                                                            className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-xs flex items-center gap-1"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" /> Editar Dados
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {fetchProductError && (
                                                <div className="mb-3 bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg flex gap-2 text-xs">
                                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                                    <span>{fetchProductError}</span>
                                                </div>
                                            )}

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
                                            ) : selectedTrack.product_name ? (
                                                /* ── Rich API Data View ── */
                                                <div className="flex flex-col gap-4">
                                                    {/* Product header: image + name + shop */}
                                                    <div className="flex gap-4">
                                                        {selectedTrack.product_image_url ? (
                                                            <img
                                                                src={selectedTrack.product_image_url}
                                                                alt={selectedTrack.product_name}
                                                                className="w-24 h-24 rounded-xl object-cover border border-border-dark flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-24 h-24 rounded-xl bg-background-dark border border-border-dark flex items-center justify-center flex-shrink-0">
                                                                <ImageIcon className="w-8 h-8 text-neutral-600" />
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col gap-1.5 min-w-0">
                                                            <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug">
                                                                {selectedTrack.product_name}
                                                            </h4>
                                                            {selectedTrack.product_shop_name && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Store className="w-3.5 h-3.5 text-neutral-500" />
                                                                    <span className="text-xs text-neutral-400">{selectedTrack.product_shop_name}</span>
                                                                    {selectedTrack.product_shop_rating != null && (
                                                                        <span className="text-xs text-yellow-400 flex items-center gap-0.5 ml-1">
                                                                            <Star className="w-3 h-3 fill-yellow-400" /> {selectedTrack.product_shop_rating}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {selectedTrack.product_link && (
                                                                <a
                                                                    href={selectedTrack.product_link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" /> Ver na Shopee
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Data grid */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                                        {/* Price */}
                                                        <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Preço</span>
                                                            <span className="text-sm font-bold text-primary">
                                                                R$ {selectedTrack.product_price != null ? formatBRL(selectedTrack.product_price) : '--'}
                                                            </span>
                                                            {selectedTrack.product_price_min != null && selectedTrack.product_price_max != null && selectedTrack.product_price_min !== selectedTrack.product_price_max && (
                                                                <span className="text-[10px] text-neutral-500 block">
                                                                    R$ {formatBRL(selectedTrack.product_price_min)} ~ R$ {formatBRL(selectedTrack.product_price_max)}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Discount */}
                                                        {selectedTrack.product_discount_rate != null && selectedTrack.product_discount_rate > 0 && (
                                                            <div className="bg-background-dark/50 border border-red-500/20 rounded-xl px-3 py-2.5">
                                                                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Desconto</span>
                                                                <span className="text-sm font-bold text-red-400">-{selectedTrack.product_discount_rate}%</span>
                                                            </div>
                                                        )}

                                                        {/* Commission Total */}
                                                        <div className="bg-background-dark/50 border border-green-500/20 rounded-xl px-3 py-2.5">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Comissão</span>
                                                            <span className="text-sm font-bold text-green-400">
                                                                {selectedTrack.product_commission != null ? `R$ ${formatBRL(selectedTrack.product_commission)}` : '--'}
                                                            </span>
                                                            {selectedTrack.product_commission_rate != null && (
                                                                <span className="text-[10px] text-green-400/60 block">
                                                                    {formatPct(selectedTrack.product_commission_rate * 100)}% total
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Seller Commission Rate */}
                                                        {selectedTrack.product_seller_commission_rate != null && (
                                                            <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Com. Vendedor</span>
                                                                <span className="text-sm font-bold text-white">
                                                                    {formatPct(selectedTrack.product_seller_commission_rate * 100)}%
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Shopee Commission Rate */}
                                                        {selectedTrack.product_shopee_commission_rate != null && (
                                                            <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                                <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Com. Shopee</span>
                                                                <span className="text-sm font-bold text-white">
                                                                    {formatPct(selectedTrack.product_shopee_commission_rate * 100)}%
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Rating */}
                                                        <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Avaliação</span>
                                                            <span className="text-sm font-bold text-white flex items-center gap-1">
                                                                {selectedTrack.product_rating != null ? (
                                                                    <>
                                                                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                                                                        {selectedTrack.product_rating}
                                                                        {selectedTrack.product_reviews != null && (
                                                                            <span className="text-neutral-500 text-xs font-normal">({selectedTrack.product_reviews})</span>
                                                                        )}
                                                                    </>
                                                                ) : '--'}
                                                            </span>
                                                        </div>

                                                        {/* Sales */}
                                                        <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Vendidos</span>
                                                            <span className="text-sm font-bold text-white">
                                                                {selectedTrack.product_sold != null ? selectedTrack.product_sold.toLocaleString('pt-BR') : '--'}
                                                            </span>
                                                        </div>

                                                        {/* Shipping */}
                                                        <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Frete</span>
                                                            <span className="text-sm font-bold text-white">
                                                                {selectedTrack.product_free_shipping ? (
                                                                    <span className="text-green-400">Grátis</span>
                                                                ) : selectedTrack.product_shipping != null ? (
                                                                    `R$ ${formatBRL(selectedTrack.product_shipping)}`
                                                                ) : (
                                                                    <span className="text-neutral-500 font-normal text-xs">Manual</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>


                                                    {/* Fetched at timestamp */}
                                                    {selectedTrack.product_fetched_at && (
                                                        <p className="text-[10px] text-neutral-600 text-right mt-2">
                                                            Dados obtidos em {format(new Date(selectedTrack.product_fetched_at), 'dd/MM/yyyy HH:mm')}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                /* ── Basic Manual View (old tracks without API data) ── */
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

                                    </div>


                                    <div className={activeTab === 'custom' ? 'flex flex-col gap-4' : 'hidden'}>
                                        <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex flex-col gap-1">
                                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                        <Tag className="w-5 h-5 text-primary" /> Campos Personalizados
                                                    </h3>
                                                    <p className="text-xs text-text-secondary">Defina informações extras chave-valor para este criativo.</p>
                                                </div>
                                                {!editingCustomFields ? (
                                                    <button
                                                        onClick={() => {
                                                            const fields = Object.entries(selectedTrack?.custom_fields || {}).map(([key, value]) => ({ key, value }));
                                                            setTabCustomFields(fields.length > 0 ? fields : []);
                                                            setEditingCustomFields(true);
                                                        }}
                                                        className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-xl font-bold hover:bg-primary/20 transition-all text-sm flex items-center gap-2"
                                                    >
                                                        <Edit2 className="w-4 h-4" /> Editar Campos
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setEditingCustomFields(false)}
                                                            className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={handleUpdateCustomFields}
                                                            disabled={saving}
                                                            className="bg-primary text-background-dark font-bold px-4 py-2 rounded-xl hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2 text-sm shadow-lg shadow-primary/10"
                                                        >
                                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {!editingCustomFields ? (
                                                <div className="flex flex-col gap-3">
                                                    {selectedTrack?.custom_fields && Object.keys(selectedTrack.custom_fields).length > 0 ? (
                                                        Object.entries(selectedTrack.custom_fields).map(([k, v]) => (
                                                            <div key={k} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-background-dark/50 border border-border-dark rounded-xl px-4 py-3 group hover:border-primary/30 transition-all">
                                                                <div className="flex-shrink-0 w-full sm:w-32 py-1 px-2.5 bg-white/5 rounded-lg border border-white/10 uppercase text-[10px] font-bold text-neutral-400">
                                                                    {k}
                                                                </div>
                                                                <div className="text-sm text-white font-bold break-all flex-1">
                                                                    {v}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="col-span-full py-12 flex flex-col items-center justify-center bg-background-dark/30 rounded-2xl border border-dashed border-border-dark">
                                                            <Tag className="w-8 h-8 text-neutral-700 mb-3" />
                                                            <p className="text-sm text-neutral-500">Nenhum campo personalizado definido.</p>
                                                            <button
                                                                onClick={() => {
                                                                    setTabCustomFields([]);
                                                                    setEditingCustomFields(true);
                                                                }}
                                                                className="mt-4 text-xs text-primary hover:underline font-bold"
                                                            >
                                                                + Adicionar Primeiro Campo
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    {tabCustomFields.map((field, idx) => (
                                                        <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                <div className="flex flex-col gap-1.5">
                                                                    <label className="text-[10px] text-text-secondary uppercase font-bold px-1">Nome do Campo</label>
                                                                    <input
                                                                        placeholder="Ex: Campanha"
                                                                        value={field.key}
                                                                        onChange={(e) => handleTabCustomFieldChange(idx, 'key', e.target.value)}
                                                                        className="bg-background-dark border border-border-dark rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary transition-all outline-none"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-1.5">
                                                                    <label className="text-[10px] text-text-secondary uppercase font-bold px-1">Valor</label>
                                                                    <input
                                                                        placeholder="Valor"
                                                                        value={field.value}
                                                                        onChange={(e) => handleTabCustomFieldChange(idx, 'value', e.target.value)}
                                                                        className="bg-background-dark border border-border-dark rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary transition-all outline-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleTabRemoveCustomField(idx)}
                                                                className="mt-6 p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                                                title="Remover"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    ))}

                                                    <button
                                                        onClick={handleTabAddCustomField}
                                                        disabled={tabCustomFields.length >= 10}
                                                        className="mt-2 w-fit flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-all border border-dashed border-primary/30"
                                                    >
                                                        <Plus className="w-4 h-4" /> Adicionar Novo Campo
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className={activeTab === 'metrics' ? 'flex flex-col gap-4' : 'hidden'}>
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
                                                                <div key={a.ad_id} className="flex flex-col bg-background-dark/50 border border-border-dark rounded-lg px-2 py-1.5 min-w-[150px]">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="text-xs text-white font-medium truncate max-w-[200px]" title={a.ad_name || a.ad_id}>
                                                                            {a.ad_name || a.ad_id}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => setPreviewAdId(a.ad_id)}
                                                                            className="p-1 hover:bg-white/10 rounded-md text-primary transition-colors ml-2"
                                                                            title="Ver Criativo"
                                                                        >
                                                                            <Eye className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                    {a.ad_link && (
                                                                        <a
                                                                            href={a.ad_link}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-1.5 mt-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors w-full group"
                                                                            title={a.ad_link}
                                                                        >
                                                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                                            <span className="truncate flex-1">{a.ad_link}</span>
                                                                        </a>
                                                                    )}
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
                                            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleTrackKpiDragEnd}>
                                                <SortableContext items={trackKpiOrder} strategy={rectSortingStrategy}>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                        {trackKpiOrder.map((id) => {
                                                            const kpiMap: Record<string, any> = {
                                                                profit: { label: 'Lucro Total', value: `R$ ${formatBRL(kpis.totalProfit)}`, icon: DollarSign, color: kpis.totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
                                                                orders: { label: 'Pedidos Totais', value: kpis.totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-400' },
                                                                completed: { label: 'Pedidos Concluídos', value: `${kpis.completedOrders} (R$ ${formatBRL(kpis.completedValue)})`, icon: CheckCircle2, color: 'text-green-400' },
                                                                pending: { label: 'Pedidos Pendentes', value: `${kpis.pendingOrders} (R$ ${formatBRL(kpis.pendingValue)})`, icon: Clock, color: 'text-yellow-400' },
                                                                cancelled: { label: 'Pedidos Cancelados', value: `${kpis.cancelledOrders} (R$ ${formatBRL(kpis.cancelledValue)})`, icon: XCircle, color: 'text-red-400' },
                                                                avgOrders: { label: 'Média Pedidos/Dia', value: kpis.avgOrdersPerDay.toFixed(1), icon: BarChart3, color: 'text-purple-400' },
                                                                commission: { label: 'Total Comissões', value: `R$ ${formatBRL(kpis.totalCommission)}`, icon: TrendingUp, color: 'text-primary' },
                                                                investment: { label: 'Total Investimento', value: `R$ ${formatBRL(kpis.totalInvestment)}`, icon: PiggyBank, color: 'text-orange-400' },
                                                                profitPct: { label: 'Lucro Médio', value: `${formatPct(kpis.profitPct)}%`, icon: Percent, color: kpis.profitPct >= 0 ? 'text-green-400' : 'text-red-400' },
                                                                shopeeClicks: { label: 'Cliques Shopee', value: kpis.totalShopeeClicks.toString(), icon: MousePointerClick, color: 'text-cyan-400' },
                                                                adClicks: { label: 'Cliques Anúncio', value: kpis.totalAdClicks.toLocaleString('pt-BR'), icon: Target, color: 'text-pink-400' },
                                                                cpc: { label: 'CPC Médio', value: `R$ ${formatBRL(kpis.totalCpc)}`, icon: MousePointerClick, color: 'text-amber-400' },
                                                            };
                                                            const kpi = kpiMap[id];
                                                            if (!kpi) return null;
                                                            return <SortableKpiCard key={id} id={id} kpi={kpi} />;
                                                        })}
                                                    </div>
                                                </SortableContext>
                                            </DndContext>
                                        ) : (
                                            <div className="text-center py-6 bg-surface-dark rounded-2xl border border-border-dark text-neutral-400 text-sm">
                                                Nenhum registro ainda. Adicione o primeiro abaixo.
                                            </div>
                                        )}

                                        {/* Video KPIs */}
                                        {videoKpis && (
                                            <div className="mt-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Video className="w-4 h-4 text-violet-400" />
                                                    <span className="text-sm font-semibold text-white">Métricas de Vídeo</span>
                                                    <span className="text-[10px] text-text-secondary bg-violet-500/10 px-2 py-0.5 rounded-full">Termômetro do Criativo</span>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                    {[
                                                        { label: 'ThruPlay', value: videoKpis.totalThruplay.toLocaleString('pt-BR'), color: 'text-violet-400', hint: 'Assistiu 15s ou mais (ou o vídeo inteiro se for menor que 15s)' },
                                                        { label: '25% Assistido', value: videoKpis.totalP25.toLocaleString('pt-BR'), color: 'text-blue-400', hint: 'Assistiu pelo menos 25% do vídeo' },
                                                        { label: '50% Assistido', value: videoKpis.totalP50.toLocaleString('pt-BR'), color: 'text-cyan-400', hint: 'Assistiu pelo menos metade do vídeo' },
                                                        { label: '95% Assistido', value: videoKpis.totalP95.toLocaleString('pt-BR'), color: 'text-emerald-400', hint: 'Assistiu quase o vídeo inteiro (95%)' },
                                                        { label: 'Retenção (95/25)', value: `${videoKpis.retentionRate.toFixed(1)}%`, color: videoKpis.retentionRate >= 30 ? 'text-green-400' : 'text-amber-400', hint: 'De quem assistiu 25%, quantos foram até 95%' },
                                                    ].map((kpi, i) => (
                                                        <div key={i} className="bg-surface-dark border border-violet-500/20 rounded-2xl p-4 flex flex-col gap-1.5">
                                                            <span className="text-xs text-text-secondary">{kpi.label}</span>
                                                            <span className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</span>
                                                            <span className="text-[10px] leading-tight text-neutral-500">{kpi.hint}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                    </div>

                                    <div className={activeTab === 'conversions' ? 'flex flex-col gap-4' : 'hidden'}>
                                        {/* ══════ Shopee Conversions Section ══════ */}
                                        <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                                            <div className="p-4 border-b border-border-dark flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <ShoppingCart size={16} className="text-orange-400" />
                                                    <h3 className="text-sm font-bold text-white">
                                                        Conversões Shopee ({filteredConversions.length})
                                                    </h3>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <button
                                                        onClick={handleSyncConversions}
                                                        disabled={syncingConversions}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-orange-400 border border-orange-400/30 hover:bg-orange-400/10 transition-all disabled:opacity-50"
                                                    >
                                                        {syncingConversions ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                        Sync Conversões
                                                    </button>
                                                    <button
                                                        onClick={handleSyncValidated}
                                                        disabled={syncingValidated}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 transition-all disabled:opacity-50"
                                                    >
                                                        {syncingValidated ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                                        Sync Validadas
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Conversion KPIs */}
                                            {filteredConversions.length > 0 && (() => {
                                                const totalNetComm = filteredConversions.reduce((s, c) => s + (c.item_total_commission || 0), 0);
                                                const validatedComm = filteredConversions.filter(c => c.is_validated).reduce((s, c) => s + (c.item_total_commission || 0), 0);
                                                const totalOrders = new Set(filteredConversions.map(c => c.order_id).filter(Boolean)).size;
                                                const validatedOrders = new Set(filteredConversions.filter(c => c.is_validated).map(c => c.order_id).filter(Boolean)).size;
                                                const fraudCount = filteredConversions.filter(c => c.fraud_status && c.fraud_status !== 'NONE' && c.fraud_status !== '').length;
                                                const fraudPct = filteredConversions.length > 0 ? ((fraudCount / filteredConversions.length) * 100) : 0;
                                                const directCount = filteredConversions.filter(c => c.attribution_type === 'DIRECT' || c.attribution_type === 'direct').length;
                                                const indirectCount = filteredConversions.filter(c => c.attribution_type !== 'DIRECT' && c.attribution_type !== 'direct' && c.attribution_type).length;

                                                return (
                                                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                        <div className="bg-background-dark border border-orange-500/20 rounded-xl p-3 flex flex-col gap-1">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider">Comissão Total</span>
                                                            <span className="text-base sm:text-lg font-bold text-orange-400">{formatBRL(totalNetComm)}</span>
                                                            {validatedComm > 0 && (
                                                                <span className="text-[10px] text-emerald-400">✅ {formatBRL(validatedComm)} validada</span>
                                                            )}
                                                        </div>
                                                        <div className="bg-background-dark border border-blue-500/20 rounded-xl p-3 flex flex-col gap-1">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider">Pedidos</span>
                                                            <span className="text-base sm:text-lg font-bold text-blue-400">{totalOrders}</span>
                                                            {validatedOrders > 0 && (
                                                                <span className="text-[10px] text-emerald-400">✅ {validatedOrders} validados</span>
                                                            )}
                                                        </div>
                                                        <div className="bg-background-dark border border-red-500/20 rounded-xl p-3 flex flex-col gap-1">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider">Taxa Fraude</span>
                                                            <span className={`text-base sm:text-lg font-bold ${fraudPct > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                {fraudPct.toFixed(1)}%
                                                            </span>
                                                            <span className="text-[10px] text-text-secondary">{fraudCount} suspeito(s)</span>
                                                        </div>
                                                        <div className="bg-background-dark border border-violet-500/20 rounded-xl p-3 flex flex-col gap-1">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider">Atribuição</span>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-sm font-bold text-green-400">{directCount}D</span>
                                                                <span className="text-[10px] text-text-secondary">vs</span>
                                                                <span className="text-sm font-bold text-amber-400">{indirectCount}I</span>
                                                            </div>
                                                            <span className="text-[10px] text-text-secondary">Diretas vs Indiretas</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Conversion List */}
                                            {filteredConversions.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full w-full text-xs">
                                                        <thead>
                                                            <tr className="border-t border-border-dark bg-background-dark">
                                                                <th className="px-3 py-2 text-left text-text-secondary font-medium whitespace-nowrap">Data</th>
                                                                <th className="px-3 py-2 text-left text-text-secondary font-medium whitespace-nowrap">Produto</th>
                                                                <th className="px-3 py-2 text-right text-text-secondary font-medium whitespace-nowrap">Qtd</th>
                                                                <th className="px-3 py-2 text-right text-text-secondary font-medium whitespace-nowrap">Comissão</th>
                                                                <th className="px-3 py-2 text-center text-text-secondary font-medium whitespace-nowrap">Status</th>
                                                                <th className="px-3 py-2 text-center text-text-secondary font-medium whitespace-nowrap">Tipo</th>
                                                                <th className="px-3 py-2 text-center text-text-secondary font-medium whitespace-nowrap">Validado</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredConversions.slice(0, 50).map((conv) => (
                                                                <tr key={conv.id} className="border-t border-border-dark/50 hover:bg-surface-dark/50 transition-colors">
                                                                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                                                                        {conv.purchase_time ? format(new Date(conv.purchase_time), 'dd/MM HH:mm') : '—'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-white min-w-0">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            {conv.image_url && (
                                                                                <img src={conv.image_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                                                                            )}
                                                                            <span className="truncate max-w-[180px]">{conv.item_name || `Item #${conv.item_id}`}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right text-white whitespace-nowrap">{conv.qty}</td>
                                                                    <td className="px-3 py-2 text-right font-medium text-orange-400 whitespace-nowrap">
                                                                        {formatBRL(conv.item_total_commission)}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center whitespace-nowrap">
                                                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${['PAID', 'VALIDATED', 'COMPLETED'].includes(conv.conversion_status || '')
                                                                            ? 'bg-emerald-500/20 text-emerald-400'
                                                                            : ['CANCELLED', 'INVALID', 'FAILED', 'UNPAID'].includes(conv.conversion_status || '')
                                                                                ? 'bg-red-500/20 text-red-400'
                                                                                : 'bg-amber-500/20 text-amber-400'
                                                                            }`}>
                                                                            {conv.conversion_status || 'PENDING'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center whitespace-nowrap">
                                                                        <span className={`text-[10px] ${conv.attribution_type === 'DIRECT' || conv.attribution_type === 'direct'
                                                                            ? 'text-green-400' : 'text-amber-400'
                                                                            }`}>
                                                                            {conv.attribution_type === 'DIRECT' || conv.attribution_type === 'direct' ? 'Direta' : conv.attribution_type || '—'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        {conv.is_validated ? (
                                                                            <ShieldCheck size={14} className="text-emerald-400 mx-auto" />
                                                                        ) : conv.fraud_status && conv.fraud_status !== 'NONE' && conv.fraud_status !== '' ? (
                                                                            <AlertTriangle size={14} className="text-red-400 mx-auto" />
                                                                        ) : (
                                                                            <span className="text-text-secondary">—</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {filteredConversions.length > 50 && (
                                                        <div className="p-3 text-center text-xs text-text-secondary border-t border-border-dark/50">
                                                            Mostrando 50 de {filteredConversions.length} conversões
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="p-6 text-center text-sm text-text-secondary">
                                                    Nenhuma conversão sincronizada. Use os botões acima para buscar dados da API Shopee.
                                                </div>
                                            )}
                                        </div>

                                    </div>

                                    <div className={activeTab === 'metrics' ? 'flex flex-col gap-4' : 'hidden'}>
                                        {/* Entries Table */}
                                        {
                                            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                                                <div className="p-4 border-b border-border-dark flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-sm font-bold text-white">Histórico ({filteredEntries.length} registros)</h3>
                                                        <span className="hidden sm:inline-block text-xs font-normal text-text-secondary bg-background-dark px-2.5 py-1 rounded-md border border-border-dark">
                                                            Dê 2 cliques na linha para editar
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowManualEntry(true)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary border border-primary/30 hover:bg-primary/10 transition-all"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Registro Manual
                                                    </button>
                                                </div>
                                                {filteredEntries.length > 0 ? (
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
                                                            <tbody className="divide-y divide-border-dark/30">
                                                                {filteredEntries.map(entry => {
                                                                    const isEditing = editingEntryId === entry.id;

                                                                    // Funnel evaluation
                                                                    const entryIndex = entries.indexOf(entry);
                                                                    const dayNumber = entries.length - entryIndex; // Day 1 = oldest entry
                                                                    let funnelStatus: 'pass' | 'fail' | 'none' = 'none';
                                                                    if (linkedFunnel) {
                                                                        const funnelDay = linkedFunnel.days?.find(d => d.day === dayNumber);
                                                                        const maxFunnelDay = Math.max(...(linkedFunnel.days || []).map(d => d.day), 0);

                                                                        // Use maintenance groups for days beyond configured ones
                                                                        const mConds = linkedFunnel.maintenance_conditions;
                                                                        const maintenanceGroups = (Array.isArray(mConds) && mConds.length > 0 && typeof mConds[0] === 'object' && 'id' in mConds[0])
                                                                            ? (mConds as FunnelConditionGroup[])
                                                                            : null;

                                                                        const groupsToEval = funnelDay?.condition_groups?.length
                                                                            ? funnelDay.condition_groups
                                                                            : (dayNumber > maxFunnelDay && maintenanceGroups)
                                                                                ? maintenanceGroups
                                                                                : null;

                                                                        // Fallback for legacy structure if present
                                                                        const legacyConditions = funnelDay?.conditions || (dayNumber > maxFunnelDay && !maintenanceGroups ? (mConds as FunnelCondition[]) : null);

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

                                                                        if (groupsToEval && groupsToEval.length > 0) {
                                                                            // LOGIC OR: If ANY group matches its internal conditions, the day passes
                                                                            const anyGroupPass = groupsToEval.some(group => {
                                                                                if (!group.conditions || group.conditions.length === 0) return false;
                                                                                // LOGIC AND: All conditions in a group must match
                                                                                return group.conditions.every(cond => {
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
                                                                            });
                                                                            funnelStatus = anyGroupPass ? 'pass' : 'fail';
                                                                        } else if (legacyConditions && legacyConditions.length > 0) {
                                                                            // Backward compatibility for legacy funnels
                                                                            const allPass = legacyConditions.every(cond => {
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
                                                            {filteredEntries.length > 0 && (() => {
                                                                const totals = filteredEntries.reduce((acc, entry) => {
                                                                    acc.ad_clicks += Number(entry.ad_clicks || 0);
                                                                    acc.shopee_clicks += Number(entry.shopee_clicks || 0);
                                                                    acc.orders += Number(entry.orders || 0);
                                                                    acc.commission += Number(entry.commission_value || 0);
                                                                    acc.investment += Number(entry.investment || 0);
                                                                    return acc;
                                                                }, { ad_clicks: 0, shopee_clicks: 0, orders: 0, commission: 0, investment: 0 });

                                                                const totalProfit = totals.commission - totals.investment;
                                                                const totalRoi = totals.investment > 0 ? (totalProfit / totals.investment) * 100 : 0;
                                                                const avgCpc = totals.ad_clicks > 0 ? (totals.investment / totals.ad_clicks) : 0;

                                                                return (
                                                                    <tfoot className="border-t-2 border-border-dark bg-background-dark font-bold text-sm">
                                                                        <tr>
                                                                            {linkedFunnel && <td className="p-3"></td>}
                                                                            <td className="p-3 text-left text-white">TOTAL</td>
                                                                            <td className="p-3 text-right text-neutral-300">{totals.ad_clicks}</td>
                                                                            <td className="p-3 text-right text-neutral-300">{totals.shopee_clicks}</td>
                                                                            <td className="p-3 text-right text-neutral-300">R$ {formatBRL(avgCpc)}</td>
                                                                            <td className="p-3 text-right text-blue-400">{totals.orders}</td>
                                                                            <td className="p-3 text-right text-primary">R$ {formatBRL(totals.commission)}</td>
                                                                            <td className="p-3 text-right text-orange-400">R$ {formatBRL(totals.investment)}</td>
                                                                            <td className={`p-3 text-right ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {formatBRL(totalProfit)}</td>
                                                                            <td className={`p-3 text-right text-xs ${totalRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPct(totalRoi)}%</td>
                                                                            <td className="p-3"></td>
                                                                        </tr>
                                                                    </tfoot>
                                                                );
                                                            })()}
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center text-neutral-400 text-sm">
                                                        Nenhum registro ainda. Adicione o primeiro abaixo.
                                                    </div>
                                                )}
                                            </div>
                                        }
                                    </div>
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
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm overflow-hidden">
                                    <div className="bg-surface-dark border border-border-dark rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                                        <div className="flex items-center justify-between p-4 border-b border-border-dark">
                                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                                <Plus className="w-5 h-5 text-primary" />
                                                Registro Manual
                                            </h2>
                                            <button onClick={() => setShowManualEntry(false)} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                </>
            )}

            {/* KANBAN DETAIL MODAL */}
            {showKanbanModal && selectedTrack && viewMode === 'kanban' && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center bg-background-dark/95 backdrop-blur-md overflow-y-auto"
                    onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget) { setShowKanbanModal(false); setSelectedTrack(null); } }}
                >
                    <div className="w-full max-w-5xl my-6 mx-4 bg-background-dark rounded-2xl border border-border-dark shadow-2xl shadow-black/50 p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white truncate flex-1 min-w-0 mr-4" title={selectedTrack.name}>
                                {selectedTrack.name}
                            </h2>
                            <button
                                onClick={() => { setShowKanbanModal(false); setSelectedTrack(null); }}
                                className="p-2.5 rounded-xl bg-surface-dark border border-border-dark text-neutral-400 hover:text-white hover:border-red-500/40 hover:bg-red-500/10 transition-all shrink-0"
                                title="Fechar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-5">
                            <>
                                {/* Track Header */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className="flex flex-col gap-1">
                                                {editingTrack ? (
                                                    <input
                                                        className="bg-background-dark border border-primary rounded-lg p-2 text-white text-lg sm:text-xl font-bold outline-none w-full"
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2 group">
                                                        <h2 className={`text-lg sm:text-xl font-bold text-white transition-all ${hideSensitive ? 'blur-md select-none' : ''}`}>
                                                            {selectedTrack.name}
                                                        </h2>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await navigator.clipboard.writeText(selectedTrack.name);
                                                                        showToast('Nome copiado para a área de transferência!', 'success');
                                                                    } catch (err) {
                                                                        showToast('Erro ao copiar nome.', 'error');
                                                                    }
                                                                }}
                                                                className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                                                                title="Copiar Nome"
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingTrack(true);
                                                                    setEditName(selectedTrack.name);
                                                                    setEditLink(selectedTrack.affiliate_link || '');
                                                                    setEditSubIds(selectedTrack.sub_id
                                                                        ? selectedTrack.sub_id.split(/[-,]/).map((s: string) => s.trim()).filter(Boolean)
                                                                        : ['']);
                                                                }}
                                                                className="p-1 rounded-md text-neutral-500 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                                                                title="Editar Criativo"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedTrack.sub_id && !editingTrack && (
                                                    <span className={`w-fit px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold font-mono transition-all ${hideSensitive ? 'blur-sm select-none' : ''}`}>
                                                        {selectedTrack.sub_id}
                                                    </span>
                                                )}
                                                {selectedTrack.affiliate_link && !editingTrack && (
                                                    <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-surface-highlight/50 border border-border-dark rounded-lg w-fit">
                                                        <span className={`text-[10px] sm:text-xs text-text-secondary font-mono truncate max-w-[150px] sm:max-w-[250px] transition-all ${hideSensitive ? 'blur-sm select-none' : ''}`}>
                                                            {selectedTrack.affiliate_link}
                                                        </span>
                                                        <button
                                                            onClick={() => handleCopyTrackLink(selectedTrack.affiliate_link)}
                                                            className="text-primary hover:text-primary-light transition-colors p-0.5"
                                                            title="Copiar Link"
                                                        >
                                                            {trackLinkCopied ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                                        </button>
                                                        <a
                                                            href={selectedTrack.affiliate_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:text-primary-light transition-colors p-0.5"
                                                            title="Acessar Link do Produto"
                                                        >
                                                            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                        </a>

                                                        {/* Link Verification Shield */}
                                                        {(() => {
                                                            const status = getLinkIntegrity(selectedTrack.affiliate_link, fbLinkedAds);
                                                            if (status === 'valid') return (
                                                                <div className="group relative flex items-center ml-1">
                                                                    <div className="flex items-center text-green-500 cursor-help">
                                                                        <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-green-500/10" />
                                                                    </div>
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-900 border border-green-500/20 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl text-center leading-relaxed">
                                                                        <span className="font-bold text-green-400 block mb-0.5">Link Verificado ✅</span>
                                                                        O mesmo link configurado aqui está presente nos seus anúncios do Facebook.
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900"></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                            if (status === 'error') return (
                                                                <div className="group relative flex items-center ml-1">
                                                                    <div className="flex items-center text-red-500 cursor-help">
                                                                        <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-red-500/10" />
                                                                    </div>
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-neutral-900 border border-red-500/20 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl text-center leading-relaxed">
                                                                        <span className="font-bold text-red-400 block mb-0.5">Links Divergentes! ⚠️</span>
                                                                        O link desta track no MOP NÃO é o mesmo usado nos anúncios do Facebook. Verifique para não perder o rastreio.
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900"></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                            return null;
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
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
                                                </div>
                                            )}
                                        </div>

                                        {!editingTrack && selectedTrack && (
                                            <div className="flex items-center gap-1 bg-background-dark/50 p-1 rounded-xl border border-border-dark w-fit">
                                                <button
                                                    onClick={() => handleUpdateStatus(selectedTrack, 'rascunho')}
                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${selectedTrack.status === 'rascunho'
                                                        ? 'bg-white text-background-dark shadow-lg shadow-white/20'
                                                        : 'text-neutral-500 hover:text-white hover:bg-white/10'
                                                        }`}
                                                    title="Marcar como Rascunho"
                                                >
                                                    <FileEdit className="w-3.5 h-3.5" /> Rascunho
                                                </button>
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
                                                    onClick={() => handleArchiveTrack(selectedTrack, !selectedTrack.is_archived)}
                                                    disabled={saving}
                                                    className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors border disabled:opacity-50 ${selectedTrack.is_archived
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:text-emerald-300'
                                                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:text-amber-300'
                                                        }`}
                                                >
                                                    {selectedTrack.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                                    {selectedTrack.is_archived ? 'Desarquivar' : 'Arquivar'}
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteTrack(selectedTrack)}
                                                    disabled={saving}
                                                    className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors disabled:opacity-50 ${selectedTrack.is_archived
                                                        ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                                        : 'text-neutral-500 cursor-not-allowed'
                                                        }`}
                                                    title={selectedTrack.is_archived ? 'Excluir permanentemente' : 'Arquive antes de excluir'}
                                                >
                                                    <Trash2 className="w-4 h-4" /> Excluir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Tabs Navigation */}
                                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border-dark scrollbar-track-transparent mt-2">
                                    <button
                                        onClick={() => setActiveTab('metrics')}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'metrics' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' : 'bg-surface-dark text-text-secondary border border-border-dark hover:text-white hover:border-primary/50'}`}
                                    >
                                        <BarChart3 className="w-4 h-4" /> Métricas
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('product')}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'product' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' : 'bg-surface-dark text-text-secondary border border-border-dark hover:text-white hover:border-primary/50'}`}
                                    >
                                        <PackageSearch className="w-4 h-4" /> Dados do Produto
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('custom')}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'custom' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' : 'bg-surface-dark text-text-secondary border border-border-dark hover:text-white hover:border-primary/50'}`}
                                    >
                                        <Tag className="w-4 h-4" /> Campos
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('conversions')}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'conversions' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' : 'bg-surface-dark text-text-secondary border border-border-dark hover:text-white hover:border-primary/50'}`}
                                    >
                                        <ShoppingCart className="w-4 h-4" /> Conversões
                                    </button>
                                </div>

                                <div className={activeTab === 'metrics' ? 'flex flex-col gap-4' : 'hidden'}>
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
                                            <div className="flex flex-col gap-1 sm:col-span-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs text-text-secondary">Sub IDs (separados por -)</label>
                                                    {editSubIds.length < 5 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditSubIds([...editSubIds, ''])}
                                                            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                                                        >
                                                            <Plus className="w-3 h-3" /> Adicionar Sub ID
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {editSubIds.map((sid, idx) => (
                                                        <div key={idx} className="flex items-center gap-1">
                                                            {idx > 0 && <span className="text-text-secondary text-sm font-bold">-</span>}
                                                            <input
                                                                className="bg-background-dark border border-border-dark rounded-lg p-2.5 text-white outline-none focus:border-primary transition-colors text-sm w-40"
                                                                value={sid}
                                                                onChange={e => {
                                                                    const updated = [...editSubIds];
                                                                    updated[idx] = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                                                                    setEditSubIds(updated);
                                                                }}
                                                                placeholder={`Sub ID ${idx + 1}`}
                                                            />
                                                            {editSubIds.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditSubIds(editSubIds.filter((_, i) => i !== idx))}
                                                                    className="text-neutral-500 hover:text-red-400 transition-colors p-0.5"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-start gap-1.5 mt-1 text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-lg px-2.5 py-2">
                                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                                    <span className="text-[11px] leading-relaxed">Alterar os Sub IDs pode desvincular conversões já sincronizadas com a Shopee e/ou Meta Ads. Recomenda-se gerar um novo link após a alteração.</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>

                                <div className={activeTab === 'product' ? 'flex flex-col gap-4' : 'hidden'}>
                                    {/* Product Details Section */}
                                    <div className="bg-surface-dark border border-border-dark rounded-2xl p-4">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                <PackageSearch className="w-4 h-4 text-orange-400" />
                                                Dados do Produto {!selectedTrack.product_name && <span className="text-xs font-normal text-text-secondary">(Opcional)</span>}
                                            </h3>
                                            {!editingProduct && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => { setFetchProductError(null); handleFetchProductData(); }}
                                                        disabled={fetchingProductData || !selectedTrack.affiliate_link}
                                                        className="px-3 py-1.5 rounded-lg text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 border border-orange-500/20 transition-colors text-xs flex items-center gap-1.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {fetchingProductData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                        {fetchingProductData ? 'Buscando...' : 'Buscar Dados Shopee'}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingProduct(true)}
                                                        className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-xs flex items-center gap-1"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" /> Editar Dados
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {fetchProductError && (
                                            <div className="mb-3 bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg flex gap-2 text-xs">
                                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                                <span>{fetchProductError}</span>
                                            </div>
                                        )}

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
                                        ) : selectedTrack.product_name ? (
                                            /* ── Rich API Data View ── */
                                            <div className="flex flex-col gap-4">
                                                {/* Product header: image + name + shop */}
                                                <div className="flex gap-4">
                                                    {selectedTrack.product_image_url ? (
                                                        <img
                                                            src={selectedTrack.product_image_url}
                                                            alt={selectedTrack.product_name}
                                                            className="w-24 h-24 rounded-xl object-cover border border-border-dark flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-24 h-24 rounded-xl bg-background-dark border border-border-dark flex items-center justify-center flex-shrink-0">
                                                            <ImageIcon className="w-8 h-8 text-neutral-600" />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col gap-1.5 min-w-0">
                                                        <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug">
                                                            {selectedTrack.product_name}
                                                        </h4>
                                                        {selectedTrack.product_shop_name && (
                                                            <div className="flex items-center gap-1.5">
                                                                <Store className="w-3.5 h-3.5 text-neutral-500" />
                                                                <span className="text-xs text-neutral-400">{selectedTrack.product_shop_name}</span>
                                                                {selectedTrack.product_shop_rating != null && (
                                                                    <span className="text-xs text-yellow-400 flex items-center gap-0.5 ml-1">
                                                                        <Star className="w-3 h-3 fill-yellow-400" /> {selectedTrack.product_shop_rating}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {selectedTrack.product_link && (
                                                            <a
                                                                href={selectedTrack.product_link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                                                            >
                                                                <ExternalLink className="w-3 h-3" /> Ver na Shopee
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Data grid */}
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                                    {/* Price */}
                                                    <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Preço</span>
                                                        <span className="text-sm font-bold text-primary">
                                                            R$ {selectedTrack.product_price != null ? formatBRL(selectedTrack.product_price) : '--'}
                                                        </span>
                                                        {selectedTrack.product_price_min != null && selectedTrack.product_price_max != null && selectedTrack.product_price_min !== selectedTrack.product_price_max && (
                                                            <span className="text-[10px] text-neutral-500 block">
                                                                R$ {formatBRL(selectedTrack.product_price_min)} ~ R$ {formatBRL(selectedTrack.product_price_max)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Discount */}
                                                    {selectedTrack.product_discount_rate != null && selectedTrack.product_discount_rate > 0 && (
                                                        <div className="bg-background-dark/50 border border-red-500/20 rounded-xl px-3 py-2.5">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Desconto</span>
                                                            <span className="text-sm font-bold text-red-400">-{selectedTrack.product_discount_rate}%</span>
                                                        </div>
                                                    )}

                                                    {/* Commission Total */}
                                                    <div className="bg-background-dark/50 border border-green-500/20 rounded-xl px-3 py-2.5">
                                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Comissão</span>
                                                        <span className="text-sm font-bold text-green-400">
                                                            {selectedTrack.product_commission != null ? `R$ ${formatBRL(selectedTrack.product_commission)}` : '--'}
                                                        </span>
                                                        {selectedTrack.product_commission_rate != null && (
                                                            <span className="text-[10px] text-green-400/60 block">
                                                                {formatPct(selectedTrack.product_commission_rate * 100)}% total
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Seller Commission Rate */}
                                                    {selectedTrack.product_seller_commission_rate != null && (
                                                        <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Com. Vendedor</span>
                                                            <span className="text-sm font-bold text-white">
                                                                {formatPct(selectedTrack.product_seller_commission_rate * 100)}%
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Shopee Commission Rate */}
                                                    {selectedTrack.product_shopee_commission_rate != null && (
                                                        <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                            <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Com. Shopee</span>
                                                            <span className="text-sm font-bold text-white">
                                                                {formatPct(selectedTrack.product_shopee_commission_rate * 100)}%
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Rating */}
                                                    <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Avaliação</span>
                                                        <span className="text-sm font-bold text-white flex items-center gap-1">
                                                            {selectedTrack.product_rating != null ? (
                                                                <>
                                                                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                                                                    {selectedTrack.product_rating}
                                                                    {selectedTrack.product_reviews != null && (
                                                                        <span className="text-neutral-500 text-xs font-normal">({selectedTrack.product_reviews})</span>
                                                                    )}
                                                                </>
                                                            ) : '--'}
                                                        </span>
                                                    </div>

                                                    {/* Sales */}
                                                    <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Vendidos</span>
                                                        <span className="text-sm font-bold text-white">
                                                            {selectedTrack.product_sold != null ? selectedTrack.product_sold.toLocaleString('pt-BR') : '--'}
                                                        </span>
                                                    </div>

                                                    {/* Shipping */}
                                                    <div className="bg-background-dark/50 border border-border-dark rounded-xl px-3 py-2.5">
                                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider block">Frete</span>
                                                        <span className="text-sm font-bold text-white">
                                                            {selectedTrack.product_free_shipping ? (
                                                                <span className="text-green-400">Grátis</span>
                                                            ) : selectedTrack.product_shipping != null ? (
                                                                `R$ ${formatBRL(selectedTrack.product_shipping)}`
                                                            ) : (
                                                                <span className="text-neutral-500 font-normal text-xs">Manual</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>


                                                {/* Fetched at timestamp */}
                                                {selectedTrack.product_fetched_at && (
                                                    <p className="text-[10px] text-neutral-600 text-right mt-2">
                                                        Dados obtidos em {format(new Date(selectedTrack.product_fetched_at), 'dd/MM/yyyy HH:mm')}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            /* ── Basic Manual View (old tracks without API data) ── */
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

                                </div>


                                <div className={activeTab === 'custom' ? 'flex flex-col gap-4' : 'hidden'}>
                                    <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex flex-col gap-1">
                                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                    <Tag className="w-5 h-5 text-primary" /> Campos Personalizados
                                                </h3>
                                                <p className="text-xs text-text-secondary">Defina informações extras chave-valor para este criativo.</p>
                                            </div>
                                            {!editingCustomFields ? (
                                                <button
                                                    onClick={() => {
                                                        const fields = Object.entries(selectedTrack?.custom_fields || {}).map(([key, value]) => ({ key, value }));
                                                        setTabCustomFields(fields.length > 0 ? fields : []);
                                                        setEditingCustomFields(true);
                                                    }}
                                                    className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-xl font-bold hover:bg-primary/20 transition-all text-sm flex items-center gap-2"
                                                >
                                                    <Edit2 className="w-4 h-4" /> Editar Campos
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setEditingCustomFields(false)}
                                                        className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={handleUpdateCustomFields}
                                                        disabled={saving}
                                                        className="bg-primary text-background-dark font-bold px-4 py-2 rounded-xl hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2 text-sm shadow-lg shadow-primary/10"
                                                    >
                                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {!editingCustomFields ? (
                                            <div className="flex flex-col gap-3">
                                                {selectedTrack?.custom_fields && Object.keys(selectedTrack.custom_fields).length > 0 ? (
                                                    Object.entries(selectedTrack.custom_fields).map(([k, v]) => (
                                                        <div key={k} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-background-dark/50 border border-border-dark rounded-xl px-4 py-3 group hover:border-primary/30 transition-all">
                                                            <div className="flex-shrink-0 w-full sm:w-32 py-1 px-2.5 bg-white/5 rounded-lg border border-white/10 uppercase text-[10px] font-bold text-neutral-400">
                                                                {k}
                                                            </div>
                                                            <div className="text-sm text-white font-bold break-all flex-1">
                                                                {v}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="col-span-full py-12 flex flex-col items-center justify-center bg-background-dark/30 rounded-2xl border border-dashed border-border-dark">
                                                        <Tag className="w-8 h-8 text-neutral-700 mb-3" />
                                                        <p className="text-sm text-neutral-500">Nenhum campo personalizado definido.</p>
                                                        <button
                                                            onClick={() => {
                                                                setTabCustomFields([]);
                                                                setEditingCustomFields(true);
                                                            }}
                                                            className="mt-4 text-xs text-primary hover:underline font-bold"
                                                        >
                                                            + Adicionar Primeiro Campo
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                {tabCustomFields.map((field, idx) => (
                                                    <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className="text-[10px] text-text-secondary uppercase font-bold px-1">Nome do Campo</label>
                                                                <input
                                                                    placeholder="Ex: Campanha"
                                                                    value={field.key}
                                                                    onChange={(e) => handleTabCustomFieldChange(idx, 'key', e.target.value)}
                                                                    className="bg-background-dark border border-border-dark rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary transition-all outline-none"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className="text-[10px] text-text-secondary uppercase font-bold px-1">Valor</label>
                                                                <input
                                                                    placeholder="Valor"
                                                                    value={field.value}
                                                                    onChange={(e) => handleTabCustomFieldChange(idx, 'value', e.target.value)}
                                                                    className="bg-background-dark border border-border-dark rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary transition-all outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleTabRemoveCustomField(idx)}
                                                            className="mt-6 p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                                            title="Remover"
                                                        >
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ))}

                                                <button
                                                    onClick={handleTabAddCustomField}
                                                    disabled={tabCustomFields.length >= 10}
                                                    className="mt-2 w-fit flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-all border border-dashed border-primary/30"
                                                >
                                                    <Plus className="w-4 h-4" /> Adicionar Novo Campo
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={activeTab === 'metrics' ? 'flex flex-col gap-4' : 'hidden'}>
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
                                                            <div key={a.ad_id} className="flex flex-col bg-background-dark/50 border border-border-dark rounded-lg px-2 py-1.5 min-w-[150px]">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-xs text-white font-medium truncate max-w-[200px]" title={a.ad_name || a.ad_id}>
                                                                        {a.ad_name || a.ad_id}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => setPreviewAdId(a.ad_id)}
                                                                        className="p-1 hover:bg-white/10 rounded-md text-primary transition-colors ml-2"
                                                                        title="Ver Criativo"
                                                                    >
                                                                        <Eye className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                                {a.ad_link && (
                                                                    <a
                                                                        href={a.ad_link}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-1.5 mt-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors w-full group"
                                                                        title={a.ad_link}
                                                                    >
                                                                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                                        <span className="truncate flex-1">{a.ad_link}</span>
                                                                    </a>
                                                                )}
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
                                        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleTrackKpiDragEnd}>
                                            <SortableContext items={trackKpiOrder} strategy={rectSortingStrategy}>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {trackKpiOrder.map((id) => {
                                                        const kpiMap: Record<string, any> = {
                                                            profit: { label: 'Lucro Total', value: `R$ ${formatBRL(kpis.totalProfit)}`, icon: DollarSign, color: kpis.totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
                                                            orders: { label: 'Pedidos Totais', value: kpis.totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-400' },
                                                            completed: { label: 'Pedidos Concluídos', value: `${kpis.completedOrders} (R$ ${formatBRL(kpis.completedValue)})`, icon: CheckCircle2, color: 'text-green-400' },
                                                            pending: { label: 'Pedidos Pendentes', value: `${kpis.pendingOrders} (R$ ${formatBRL(kpis.pendingValue)})`, icon: Clock, color: 'text-yellow-400' },
                                                            cancelled: { label: 'Pedidos Cancelados', value: `${kpis.cancelledOrders} (R$ ${formatBRL(kpis.cancelledValue)})`, icon: XCircle, color: 'text-red-400' },
                                                            avgOrders: { label: 'Média Pedidos/Dia', value: kpis.avgOrdersPerDay.toFixed(1), icon: BarChart3, color: 'text-purple-400' },
                                                            commission: { label: 'Total Comissões', value: `R$ ${formatBRL(kpis.totalCommission)}`, icon: TrendingUp, color: 'text-primary' },
                                                            investment: { label: 'Total Investimento', value: `R$ ${formatBRL(kpis.totalInvestment)}`, icon: PiggyBank, color: 'text-orange-400' },
                                                            profitPct: { label: 'Lucro Médio', value: `${formatPct(kpis.profitPct)}%`, icon: Percent, color: kpis.profitPct >= 0 ? 'text-green-400' : 'text-red-400' },
                                                            shopeeClicks: { label: 'Cliques Shopee', value: kpis.totalShopeeClicks.toString(), icon: MousePointerClick, color: 'text-cyan-400' },
                                                            adClicks: { label: 'Cliques Anúncio', value: kpis.totalAdClicks.toLocaleString('pt-BR'), icon: Target, color: 'text-pink-400' },
                                                            cpc: { label: 'CPC Médio', value: `R$ ${formatBRL(kpis.totalCpc)}`, icon: MousePointerClick, color: 'text-amber-400' },
                                                        };
                                                        const kpi = kpiMap[id];
                                                        if (!kpi) return null;
                                                        return <SortableKpiCard key={id} id={id} kpi={kpi} />;
                                                    })}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    ) : (
                                        <div className="text-center py-6 bg-surface-dark rounded-2xl border border-border-dark text-neutral-400 text-sm">
                                            Nenhum registro ainda. Adicione o primeiro abaixo.
                                        </div>
                                    )}

                                    {/* Video KPIs */}
                                    {videoKpis && (
                                        <div className="mt-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Video className="w-4 h-4 text-violet-400" />
                                                <span className="text-sm font-semibold text-white">Métricas de Vídeo</span>
                                                <span className="text-[10px] text-text-secondary bg-violet-500/10 px-2 py-0.5 rounded-full">Termômetro do Criativo</span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                {[
                                                    { label: 'ThruPlay', value: videoKpis.totalThruplay.toLocaleString('pt-BR'), color: 'text-violet-400', hint: 'Assistiu 15s ou mais (ou o vídeo inteiro se for menor que 15s)' },
                                                    { label: '25% Assistido', value: videoKpis.totalP25.toLocaleString('pt-BR'), color: 'text-blue-400', hint: 'Assistiu pelo menos 25% do vídeo' },
                                                    { label: '50% Assistido', value: videoKpis.totalP50.toLocaleString('pt-BR'), color: 'text-cyan-400', hint: 'Assistiu pelo menos metade do vídeo' },
                                                    { label: '95% Assistido', value: videoKpis.totalP95.toLocaleString('pt-BR'), color: 'text-emerald-400', hint: 'Assistiu quase o vídeo inteiro (95%)' },
                                                    { label: 'Retenção (95/25)', value: `${videoKpis.retentionRate.toFixed(1)}%`, color: videoKpis.retentionRate >= 30 ? 'text-green-400' : 'text-amber-400', hint: 'De quem assistiu 25%, quantos foram até 95%' },
                                                ].map((kpi, i) => (
                                                    <div key={i} className="bg-surface-dark border border-violet-500/20 rounded-2xl p-4 flex flex-col gap-1.5">
                                                        <span className="text-xs text-text-secondary">{kpi.label}</span>
                                                        <span className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</span>
                                                        <span className="text-[10px] leading-tight text-neutral-500">{kpi.hint}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>

                                <div className={activeTab === 'conversions' ? 'flex flex-col gap-4' : 'hidden'}>
                                    {/* ══════ Shopee Conversions Section ══════ */}
                                    <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                                        <div className="p-4 border-b border-border-dark flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <ShoppingCart size={16} className="text-orange-400" />
                                                <h3 className="text-sm font-bold text-white">
                                                    Conversões Shopee ({filteredConversions.length})
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={handleSyncConversions}
                                                    disabled={syncingConversions}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-orange-400 border border-orange-400/30 hover:bg-orange-400/10 transition-all disabled:opacity-50"
                                                >
                                                    {syncingConversions ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                    Sync Conversões
                                                </button>
                                                <button
                                                    onClick={handleSyncValidated}
                                                    disabled={syncingValidated}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 transition-all disabled:opacity-50"
                                                >
                                                    {syncingValidated ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                                    Sync Validadas
                                                </button>
                                            </div>
                                        </div>

                                        {/* Conversion KPIs */}
                                        {filteredConversions.length > 0 && (() => {
                                            const totalNetComm = filteredConversions.reduce((s, c) => s + (c.item_total_commission || 0), 0);
                                            const validatedComm = filteredConversions.filter(c => c.is_validated).reduce((s, c) => s + (c.item_total_commission || 0), 0);
                                            const totalOrders = new Set(filteredConversions.map(c => c.order_id).filter(Boolean)).size;
                                            const validatedOrders = new Set(filteredConversions.filter(c => c.is_validated).map(c => c.order_id).filter(Boolean)).size;
                                            const fraudCount = filteredConversions.filter(c => c.fraud_status && c.fraud_status !== 'NONE' && c.fraud_status !== '').length;
                                            const fraudPct = filteredConversions.length > 0 ? ((fraudCount / filteredConversions.length) * 100) : 0;
                                            const directCount = filteredConversions.filter(c => c.attribution_type === 'DIRECT' || c.attribution_type === 'direct').length;
                                            const indirectCount = filteredConversions.filter(c => c.attribution_type !== 'DIRECT' && c.attribution_type !== 'direct' && c.attribution_type).length;

                                            return (
                                                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    <div className="bg-background-dark border border-orange-500/20 rounded-xl p-3 flex flex-col gap-1">
                                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider">Comissão Total</span>
                                                        <span className="text-base sm:text-lg font-bold text-orange-400">{formatBRL(totalNetComm)}</span>
                                                        {validatedComm > 0 && (
                                                            <span className="text-[10px] text-emerald-400">✅ {formatBRL(validatedComm)} validada</span>
                                                        )}
                                                    </div>
                                                    <div className="bg-background-dark border border-blue-500/20 rounded-xl p-3 flex flex-col gap-1">
                                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider">Pedidos</span>
                                                        <span className="text-base sm:text-lg font-bold text-blue-400">{totalOrders}</span>
                                                        {validatedOrders > 0 && (
                                                            <span className="text-[10px] text-emerald-400">✅ {validatedOrders} validados</span>
                                                        )}
                                                    </div>
                                                    <div className="bg-background-dark border border-red-500/20 rounded-xl p-3 flex flex-col gap-1">
                                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider">Taxa Fraude</span>
                                                        <span className={`text-base sm:text-lg font-bold ${fraudPct > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            {fraudPct.toFixed(1)}%
                                                        </span>
                                                        <span className="text-[10px] text-text-secondary">{fraudCount} suspeito(s)</span>
                                                    </div>
                                                    <div className="bg-background-dark border border-violet-500/20 rounded-xl p-3 flex flex-col gap-1">
                                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider">Atribuição</span>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-sm font-bold text-green-400">{directCount}D</span>
                                                            <span className="text-[10px] text-text-secondary">vs</span>
                                                            <span className="text-sm font-bold text-amber-400">{indirectCount}I</span>
                                                        </div>
                                                        <span className="text-[10px] text-text-secondary">Diretas vs Indiretas</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Conversion List */}
                                        {filteredConversions.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full w-full text-xs">
                                                    <thead>
                                                        <tr className="border-t border-border-dark bg-background-dark">
                                                            <th className="px-3 py-2 text-left text-text-secondary font-medium whitespace-nowrap">Data</th>
                                                            <th className="px-3 py-2 text-left text-text-secondary font-medium whitespace-nowrap">Produto</th>
                                                            <th className="px-3 py-2 text-right text-text-secondary font-medium whitespace-nowrap">Qtd</th>
                                                            <th className="px-3 py-2 text-right text-text-secondary font-medium whitespace-nowrap">Comissão</th>
                                                            <th className="px-3 py-2 text-center text-text-secondary font-medium whitespace-nowrap">Status</th>
                                                            <th className="px-3 py-2 text-center text-text-secondary font-medium whitespace-nowrap">Tipo</th>
                                                            <th className="px-3 py-2 text-center text-text-secondary font-medium whitespace-nowrap">Validado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredConversions.slice(0, 50).map((conv) => (
                                                            <tr key={conv.id} className="border-t border-border-dark/50 hover:bg-surface-dark/50 transition-colors">
                                                                <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                                                                    {conv.purchase_time ? format(new Date(conv.purchase_time), 'dd/MM HH:mm') : '—'}
                                                                </td>
                                                                <td className="px-3 py-2 text-white min-w-0">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        {conv.image_url && (
                                                                            <img src={conv.image_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                                                                        )}
                                                                        <span className="truncate max-w-[180px]">{conv.item_name || `Item #${conv.item_id}`}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-white whitespace-nowrap">{conv.qty}</td>
                                                                <td className="px-3 py-2 text-right font-medium text-orange-400 whitespace-nowrap">
                                                                    {formatBRL(conv.item_total_commission)}
                                                                </td>
                                                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${['PAID', 'VALIDATED', 'COMPLETED'].includes(conv.conversion_status || '')
                                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                                        : ['CANCELLED', 'INVALID', 'FAILED', 'UNPAID'].includes(conv.conversion_status || '')
                                                                            ? 'bg-red-500/20 text-red-400'
                                                                            : 'bg-amber-500/20 text-amber-400'
                                                                        }`}>
                                                                        {conv.conversion_status || 'PENDING'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                                                    <span className={`text-[10px] ${conv.attribution_type === 'DIRECT' || conv.attribution_type === 'direct'
                                                                        ? 'text-green-400' : 'text-amber-400'
                                                                        }`}>
                                                                        {conv.attribution_type === 'DIRECT' || conv.attribution_type === 'direct' ? 'Direta' : conv.attribution_type || '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    {conv.is_validated ? (
                                                                        <ShieldCheck size={14} className="text-emerald-400 mx-auto" />
                                                                    ) : conv.fraud_status && conv.fraud_status !== 'NONE' && conv.fraud_status !== '' ? (
                                                                        <AlertTriangle size={14} className="text-red-400 mx-auto" />
                                                                    ) : (
                                                                        <span className="text-text-secondary">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {filteredConversions.length > 50 && (
                                                    <div className="p-3 text-center text-xs text-text-secondary border-t border-border-dark/50">
                                                        Mostrando 50 de {filteredConversions.length} conversões
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-6 text-center text-sm text-text-secondary">
                                                Nenhuma conversão sincronizada. Use os botões acima para buscar dados da API Shopee.
                                            </div>
                                        )}
                                    </div>

                                </div>

                                <div className={activeTab === 'metrics' ? 'flex flex-col gap-4' : 'hidden'}>
                                    {/* Entries Table */}
                                    {
                                        <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                                            <div className="p-4 border-b border-border-dark flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-sm font-bold text-white">Histórico ({filteredEntries.length} registros)</h3>
                                                    <span className="hidden sm:inline-block text-xs font-normal text-text-secondary bg-background-dark px-2.5 py-1 rounded-md border border-border-dark">
                                                        Dê 2 cliques na linha para editar
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => setShowManualEntry(true)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary border border-primary/30 hover:bg-primary/10 transition-all"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Registro Manual
                                                </button>
                                            </div>
                                            {filteredEntries.length > 0 ? (
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
                                                        <tbody className="divide-y divide-border-dark/30">
                                                            {filteredEntries.map(entry => {
                                                                const isEditing = editingEntryId === entry.id;

                                                                // Funnel evaluation
                                                                const entryIndex = entries.indexOf(entry);
                                                                const dayNumber = entries.length - entryIndex; // Day 1 = oldest entry
                                                                let funnelStatus: 'pass' | 'fail' | 'none' = 'none';
                                                                if (linkedFunnel) {
                                                                    const funnelDay = linkedFunnel.days?.find(d => d.day === dayNumber);
                                                                    const maxFunnelDay = Math.max(...(linkedFunnel.days || []).map(d => d.day), 0);

                                                                    // Use maintenance groups for days beyond configured ones
                                                                    const mConds = linkedFunnel.maintenance_conditions;
                                                                    const maintenanceGroups = (Array.isArray(mConds) && mConds.length > 0 && typeof mConds[0] === 'object' && 'id' in mConds[0])
                                                                        ? (mConds as FunnelConditionGroup[])
                                                                        : null;

                                                                    const groupsToEval = funnelDay?.condition_groups?.length
                                                                        ? funnelDay.condition_groups
                                                                        : (dayNumber > maxFunnelDay && maintenanceGroups)
                                                                            ? maintenanceGroups
                                                                            : null;

                                                                    // Fallback for legacy structure if present
                                                                    const legacyConditions = funnelDay?.conditions || (dayNumber > maxFunnelDay && !maintenanceGroups ? (mConds as FunnelCondition[]) : null);

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

                                                                    if (groupsToEval && groupsToEval.length > 0) {
                                                                        // LOGIC OR: If ANY group matches its internal conditions, the day passes
                                                                        const anyGroupPass = groupsToEval.some(group => {
                                                                            if (!group.conditions || group.conditions.length === 0) return false;
                                                                            // LOGIC AND: All conditions in a group must match
                                                                            return group.conditions.every(cond => {
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
                                                                        });
                                                                        funnelStatus = anyGroupPass ? 'pass' : 'fail';
                                                                    } else if (legacyConditions && legacyConditions.length > 0) {
                                                                        // Backward compatibility for legacy funnels
                                                                        const allPass = legacyConditions.every(cond => {
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
                                                        {filteredEntries.length > 0 && (() => {
                                                            const totals = filteredEntries.reduce((acc, entry) => {
                                                                acc.ad_clicks += Number(entry.ad_clicks || 0);
                                                                acc.shopee_clicks += Number(entry.shopee_clicks || 0);
                                                                acc.orders += Number(entry.orders || 0);
                                                                acc.commission += Number(entry.commission_value || 0);
                                                                acc.investment += Number(entry.investment || 0);
                                                                return acc;
                                                            }, { ad_clicks: 0, shopee_clicks: 0, orders: 0, commission: 0, investment: 0 });

                                                            const totalProfit = totals.commission - totals.investment;
                                                            const totalRoi = totals.investment > 0 ? (totalProfit / totals.investment) * 100 : 0;
                                                            const avgCpc = totals.ad_clicks > 0 ? (totals.investment / totals.ad_clicks) : 0;

                                                            return (
                                                                <tfoot className="border-t-2 border-border-dark bg-background-dark font-bold text-sm">
                                                                    <tr>
                                                                        {linkedFunnel && <td className="p-3"></td>}
                                                                        <td className="p-3 text-left text-white">TOTAL</td>
                                                                        <td className="p-3 text-right text-neutral-300">{totals.ad_clicks}</td>
                                                                        <td className="p-3 text-right text-neutral-300">{totals.shopee_clicks}</td>
                                                                        <td className="p-3 text-right text-neutral-300">R$ {formatBRL(avgCpc)}</td>
                                                                        <td className="p-3 text-right text-blue-400">{totals.orders}</td>
                                                                        <td className="p-3 text-right text-primary">R$ {formatBRL(totals.commission)}</td>
                                                                        <td className="p-3 text-right text-orange-400">R$ {formatBRL(totals.investment)}</td>
                                                                        <td className={`p-3 text-right ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {formatBRL(totalProfit)}</td>
                                                                        <td className={`p-3 text-right text-xs ${totalRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPct(totalRoi)}%</td>
                                                                        <td className="p-3"></td>
                                                                    </tr>
                                                                </tfoot>
                                                            );
                                                        })()}
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center text-neutral-400 text-sm">
                                                    Nenhum registro ainda. Adicione o primeiro abaixo.
                                                </div>
                                            )}
                                        </div>
                                    }
                                </div>
                            </>

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
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm overflow-hidden">
                                    <div className="bg-surface-dark border border-border-dark rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                                        <div className="flex items-center justify-between p-4 border-b border-border-dark">
                                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                                <Plus className="w-5 h-5 text-primary" />
                                                Registro Manual
                                            </h2>
                                            <button onClick={() => setShowManualEntry(false)} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            )}
        </div>
    );
}
