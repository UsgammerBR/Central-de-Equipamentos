
import React, { Component, useState, useEffect, useReducer, useRef, useMemo } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileWord, IconFileExcel, IconWhatsapp, IconTelegram, IconEmail, IconSave, IconStack, IconChevronDown, IconChevronUp, IconExclamation, IconSettings, IconInfo, IconBell, IconRefresh
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem } from './types';
import { CATEGORIES } from './constants';
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";

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
  public state: ErrorBoundaryState = { hasError: false, error: null };
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

interface UserSettings {
    userName: string;
    userCpf: string;
    autoSave: boolean;
    darkMode: boolean;
    notifications: boolean;
}

const defaultSettings: UserSettings = {
    userName: '',
    userCpf: '',
    autoSave: true,
    darkMode: false,
    notifications: true
};

const AppContent = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appData, dispatch] = useReducer(dataReducer, {});
  const [history, setHistory] = useState<AppData[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [galleryItem, setGalleryItem] = useState<EquipmentItem | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<EquipmentCategory>(CATEGORIES[0]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [cameraModalItem, setCameraModalItem] = useState<EquipmentItem | null>(null);
  const [isGlobalDeleteMode, setIsGlobalDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
  
  // Settings State
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  const formattedDate = getFormattedDate(currentDate);

  const dispatchWithHistory = (action: Action) => {
    setHistory(prev => [appData, ...prev].slice(0, 10)); 
    dispatch(action);
  };

  // LOAD DATA & SETTINGS
  useEffect(() => {
    const savedData = localStorage.getItem('equipmentData');
    if (savedData) {
        try { dispatch({ type: 'SET_DATA', payload: JSON.parse(savedData) }); } 
        catch (e) { console.error("Failed to load data", e); }
    }
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
        try { setSettings(JSON.parse(savedSettings)); }
        catch (e) { console.error("Failed settings", e); }
    }
  }, []);

  // ENSURE CURRENT DAY EXISTS
  useEffect(() => {
    if (!appData[formattedDate]) {
      dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } });
    }
  }, [appData, formattedDate]);

  // SAVE DATA ON CHANGE (If AutoSave is ON)
  useEffect(() => {
    if (!isRestoring && Object.keys(appData).length > 0 && settings.autoSave) {
        localStorage.setItem('equipmentData', JSON.stringify(appData));
    }
  }, [appData, isRestoring, settings.autoSave]);

  // SAVE SETTINGS
  useEffect(() => {
      localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  const currentDayData: DailyData = appData[formattedDate] || createEmptyDailyData();

  const handleAddItem = () => {
    if (activeCategory) {
        dispatchWithHistory({ type: 'ADD_ITEM', payload: { date: formattedDate, category: activeCategory } });
    }
  };

  const handleUpdateItem = (category: EquipmentCategory, item: EquipmentItem) => dispatchWithHistory({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } });

  const handleUndo = () => {
    if (history.length > 0) {
      const previousState = history[0];
      setHistory(history.slice(1));
      setIsRestoring(true);
      dispatch({ type: 'SET_DATA', payload: previousState });
    }
  }

  const handleToggleDeleteMode = () => {
    setIsGlobalDeleteMode(prev => !prev);
    setSelectedItems({}); 
  };

  const handleConfirmGlobalDelete = () => {
      const totalSelected = Object.values(selectedItems).reduce<number>((sum, ids: string[]) => sum + ids.length, 0);
      if (totalSelected > 0) {
        setConfirmation({
            message: `Apagar ${totalSelected} item(s)?`,
            onConfirm: () => {
                Object.entries(selectedItems).forEach(([cat, ids]: [string, string[]]) => {
                    if (ids.length > 0) dispatchWithHistory({ type: 'DELETE_ITEMS', payload: { date: formattedDate, category: cat as EquipmentCategory, itemIds: ids } });
                });
                handleToggleDeleteMode(); 
            }
        });
      }
  };

  return (
    // Global Gradient Background Matching Reference Image
    <div className="min-h-screen bg-gradient-to-b from-[#a855f7] via-[#3b82f6] to-[#bfdbfe] font-sans pb-32 relative overflow-x-hidden text-slate-700">
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={(m) => { setActiveModal(m); setIsMenuOpen(false); }}/>
      
      {/* HEADER REDESIGN */}
      <header className="pt-4 pb-2 px-4 relative z-30">
        <div className="flex justify-between items-start mb-4">
            {/* Left: Custom App Icon */}
            <button onClick={() => setIsMenuOpen(true)} className="active:scale-95 transition-transform drop-shadow-xl">
                <CustomMenuIcon className="w-16 h-16 rounded-3xl" />
            </button>

            {/* Right: Action Buttons Row (White/Glass Squares) */}
            <div className="flex gap-2 p-1">
                <ActionButton onClick={handleAddItem}><IconPlus className="w-6 h-6 text-blue-500" /></ActionButton>
                <ActionButton onClick={handleToggleDeleteMode} isDanger={isGlobalDeleteMode}><IconMinus className="w-6 h-6 text-red-500" /></ActionButton>
                <ActionButton onClick={handleUndo}><IconRefresh className="w-5 h-5 text-blue-500" /></ActionButton>
                <ActionButton onClick={() => setIsSearchActive(!isSearchActive)}><IconSearch className="w-5 h-5 text-blue-500" /></ActionButton>
                <div className="relative">
                    <ActionButton><IconBell className="w-5 h-5 text-blue-500" /></ActionButton>
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">18</span>
                </div>
            </div>
        </div>

        {/* Date Section (Title Removed) */}
        <div className="text-center mt-2">
            <div className="text-sm font-bold text-slate-700 opacity-70">
                {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
        </div>
      </header>

      <main className="container mx-auto px-4 space-y-4 relative z-10 mt-4">
        {CATEGORIES.map(category => (
            <EquipmentSection 
                key={`${formattedDate}-${category}`} 
                category={category} 
                items={currentDayData[category] || []}
                onUpdateItem={(item: EquipmentItem) => handleUpdateItem(category, item)}
                onViewGallery={(item: EquipmentItem) => setGalleryItem(item)}
                isDeleteMode={isGlobalDeleteMode}
                selectedItems={selectedItems[category] || []}
                onToggleSelect={(id: string) => setSelectedItems(prev => ({ ...prev, [category]: prev[category]?.includes(id) ? prev[category].filter(i => i !== id) : [...(prev[category]||[]), id] }))}
                isActive={category === activeCategory}
                onActivate={() => setActiveCategory(category)}
                onOpenCamera={(item: EquipmentItem) => setCameraModalItem(item)}
                appData={appData}
            />
        ))}
      </main>

      <SummaryFooter data={currentDayData} />
            
      {galleryItem && <PhotoGalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} onUpdatePhotos={(photos: string[]) => {
        const cat = Object.keys(currentDayData).find(k => currentDayData[k as EquipmentCategory].some(i => i.id === galleryItem.id)) as EquipmentCategory;
        if(cat) { handleUpdateItem(cat, { ...galleryItem, photos }); setGalleryItem({ ...galleryItem, photos }); }
      }} setConfirmation={setConfirmation} />}
      
      {cameraModalItem && <CameraModal onClose={() => setCameraModalItem(null)} onCapture={(photo: string, code: string) => {
           const cat = Object.keys(currentDayData).find(k => currentDayData[k as EquipmentCategory].some(i => i.id === cameraModalItem.id)) as EquipmentCategory;
           if (cat) { handleUpdateItem(cat, { ...cameraModalItem, photos: photo ? [...cameraModalItem.photos, photo] : cameraModalItem.photos, serial: code || cameraModalItem.serial }); }
           setCameraModalItem(null);
      }} />}

      {/* Other Modals... */}
      {activeModal === 'calendar' && <CalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={(d: Date) => { setCurrentDate(d); setActiveModal(null); }}/>}
      {activeModal === 'save' && <DownloadModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'export' && <ShareModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'settings' && <SettingsModal settings={settings} setSettings={setSettings} onClose={() => setActiveModal(null)} onClearData={() => setConfirmation({ message: "Apagar tudo?", onConfirm: () => { dispatchWithHistory({ type: 'CLEAR_ALL_DATA' }); setActiveModal(null); } })}/>}
      {activeModal === 'about' && <AboutModal onClose={() => setActiveModal(null)} onShareClick={() => setActiveModal('shareApp')}/>}
      {activeModal === 'shareApp' && <ShareModal appData={appData} currentDate={currentDate} isSharingApp onClose={() => setActiveModal(null)} />}
      {isSearchActive && <SearchModal onClose={() => setIsSearchActive(false)} appData={appData} onSelect={(res: any) => { const [y, m, d] = res.date.split('-'); setCurrentDate(new Date(y, m-1, d)); setIsSearchActive(false); }} />}
      {confirmation && <ConfirmationModal message={confirmation.message} onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} onCancel={() => setConfirmation(null)} />}
    </div>
  );
};

const App = () => (<ErrorBoundary><AppContent /></ErrorBoundary>)
export default App;

// --- REDESIGNED COMPONENTS TO MATCH IMAGE ---

const ActionButton = ({ children, onClick, isPrimary, isDanger }: any) => (
    <button 
        onClick={onClick} 
        className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/90 shadow-sm border border-white/50 active:scale-95 transition-all"
    >
        {children}
    </button>
);

const EquipmentSection = ({ category, items, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isActive, onActivate, onOpenCamera, appData }: any) => {
    return (
        <div onClick={onActivate} className="mb-2">
            {/* Header Card: Rounded Blue Gradient Bar */}
            <div className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-400 rounded-2xl flex items-center px-4 justify-between shadow-md mb-2 cursor-pointer active:scale-[0.99] transition-transform">
                <h2 className="text-white font-black uppercase tracking-wide text-lg">
                    {category}
                </h2>
                <IconChevronDown className="text-white w-6 h-6 opacity-90" />
            </div>

            {/* Rows Container */}
            <div className="space-y-3">
                {items.map((item: any) => (
                    <EquipmentRow 
                        key={item.id} item={item} onUpdate={onUpdateItem} isDeleteMode={isDeleteMode}
                        isSelected={selectedItems.includes(item.id)} onToggleSelect={() => onToggleSelect(item.id)} 
                        onViewGallery={() => onViewGallery(item)} onOpenCamera={() => onOpenCamera(item)}
                        onFocus={() => onActivate()}
                        appData={appData}
                    />
                ))}
            </div>
        </div>
    );
};

const EquipmentRow = ({ item, onUpdate, isDeleteMode, isSelected, onToggleSelect, onViewGallery, onOpenCamera, onFocus, appData }: any) => {
    const handleChange = (field: keyof EquipmentItem, value: string) => {
        onUpdate({ ...item, [field]: value });
    };

    const isDuplicateContract = checkDuplicate(appData, item.contract, item.id);
    const isDuplicateSerial = checkDuplicate(appData, item.serial, item.id);

    return (
        <div className="flex items-center gap-2 px-1">
            {isDeleteMode && (
                <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="w-6 h-6 accent-red-500" />
            )}
            
            {/* Layout: [ Contrato (Wide) ] [ Se (Small) ] [ Cam ] [ Gal ] */}
            <div className="flex-1 flex gap-2">
                
                {/* Contrato Input - Wide Rounded Pill */}
                <div className="flex-[2] relative">
                    <input
                        value={item.contract}
                        onChange={(e) => { if(e.target.value.length <= 10) handleChange('contract', e.target.value) }}
                        onFocus={onFocus}
                        placeholder="Contrato"
                        className={`w-full h-12 rounded-2xl px-4 text-sm font-bold text-slate-500 placeholder:text-slate-400 outline-none bg-white/50 shadow-sm border border-white/20 ${isDuplicateContract ? 'bg-red-50 text-red-500' : ''}`}
                    />
                </div>

                {/* Serial (Se) Input - Smaller Rounded Pill */}
                <div className="flex-[1] relative">
                    <input
                        value={item.serial}
                        onChange={(e) => { if(e.target.value.length <= 20) handleChange('serial', e.target.value) }}
                        onFocus={onFocus}
                        placeholder="Se"
                        className={`w-full h-12 rounded-2xl px-2 text-center text-sm font-bold text-slate-500 placeholder:text-slate-400 outline-none bg-white/50 shadow-sm border border-white/20 ${isDuplicateSerial ? 'bg-red-50 text-red-500' : ''}`}
                    />
                </div>

                {/* Buttons - Square Rounded Blue */}
                <button onClick={onOpenCamera} className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-500 shadow-sm active:scale-95 border border-blue-200">
                    <IconCamera className="w-6 h-6" />
                </button>
                
                <button onClick={onViewGallery} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm active:scale-95 border ${item.photos.length > 0 ? 'bg-green-100 text-green-500 border-green-200' : 'bg-blue-100 text-blue-400 border-blue-200'}`}>
                    <IconGallery className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

// Simplified Clean Footer
const SummaryFooter = ({ data }: { data: DailyData }) => {
    return (
        <footer className="fixed bottom-0 left-0 w-full bg-blue-100/40 backdrop-blur-xl border-t border-white/30 py-3 z-40">
             <div className="flex justify-around items-center px-4">
                {CATEGORIES.map(cat => {
                    const count = (data[cat] || []).filter(isItemActive).length;
                    const label = cat === 'BOX SOUND' ? 'SOUND' : cat === 'CONTROLE REMOTO' ? 'CONTROLE' : cat;
                    return (
                        <div key={cat} className="flex flex-col items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-80">{label}</span>
                            <span className="text-2xl font-black text-slate-700 leading-none">{count}</span>
                        </div>
                    )
                })}
            </div>
        </footer>
    );
};

// ... (Rest of existing Modals: Calendar, Download, Share, etc. preserved) ...
const Modal = ({ title, onClose, children }: any) => (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in"><div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md border border-white/50 animate-slide-in-up"><div className="flex justify-between items-center p-4 border-b border-slate-200/50"><h3 className="text-lg font-bold text-slate-700">{title}</h3><button onClick={onClose}><IconX className="w-6 h-6 text-slate-400 hover:text-red-500" /></button></div><div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div></div></div>);
const CalendarModal = ({ currentDate, onClose, onDateSelect }: any) => { const [viewDate, setViewDate] = useState(currentDate); const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate(); const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); return (<Modal title="Selecionar Data" onClose={onClose}><div className="flex justify-between items-center mb-4"><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}><IconChevronLeft className="w-6 h-6 text-slate-600"/></button><span className="font-bold text-slate-700 capitalize">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span><button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}><IconChevronRight className="w-6 h-6 text-slate-600"/></button></div><div className="grid grid-cols-7 gap-1 text-center mb-2">{['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="text-xs font-bold text-slate-400">{d}</span>)}</div><div className="grid grid-cols-7 gap-1">{Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}{Array.from({ length: daysInMonth }).map((_, i) => { const d = i + 1; const isSelected = d === currentDate.getDate() && viewDate.getMonth() === currentDate.getMonth() && viewDate.getFullYear() === currentDate.getFullYear(); return <button key={d} onClick={() => onDateSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), d))} className={`p-2 rounded-lg text-sm font-medium transition-all ${isSelected ? 'bg-cyan-500 text-white shadow-md' : 'hover:bg-slate-100 text-slate-700'}`}>{d}</button>; })}</div><button onClick={() => onDateSelect(new Date())} className="w-full mt-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Ir para Hoje</button></Modal>); };
const DownloadModal = ({ appData, currentDate, onClose }: any) => { const [range, setRange] = useState<'day' | 'month'>('day'); const handleDownload = (format: 'word' | 'excel') => { const { data, label } = getDataInRange(appData, currentDate, range); let content = '', mimeType = '', extension = ''; if (format === 'word') { mimeType = 'application/msword'; extension = 'doc'; content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Relatório</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{border:1px solid #999;padding:8px;text-align:left;vertical-align:top}th{background-color:#eee}.category-title{background-color:#0ea5e9;color:white;padding:10px;margin-top:20px;font-size:18px}.photo-container{margin-top:5px}.item-photo{width:150px;height:auto;border:1px solid #ccc;margin-right:5px}</style></head><body><h1 style="text-align:center;color:#333">Relatório de Equipamentos</h1><h3 style="text-align:center;color:#666">${label}</h3>${CATEGORIES.map(cat => { const items = data[cat] || []; if (items.length === 0) return ''; return `<div class="category-title">${cat} (${items.length})</div><table><tr><th width="40%">Contrato</th><th width="60%">Serial</th></tr>${items.map((item: any) => { const photosHtml = item.photos && item.photos.length > 0 ? `<div class="photo-container"><br/><b>Fotos:</b><br/>${item.photos.map((p: string) => `<img src="${p}" class="item-photo" />`).join('')}</div>` : ''; return `<tr><td>${item.contract || '-'}</td><td>${item.serial || '-'}${photosHtml}</td></tr>`; }).join('')}</table>`; }).join('')}<br/><p>Gerado por Controle de Equipamentos</p></body></html>`; } else { mimeType = 'application/vnd.ms-excel'; extension = 'xls'; content = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body><table><thead><tr><th colspan="3" style="font-size:16px;font-weight:bold">Relatório - ${label}</th></tr><tr><th style="background-color:#ddd">Categoria</th><th style="background-color:#ddd">Contrato</th><th style="background-color:#ddd">Serial</th><th style="background-color:#ddd">Fotos (Qtd)</th></tr></thead><tbody>${CATEGORIES.flatMap(cat => (data[cat]||[]).map((item: any) => `<tr><td>${cat}</td><td style="mso-number-format:'\@'">${item.contract||''}</td><td style="mso-number-format:'\@'">${item.serial||''}</td><td>${item.photos?item.photos.length:0}</td></tr>`)).join('')}</tbody></table></body></html>`; } const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff', content], { type: mimeType })); link.download = `Equipamentos_${label.replace(/[^a-z0-9]/gi, '_')}.${extension}`; document.body.appendChild(link); link.click(); document.body.removeChild(link); }; return (<Modal title="Salvar Arquivo" onClose={onClose}><div className="space-y-4"><div className="flex bg-slate-100 p-1 rounded-lg"><button onClick={() => setRange('day')} className={`flex-1 py-1 rounded-md text-sm font-bold ${range === 'day' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Apenas Hoje</button><button onClick={() => setRange('month')} className={`flex-1 py-1 rounded-md text-sm font-bold ${range === 'month' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Mês até Hoje</button></div><p className="text-sm text-slate-500 text-center">Baixar relatório de: <b>{range === 'day' ? 'Hoje' : 'Todo o mês atual'}</b></p><div className="grid grid-cols-2 gap-3"><button onClick={() => handleDownload('word')} className="flex flex-col items-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 border border-blue-200"><IconFileWord className="w-8 h-8 text-blue-600 mb-2" /><span className="font-bold text-blue-700">Word (com Fotos)</span></button><button onClick={() => handleDownload('excel')} className="flex flex-col items-center p-4 bg-green-50 rounded-xl hover:bg-green-100 border border-green-200"><IconFileExcel className="w-8 h-8 text-green-600 mb-2" /><span className="font-bold text-green-700">Excel</span></button></div></div></Modal>); };
const ShareModal = ({ appData, currentDate, onClose, isSharingApp }: any) => { const [range, setRange] = useState<'day' | 'month'>('day'); const handleShare = (platform: 'whatsapp' | 'telegram' | 'email') => { let text = ''; if (isSharingApp) text = `Baixe o App Controle de Equipamentos aqui: ${window.location.href}`; else { const { data, label } = getDataInRange(appData, currentDate, range); let report = `*Relatório - ${label}*\n\n`; CATEGORIES.forEach(cat => { const items = data[cat] || []; if(items.length > 0) { report += `*${cat}* (${items.length})\n`; items.forEach((item: any) => { report += `- SN: ${item.serial} | CT: ${item.contract}\n`; }); report += '\n'; } }); text = report; } const encoded = encodeURIComponent(text); let url = ''; if (platform === 'whatsapp') url = `https://wa.me/?text=${encoded}`; else if (platform === 'telegram') url = `https://t.me/share/url?url=${window.location.href}&text=${encoded}`; else if (platform === 'email') url = `mailto:?subject=Relatório Equipamentos&body=${encoded}`; window.open(url, '_blank'); }; return (<Modal title={isSharingApp ? "Compartilhar App" : "Exportar Relatório"} onClose={onClose}>{!isSharingApp && (<div className="mb-6"><div className="flex bg-slate-100 p-1 rounded-lg mb-2"><button onClick={() => setRange('day')} className={`flex-1 py-1 rounded-md text-sm font-bold ${range === 'day' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Apenas Hoje</button><button onClick={() => setRange('month')} className={`flex-1 py-1 rounded-md text-sm font-bold ${range === 'month' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Mês até Hoje</button></div></div>)}<div className="grid grid-cols-3 gap-3"><button onClick={() => handleShare('whatsapp')} className="flex flex-col items-center p-3 bg-green-50 rounded-xl border border-green-100 hover:bg-green-100"><IconWhatsapp className="w-8 h-8 text-green-500 mb-1"/><span className="text-xs font-bold text-green-700">WhatsApp</span></button><button onClick={() => handleShare('telegram')} className="flex flex-col items-center p-3 bg-sky-50 rounded-xl border border-sky-100 hover:bg-sky-100"><IconTelegram className="w-8 h-8 text-sky-500 mb-1"/><span className="text-xs font-bold text-sky-700">Telegram</span></button><button onClick={() => handleShare('email')} className="flex flex-col items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100"><IconEmail className="w-8 h-8 text-slate-500 mb-1"/><span className="text-xs font-bold text-slate-700">E-mail</span></button></div></Modal>); };
const AboutModal = ({ onClose, onShareClick }: any) => (<Modal title="Sobre" onClose={onClose}><div className="text-center space-y-4"><CustomMenuIcon className="w-24 h-24 mx-auto drop-shadow-xl" /><div><h2 className="text-xl font-black text-slate-700">Controle de Equipamentos</h2><span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded text-xs font-bold">V0.0.1b</span></div><div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-xl"><p>Desenvolvido para gestão ágil de ativos.</p><p className="font-bold mt-2">Dono: Leo Luz</p></div><button onClick={onShareClick} className="w-full py-3 bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30 hover:bg-cyan-600 active:scale-95 flex items-center justify-center gap-2"><IconShare className="w-5 h-5" /> Compartilhar App</button></div></Modal>);
const SettingsModal = ({ settings, setSettings, onClose, onClearData }: any) => { const toggle = (k: any) => setSettings({...settings, [k]: !settings[k]}); const change = (e: any) => setSettings({...settings, [e.target.name]: e.target.value}); return (<Modal title="Configurações" onClose={onClose}><div className="space-y-4"><div><label className="text-xs font-bold text-slate-500">Nome</label><input name="userName" value={settings.userName} onChange={change} className="w-full p-3 bg-slate-100 rounded-xl border border-slate-200 outline-none" placeholder="Seu nome" /></div><div><label className="text-xs font-bold text-slate-500">CPF</label><input name="userCpf" value={settings.userCpf} onChange={change} className="w-full p-3 bg-slate-100 rounded-xl border border-slate-200 outline-none" placeholder="000.000.000-00" /></div><div className="flex justify-between items-center p-2"><span className="font-bold text-slate-600">Salvamento Auto</span><button onClick={() => toggle('autoSave')} className={`w-10 h-5 rounded-full p-0.5 ${settings.autoSave ? 'bg-cyan-500' : 'bg-slate-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.autoSave ? 'translate-x-5' : ''}`} /></button></div><div className="flex justify-between items-center p-2"><span className="font-bold text-slate-600">Modo Escuro</span><button onClick={() => toggle('darkMode')} className={`w-10 h-5 rounded-full p-0.5 ${settings.darkMode ? 'bg-cyan-500' : 'bg-slate-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.darkMode ? 'translate-x-5' : ''}`} /></button></div><div className="flex justify-between items-center p-2"><span className="font-bold text-slate-600">Notificações</span><button onClick={() => toggle('notifications')} className={`w-10 h-5 rounded-full p-0.5 ${settings.notifications ? 'bg-cyan-500' : 'bg-slate-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.notifications ? 'translate-x-5' : ''}`} /></button></div><button onClick={onClearData} className="w-full py-2 bg-red-50 text-red-500 font-bold rounded-lg border border-red-100 mt-4">Apagar Tudo</button></div></Modal>); };
const CameraModal = ({ onClose, onCapture }: any) => { const [mode, setMode] = useState<'select'|'photo'|'scan'>('select'); const videoRef = useRef<HTMLVideoElement>(null); const scannerRef = useRef<Html5QrcodeScanner>(null); useEffect(() => { if (mode==='scan') { const scanner = new Html5QrcodeScanner("reader", { fps:10, qrbox:250, supportedScanTypes:[Html5QrcodeScanType.SCAN_TYPE_CAMERA] }, false); scannerRef.current=scanner; scanner.render((decodedText) => { if(confirm(`Código: ${decodedText}`)) onCapture(null, decodedText); }, console.error); return () => scanner.clear().catch(console.error); } }, [mode]); useEffect(() => { if(mode==='photo') { navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}).then(s=>{if(videoRef.current){videoRef.current.srcObject=s;videoRef.current.play()}}).catch(console.error); return ()=>{if(videoRef.current?.srcObject)(videoRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop())} } }, [mode]); const takePhoto=()=>{if(videoRef.current){const c=document.createElement('canvas');c.width=videoRef.current.videoWidth;c.height=videoRef.current.videoHeight;c.getContext('2d')?.drawImage(videoRef.current,0,0);onCapture(c.toDataURL('image/jpeg'),null)}}; 
if(mode==='select') return (<div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center"><h3 className="font-bold text-slate-700 mb-6">Opções</h3><div className="space-y-4"><button onClick={()=>setMode('photo')} className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold flex justify-center gap-2"><IconCamera className="w-6 h-6"/> Foto</button><button onClick={()=>setMode('scan')} className="w-full py-4 bg-purple-500 text-white rounded-xl font-bold flex justify-center gap-2"><IconSearch className="w-6 h-6"/> Scan</button></div><button onClick={onClose} className="mt-6 text-slate-400 underline">Cancelar</button></div></div>); 
if(mode==='photo') return (<div className="fixed inset-0 z-[70] bg-black flex flex-col"><div className="flex justify-between p-4 text-white z-10 absolute w-full"><h3 className="font-bold">Foto</h3><button onClick={onClose}><IconX className="w-6 h-6"/></button></div><video ref={videoRef} className="w-full h-full object-cover" playsInline/><div className="absolute bottom-0 w-full p-6 flex justify-center"><button onClick={takePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 shadow-lg"/></div></div>); 
return (<div className="fixed inset-0 z-[70] bg-black flex flex-col"><div className="flex justify-between p-4 text-white z-10"><h3 className="font-bold">Scan</h3><button onClick={onClose}><IconX className="w-6 h-6"/></button></div><div className="flex-1 flex items-center justify-center"><div id="reader" className="w-full max-w-md"/></div></div>); };
const SearchModal = ({ onClose, appData, onSelect }: any) => { const [term, setTerm] = useState(''); const [results, setResults] = useState<any[]>([]); useEffect(() => { if (term.length<2) {setResults([]);return;} const res:any[]=[]; Object.entries(appData).forEach(([date,daily]:[string,any])=>{CATEGORIES.forEach(cat=>{(daily[cat]||[]).forEach((item:any)=>{if((item.serial?.includes(term)||item.contract?.includes(term))&&isItemActive(item))res.push({date,category:cat,item})})})}); setResults(res.sort((a,b)=>b.date.localeCompare(a.date))); }, [term,appData]); return (<Modal title="Buscar" onClose={onClose}><input autoFocus value={term} onChange={e=>setTerm(e.target.value)} placeholder="Serial ou Contrato..." className="w-full p-3 bg-slate-100 rounded-xl outline-none font-bold text-slate-700 mb-4"/><div className="space-y-2">{results.map((res,i)=>(<div key={i} onClick={()=>onSelect(res)} className="p-3 bg-white border rounded-xl shadow-sm cursor-pointer"><div className="flex justify-between text-xs text-slate-400 mb-1"><span>{res.date}</span><span className="uppercase text-cyan-600">{res.category}</span></div><div className="text-sm text-slate-700">{res.item.serial&&<div>SN: <span className="font-bold">{res.item.serial}</span></div>}{res.item.contract&&<div>CT: <span className="font-bold">{res.item.contract}</span></div>}</div></div>))}</div></Modal>); };
const ConfirmationModal = ({ message, onConfirm, onCancel }: any) => (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"><div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs w-full text-center"><IconTrash className="w-12 h-12 text-red-500 mx-auto mb-3"/><h3 className="text-lg font-bold text-slate-800 mb-6">{message}</h3><div className="flex gap-3"><button onClick={onCancel} className="flex-1 py-2 bg-slate-100 rounded-xl font-bold">Cancelar</button><button onClick={onConfirm} className="flex-1 py-2 bg-red-500 text-white rounded-xl font-bold">Confirmar</button></div></div></div>);
const PhotoGalleryModal = ({ item, onClose, onUpdatePhotos, setConfirmation }: any) => { const [viewPhoto, setViewPhoto] = useState<string | null>(null); const fileInputRef = useRef<HTMLInputElement>(null); const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const reader = new FileReader(); reader.onload = (ev) => { if (ev.target?.result) { onUpdatePhotos([...item.photos, ev.target.result as string]); } }; reader.readAsDataURL(e.target.files[0]); } }; const handleDeletePhoto = (photo: string) => { setConfirmation({ message: "Apagar foto?", onConfirm: () => { onUpdatePhotos(item.photos.filter((p: string) => p !== photo)); if (viewPhoto === photo) setViewPhoto(null); } }); }; return (<Modal title={`Galeria - ${item.serial || 'Item'}`} onClose={onClose}><div className="space-y-4"><div className="grid grid-cols-3 gap-2">{item.photos.map((photo: string, idx: number) => (<div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group"><img src={photo} alt={`Foto ${idx}`} className="w-full h-full object-cover cursor-pointer" onClick={() => setViewPhoto(photo)} /><button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><IconX className="w-4 h-4" /></button></div>))}<button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 transition-colors"><IconPlus className="w-8 h-8" /></button></div><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAddPhoto} />{viewPhoto && (<div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}><img src={viewPhoto} className="max-w-full max-h-full rounded-lg" /><button onClick={() => setViewPhoto(null)} className="absolute top-4 right-4 text-white"><IconX className="w-8 h-8" /></button></div>)}</div></Modal>); };
