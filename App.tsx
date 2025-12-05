
import React, { Component, useState, useEffect, useReducer, useRef, useMemo } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileWord, IconFileExcel, IconWhatsapp, IconTelegram, IconEmail, IconSave, IconStack, IconChevronDown, IconChevronUp, IconExclamation, IconSettings, IconInfo, IconBell, IconRefresh, IconLock, IconUser, IconBarcode
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem } from './types';
import { CATEGORIES } from './constants';
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";

// --- INDEXEDDB UTILS (UNLIMITED STORAGE) ---
const DB_NAME = 'EquipamentosDB';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

const savePhotoToDB = async (photoId: string, base64: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(base64, photoId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const getPhotoFromDB = async (photoId: string): Promise<string | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(photoId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const deletePhotoFromDB = async (photoId: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(photoId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const generatePhotoId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// --- UTILITIES ---

const getFormattedDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const createEmptyDailyData = (): DailyData => {
  const data = CATEGORIES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as DailyData);

  CATEGORIES.forEach(category => {
    data[category].push({ id: generateId(), qt: '', contract: '', serial: '', photos: [] });
  });

  return data;
};

const getDataInRange = (appData: AppData, currentDate: Date, scope: 'day' | 'month'): { data: DailyData, label: string } => {
    const fmtDate = getFormattedDate(currentDate);
    
    if (scope === 'day') {
        return { 
            data: appData[fmtDate] || createEmptyDailyData(), 
            label: fmtDate 
        };
    } else {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startDay = 1;
        const currentDay = currentDate.getDate();
        
        const aggregatedData = createEmptyDailyData();
        CATEGORIES.forEach(cat => aggregatedData[cat] = []);

        for (let d = startDay; d <= currentDay; d++) {
            const loopDate = new Date(year, month, d);
            const loopFmt = getFormattedDate(loopDate);
            const dayData = appData[loopFmt];

            if (dayData) {
                CATEGORIES.forEach(cat => {
                    const items = dayData[cat] || [];
                    const activeItems = items.filter(isItemActive);
                    if (activeItems.length > 0) {
                        aggregatedData[cat].push(...activeItems);
                    }
                });
            }
        }
        return { 
            data: aggregatedData, 
            label: `Mês ${month + 1}/${year} (até dia ${currentDay})` 
        };
    }
};

const checkDuplicate = (appData: AppData, value: string, currentId: string): boolean => {
    if (!value || value.length < 3) return false;
    for (const dateKey in appData) {
        const daily = appData[dateKey];
        for (const catKey in daily) {
            const items = daily[catKey as EquipmentCategory];
            for (const item of items) {
                if (item.id !== currentId) {
                    if (item.serial === value || item.contract === value) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};

// --- REDUCER ---

type Action =
  | { type: 'SET_DATA'; payload: AppData }
  | { type: 'ENSURE_DAY_DATA'; payload: { date: string; dayData: DailyData } }
  | { type: 'ADD_ITEM'; payload: { date: string; category: EquipmentCategory } }
  | { type: 'UPDATE_ITEM'; payload: { date: string; category: EquipmentCategory; item: EquipmentItem } }
  | { type: 'DELETE_ITEMS'; payload: { date: string; category: EquipmentCategory; itemIds: string[] } }
  | { type: 'CLEAR_ALL_DATA' };

const dataReducer = (state: AppData, action: Action): AppData => {
    switch(action.type) {
        case 'SET_DATA': return action.payload;
        case 'ENSURE_DAY_DATA': {
            const { date, dayData } = action.payload;
            if (state[date]) return state;
            const newState = { ...state };
            newState[date] = dayData;
            return newState;
        }
        case 'ADD_ITEM': {
            const { date, category } = action.payload;
            const newState = JSON.parse(JSON.stringify(state));
            if (!newState[date]) newState[date] = createEmptyDailyData();
            // QT Removed
            const newItem: EquipmentItem = { id: generateId(), qt: '', contract: '', serial: '', photos: [] };
            newState[date][category].push(newItem);
            return newState;
        }
        case 'UPDATE_ITEM': {
            const { date, category, item } = action.payload;
            const newState = JSON.parse(JSON.stringify(state));
            const dayData = newState[date]?.[category];
            if (!dayData) return state;
            const itemIndex = dayData.findIndex((i: EquipmentItem) => i.id === item.id);
            if (itemIndex > -1) dayData[itemIndex] = item;
            else dayData.push(item);
            return newState;
        }
        case 'DELETE_ITEMS': {
            const { date, category, itemIds } = action.payload;
            const newState = JSON.parse(JSON.stringify(state));
            const dayData = newState[date]?.[category];
            if (!dayData) return state;
            
            // Also delete photos from IDB
            itemIds.forEach(id => {
                const item = dayData.find((i:any) => i.id === id);
                if(item && item.photos) item.photos.forEach((pId: string) => deletePhotoFromDB(pId));
            });

            newState[date][category] = dayData.filter((item: EquipmentItem) => !itemIds.includes(item.id));
            if (newState[date][category].length === 0) {
                 newState[date][category].push({ id: generateId(), qt: '', contract: '', serial: '', photos: [] });
            }
            return newState;
        }
        case 'CLEAR_ALL_DATA': return {};
        default: return state;
    }
}

const isItemActive = (item: EquipmentItem): boolean => {
    return (item.contract && item.contract.trim() !== '') || (item.serial && item.serial.trim() !== '') || item.photos.length > 0;
};

// --- ERROR BOUNDARY ---

interface ErrorBoundaryProps { children?: React.ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-center text-red-600"><h1>Erro inesperado</h1><button onClick={() => window.location.reload()}>Recarregar</button></div>;
    }
    return this.props.children;
  }
}

// --- MAIN APP ---

interface UserSettings { userName: string; userCpf: string; autoSave: boolean; darkMode: boolean; notifications: boolean; }
interface Notification { id: string; type: 'info' | 'alert' | 'request'; message: string; date: string; read: boolean; action?: () => void; }
const defaultSettings: UserSettings = { userName: '', userCpf: '', autoSave: true, darkMode: false, notifications: true };

const AppContent = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appData, dispatch] = useReducer(dataReducer, {});
  const [history, setHistory] = useState<AppData[]>([]);
  const [galleryItem, setGalleryItem] = useState<EquipmentItem | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [cameraModalItem, setCameraModalItem] = useState<EquipmentItem | null>(null);
  const [isGlobalDeleteMode, setIsGlobalDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const formattedDate = getFormattedDate(currentDate);

  // --- INITIALIZATION ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('data');
    if (sharedData) {
        try {
            const decoded = JSON.parse(atob(sharedData));
            dispatch({ type: 'SET_DATA', payload: decoded });
            setIsReadOnly(true); 
            setNotifications(prev => [...prev, { id: generateId(), type: 'info', message: 'Modo Leitura: Dados compartilhados carregados.', date: new Date().toLocaleTimeString(), read: false }]);
        } catch (e) { console.error("Invalid shared data"); }
    } else {
        const savedData = localStorage.getItem('equipmentData');
        if (savedData) dispatch({ type: 'SET_DATA', payload: JSON.parse(savedData) });
    }
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => { if (!appData[formattedDate] && !isReadOnly) dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } }); }, [appData, formattedDate, isReadOnly]);
  useEffect(() => { if (!isReadOnly && Object.keys(appData).length > 0 && settings.autoSave) localStorage.setItem('equipmentData', JSON.stringify(appData)); }, [appData, isReadOnly, settings.autoSave]);
  useEffect(() => { localStorage.setItem('appSettings', JSON.stringify(settings)); }, [settings]);

  // --- HANDLERS ---
  const checkAuth = (action: () => void) => {
      if (!isReadOnly) { action(); return; }
      setConfirmation({ 
          message: "Modo Leitura. Pedir autorização para editar?", 
          onConfirm: () => {
              alert("Solicitação enviada ao proprietário...");
              setTimeout(() => {
                  const notifId = generateId();
                  setNotifications(prev => [
                      { 
                          id: notifId, 
                          type: 'request', 
                          message: 'Solicitação de edição pendente. Aceitar?', 
                          date: new Date().toLocaleTimeString(), 
                          read: false,
                          action: () => {
                              setIsReadOnly(false);
                              setNotifications(curr => curr.filter(n => n.id !== notifId));
                              alert("Edição Autorizada!");
                          }
                      },
                      ...prev
                  ]);
              }, 2000);
          } 
      });
  };

  const dispatchWithHistory = (action: Action) => {
      if (['ADD_ITEM', 'UPDATE_ITEM', 'DELETE_ITEMS', 'CLEAR_ALL_DATA'].includes(action.type)) {
          checkAuth(() => {
            setHistory(prev => [appData, ...prev].slice(0, 10)); 
            dispatch(action);
          });
      } else {
          dispatch(action);
      }
  };

  const handleAddItem = (cat: EquipmentCategory) => dispatchWithHistory({ type: 'ADD_ITEM', payload: { date: formattedDate, category: cat } });
  const handleUpdateItem = (category: EquipmentCategory, item: EquipmentItem) => dispatchWithHistory({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } });
  
  const unreadCount = notifications.length;

  return (
    <div className={`min-h-screen font-sans pb-32 relative overflow-x-hidden ${settings.darkMode ? 'bg-slate-900 text-white' : 'bg-gradient-to-b from-[#a855f7] via-[#3b82f6] to-[#bfdbfe] text-slate-700'}`}>
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={(m) => { setActiveModal(m); setIsMenuOpen(false); }}/>
      
      <header className="pt-4 pb-2 px-4 relative z-30">
        <div className="flex justify-between items-start mb-2">
            <button onClick={() => setIsMenuOpen(true)} className="active:scale-95 transition-transform drop-shadow-xl">
                <CustomMenuIcon className="w-16 h-16" />
            </button>
            <div className="flex gap-2 p-1 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-lg">
                <ActionButton onClick={() => checkAuth(() => handleAddItem(CATEGORIES[0]))}><IconPlus className="w-4 h-4 text-blue-600" /></ActionButton>
                <ActionButton onClick={() => setIsGlobalDeleteMode(!isGlobalDeleteMode)} isDanger={isGlobalDeleteMode}><IconMinus className="w-4 h-4 text-red-500" /></ActionButton>
                <ActionButton onClick={() => { if(history.length>0) dispatch({type:'SET_DATA', payload:history[0]}) }}><IconRefresh className="w-4 h-4 text-blue-600" /></ActionButton>
                <ActionButton onClick={() => setActiveModal('search')}><IconSearch className="w-4 h-4 text-blue-600" /></ActionButton>
                <div className="relative">
                    <ActionButton onClick={() => setActiveModal('notifications')}><IconBell className="w-4 h-4 text-blue-600" /></ActionButton>
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">{unreadCount}</span>}
                </div>
            </div>
        </div>
        <div className="text-center mt-1">
            <div className={`text-sm font-bold opacity-70 ${settings.darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{currentDate.toLocaleDateString('pt-BR')}</div>
            {settings.userName && <div className={`text-xl font-serif font-bold ${settings.darkMode ? 'text-white' : 'text-slate-800'}`}>{settings.userName.split(' ')[0]}</div>}
        </div>
      </header>

      <main className="container mx-auto px-4 space-y-3 relative z-10 mt-2">
        {CATEGORIES.map(category => (
            <EquipmentSection 
                key={`${formattedDate}-${category}`} 
                category={category} 
                items={appData[formattedDate]?.[category] || []}
                onUpdateItem={(item: EquipmentItem) => handleUpdateItem(category, item)}
                onViewGallery={setGalleryItem}
                isDeleteMode={isGlobalDeleteMode}
                selectedItems={selectedItems[category] || []}
                onToggleSelect={(id: string) => setSelectedItems(prev => ({ ...prev, [category]: prev[category]?.includes(id) ? prev[category].filter(i => i !== id) : [...(prev[category]||[]), id] }))}
                onAddItem={() => handleAddItem(category)}
                onOpenCamera={setCameraModalItem}
                appData={appData}
                isReadOnly={isReadOnly}
            />
        ))}
      </main>

      <SummaryFooter data={appData[formattedDate] || createEmptyDailyData()} allData={appData} currentDate={formattedDate} />
            
      {galleryItem && <PhotoGalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} onUpdatePhotos={(p:string[]) => { const cat = Object.keys(appData[formattedDate]).find(k=>appData[formattedDate][k as EquipmentCategory].some(i=>i.id===galleryItem.id)) as EquipmentCategory; handleUpdateItem(cat, {...galleryItem, photos:p}); setGalleryItem({...galleryItem, photos:p}); }} setConfirmation={setConfirmation} />}
      {cameraModalItem && <CameraModal onClose={() => setCameraModalItem(null)} onCapture={async (p:string,c:string) => { 
          const cat = Object.keys(appData[formattedDate]).find(k=>appData[formattedDate][k as EquipmentCategory].some(i=>i.id===cameraModalItem.id)) as EquipmentCategory; 
          let photoId;
          if(p) { photoId = generatePhotoId(); await savePhotoToDB(photoId, p); }
          handleUpdateItem(cat, {...cameraModalItem, photos: photoId ? [...cameraModalItem.photos, photoId] : cameraModalItem.photos, serial:c||cameraModalItem.serial}); 
          setCameraModalItem(null); 
      }} />}

      {activeModal === 'notifications' && <NotificationsModal notifications={notifications} setNotifications={setNotifications} onClose={() => setActiveModal(null)} />}
      {activeModal === 'calendar' && <CalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={(d:Date) => { setCurrentDate(d); setActiveModal(null); }}/>}
      {activeModal === 'save' && <DownloadModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'export' && <ShareModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'settings' && <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setActiveModal(null)} onClearData={() => setConfirmation({ message: "Apagar tudo?", onConfirm: () => { dispatchWithHistory({ type: 'CLEAR_ALL_DATA' }); setActiveModal(null); } })}/>}
      {activeModal === 'about' && <AboutModal onClose={() => setActiveModal(null)} appData={appData} />}
      {activeModal === 'search' && <SearchModal onClose={() => setActiveModal(null)} appData={appData} onSelect={(res: any) => { const [y, m, d] = res.date.split('-'); setCurrentDate(new Date(y, m-1, d)); setActiveModal(null); }} />}
      {confirmation && <ConfirmationModal message={confirmation.message} onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} onCancel={() => setConfirmation(null)} />}
    </div>
  );
};

const ActionButton = ({ children, onClick, isPrimary, isDanger }: any) => (
    <button onClick={onClick} className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-all ${isDanger ? 'bg-red-50 border-red-200' : 'bg-white/90 border-white/50'}`}>{children}</button>
);

const EquipmentSection = ({ category, items, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, onAddItem, onOpenCamera, appData, isReadOnly }: any) => (
    <div className="mb-2">
        <div className="w-full h-10 bg-gradient-to-r from-blue-500 to-blue-400 rounded-xl flex items-center px-4 justify-between shadow-md mb-2">
            <h2 className="text-white font-black uppercase tracking-wide text-sm">{category}</h2>
            <div className="flex gap-2">
                <button onClick={onAddItem} className="bg-white/20 p-1 rounded-md text-white hover:bg-white/30"><IconPlus className="w-4 h-4" /></button>
                <IconStack className="text-white w-4 h-4 opacity-90" />
            </div>
        </div>
        <div className="space-y-2">
            {items.map((item: any) => (
                <EquipmentRow key={item.id} item={item} onUpdate={onUpdateItem} isDeleteMode={isDeleteMode} isSelected={selectedItems.includes(item.id)} onToggleSelect={() => onToggleSelect(item.id)} onViewGallery={() => onViewGallery(item)} onOpenCamera={() => onOpenCamera(item)} appData={appData} isReadOnly={isReadOnly} />
            ))}
        </div>
    </div>
);

const EquipmentRow = ({ item, onUpdate, isDeleteMode, isSelected, onToggleSelect, onViewGallery, onOpenCamera, appData, isReadOnly }: any) => {
    const handleChange = (field: keyof EquipmentItem, value: string) => { if(!isReadOnly) onUpdate({ ...item, [field]: value }); };
    const isDuplicateContract = checkDuplicate(appData, item.contract, item.id);
    const isDuplicateSerial = checkDuplicate(appData, item.serial, item.id);

    return (
        <div className="flex items-center gap-2 px-1 relative">
            {isReadOnly && <IconLock className="absolute -left-2 text-slate-500 w-4 h-4 z-10" />}
            {isDeleteMode && <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="w-5 h-5 accent-red-500" />}
            <div className="flex-1 flex gap-2">
                <div className="flex-[2] relative"><input disabled={isReadOnly} value={item.contract} onChange={(e) => { if(e.target.value.length <= 10) handleChange('contract', e.target.value) }} placeholder="Contrato" className={`w-full h-10 rounded-xl px-3 text-xs font-bold text-slate-500 placeholder:text-slate-400 outline-none bg-white/70 shadow-sm border border-white/20 ${isDuplicateContract ? 'bg-red-50 text-red-500' : ''}`} /></div>
                <div className="flex-[3] relative"><input disabled={isReadOnly} value={item.serial} onChange={(e) => { if(e.target.value.length <= 20) handleChange('serial', e.target.value) }} placeholder="Serial" className={`w-full h-10 rounded-xl px-3 text-center text-xs font-bold text-slate-500 placeholder:text-slate-400 outline-none bg-white/70 shadow-sm border border-white/20 ${isDuplicateSerial ? 'bg-red-50 text-red-500' : ''}`} /></div>
                <button onClick={onOpenCamera} className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-500 shadow-sm active:scale-95"><IconCamera className="w-4 h-4" /></button>
                <button onClick={onViewGallery} className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm active:scale-95 ${item.photos.length > 0 ? 'bg-green-100 text-green-500' : 'bg-blue-100 text-blue-400'}`}><IconGallery className="w-4 h-4" /></button>
            </div>
        </div>
    );
};

const SummaryFooter = ({ data, allData, currentDate }: any) => {
    const calculateTotal = (d: DailyData) => Object.values(d).flat().filter(isItemActive).length;
    const totalDay = calculateTotal(data);
    const totalMonth = useMemo(() => {
        const curr = new Date(currentDate + 'T00:00:00'); 
        const year = curr.getFullYear();
        const month = curr.getMonth();
        let sum = 0;
        for (let d = 1; d <= 31; d++) {
             const dayStr = d.toString().padStart(2, '0');
             const monthStr = (month + 1).toString().padStart(2, '0');
             const dateKey = `${year}-${monthStr}-${dayStr}`;
             if (allData[dateKey]) sum += calculateTotal(allData[dateKey]);
        }
        return sum;
    }, [allData, currentDate]);

    return (
        <footer className="fixed bottom-0 left-0 w-full bg-white/30 backdrop-blur-xl border-t border-white/40 py-2 z-40 overflow-x-auto whitespace-nowrap">
             <div className="flex px-4 gap-4 min-w-full">
                {CATEGORIES.map(cat => {
                    const count = (data[cat] || []).filter(isItemActive).length;
                    return (
                        <div key={cat} className="flex flex-col items-center min-w-[60px]">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{cat.replace('BOX SOUND','SOUND').substring(0,8)}</span>
                            <span className="text-xl font-black text-slate-700">{count}</span>
                        </div>
                    )
                })}
                <div className="flex flex-col items-center min-w-[70px] bg-blue-50/50 rounded-lg">
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">TOTAL DIA</span>
                    <span className="text-xl font-black text-blue-600">{totalDay}</span>
                </div>
                <div className="flex flex-col items-center min-w-[70px] bg-purple-50/50 rounded-lg">
                    <span className="text-[9px] font-bold text-purple-500 uppercase tracking-widest">SOMA TOTAL</span>
                    <span className="text-xl font-black text-purple-600">{totalMonth}</span>
                </div>
            </div>
        </footer>
    );
};

// --- MODALS ---
const NotificationsModal = ({ notifications, setNotifications, onClose }: any) => {
    const handleAction = (n: Notification) => {
        if(n.action) n.action();
        setNotifications((prev:any) => prev.filter((i:any)=>i.id!==n.id));
    };
    return (
        <Modal title="Notificações" onClose={onClose}>
            {notifications.length === 0 ? <p className="text-center text-slate-400 py-4">Nenhuma notificação.</p> : 
            <div className="space-y-2">{notifications.map((n:any) => (
                <div key={n.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="flex justify-between mb-1"><span className={`text-xs font-bold uppercase ${n.type==='request'?'text-red-500':'text-blue-500'}`}>{n.type}</span><span className="text-[10px] text-slate-400">{n.date}</span></div>
                    <p className="text-sm text-slate-600 mb-2">{n.message}</p>
                    {n.type === 'request' && <button onClick={() => handleAction(n)} className="w-full py-1 bg-green-500 text-white rounded-lg text-xs font-bold">Autorizar</button>}
                </div>
            ))}</div>}
        </Modal>
    );
};

const AboutModal = ({ onClose, appData }: any) => {
    const handleShare = (type: 'link' | 'data') => {
        if (type === 'link') {
            const url = window.location.href.split('?')[0];
            const text = `Baixe o App Controle de Equipamentos: ${url}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
        } else {
            const dataStr = btoa(JSON.stringify(appData));
            const url = `${window.location.href.split('?')[0]}?data=${dataStr}`;
            const text = `Acesse meus dados no App (Modo Leitura): ${url}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
        }
    };
    return (
        <Modal title="Sobre" onClose={onClose}>
            <div className="text-center space-y-4">
                <CustomMenuIcon className="w-20 h-20 mx-auto" />
                <h2 className="text-lg font-bold">Controle de Equipamentos</h2>
                <div className="flex flex-col gap-2">
                    <button onClick={() => handleShare('link')} className="py-3 bg-blue-500 text-white rounded-xl font-bold shadow-lg">Compartilhar App</button>
                    <button onClick={() => handleShare('data')} className="py-3 bg-purple-500 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"><IconLock className="w-4 h-4"/> Compartilhar com Dados</button>
                </div>
            </div>
        </Modal>
    );
};

const CameraModal = ({ onClose, onCapture }: any) => {
    const [mode, setMode] = useState<'select'|'photo'|'scan'>('select');
    const videoRef = useRef<HTMLVideoElement>(null);
    const scannerRef = useRef<Html5QrcodeScanner>(null);

    useEffect(() => {
        if (mode === 'scan') {
            const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] }, false);
            scannerRef.current = scanner;
            scanner.render((decodedText) => { 
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); audio.play().catch(()=>{});
                if(confirm(`Código: ${decodedText}`)) onCapture(null, decodedText); 
            }, console.error);
            return () => scanner.clear().catch(console.error);
        }
        if (mode === 'photo') {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(s => { if(videoRef.current){videoRef.current.srcObject=s;videoRef.current.play()} });
            return () => { if(videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop()); };
        }
    }, [mode]);

    const takePhoto = () => { if(videoRef.current){ const c = document.createElement('canvas'); c.width=videoRef.current.videoWidth; c.height=videoRef.current.videoHeight; c.getContext('2d')?.drawImage(videoRef.current,0,0); onCapture(c.toDataURL('image/jpeg'),null); } };

    if (mode === 'select') return (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-2xl space-y-4">
                <h3 className="font-bold text-slate-700">Escolha uma opção</h3>
                <button onClick={() => setMode('photo')} className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold flex justify-center gap-2"><IconCamera className="w-5 h-5"/> Tirar Foto</button>
                <button onClick={() => setMode('scan')} className="w-full py-3 bg-purple-500 text-white rounded-xl font-bold flex justify-center gap-2"><IconSearch className="w-5 h-5"/> QR Code</button>
                <button onClick={() => setMode('scan')} className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold flex justify-center gap-2"><IconBarcode className="w-5 h-5"/> Cód. Barras</button>
                <button onClick={onClose} className="text-slate-400 underline pt-2">Cancelar</button>
            </div>
        </div>
    );

    if (mode === 'photo') return (<div className="fixed inset-0 z-[70] bg-black flex flex-col"><div className="absolute top-0 w-full p-4 flex justify-between z-10"><h3 className="text-white font-bold">Foto</h3><button onClick={onClose}><IconX className="w-6 h-6 text-white"/></button></div><video ref={videoRef} className="w-full h-full object-cover"/><div className="absolute bottom-0 w-full p-6 flex justify-center"><button onClick={takePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-gray-300"/></div></div>);
    return (<div className="fixed inset-0 z-[70] bg-black flex flex-col"><div className="p-4 flex justify-between text-white"><h3 className="font-bold">Scanner</h3><button onClick={onClose}><IconX className="w-6 h-6"/></button></div><div className="flex-1 flex items-center justify-center"><div id="reader" className="w-full max-w-md"/></div></div>);
};

const Modal = ({ title, onClose, children }: any) => (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in"><div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md border border-white/50 animate-slide-in-up"><div className="flex justify-between items-center p-4 border-b border-slate-200/50"><h3 className="text-lg font-bold text-slate-700">{title}</h3><button onClick={onClose}><IconX className="w-6 h-6 text-slate-400 hover:text-red-500" /></button></div><div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div></div></div>);
const CalendarModal = ({ currentDate, onClose, onDateSelect }: any) => { const [viewDate, setViewDate] = useState(currentDate); const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate(); const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); return (<Modal title="Selecionar Data" onClose={onClose}><div className="flex justify-between items-center mb-4"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}><IconChevronLeft className="w-6 h-6 text-slate-600"/></button><span className="font-bold text-slate-700 capitalize">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}><IconChevronRight className="w-6 h-6 text-slate-600"/></button></div><div className="grid grid-cols-7 gap-1 text-center mb-2">{['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="text-xs font-bold text-slate-400">{d}</span>)}</div><div className="grid grid-cols-7 gap-1">{Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}{Array.from({ length: daysInMonth }).map((_, i) => { const d = i + 1; const isSelected = d === currentDate.getDate() && viewDate.getMonth() === currentDate.getMonth() && viewDate.getFullYear() === currentDate.getFullYear(); return <button key={d} onClick={() => onDateSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), d))} className={`p-2 rounded-lg text-sm font-medium transition-all ${isSelected ? 'bg-cyan-500 text-white shadow-md' : 'hover:bg-slate-100 text-slate-700'}`}>{d}</button>; })}</div><button onClick={() => onDateSelect(new Date())} className="w-full mt-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Ir para Hoje</button></Modal>); };
const DownloadModal = ({ appData, currentDate, onClose }: any) => { const [range, setRange] = useState<'day' | 'month'>('day'); const handleDownload = async (format: 'word' | 'excel') => { const { data, label } = getDataInRange(appData, currentDate, range); let content = '', mimeType = '', extension = ''; if (format === 'word') { mimeType = 'application/msword'; extension = 'doc'; const prepared = await Promise.all(CATEGORIES.map(async cat => { const items = data[cat] || []; const withPhotos = await Promise.all(items.map(async (item: any) => { const photos = await Promise.all((item.photos || []).map((id: string) => getPhotoFromDB(id))); return { ...item, photos: photos.filter(Boolean) }; })); return { cat, items: withPhotos }; })); content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Relatório</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{border:1px solid #999;padding:8px;text-align:left;vertical-align:top}th{background-color:#eee}.category-title{background-color:#0ea5e9;color:white;padding:10px;margin-top:20px;font-size:18px}.photo-container{margin-top:5px}.item-photo{width:150px;height:auto;border:1px solid #ccc;margin-right:5px}</style></head><body><h1 style="text-align:center;color:#333">Relatório de Equipamentos</h1><h3 style="text-align:center;color:#666">${label}</h3>${prepared.map(({cat, items}) => items.length ? `<h2>${cat}</h2><table><tr><th>Contrato</th><th>Serial</th><th>Fotos</th></tr>${items.map((i:any) => `<tr><td>${i.contract}</td><td>${i.serial}</td><td>${i.photos.map((p:string)=>`<img src="${p}" width="100"/>`).join('')}</td></tr>`).join('')}</table>` : '').join('')}</body></html>`; } else { mimeType = 'application/vnd.ms-excel'; extension = 'xls'; content = `<html><body><table><thead><tr><th>Cat</th><th>Contrato</th><th>Serial</th></tr></thead><tbody>${CATEGORIES.flatMap(cat => (data[cat]||[]).map((i:any) => `<tr><td>${cat}</td><td>${i.contract}</td><td>${i.serial}</td></tr>`)).join('')}</tbody></table></body></html>`; } const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff', content], { type: mimeType })); link.download = `Equipamentos_${label}.${extension}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); }; return (<Modal title="Salvar" onClose={onClose}><div className="space-y-4"><div className="flex bg-slate-100 p-1 rounded-xl"><button onClick={() => setRange('day')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${range === 'day' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Hoje</button><button onClick={() => setRange('month')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${range === 'month' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Mês</button></div><div className="grid grid-cols-2 gap-4"><button onClick={() => handleDownload('word')} className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center"><IconFileWord className="w-8 h-8 text-blue-600 mb-2"/><span className="font-bold text-blue-700">Word</span></button><button onClick={() => handleDownload('excel')} className="p-4 bg-green-50 rounded-2xl border border-green-100 flex flex-col items-center"><IconFileExcel className="w-8 h-8 text-green-600 mb-2"/><span className="font-bold text-green-700">Excel</span></button></div></div></Modal>); };
const ShareModal = ({ appData, currentDate, onClose, isSharingApp }: any) => { const handleShare = () => { const text = `Acesse o app aqui: ${window.location.href}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`); }; return (<Modal title="Compartilhar" onClose={onClose}><button onClick={handleShare} className="w-full py-4 bg-green-500 text-white rounded-xl font-bold flex justify-center gap-2"><IconWhatsapp className="w-6 h-6"/> Enviar Link</button></Modal>); };
const SettingsModal = ({ settings, setSettings, onClose, onClearData }: any) => { const toggle = (k:any) => setSettings({...settings, [k]: !settings[k]}); const change = (e:any) => setSettings({...settings, [e.target.name]: e.target.value}); return (<Modal title="Configurações" onClose={onClose}><div className="space-y-4"><div><label className="text-xs font-bold text-slate-400">Nome</label><input name="userName" value={settings.userName} onChange={change} className="w-full p-3 bg-slate-50 rounded-xl border outline-none font-bold text-slate-700" /></div><div className="flex justify-between items-center p-2"><span className="font-bold text-slate-600">Auto Salvar</span><button onClick={() => toggle('autoSave')} className={`w-12 h-6 rounded-full p-1 ${settings.autoSave ? 'bg-blue-500' : 'bg-slate-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.autoSave ? 'translate-x-6' : ''}`} /></button></div><button onClick={onClearData} className="w-full py-3 bg-red-50 text-red-500 font-bold rounded-xl mt-4">Resetar Dados</button></div></Modal>); };
const SearchModal = ({ onClose, appData, onSelect }: any) => { const [term, setTerm] = useState(''); const [results, setResults] = useState<any[]>([]); useEffect(() => { if(term.length<2){setResults([]);return;} const r:any[]=[]; Object.entries(appData).forEach(([d,day]:[string,any])=>{CATEGORIES.forEach(c=>{(day[c]||[]).forEach((i:any)=>{if((i.serial?.includes(term)||i.contract?.includes(term))&&isItemActive(i))r.push({date:d,category:c,item:i})})})}); setResults(r); }, [term, appData]); return (<Modal title="Buscar" onClose={onClose}><input autoFocus value={term} onChange={e=>setTerm(e.target.value)} placeholder="Serial..." className="w-full p-3 bg-slate-100 rounded-xl font-bold mb-4"/><div className="space-y-2">{results.map((res,i)=>(<div key={i} onClick={()=>onSelect(res)} className="p-3 border rounded-xl cursor-pointer"><div className="flex justify-between text-xs text-slate-400"><span>{res.date}</span><span className="uppercase text-blue-500">{res.category}</span></div><div className="font-bold text-slate-700">{res.item.serial}</div></div>))}</div></Modal>); };
const ConfirmationModal = ({ message, onConfirm, onCancel }: any) => (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"><div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs w-full text-center"><IconTrash className="w-12 h-12 text-red-500 mx-auto mb-3"/><h3 className="text-lg font-bold text-slate-800 mb-6">{message}</h3><div className="flex gap-3"><button onClick={onCancel} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={onConfirm} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/30">Confirmar</button></div></div></div>);
const PhotoGalleryModal = ({ item, onClose, onUpdatePhotos, setConfirmation }: any) => { const [viewPhoto, setViewPhoto] = useState<string | null>(null); const [loaded, setLoaded] = useState<string[]>([]); useEffect(()=>{ Promise.all((item.photos||[]).map((id:string)=>getPhotoFromDB(id))).then((imgs:any)=>setLoaded(imgs.filter(Boolean))); },[item]); const fileRef = useRef<HTMLInputElement>(null); const add = (e:any) => { if(e.target.files[0]){ const r = new FileReader(); r.onload=async(ev)=>{ if(ev.target?.result) { const pid=generatePhotoId(); await savePhotoToDB(pid, ev.target.result as string); onUpdatePhotos([...(item.photos||[]), pid]); } }; r.readAsDataURL(e.target.files[0]); } }; return (<Modal title="Galeria" onClose={onClose}><div className="grid grid-cols-3 gap-2">{loaded.map((p,i)=>(<img key={i} src={p} className="rounded-lg w-full h-24 object-cover" onClick={()=>setViewPhoto(p)}/>))}<button onClick={()=>fileRef.current?.click()} className="w-full h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center"><IconPlus className="text-slate-400"/></button><input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={add}/></div>{viewPhoto && <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={()=>setViewPhoto(null)}><img src={viewPhoto} className="max-w-full max-h-full rounded-xl"/></div>}</Modal>); };

const App = () => (
    <ErrorBoundary>
        <AppContent />
    </ErrorBoundary>
);

export default App;
