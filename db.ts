import { AppData, UserProfile } from './types';

const DB_NAME = 'EquipmentControlDB_V2';
const DB_VERSION = 1;
const STORE_DATA = 'dailyData';
const STORE_CONFIG = 'userConfig';

// Open Database
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_DATA)) {
                db.createObjectStore(STORE_DATA); // Key is the Date string "YYYY-MM-DD"
            }
            if (!db.objectStoreNames.contains(STORE_CONFIG)) {
                db.createObjectStore(STORE_CONFIG); // Key is 'profile', etc.
            }
        };

        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
};

// Save Full App Data (Splitting by date keys for performance)
export const saveAppDataToDB = async (data: AppData): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DATA], 'readwrite');
        const store = transaction.objectStore(STORE_DATA);

        // Save each day individually so we don't have one massive JSON object
        Object.entries(data).forEach(([dateKey, dayData]) => {
            store.put(dayData, dateKey);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

// Load Full App Data
export const loadAppDataFromDB = async (): Promise<AppData> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_DATA], 'readonly');
        const store = transaction.objectStore(STORE_DATA);
        const request = store.getAllKeys();

        const loadedData: AppData = {};

        request.onsuccess = async () => {
            const keys = request.result as string[];
            if (keys.length === 0) {
                resolve({});
                return;
            }

            let loadedCount = 0;
            keys.forEach((key) => {
                const getReq = store.get(key);
                getReq.onsuccess = () => {
                    loadedData[key] = getReq.result;
                    loadedCount++;
                    if (loadedCount === keys.length) resolve(loadedData);
                };
            });
        };
        request.onerror = () => reject(request.error);
    });
};

// Save User Profile
export const saveUserProfileToDB = async (profile: UserProfile): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction([STORE_CONFIG], 'readwrite');
    tx.objectStore(STORE_CONFIG).put(profile, 'profile');
};

// Load User Profile
export const loadUserProfileFromDB = async (): Promise<UserProfile | null> => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction([STORE_CONFIG], 'readonly');
        const req = tx.objectStore(STORE_CONFIG).get('profile');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
};

// Migration Tool: Move LocalStorage to IndexedDB
export const migrateLocalStorageToDB = async (): Promise<boolean> => {
    const localData = localStorage.getItem('equipmentData');
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            await saveAppDataToDB(parsed);
            localStorage.removeItem('equipmentData'); // Clear after success
            return true;
        } catch (e) {
            console.error("Migration failed", e);
        }
    }
    return false;
};