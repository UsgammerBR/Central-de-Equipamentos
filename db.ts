
import { AppData, UserProfile, DailyData } from './types';

const DB_NAME = 'EquipmentControlDB_V3';
const DB_VERSION = 1;
const STORE_DATA = 'dailyData';
const STORE_CONFIG = 'userConfig';

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_DATA)) db.createObjectStore(STORE_DATA);
            if (!db.objectStoreNames.contains(STORE_CONFIG)) db.createObjectStore(STORE_CONFIG);
        };
        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
};

export const saveDayData = async (date: string, dayData: DailyData): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_DATA], 'readwrite');
        tx.objectStore(STORE_DATA).put(dayData, date);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const loadDayData = async (date: string): Promise<DailyData | null> => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction([STORE_DATA], 'readonly');
        const req = tx.objectStore(STORE_DATA).get(date);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
};

export const getAllDataForBackup = async (): Promise<AppData> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_DATA], 'readonly');
        const store = tx.objectStore(STORE_DATA);
        const request = store.getAll();
        const keysRequest = store.getAllKeys();
        request.onsuccess = () => {
            const data: AppData = {};
            const keys = keysRequest.result as string[];
            request.result.forEach((val, i) => { data[keys[i]] = val; });
            resolve(data);
        };
        request.onerror = () => reject(request.error);
    });
};

export const getGrandTotalCount = async (): Promise<number> => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction([STORE_DATA], 'readonly');
        const store = tx.objectStore(STORE_DATA);
        const request = store.openCursor();
        let total = 0;
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                const dayData = cursor.value as DailyData;
                Object.values(dayData).forEach(items => {
                    total += items.filter((i: any) => i.contract || i.serial || (i.photos && i.photos.length > 0)).length;
                });
                cursor.continue();
            } else {
                resolve(total);
            }
        };
    });
};

export const saveUserProfileToDB = async (profile: UserProfile): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction([STORE_CONFIG], 'readwrite');
    tx.objectStore(STORE_CONFIG).put(profile, 'profile');
};

export const loadUserProfileFromDB = async (): Promise<UserProfile | null> => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction([STORE_CONFIG], 'readonly');
        const req = tx.objectStore(STORE_CONFIG).get('profile');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
};

export const migrateLocalStorageToDB = async (): Promise<void> => {
    const localData = localStorage.getItem('equipmentData');
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            for (const [date, data] of Object.entries(parsed)) {
                await saveDayData(date, data as DailyData);
            }
            localStorage.removeItem('equipmentData');
        } catch (e) { console.error(e); }
    }
};
