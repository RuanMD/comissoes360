import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook que busca as configurações do site (site_settings) e aplica
 * dinamicamente no <head> do documento: favicon, title e meta description.
 */
export function useSiteSettings() {
    useEffect(() => {
        const apply = async () => {
            try {
                const { data, error } = await supabase
                    .from('site_settings')
                    .select('title, description, favicon_url, banner_url')
                    .eq('id', 1)
                    .single();

                if (error || !data) return;

                // Título da aba do navegador
                if (data.title) {
                    document.title = data.title;
                }

                // Favicon
                if (data.favicon_url) {
                    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
                    if (!link) {
                        link = document.createElement('link');
                        link.rel = 'icon';
                        document.head.appendChild(link);
                    }
                    link.href = data.favicon_url;
                    // Remove type fixo para aceitar qualquer formato (png, ico, svg)
                    link.removeAttribute('type');
                }

                // Meta description (SEO)
                if (data.description) {
                    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
                    if (!meta) {
                        meta = document.createElement('meta');
                        meta.name = 'description';
                        document.head.appendChild(meta);
                    }
                    meta.content = data.description;
                }

                // Open Graph tags (para preview no WhatsApp, Facebook, etc.)
                const ogTags: Record<string, string> = {};
                if (data.title) ogTags['og:title'] = data.title;
                if (data.description) ogTags['og:description'] = data.description;
                if (data.banner_url) ogTags['og:image'] = data.banner_url;

                for (const [property, content] of Object.entries(ogTags)) {
                    let meta = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
                    if (!meta) {
                        meta = document.createElement('meta');
                        meta.setAttribute('property', property);
                        document.head.appendChild(meta);
                    }
                    meta.content = content;
                }
            } catch (err) {
                console.error('Erro ao carregar configurações do site:', err);
            }
        };

        apply();
    }, []);
}
