import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { Upload, X, Loader2, Instagram, Facebook, Video, Image as ImageIcon, Send, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface PostagemTabProps {
    trackId: string;
    trackName: string;
    fbToken: string;
    initialCaption: string;
}

interface CreativePost {
    id: string;
    platform: 'instagram' | 'facebook';
    post_id: string;
    post_url: string | null;
    media_url: string;
    caption: string;
    status: string;
    created_at: string;
}

interface FbPage {
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: {
        id: string;
    };
}

export function PostagemTab({ trackId, fbToken, initialCaption }: PostagemTabProps) {
    const { user } = useAuth();
    const { showToast } = useToast();

    // History state
    const [postsHistory, setPostsHistory] = useState<CreativePost[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // File state
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [caption, setCaption] = useState(initialCaption);
    const [pages, setPages] = useState<FbPage[]>([]);
    const [selectedPageId, setSelectedPageId] = useState('');
    const [postToInstagram, setPostToInstagram] = useState(true);
    const [postToFacebook, setPostToFacebook] = useState(true);

    // Loading states
    const [loadingPages, setLoadingPages] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [postProgress, setPostProgress] = useState('');

    useEffect(() => {
        setCaption(initialCaption);
    }, [initialCaption]);

    useEffect(() => {
        if (trackId) fetchPostsHistory();
    }, [trackId]);

    const fetchPostsHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('creative_posts')
                .select('*')
                .eq('track_id', trackId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPostsHistory(data || []);
        } catch (error) {
            console.error('Error fetching posts history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (fbToken) {
            fetchPages();
        }
    }, [fbToken]);

    const fetchPages = async () => {
        setLoadingPages(true);
        try {
            const res = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${fbToken}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);

            const fetchedPages = data.data || [];
            setPages(fetchedPages);

            if (fetchedPages.length > 0) {
                setSelectedPageId(fetchedPages[0].id);
            }
        } catch (error: any) {
            console.error('Erro ao buscar páginas do Facebook:', error);
            showToast('Erro ao buscar suas páginas do Facebook. Reconecte a conta se o token estiver expirado.', 'error');
        } finally {
            setLoadingPages(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const isVideo = selectedFile.type.startsWith('video/');
            const isImage = selectedFile.type.startsWith('image/');

            if (!isVideo && !isImage) {
                showToast('Formato não suportado. Envie vídeo (.mp4, .mov) ou imagem (.jpg, .png).', 'error');
                return;
            }

            // Max size: 200MB to avoid large uploads freezing
            if (selectedFile.size > 200 * 1024 * 1024) {
                showToast('O arquivo deve ter no máximo 200MB.', 'error');
                return;
            }

            setFile(selectedFile);
            const objectUrl = URL.createObjectURL(selectedFile);
            setPreviewUrl(objectUrl);
        }
    };

    const clearFile = () => {
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const pollIgContainerStatus = async (containerId: string, accessToken: string): Promise<void> => {
        const checkStatus = async () => {
            const res = await fetch(`https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`);
            const data = await res.json();
            if (data.status_code === 'FINISHED') return true;
            if (data.status_code === 'ERROR') throw new Error('Erro no processamento do vídeo pelo Instagram.');
            return false;
        };

        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            if (await checkStatus()) return;
        }
        throw new Error('Timeout ao processar vídeo no Instagram.');
    };

    const handlePost = async () => {
        if (!user) return;
        if (!file) {
            showToast('Selecione um arquivo de mídia.', 'error');
            return;
        }
        if (!selectedPageId) {
            showToast('Selecione uma conta para postar.', 'error');
            return;
        }
        if (!postToInstagram && !postToFacebook) {
            showToast('Selecione onde postar (Instagram e/ou Facebook).', 'error');
            return;
        }

        const selectedPage = pages.find(p => p.id === selectedPageId);
        if (!selectedPage) return;

        if (postToInstagram && !selectedPage.instagram_business_account) {
            showToast('A página selecionada não possui uma conta do Instagram conectada.', 'error');
            return;
        }

        try {
            setIsUploading(true);
            setPostProgress('Fazendo upload p/ nuvem...');

            // 1. Upload to Supabase Storage
            // Normalize filename
            const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filePath = `${user.id}/${Date.now()}_${cleanName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('creative_media')
                .upload(filePath, file);

            if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`);

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('creative_media')
                .getPublicUrl(uploadData.path);

            const isVideo = file.type.startsWith('video/');

            setIsPosting(true);
            setIsUploading(false);

            // 2. Post to Instagram
            if (postToInstagram && selectedPage.instagram_business_account) {
                setPostProgress('Publicando no Instagram...');
                const igId = selectedPage.instagram_business_account.id;

                let mediaUrlParam = isVideo ? `video_url=${encodeURIComponent(publicUrl)}` : `image_url=${encodeURIComponent(publicUrl)}`;
                let typeParam = isVideo ? 'media_type=REELS&' : '';

                // Step A: Create Media Container
                const containerRes = await fetch(
                    `https://graph.facebook.com/v19.0/${igId}/media?${typeParam}${mediaUrlParam}&caption=${encodeURIComponent(caption)}&access_token=${selectedPage.access_token}`,
                    { method: 'POST' }
                );
                const containerData = await containerRes.json();

                if (containerData.error) throw new Error(`Erro IG (Container): ${containerData.error.message}`);

                const containerId = containerData.id;

                // Step B: Wait for processing if video
                if (isVideo) {
                    setPostProgress('Processando Reels no servidor do Meta...');
                    await pollIgContainerStatus(containerId, selectedPage.access_token);
                }

                // Step C: Publish Container
                setPostProgress('Finalizando post do Instagram...');
                const publishRes = await fetch(
                    `https://graph.facebook.com/v19.0/${igId}/media_publish?creation_id=${containerId}&access_token=${selectedPage.access_token}`,
                    { method: 'POST' }
                );
                const publishData = await publishRes.json();
                if (publishData.error) throw new Error(`Erro IG (Publish): ${publishData.error.message}`);

                const publishedMediaId = publishData.id;
                let igPermalink = null;

                // Attempt to get permalink
                try {
                    const mediaDetailsRes = await fetch(`https://graph.facebook.com/v19.0/${publishedMediaId}?fields=permalink&access_token=${selectedPage.access_token}`);
                    const mediaDetails = await mediaDetailsRes.json();
                    igPermalink = mediaDetails.permalink;
                } catch (e) {
                    console.warn('Could not fetch IG permalink:', e);
                }

                // Record history with the Meta ID and Permalink
                await supabase.from('creative_posts').insert({
                    track_id: trackId,
                    user_id: user.id,
                    platform: 'instagram',
                    post_id: publishedMediaId,
                    post_url: igPermalink,
                    media_url: publicUrl,
                    caption: caption,
                    status: 'published'
                });
            }

            // 3. Post to Facebook Page
            if (postToFacebook) {
                setPostProgress('Publicando na Página do Facebook...');

                if (isVideo) {
                    // Usage of Video API for Facebook Page
                    // Note: As of recent Graph API versions, video_reels on pages requires specific formats
                    const fbVideoRes = await fetch(
                        `https://graph.facebook.com/v19.0/${selectedPage.id}/videos?file_url=${encodeURIComponent(publicUrl)}&description=${encodeURIComponent(caption)}&access_token=${selectedPage.access_token}`,
                        { method: 'POST' }
                    );
                    const fbVideoData = await fbVideoRes.json();
                    if (fbVideoData.error) throw new Error(`Erro FB: ${fbVideoData.error.message}`);

                    await supabase.from('creative_posts').insert({
                        track_id: trackId,
                        user_id: user.id,
                        platform: 'facebook',
                        post_id: fbVideoData.id,
                        post_url: `https://facebook.com/${fbVideoData.id}`,
                        media_url: publicUrl,
                        caption: caption,
                        status: 'published'
                    });
                } else {
                    // Image photo API
                    const fbPhotoRes = await fetch(
                        `https://graph.facebook.com/v19.0/${selectedPage.id}/photos?url=${encodeURIComponent(publicUrl)}&message=${encodeURIComponent(caption)}&access_token=${selectedPage.access_token}`,
                        { method: 'POST' }
                    );
                    const fbPhotoData = await fbPhotoRes.json();
                    if (fbPhotoData.error) throw new Error(`Erro FB: ${fbPhotoData.error.message}`);

                    await supabase.from('creative_posts').insert({
                        track_id: trackId,
                        user_id: user.id,
                        platform: 'facebook',
                        post_id: fbPhotoData.id,
                        post_url: `https://facebook.com/${fbPhotoData.post_id || fbPhotoData.id}`,
                        media_url: publicUrl,
                        caption: caption,
                        status: 'published'
                    });
                }
            }

            // 4. Cleanup and record success
            // After successful posts, we delete from Supabase storage to save space
            if (uploadData) {
                await supabase.storage
                    .from('creative_media')
                    .remove([uploadData.path]);
            }

            showToast('Postagem realizada com sucesso! (Espaço otimizado)', 'success');
            clearFile();
            setPostProgress('');
            fetchPostsHistory();
        } catch (error: any) {
            console.error('Post error:', error);
            showToast(error.message || 'Erro inesperado ao postar.', 'error');
        } finally {
            setIsUploading(false);
            setIsPosting(false);
        }
    };

    if (!fbToken) {
        return (
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-4">
                <AlertTriangle className="w-12 h-12 text-amber-500 mb-2" />
                <h3 className="text-xl font-bold text-white">Facebook não conectado</h3>
                <p className="text-sm text-text-secondary max-w-md">
                    Para postar vídeos ou imagens diretamente no seu Instagram e Facebook,
                    você precisa primeiro conectar sua conta na configuração de integrações.
                </p>
                {/* Note: In actual app, user can go to header or settings to link FB */}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Upload & Options */}
            <div className="flex flex-col gap-6">
                <div className="bg-surface-dark border border-border-dark rounded-2xl p-5">
                    <h3 className="text-base font-bold text-white mb-4">Criativo (Vídeo/Imagem)</h3>

                    {!file ? (
                        <div
                            className="border-2 border-dashed border-border-dark rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 hover:border-primary/50 hover:bg-surface-highlight transition-all cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Upload className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white mb-1">Clique para enviar o arquivo</p>
                                <p className="text-xs text-text-secondary">MP4, MOV, JPG, PNG (Max. 200MB)</p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative rounded-xl overflow-hidden border border-border-dark bg-background-dark/50">
                            {file.type.startsWith('video/') ? (
                                <video src={previewUrl!} className="w-full aspect-[9/16] object-cover max-h-[400px]" controls />
                            ) : (
                                <img src={previewUrl!} className="w-full aspect-[4/5] object-cover max-h-[400px]" alt="Prévia" />
                            )}
                            <button
                                onClick={clearFile}
                                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors backdrop-blur-sm"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-2 left-2 px-3 py-1.5 bg-black/60 text-white rounded-lg backdrop-blur-sm text-xs font-medium flex items-center gap-2">
                                {file.type.startsWith('video/') ? <Video className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                                <span className="truncate max-w-[150px]">{file.name}</span>
                            </div>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="video/mp4,video/quicktime,image/jpeg,image/png"
                        onChange={handleFileSelect}
                    />
                </div>

                <div className="bg-surface-dark border border-border-dark rounded-2xl p-5">
                    <h3 className="text-base font-bold text-white mb-4">Configuração da Publicação</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Página Destino</label>
                            <div className="relative">
                                <select
                                    value={selectedPageId}
                                    onChange={(e) => setSelectedPageId(e.target.value)}
                                    disabled={loadingPages || pages.length === 0}
                                    className="w-full bg-background-dark border border-border-dark text-white text-sm rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-primary disabled:opacity-50"
                                >
                                    {loadingPages ? (
                                        <option>Carregando páginas...</option>
                                    ) : pages.length === 0 ? (
                                        <option>Nenhuma página encontrada</option>
                                    ) : (
                                        pages.map(page => (
                                            <option key={page.id} value={page.id}>
                                                {page.name} {!page.instagram_business_account ? '(Sem IG)' : ''}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">Publicar em</label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${postToInstagram ? 'border-pink-500/50 bg-pink-500/10' : 'border-border-dark hover:border-border-dark/80'}`}>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={postToInstagram}
                                        onChange={(e) => setPostToInstagram(e.target.checked)}
                                    />
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${postToInstagram ? 'bg-pink-500 border-pink-500 text-white' : 'border-text-secondary'}`}>
                                        {postToInstagram && <Instagram className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Instagram className={`w-4 h-4 ${postToInstagram ? 'text-pink-500' : 'text-text-secondary'}`} />
                                        <span className={`text-sm font-medium ${postToInstagram ? 'text-white' : 'text-text-secondary'}`}>Instagram</span>
                                    </div>
                                </label>

                                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${postToFacebook ? 'border-blue-500/50 bg-blue-500/10' : 'border-border-dark hover:border-border-dark/80'}`}>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={postToFacebook}
                                        onChange={(e) => setPostToFacebook(e.target.checked)}
                                    />
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${postToFacebook ? 'bg-blue-500 border-blue-500 text-white' : 'border-text-secondary'}`}>
                                        {postToFacebook && <Facebook className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Facebook className={`w-4 h-4 ${postToFacebook ? 'text-blue-500' : 'text-text-secondary'}`} />
                                        <span className={`text-sm font-medium ${postToFacebook ? 'text-white' : 'text-text-secondary'}`}>Facebook</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Caption Edit & Action */}
            <div className="flex flex-col gap-6">
                <div className="bg-surface-dark border border-border-dark rounded-2xl p-5 flex flex-col h-full">
                    <h3 className="text-base font-bold text-white mb-4">Revisar Legenda</h3>

                    <div className="flex-1 flex flex-col gap-2">
                        <textarea
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Escreva a legenda para a sua publicação..."
                            className="w-full flex-1 min-h-[250px] bg-background-dark border border-border-dark rounded-xl p-4 text-sm text-white resize-none focus:outline-none focus:border-primary font-outfit"
                        />
                        <div className="flex justify-end">
                            <span className="text-[10px] text-text-secondary font-medium">
                                {caption.length} caracteres
                            </span>
                        </div>
                    </div>

                    <div className="pt-6 mt-2 border-t border-border-dark">
                        <button
                            onClick={handlePost}
                            disabled={!file || (!postToInstagram && !postToFacebook) || isUploading || isPosting}
                            className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-sm font-bold transition-all
                                ${(isUploading || isPosting) || !file ? 'bg-surface-highlight text-text-secondary cursor-not-allowed' : 'bg-primary text-background-dark hover:brightness-110'}`}
                        >
                            {(isUploading || isPosting) ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {postProgress || 'Processando...'}
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    Postar Agora
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Row: History */}
            <div className="lg:col-span-2">
                <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden mt-6">
                    <div className="p-4 border-b border-border-dark flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            Histórico de Postagens ({postsHistory.length})
                        </h3>
                        <button
                            onClick={fetchPostsHistory}
                            disabled={loadingHistory}
                            className="p-1.5 text-text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent disabled:opacity-50"
                            title="Atualizar Histórico"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="p-4">
                        {loadingHistory && postsHistory.length === 0 ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                        ) : postsHistory.length === 0 ? (
                            <div className="text-center text-sm text-text-secondary py-6">
                                Nenhuma postagem foi feita para este criativo ainda.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {postsHistory.map(post => {
                                    return (
                                        <div key={post.id} className="bg-background-dark border border-border-dark rounded-xl p-4 flex gap-4">
                                            <div className="w-16 h-16 rounded-lg bg-surface-dark overflow-hidden flex-shrink-0 flex items-center justify-center border border-border-dark relative group">
                                                {/* Since we optimize storage by deleting from Supabase, the media_url might be invalid.
                                                    We can show an icon if it fails or just show the platform icon prominently. */}
                                                {(post.media_url && !post.media_url.includes('facebook') && !post.media_url.includes('instagram')) ? (
                                                    <img
                                                        src={post.media_url}
                                                        alt=""
                                                        className="w-full h-full object-cover opacity-30 grayscale" // Dimmer because it might be deleted
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = '';
                                                            (e.target as HTMLImageElement).classList.add('hidden');
                                                        }}
                                                    />
                                                ) : null}

                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    {post.platform === 'instagram' ? <Instagram className="w-8 h-8 text-pink-500/20" /> : <Facebook className="w-8 h-8 text-blue-500/20" />}
                                                </div>

                                                <div className={`absolute bottom-1 right-1 w-5 h-5 rounded shadow flex items-center justify-center z-10 ${post.platform === 'instagram' ? 'bg-pink-500' : 'bg-blue-500'}`}>
                                                    {post.platform === 'instagram' ? <Instagram className="w-3 h-3 text-white" /> : <Facebook className="w-3 h-3 text-white" />}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <div className="text-[10px] text-text-secondary">
                                                            {format(new Date(post.created_at), "dd/MM 'às' HH:mm")}
                                                        </div>
                                                        {post.post_url && (
                                                            <a
                                                                href={post.post_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary hover:text-white transition-colors p-0.5"
                                                                title="Ver Publicação Oficial"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-white line-clamp-2 leading-snug" title={post.caption}>
                                                        {post.caption || '(Sem legenda)'}
                                                    </p>
                                                </div>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <span className="text-[9px] font-bold text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                                        Publicado
                                                    </span>
                                                    {post.post_id && (
                                                        <span className="text-[8px] text-text-secondary truncate max-w-[80px]">
                                                            ID: {post.post_id}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
