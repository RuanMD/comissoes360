import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

type SubscriptionStatus = 'active' | 'inactive' | 'expired' | 'unknown';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    subscriptionStatus: SubscriptionStatus;
    isAdmin: boolean;
    loading: boolean;
    signInWithPassword: (email: string, password: string) => Promise<{ data: any; error: Error | null }>;
    updatePassword: (password: string) => Promise<{ data: any; error: Error | null }>;
    sendPasswordResetEmail: (email: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('unknown');
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Obter sessão inicial
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                checkSubscription(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Escutar mudanças de autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                localStorage.setItem('mustReset', 'true');
            }

            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                checkSubscription(session.user.id);
            } else {
                setSubscriptionStatus('unknown');
                setIsAdmin(false);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkSubscription = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('subscription_status, subscription_expires_at, is_admin')
                .eq('id', userId)
                .single();

            if (error) {
                console.error("Erro ao verificar assinatura:", error);
                setSubscriptionStatus('unknown');
                return;
            }

            if (data) {
                const isActive = data.subscription_status === 'active';
                const expiresAt = new Date(data.subscription_expires_at);
                const now = new Date();

                if (isActive && expiresAt >= now) {
                    setSubscriptionStatus('active');
                } else {
                    setSubscriptionStatus('expired');
                }

                setIsAdmin(data.is_admin || false);
            } else {
                setSubscriptionStatus('inactive'); // Usuário não existe na tabela pública ou sem assinatura
                setIsAdmin(false);
            }
        } catch (err) {
            console.error(err);
            setSubscriptionStatus('unknown');
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    const signInWithPassword = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        return { data, error };
    };

    const updatePassword = async (password: string) => {
        const { data, error } = await supabase.auth.updateUser({
            password
        });
        return { data, error };
    };

    const sendPasswordResetEmail = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password',
        });
        return { error };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{
            session, user, subscriptionStatus, isAdmin, loading,
            signInWithPassword, updatePassword, sendPasswordResetEmail, signOut
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
}
