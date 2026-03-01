import Dexie, { type Table } from 'dexie';

export interface LocalOrder {
    id?: number;
    order_id: string;
    purchase_time: string; // ISO string
    actual_amount: number;
    commission: number;
    status: string;
    data: any; // Raw JSON from Shopee
    updated_at: string;
}

export interface SyncAction {
    id?: number;
    type:
    | 'CREATE_TRACK'
    | 'UPDATE_TRACK'
    | 'DELETE_TRACK'
    | 'UPDATE_STATUS'
    | 'CREATE_FUNNEL'
    | 'UPDATE_FUNNEL'
    | 'DELETE_FUNNEL';
    payload: any;
    timestamp: string;
    status: 'pending' | 'syncing' | 'failed';
    error?: string;
}

export class AppDatabase extends Dexie {
    orders!: Table<LocalOrder>;
    tracks!: Table<any>; // For creative_tracks
    syncQueue!: Table<SyncAction>;

    constructor() {
        super('Comissoes360DB');
        this.version(2).stores({
            orders: '++id, order_id, purchase_time, status',
            tracks: 'id, sub_id, channel',
            syncQueue: '++id, type, status, timestamp'
        });
    }
}

export const db = new AppDatabase();
