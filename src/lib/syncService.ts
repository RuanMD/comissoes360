import { db, type SyncAction } from './db';
import { supabase } from './supabase';

export const syncService = {
    async addToQueue(action: Omit<SyncAction, 'id' | 'status' | 'timestamp'>) {
        await db.syncQueue.add({
            ...action,
            status: 'pending' as const,
            timestamp: new Date().toISOString()
        });
        this.processQueue();
    },

    async processQueue() {
        if (!navigator.onLine) return;

        const pendingActions = await db.syncQueue
            .where('status')
            .equals('pending')
            .toArray();

        if (pendingActions.length === 0) return;

        console.log(`Processing ${pendingActions.length} pending actions...`);

        for (const action of pendingActions) {
            if (!action.id) continue;

            try {
                await db.syncQueue.update(action.id, { status: 'syncing' });

                let error = null;

                switch (action.type) {
                    case 'CREATE_TRACK': {
                        const { error: err } = await supabase
                            .from('creative_tracks')
                            .insert([action.payload]);
                        error = err;
                        break;
                    }
                    case 'UPDATE_TRACK': {
                        const { id, updates } = action.payload;
                        const { error: err } = await supabase
                            .from('creative_tracks')
                            .update(updates)
                            .eq('id', id);
                        error = err;
                        break;
                    }
                    case 'DELETE_TRACK': {
                        const { id } = action.payload;
                        const { error: err } = await supabase
                            .from('creative_tracks')
                            .delete()
                            .eq('id', id);
                        error = err;
                        break;
                    }
                    case 'UPDATE_STATUS': {
                        const { id, status } = action.payload;
                        const { error: err } = await supabase
                            .from('creative_tracks')
                            .update({ status })
                            .eq('id', id);
                        error = err;
                        break;
                    }
                    case 'CREATE_FUNNEL': {
                        const { error: err } = await supabase
                            .from('funnels')
                            .insert([action.payload]);
                        error = err;
                        break;
                    }
                    case 'UPDATE_FUNNEL': {
                        const { id, ...updates } = action.payload;
                        const { error: err } = await supabase
                            .from('funnels')
                            .update(updates)
                            .eq('id', id);
                        error = err;
                        break;
                    }
                    case 'DELETE_FUNNEL': {
                        const { id } = action.payload;
                        const { error: err } = await supabase
                            .from('funnels')
                            .delete()
                            .eq('id', id);
                        error = err;
                        break;
                    }
                }

                if (error) throw error;

                // Successfully synced, remove from queue
                await db.syncQueue.delete(action.id);
            } catch (err) {
                console.error('Sync failed for action:', action.id, err);
                await db.syncQueue.update(action.id, {
                    status: 'failed',
                    error: (err as any).message
                });
            }
        }
    }
};

// Registrar listener global para reconexão
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('Online detected, processing sync queue...');
        syncService.processQueue();
    });
}
