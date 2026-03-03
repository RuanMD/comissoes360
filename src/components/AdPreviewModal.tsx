import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

import { Loader2, X, ExternalLink, Image as ImageIcon } from 'lucide-react';

interface AdPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    adId: string;
    fbToken: string;
}

export function AdPreviewModal({ isOpen, onClose, adId, fbToken }: AdPreviewModalProps) {
    const [loading, setLoading] = useState(true);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [destLink, setDestLink] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && adId && fbToken) {
            fetchPreview();
        }
    }, [isOpen, adId, fbToken]);

    const fetchPreview = async () => {
        setLoading(true);
        setError(null);
        setPreviewHtml(null);
        setDestLink(null);

        try {
            // Fetch preview iframe
            const previewRes = await fetch(
                `https://graph.facebook.com/v21.0/${adId}/previews?ad_format=DESKTOP_FEED_STANDARD&access_token=${fbToken}`
            );
            const previewData = await previewRes.json();

            if (previewData.error) {
                console.error('Preview error:', previewData.error);
                setError(previewData.error.message || 'Erro ao carregar preview do anúncio');
            } else if (previewData.data && previewData.data.length > 0) {
                setPreviewHtml(previewData.data[0].body);
            }

            // Fetch creative details to extract destination link
            const creativeRes = await fetch(
                `https://graph.facebook.com/v21.0/${adId}?fields=creative{object_story_spec}&access_token=${fbToken}`
            );
            const adData = await creativeRes.json();

            if (adData.creative && adData.creative.id) {
                // Sometime creative returns just ID, we need to fetch the creative node
                const creativeNodeRes = await fetch(
                    `https://graph.facebook.com/v21.0/${adData.creative.id}?fields=object_story_spec,asset_feed_spec&access_token=${fbToken}`
                );
                const creativeData = await creativeNodeRes.json();

                let link = null;
                if (creativeData.object_story_spec) {
                    const spec = creativeData.object_story_spec;
                    if (spec.link_data && spec.link_data.link) {
                        link = spec.link_data.link;
                    } else if (spec.video_data && spec.video_data.call_to_action && spec.video_data.call_to_action.value && spec.video_data.call_to_action.value.link) {
                        link = spec.video_data.call_to_action.value.link;
                    }
                } else if (creativeData.asset_feed_spec) {
                    const spec = creativeData.asset_feed_spec;
                    if (spec.link_urls && spec.link_urls.length > 0) {
                        link = spec.link_urls[0].website_url;
                    }
                }
                if (link) {
                    setDestLink(link);
                }
            }

        } catch (err: any) {
            console.error('Error fetching preview:', err);
            setError('Falha na comunicação com o Facebook');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm overflow-y-auto">
            <div className="bg-surface-dark border border-border-dark rounded-2xl shadow-xl w-full max-w-2xl my-auto flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-border-dark flex-shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary" />
                        Preview do Criativo
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <span className="text-neutral-400 text-sm">Carregando preview...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col items-center gap-6">
                            {previewHtml ? (
                                <div
                                    className="w-full flex justify-center bg-white rounded-xl overflow-hidden shadow-inner"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
                                />

                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-neutral-400 text-sm">Nenhum preview disponível.</p>
                                </div>
                            )}

                            {destLink && (
                                <div className="w-full bg-background-dark border border-border-dark rounded-xl p-4 flex flex-col gap-2">
                                    <span className="text-xs font-bold text-text-secondary">Link Vinculado:</span>
                                    <a
                                        href={destLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors p-3 rounded-lg text-primary text-sm font-medium break-all"
                                    >
                                        <span className="truncate mr-2">{destLink}</span>
                                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
