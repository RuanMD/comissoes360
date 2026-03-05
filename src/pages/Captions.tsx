import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Plus,
    Trash2,
    Save,
    Hash,
    MessageSquare,
    Variable,
    Search,
    ChevronRight,
    Tag,
    X
} from 'lucide-react';

interface Caption {
    id: string;
    title: string;
    content: string;
    hashtags: string[];
    created_at: string;
}

interface Hashtag {
    id: string;
    tag: string;
}

export function Captions() {
    const { user } = useAuth();
    const [captions, setCaptions] = useState<Caption[]>([]);
    const [myHashtags, setMyHashtags] = useState<Hashtag[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [showTagInput, setShowTagInput] = useState(false);

    // Form state
    const [selectedCaption, setSelectedCaption] = useState<Caption | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [captionsRes, hashtagsRes] = await Promise.all([
                supabase.from('captions').select('*').order('created_at', { ascending: false }),
                supabase.from('hashtags').select('*').order('tag', { ascending: true })
            ]);

            if (captionsRes.data) setCaptions(captionsRes.data);
            if (hashtagsRes.data) setMyHashtags(hashtagsRes.data);
        } catch (error) {
            console.error('Error fetching captions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCaption = async () => {
        if (!user || !title || !content) return;
        setIsSaving(true);

        const payload = {
            user_id: user.id,
            title,
            content,
            hashtags: selectedTags
        };

        try {
            if (selectedCaption) {
                await supabase.from('captions').update(payload).eq('id', selectedCaption.id);
            } else {
                await supabase.from('captions').insert([payload]);
            }
            fetchData();
            handleResetForm();
        } catch (error) {
            console.error('Error saving caption:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCaption = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir esta legenda?')) return;
        try {
            await supabase.from('captions').delete().eq('id', id);
            if (selectedCaption?.id === id) handleResetForm();
            fetchData();
        } catch (error) {
            console.error('Error deleting caption:', error);
        }
    };

    const handleAddHashtag = async () => {
        if (!user || !newTag) return;
        const tagValue = newTag.startsWith('#') ? newTag : `#${newTag}`;
        try {
            await supabase.from('hashtags').insert([{ user_id: user.id, tag: tagValue }]);
            setNewTag('');
            setShowTagInput(false);
            fetchData();
        } catch (error) {
            console.error('Error adding tag:', error);
        }
    };

    const handleDeleteHashtag = async (id: string) => {
        try {
            await supabase.from('hashtags').delete().eq('id', id);
            fetchData();
        } catch (error) {
            console.error('Error deleting tag:', error);
        }
    };

    const handleResetForm = () => {
        setSelectedCaption(null);
        setTitle('');
        setContent('');
        setSelectedTags([]);
    };

    const handleSelectCaption = (caption: Caption) => {
        setSelectedCaption(caption);
        setTitle(caption.title);
        setContent(caption.content);
        setSelectedTags(caption.hashtags || []);
    };

    const insertVariable = (variable: string) => {
        setContent(prev => prev + ` {{${variable}}}`);
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const filteredCaptions = captions.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <MessageSquare className="w-8 h-8 text-primary" />
                        Biblioteca de Legendas
                    </h1>
                    <p className="text-text-secondary text-sm md:text-base mt-1">
                        Crie e gerencie seus textos prontos para postagens no Instagram e TikTok.
                    </p>
                </div>
                <button
                    onClick={handleResetForm}
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background-dark font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95 text-sm sm:text-base whitespace-nowrap"
                >
                    <Plus className="w-5 h-5" />
                    Nova Legenda
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Sidebar: List of Captions */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                        <input
                            type="text"
                            placeholder="Buscar legendas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface-dark border border-border-dark rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>

                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[600px] pr-1">
                        {loading ? (
                            <div className="p-8 text-center text-text-secondary animate-pulse">Carregando legendas...</div>
                        ) : filteredCaptions.length === 0 ? (
                            <div className="p-8 text-center text-text-secondary border border-dashed border-border-dark rounded-xl bg-surface-dark/30">
                                Nenhuma legenda encontrada.
                            </div>
                        ) : (
                            filteredCaptions.map(caption => (
                                <div
                                    key={caption.id}
                                    onClick={() => handleSelectCaption(caption)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedCaption?.id === caption.id
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-surface-dark border-border-dark text-text-secondary hover:border-primary/30 hover:bg-surface-highlight'
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h3 className={`font-bold text-sm truncate ${selectedCaption?.id === caption.id ? 'text-primary' : 'text-white'}`}>
                                            {caption.title}
                                        </h3>
                                        <button
                                            onClick={(e) => handleDeleteCaption(caption.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-400/10 hover:text-red-400 mt-[-4px] mr-[-4px] transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <p className="text-xs line-clamp-2 opacity-70">
                                        {caption.content.replace(/{{|}}/g, '')}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Hashtags Management Card */}
                    <div className="bg-surface-dark border border-border-dark rounded-2xl p-4 mt-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Hash className="w-4 h-4 text-primary" />
                                Minhas Hashtags
                            </h3>
                            <button
                                onClick={() => setShowTagInput(!showTagInput)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {showTagInput && (
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    placeholder="Ex: #ofertashopee"
                                    className="flex-1 bg-background-dark border border-border-dark rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddHashtag()}
                                />
                                <button
                                    onClick={handleAddHashtag}
                                    className="bg-primary text-background-dark p-1.5 rounded-lg font-bold"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {myHashtags.length === 0 ? (
                                <p className="text-[10px] text-text-secondary italic">Nenhuma tag cadastrada.</p>
                            ) : (
                                myHashtags.map(tag => (
                                    <div key={tag.id} className="flex items-center gap-1.5 bg-background-dark/50 border border-border-dark rounded-full px-2.5 py-1 group hover:border-primary/30 transition-colors">
                                        <span className="text-[10px] text-text-secondary group-hover:text-primary transition-colors">{tag.tag}</span>
                                        <button
                                            onClick={() => handleDeleteHashtag(tag.id)}
                                            className="text-text-secondary hover:text-red-400"
                                        >
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content: Editor */}
                <div className="lg:col-span-8">
                    <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden min-h-[500px] flex flex-col shadow-xl">
                        {/* Editor Header */}
                        <div className="p-4 border-b border-border-dark bg-surface-highlight/30 flex items-center justify-between">
                            <input
                                type="text"
                                placeholder="Título da Legenda"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-transparent border-none text-lg font-bold text-white focus:outline-none flex-1 placeholder:text-text-secondary/50"
                            />
                            <div className="flex items-center gap-2">
                                {selectedCaption && (
                                    <button
                                        onClick={handleResetForm}
                                        className="p-2 text-text-secondary hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                                <button
                                    onClick={handleSaveCaption}
                                    disabled={isSaving || !title || !content}
                                    className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-background-dark font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50 pointer-events-auto"
                                >
                                    <Save className="w-4 h-4" />
                                    {isSaving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>

                        {/* Variables Toolbar */}
                        <div className="px-4 py-2 bg-background-dark/30 border-b border-border-dark flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mr-2 flex items-center gap-1">
                                <Variable className="w-3 h-3" />
                                Variáveis:
                            </span>
                            {[
                                { id: 'nome_produto', label: 'Nome' },
                                { id: 'link_produto', label: 'Link' },
                                { id: 'id_afiliado', label: 'ID Afiliado' },
                                { id: 'preco', label: 'Preço' },
                                { id: 'canal', label: 'Canal' },
                                { id: 'sub_id', label: 'Origem' },
                            ].map(v => (
                                <button
                                    key={v.id}
                                    onClick={() => insertVariable(v.id)}
                                    className="text-[10px] bg-surface-highlight border border-border-dark rounded-lg px-2 py-1 text-white hover:border-primary/50 hover:text-primary transition-all active:scale-95"
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 flex flex-col p-4 gap-4">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Escreva sua legenda aqui..."
                                className="flex-1 bg-transparent border-none text-white text-base leading-relaxed resize-none focus:outline-none placeholder:text-text-secondary/30 min-h-[300px]"
                            />

                            {/* Applied Tags Section */}
                            <div className="border-t border-border-dark pt-4 mb-2">
                                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3 flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    Tags:
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {myHashtags.map(tag => (
                                        <button
                                            key={tag.id}
                                            onClick={() => toggleTag(tag.tag)}
                                            className={`text-[10px] px-3 py-1.5 rounded-full border transition-all ${selectedTags.includes(tag.tag)
                                                    ? 'bg-primary border-primary text-background-dark font-bold'
                                                    : 'bg-background-dark/50 border-border-dark text-text-secondary hover:border-primary/30'
                                                }`}
                                        >
                                            {tag.tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-background-dark/50 border-t border-border-dark text-text-secondary">
                            <div className="flex items-center justify-between text-[10px]">
                                <div className="flex gap-4">
                                    <span>{content.length} caracteres</span>
                                </div>
                                <div className="flex items-center gap-1 text-primary italic">
                                    <Variable className="w-3 h-3" />
                                    Use variáveis com colchetes duplos
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
