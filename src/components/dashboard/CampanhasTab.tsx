import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/ToastContext';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { PlayCircle, Loader2, AlertTriangle, Facebook, Instagram, Image as ImageIcon } from 'lucide-react';

interface CampanhasTabProps {
    trackId: string;
    trackName: string;
    fbToken: string;
}

interface CreativePost {
    id: string;
    platform: string;
    post_id: string;
    caption: string;
    created_at: string;
}

interface AdAccount {
    id: string;
    name: string;
    account_id: string;
}

interface FbPage {
    id: string;
    name: string;
    instagram_business_account?: { id: string };
}

export function CampanhasTab({ trackId, trackName, fbToken }: CampanhasTabProps) {
    const { showToast } = useToast();

    // Data states
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [pages, setPages] = useState<FbPage[]>([]);
    const [creativePosts, setCreativePosts] = useState<CreativePost[]>([]);

    const [loadingData, setLoadingData] = useState(false);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [creationProgress, setCreationProgress] = useState('');

    // Form states
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedPageId, setSelectedPageId] = useState('');
    const [campaignName, setCampaignName] = useState(trackName);

    // Creative Source
    const [creativeSource, setCreativeSource] = useState<'NEW' | 'EXISTING'>('NEW');
    const [linkUrl, setLinkUrl] = useState('');
    const [selectedPostId, setSelectedPostId] = useState('');

    // Budget
    const [budgetType, setBudgetType] = useState<'DAILY' | 'LIFETIME'>('DAILY');
    const [budget, setBudget] = useState('50.00');

    // Audience
    const [minAge, setMinAge] = useState('18');
    const [maxAge, setMaxAge] = useState('65');
    const [gender, setGender] = useState<'ALL' | 'MALE' | 'FEMALE'>('ALL');

    // Placements
    const [placementsType, setPlacementsType] = useState<'AUTO' | 'MANUAL'>('AUTO');
    const [manualPlacements, setManualPlacements] = useState({
        fb_feed: true,
        ig_feed: true,
        ig_reels: true,
        ig_stories: true
    });

    useEffect(() => {
        if (fbToken) {
            fetchInitialData();
        }
    }, [fbToken]);

    useEffect(() => {
        if (trackId) {
            fetchPosts();
        }
    }, [trackId]);

    const fetchPosts = async () => {
        setLoadingPosts(true);
        try {
            const { data, error } = await supabase
                .from('creative_posts')
                .select('id, platform, post_id, caption, created_at')
                .eq('track_id', trackId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCreativePosts(data || []);
            if (data && data.length > 0) setSelectedPostId(data[0].id);
        } catch (e) {
            console.error('Fetch posts error:', e);
        } finally {
            setLoadingPosts(false);
        }
    };

    const fetchInitialData = async () => {
        setLoadingData(true);
        try {
            // Fetch Ad Accounts
            const adAccRes = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_id&access_token=${fbToken}`);
            const adAccData = await adAccRes.json();
            if (adAccData.error) throw new Error(`Erro AdAccounts: ${adAccData.error.message}`);

            const accounts = adAccData.data || [];
            setAdAccounts(accounts);
            if (accounts.length > 0) setSelectedAccountId(accounts[0].id);

            // Fetch Pages
            const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account&access_token=${fbToken}`);
            const pagesData = await pagesRes.json();
            if (pagesData.error) throw new Error(`Erro Pages: ${pagesData.error.message}`);

            const fetchedPages = pagesData.data || [];
            setPages(fetchedPages);
            if (fetchedPages.length > 0) setSelectedPageId(fetchedPages[0].id);

        } catch (error: any) {
            console.error('Erro ao buscar dados do Facebook:', error);
            showToast('Erro ao buscar contas de anúncios ou páginas.', 'error');
        } finally {
            setLoadingData(false);
        }
    };

    const handleCreateCampaign = async () => {
        if (!selectedAccountId || !selectedPageId) {
            showToast('Selecione uma conta de anúncio e uma página.', 'error');
            return;
        }
        if (creativeSource === 'NEW' && !linkUrl) {
            showToast('Informe a URL de destino (Link).', 'error');
            return;
        }
        if (creativeSource === 'EXISTING' && !selectedPostId) {
            showToast('Nenhum post selecionado.', 'error');
            return;
        }

        try {
            setIsCreating(true);
            setCreationProgress('Criando Campanha...');

            const budgetCents = Math.floor(parseFloat(budget.replace(',', '.')) * 100);

            // 1. Create Campaign (Status: PAUSED by default for safety)
            const campaignRes = await fetch(`https://graph.facebook.com/v19.0/${selectedAccountId}/campaigns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: campaignName,
                    objective: 'OUTCOME_TRAFFIC',
                    status: 'PAUSED',
                    special_ad_categories: [],
                    access_token: fbToken
                })
            });
            const campaignData = await campaignRes.json();
            if (campaignData.error) throw new Error(`Erro ao criar campanha: ${campaignData.error.message}`);
            const campaignId = campaignData.id;

            // 2. Formatting Targeting
            setCreationProgress('Configurando Conjunto de Anúncios...');

            const targeting: any = {
                age_min: parseInt(minAge),
                age_max: parseInt(maxAge),
                geo_locations: { countries: ['BR'] } // Default to BR
            };

            if (gender === 'MALE') targeting.genders = [1];
            if (gender === 'FEMALE') targeting.genders = [2];

            if (placementsType === 'MANUAL') {
                targeting.publisher_platforms = [];
                const fbPositions = [];
                const igPositions = [];

                if (manualPlacements.fb_feed) {
                    if (!targeting.publisher_platforms.includes('facebook')) targeting.publisher_platforms.push('facebook');
                    fbPositions.push('feed');
                }
                if (manualPlacements.ig_feed) {
                    if (!targeting.publisher_platforms.includes('instagram')) targeting.publisher_platforms.push('instagram');
                    igPositions.push('stream');
                }
                if (manualPlacements.ig_reels) {
                    if (!targeting.publisher_platforms.includes('instagram')) targeting.publisher_platforms.push('instagram');
                    igPositions.push('reels');
                }
                if (manualPlacements.ig_stories) {
                    if (!targeting.publisher_platforms.includes('instagram')) targeting.publisher_platforms.push('instagram');
                    igPositions.push('story');
                }

                if (fbPositions.length > 0) targeting.facebook_positions = fbPositions;
                if (igPositions.length > 0) targeting.instagram_positions = igPositions;
            }

            // 3. Create Ad Set
            const adSetPayload: any = {
                name: 'Conjunto 01 - Principal',
                campaign_id: campaignId,
                optimization_goal: 'LINK_CLICKS',
                billing_event: 'IMPRESSIONS',
                bid_amount: 100, // nominal bid (1 BRL)
                targeting: targeting,
                status: 'PAUSED',
                access_token: fbToken
            };

            if (budgetType === 'DAILY') {
                adSetPayload.daily_budget = budgetCents;
            } else {
                adSetPayload.lifetime_budget = budgetCents;
                // Lifetime budget requires end_time
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 7); // Default 7 days
                adSetPayload.end_time = Math.floor(endDate.getTime() / 1000);
            }

            const adSetRes = await fetch(`https://graph.facebook.com/v19.0/${selectedAccountId}/adsets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(adSetPayload)
            });
            const adSetData = await adSetRes.json();
            if (adSetData.error) throw new Error(`Erro ao criar AdSet: ${adSetData.error.message}`);
            const adSetId = adSetData.id;

            setCreationProgress('Gerando Criativo e Anúncio...');

            // 4. Create Ad Creative
            const creativePayload: any = {
                name: 'Criativo 01',
                access_token: fbToken
            };

            if (creativeSource === 'NEW') {
                creativePayload.object_story_spec = {
                    page_id: selectedPageId,
                    link_data: {
                        link: linkUrl,
                        message: `Confira nossas ofertas! ${trackName}`
                    }
                };
            } else {
                const selectedPost = creativePosts.find(p => p.id === selectedPostId);
                if (!selectedPost) throw new Error("Publicação não encontrada.");

                if (selectedPost.platform === 'instagram') {
                    const igUserId = pages.find(p => p.id === selectedPageId)?.instagram_business_account?.id;
                    if (!igUserId) throw new Error("A página selecionada não possui uma conta do Instagram vinculada para impulsionar este post.");

                    creativePayload.object_story_spec = {
                        page_id: selectedPageId,
                        instagram_actor_id: igUserId
                    };
                    creativePayload.source_instagram_media_id = selectedPost.post_id;
                } else {
                    const storyId = selectedPost.post_id.includes('_') ? selectedPost.post_id : `${selectedPageId}_${selectedPost.post_id}`;
                    creativePayload.object_story_id = storyId;
                }
            }

            const creativeRes = await fetch(`https://graph.facebook.com/v19.0/${selectedAccountId}/adcreatives`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(creativePayload)
            });
            const creativeData = await creativeRes.json();
            if (creativeData.error) throw new Error(`Erro ao criar Criativo: ${creativeData.error.message}`);
            const creativeId = creativeData.id;

            // 5. Create Ad
            const adRes = await fetch(`https://graph.facebook.com/v19.0/${selectedAccountId}/ads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Anúncio 01',
                    adset_id: adSetId,
                    creative: { creative_id: creativeId },
                    status: 'PAUSED',
                    access_token: fbToken
                })
            });
            const adData = await adRes.json();
            if (adData.error) throw new Error(`Erro ao criar Anúncio: ${adData.error.message}`);

            showToast('Campanha criada com sucesso! Verifique no seu Gerenciador de Anúncios.', 'success');

        } catch (error: any) {
            console.error('Campanha erro:', error);
            showToast(error.message || 'Erro inesperado ao criar campanha.', 'error');
        } finally {
            setIsCreating(false);
            setCreationProgress('');
        }
    };

    if (!fbToken) {
        return (
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-4">
                <AlertTriangle className="w-12 h-12 text-amber-500 mb-2" />
                <h3 className="text-xl font-bold text-white">Gerenciador de Anúncios não Conectado</h3>
                <p className="text-sm text-text-secondary max-w-md">
                    Para criar campanhas e anúncios no Facebook Ads, primeiro conecte sua conta Meta nas configurações de integrações.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Config */}
            <div className="flex flex-col gap-6">
                <div className="bg-surface-dark border border-border-dark rounded-2xl p-5">
                    <h3 className="text-base font-bold text-white mb-4">Configuração Básica</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Conta de Anúncios</label>
                            <select
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                disabled={loadingData || adAccounts.length === 0}
                                className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary disabled:opacity-50"
                            >
                                {loadingData ? (
                                    <option>Carregando contas...</option>
                                ) : adAccounts.length === 0 ? (
                                    <option>Nenhuma conta de anúncios encontrada</option>
                                ) : (
                                    adAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} ({acc.account_id})
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Página Vinculada (Identidade do Anúncio)</label>
                            <select
                                value={selectedPageId}
                                onChange={(e) => setSelectedPageId(e.target.value)}
                                disabled={loadingData || pages.length === 0}
                                className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary disabled:opacity-50"
                            >
                                {loadingData ? (
                                    <option>Carregando páginas...</option>
                                ) : pages.length === 0 ? (
                                    <option>Nenhuma página encontrada</option>
                                ) : (
                                    pages.map(page => (
                                        <option key={page.id} value={page.id}>{page.name}</option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Nome da Campanha</label>
                            <input
                                type="text"
                                value={campaignName}
                                onChange={(e) => setCampaignName(e.target.value)}
                                className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                                placeholder="Ex: Campanha de Teste"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Origem do Criativo</label>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <button
                                    onClick={() => setCreativeSource('NEW')}
                                    className={`py-2 rounded-xl border text-sm transition-all ${creativeSource === 'NEW' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-border-dark text-text-secondary hover:border-border-highlight'}`}
                                >
                                    Criar Novo Anúncio
                                </button>
                                <button
                                    onClick={() => setCreativeSource('EXISTING')}
                                    className={`py-2 rounded-xl border text-sm transition-all flex items-center justify-center gap-2 ${creativeSource === 'EXISTING' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-border-dark text-text-secondary hover:border-border-highlight'}`}
                                >
                                    <ImageIcon className="w-4 h-4" /> Usar Post Existente
                                </button>
                            </div>

                            {creativeSource === 'NEW' ? (
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">URL de Destino (Link)</label>
                                    <input
                                        type="url"
                                        value={linkUrl}
                                        onChange={(e) => setLinkUrl(e.target.value)}
                                        className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                                        placeholder="https://seu-site.com/produto"
                                    />
                                    <p className="text-xs text-text-secondary mt-2">Um anúncio de link padrão será gerado.</p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Selecione a Publicação (Histórico)</label>
                                    <select
                                        value={selectedPostId}
                                        onChange={(e) => setSelectedPostId(e.target.value)}
                                        disabled={loadingPosts || creativePosts.length === 0}
                                        className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                                    >
                                        {loadingPosts ? (
                                            <option>Buscando histórico...</option>
                                        ) : creativePosts.length === 0 ? (
                                            <option>Nenhuma publicação encontrada. Vá para a aba Postagem primeiro.</option>
                                        ) : (
                                            creativePosts.map(post => (
                                                <option key={post.id} value={post.id}>
                                                    {post.platform === 'instagram' ? 'IG' : 'FB'} - {format(new Date(post.created_at), "dd/MM 'às' HH:mm")} - {post.caption?.substring(0, 30)}...
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-surface-dark border border-border-dark rounded-2xl p-5">
                    <h3 className="text-base font-bold text-white mb-4">Orçamento e Público</h3>

                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Tipo de Orçamento</label>
                                <select
                                    value={budgetType}
                                    onChange={(e) => setBudgetType(e.target.value as any)}
                                    className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                                >
                                    <option value="DAILY">Diário</option>
                                    <option value="LIFETIME">Vitalício</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Valor (R$)</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Idade</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="18" max="65"
                                    value={minAge}
                                    onChange={(e) => setMinAge(e.target.value)}
                                    className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                                />
                                <span className="text-text-secondary font-medium">até</span>
                                <input
                                    type="number"
                                    min="18" max="65"
                                    value={maxAge}
                                    onChange={(e) => setMaxAge(e.target.value)}
                                    className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Gênero</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value as any)}
                                className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
                            >
                                <option value="ALL">Todos</option>
                                <option value="MALE">Homens</option>
                                <option value="FEMALE">Mulheres</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Placements & Action */}
            <div className="flex flex-col gap-6">
                <div className="bg-surface-dark border border-border-dark rounded-2xl p-5 flex flex-col h-full">
                    <h3 className="text-base font-bold text-white mb-4">Posicionamentos</h3>

                    <div className="flex-1 space-y-5">
                        <div className="grid grid-cols-2 gap-3">
                            <label className={`flex items-center justify-center py-3 rounded-xl border cursor-pointer transition-all ${placementsType === 'AUTO' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-border-dark text-text-secondary hover:border-primary/50'}`}>
                                <input
                                    type="radio"
                                    className="sr-only"
                                    checked={placementsType === 'AUTO'}
                                    onChange={() => setPlacementsType('AUTO')}
                                />
                                Automáticos (Recomendado)
                            </label>
                            <label className={`flex items-center justify-center py-3 rounded-xl border cursor-pointer transition-all ${placementsType === 'MANUAL' ? 'bg-primary/10 border-primary text-primary font-bold' : 'border-border-dark text-text-secondary hover:border-primary/50'}`}>
                                <input
                                    type="radio"
                                    className="sr-only"
                                    checked={placementsType === 'MANUAL'}
                                    onChange={() => setPlacementsType('MANUAL')}
                                />
                                Manuais
                            </label>
                        </div>

                        {placementsType === 'MANUAL' && (
                            <div className="space-y-3 bg-background-dark/50 p-4 rounded-xl border border-border-dark">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <Facebook className="w-5 h-5 text-blue-500" />
                                        <span className="text-sm text-white">Facebook Feed</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={manualPlacements.fb_feed}
                                        onChange={(e) => setManualPlacements({ ...manualPlacements, fb_feed: e.target.checked })}
                                        className="w-4 h-4 text-primary rounded focus:ring-primary focus:ring-offset-background-dark bg-background-dark border-border-dark"
                                    />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <Instagram className="w-5 h-5 text-pink-500" />
                                        <span className="text-sm text-white">Instagram Feed</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={manualPlacements.ig_feed}
                                        onChange={(e) => setManualPlacements({ ...manualPlacements, ig_feed: e.target.checked })}
                                        className="w-4 h-4 text-primary rounded focus:ring-primary focus:ring-offset-background-dark bg-background-dark border-border-dark"
                                    />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <Instagram className="w-5 h-5 text-pink-500" />
                                        <span className="text-sm text-white">Instagram Reels</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={manualPlacements.ig_reels}
                                        onChange={(e) => setManualPlacements({ ...manualPlacements, ig_reels: e.target.checked })}
                                        className="w-4 h-4 text-primary rounded focus:ring-primary focus:ring-offset-background-dark bg-background-dark border-border-dark"
                                    />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <Instagram className="w-5 h-5 text-pink-500" />
                                        <span className="text-sm text-white">Instagram Stories</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={manualPlacements.ig_stories}
                                        onChange={(e) => setManualPlacements({ ...manualPlacements, ig_stories: e.target.checked })}
                                        className="w-4 h-4 text-primary rounded focus:ring-primary focus:ring-offset-background-dark bg-background-dark border-border-dark"
                                    />
                                </label>
                            </div>
                        )}

                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-3 mt-auto">
                            <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0" />
                            <p className="text-xs text-blue-300 leading-relaxed">
                                A campanha será criada e configurada com status <strong>PAUSADO</strong>. Você poderá revisá-la e adicionar o vídeo/imagem final diretamente no Gerenciador de Anúncios antes de veicular.
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 mt-4 border-t border-border-dark">
                        <button
                            onClick={handleCreateCampaign}
                            disabled={!selectedAccountId || !selectedPageId || isCreating || (creativeSource === 'NEW' && !linkUrl) || (creativeSource === 'EXISTING' && !selectedPostId)}
                            className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-sm font-bold transition-all
                                ${(isCreating || !selectedAccountId || (creativeSource === 'NEW' && !linkUrl) || (creativeSource === 'EXISTING' && !selectedPostId)) ? 'bg-surface-highlight text-text-secondary cursor-not-allowed' : 'bg-primary text-background-dark hover:brightness-110'}`}
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {creationProgress || 'Processando...'}
                                </>
                            ) : (
                                <>
                                    <PlayCircle className="w-5 h-5" />
                                    Criar Campanha no Gerenciador
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
