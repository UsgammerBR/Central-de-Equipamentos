
import React, { Component, useState, useEffect, useReducer, useRef, useMemo } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileWord, IconFileExcel, IconWhatsapp, IconTelegram, IconEmail, IconSave
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
    return (item.qt && item.qt.trim() !== '') || (item.contract && item.contract.trim() !== '') || (item.serial && item.serial.trim() !== '') || item.photos.length > 0;
};

// --- ERROR BOUNDARY ---

interface ErrorBoundaryProps { children?: React.ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-center text-red-600"><h1>Erro inesperado</h1><button onClick={() => window.location.reload()}>Recarregar</button></div>;
    }
    return this.props.children;
  }
}

// --- MAIN APP ---

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
  
  const formattedDate = getFormattedDate(currentDate);

  const dispatchWithHistory = (action: Action) => {
    setHistory(prev => [appData, ...prev].slice(0, 10)); 
    dispatch(action);
  };

  useEffect(() => {
    const savedData = localStorage.getItem('equipmentData');
    if (savedData) dispatch({ type: 'SET_DATA', payload: JSON.parse(savedData) });
  }, []);

  useEffect(() => {
    if (!appData[formattedDate]) {
      dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } });
    }
  }, [appData, formattedDate]);

  useEffect(() => {
    if (!isRestoring) localStorage.setItem('equipmentData', JSON.stringify(appData));
  }, [appData, isRestoring]);

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
    // REVERTED: White/Milky Gloss Gradient
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-700 font-sans pb-32">
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={(m) => { setActiveModal(m); setIsMenuOpen(false); }}/>
      
      <header className="sticky top-0 z-30 bg-white/40 backdrop-blur-xl pt-4 pb-2 px-4 relative overflow-hidden shadow-sm border-b border-white/10">
        {/* Watermark: Restored to lighter gray/white look compatible with white theme */}
        <div className="absolute top-6 inset-x-0 flex items-center justify-center pointer-events-none z-0">
             <span className="text-3xl font-black text-slate-300 opacity-60 uppercase tracking-widest whitespace-nowrap transform scale-150 drop-shadow-sm blur-[0.5px]">EQUIPAMENTOS</span>
        </div>

        <div className="container mx-auto relative z-10">
            <div className="flex justify-between items-center mb-2">
                <button onClick={() => setIsMenuOpen(true)} className="active:scale-95 transition-transform drop-shadow-xl">
                    <CustomMenuIcon className="w-14 h-14" />
                </button>

                <div className="flex items-center gap-3">
                    {/* Reverted to larger, light buttons */}
                    <ActionButton onClick={handleAddItem}><IconPlus className="w-5 h-5" /></ActionButton>
                    <ActionButton onClick={handleToggleDeleteMode} isDanger={isGlobalDeleteMode}><IconMinus className="w-5 h-5" /></ActionButton>
                    {isGlobalDeleteMode && Object.values(selectedItems).reduce<number>((acc, items: string[]) => acc + items.length, 0) > 0 && (
                    <ActionButton onClick={handleConfirmGlobalDelete} isDanger={true}><IconTrash className="w-5 h-5" /></ActionButton>
                    )}
                    <ActionButton onClick={handleUndo}><IconUndo className="w-5 h-5" /></ActionButton>
                    <ActionButton onClick={() => setIsSearchActive(!isSearchActive)}><IconSearch className="w-5 h-5" /></ActionButton>
                </div>
            </div>

            <div className="text-center mt-2">
                <div className="inline-block px-6 py-1 rounded-full bg-white/20 border border-white/30 backdrop-blur-md shadow-sm">
                    <div className="text-lg font-extrabold text-slate-600 tracking-tight drop-shadow-sm">
                        {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                </div>
            </div>
        </div>
      </header>

      <main className="container mx-auto p-3 space-y-5">
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
            />
        ))}
      </main>

      <SummaryFooter data={currentDayData} allData={appData} currentDate={formattedDate} />
            
      {galleryItem && <PhotoGalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} onUpdatePhotos={(photos: string[]) => {
        const cat = Object.keys(currentDayData).find(k => currentDayData[k as EquipmentCategory].some(i => i.id === galleryItem.id)) as EquipmentCategory;
        if(cat) {
            const updated = { ...galleryItem, photos };
            handleUpdateItem(cat, updated);
            setGalleryItem(updated);
        }
      }} setConfirmation={setConfirmation} />}
      
      {cameraModalItem && <CameraModal onClose={() => setCameraModalItem(null)} onCapture={(photo: string, code: string) => {
           const cat = Object.keys(currentDayData).find(k => currentDayData[k as EquipmentCategory].some(i => i.id === cameraModalItem.id)) as EquipmentCategory;
           if (cat) {
               const updated = { ...cameraModalItem };
               if (photo) updated.photos = [...updated.photos, photo];
               if (code) updated.serial = code;
               handleUpdateItem(cat, updated);
           }
           setCameraModalItem(null);
      }} />}

      {activeModal === 'calendar' && <CalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={(d: Date) => { setCurrentDate(d); setActiveModal(null); }}/>}
      {activeModal === 'save' && <DownloadModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'export' && <ShareModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'settings' && <SettingsModal onClose={() => setActiveModal(null)} onClearData={() => setConfirmation({ message: "Apagar tudo permanentemente?", onConfirm: () => { dispatchWithHistory({ type: 'CLEAR_ALL_DATA' }); setActiveModal(null); } })}/>}
      {activeModal === 'about' && <AboutModal onClose={() => setActiveModal(null)} onShareClick={() => setActiveModal('shareApp')}/>}
      {activeModal === 'shareApp' && <ShareModal appData={appData} currentDate={currentDate} isSharingApp onClose={() => setActiveModal(null)} />}
      {isSearchActive && <SearchModal onClose={() => setIsSearchActive(false)} appData={appData} onSelect={(res: any) => { 
          const [y, m, d] = res.date.split('-'); 
          setCurrentDate(new Date(y, m-1, d)); 
          setIsSearchActive(false); 
      }} />}
      {confirmation && <ConfirmationModal message={confirmation.message} onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} onCancel={() => setConfirmation(null)} />}
    </div>
  );
};

const App = () => (<ErrorBoundary><AppContent /></ErrorBoundary>)
export default App;

// --- COMPONENTS ---

const ActionButton = ({ children, onClick, isPrimary, isDanger }: any) => (
    <button 
        onClick={onClick} 
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-md border border-white/20 ${
            isPrimary ? 'bg-cyan-500 text-white' : 
            isDanger ? 'bg-red-500/20 text-red-500' :
            'bg-white text-slate-600 hover:bg-slate-50' // Restored light style
        }`}
    >
        {children}
    </button>
);

const EquipmentSection = ({ category, items, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isActive, onActivate, onOpenCamera }: any) => (
    <div onClick={onActivate} className="group">
        {/* Dark Gray Text */}
        <h2 className={`text-lg font-bold text-slate-700 drop-shadow-sm uppercase tracking-widest mb-2 ml-2 transition-colors ${isActive ? 'text-cyan-600' : ''}`}>{category}</h2>
        <section className={`p-2 bg-white/40 backdrop-blur-lg border-t border-l border-white/60 border-b border-r border-white/20 rounded-xl shadow-lg transition-all duration-300 ${isActive ? 'ring-1 ring-cyan-200/60 scale-[1.01]' : ''}`}>
            <div className="space-y-2">
                {items.map((item: any) => (
                    <EquipmentRow 
                        key={item.id} item={item} onUpdate={onUpdateItem} isDeleteMode={isDeleteMode}
                        isSelected={selectedItems.includes(item.id)} onToggleSelect={() => onToggleSelect(item.id)} 
                        onViewGallery={() => onViewGallery(item)} onOpenCamera={() => onOpenCamera(item)}
                        onFocus={() => onActivate()}
                    />
                ))}
            </div>
        </section>
    </div>
);

const EquipmentRow = ({ item, onUpdate, isDeleteMode, isSelected, onToggleSelect, onViewGallery, onOpenCamera, onFocus }: any) => {
    const handleChange = (field: keyof EquipmentItem, value: string) => {
        onUpdate({ ...item, [field]: value });
    };

    return (
        <div className="flex items-center gap-0.5 p-0.5 bg-white/50 rounded-lg shadow-sm border border-white/40 backdrop-blur-sm">
            {isDeleteMode && (
                <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="w-5 h-5 accent-red-500 mr-1 ml-1" />
            )}
            
            <InputWithLabel 
                value={item.qt} 
                onChange={(e) => { if(e.target.value.length <= 2) handleChange('qt', e.target.value) }}
                placeholder="QT" 
                type="number" 
                containerClassName="w-9"
                onFocus={onFocus}
            />

            <InputWithLabel 
                value={item.contract} 
                onChange={(e) => { if(e.target.value.length <= 10) handleChange('contract', e.target.value) }}
                placeholder="Contrato" 
                containerClassName="flex-[2]"
                showClipboard
                onFocus={onFocus}
            />

            <InputWithLabel 
                value={item.serial} 
                onChange={(e) => { if(e.target.value.length <= 20) handleChange('serial', e.target.value) }}
                placeholder="Serial" 
                containerClassName="flex-[3]"
                showClipboard
                onFocus={onFocus}
            />

            <div className="flex gap-0.5 ml-0.5">
                <button onClick={onOpenCamera} className="p-1 rounded-md bg-blue-50 text-blue-600 shadow-sm hover:bg-blue-100 active:scale-95"><IconCamera className="w-4 h-4" /></button>
                <div className="relative">
                    <button onClick={onViewGallery} className={`p-1 rounded-md shadow-sm active:scale-95 ${item.photos.length > 0 ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
                        <IconGallery className="w-4 h-4" />
                    </button>
                    {item.photos.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center">{item.photos.length}</span>}
                </div>
            </div>
        </div>
    );
};

const InputWithLabel = ({ value, onChange, placeholder, type = "text", containerClassName, showClipboard, onFocus }: any) => (
    <div className={`relative h-8 bg-white/70 rounded-md shadow-inner border border-black/5 flex items-center ${containerClassName}`}>
        <input
            type={type}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            placeholder={placeholder}
            className="w-full h-full bg-transparent text-center text-[10px] font-medium text-slate-700 placeholder:text-slate-400 outline-none px-0"
        />
        {showClipboard && value && (
            <button 
                onClick={() => navigator.clipboard.writeText(value)} 
                className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
            >
                <IconClipboard className="w-3 h-3" />
            </button>
        )}
    </div>
);

const SummaryFooter = ({ data, allData, currentDate }: { data: DailyData, allData: AppData, currentDate: string }) => {
    const calculateTotal = (d: DailyData) => {
        if (!d) return 0;
        return Object.values(d).flat().filter(isItemActive).reduce((sum, item) => {
            const qty = parseInt(item.qt);
            return sum + (isNaN(qty) ? 1 : qty);
        }, 0);
    };

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
             
             if (allData[dateKey]) {
                 sum += calculateTotal(allData[dateKey]);
             }
        }
        return sum;
    }, [allData, currentDate]);

    return (
        <footer className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-white/50 p-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
             <div className="container mx-auto overflow-x-auto hide-scrollbar">
                <div className="flex gap-2 pb-1 min-w-max">
                    {CATEGORIES.map(cat => {
                        const count = (data[cat] || []).filter(isItemActive).reduce((acc, item) => acc + (parseInt(item.qt) || 1), 0);
                        return (
                            <div key={cat} className="flex flex-col items-center justify-center px-3 py-1 bg-white/50 rounded-lg border border-white shadow-sm min-w-[60px]">
                                <span className="text-[8px] font-bold text-slate-400 uppercase">{cat.replace('BOX SOUND', 'SOUND').substring(0, 8)}</span>
                                <span className="text-sm font-black text-slate-600">{count}</span>
                            </div>
                        )
                    })}
                     <div className="flex flex-col items-center justify-center px-4 py-1 bg-blue-500/10 rounded-lg border border-blue-200/50 shadow-sm min-w-[70px]">
                        <span className="text-[8px] font-bold text-blue-400 uppercase">TOTAL DIA</span>
                        <span className="text-lg font-black text-blue-600">{totalDay}</span>
                    </div>
                     <div className="flex flex-col items-center justify-center px-4 py-1 bg-purple-500/10 rounded-lg border border-purple-200/50 shadow-sm min-w-[70px]">
                        <span className="text-[8px] font-bold text-purple-400 uppercase">SOMA TOTAL</span>
                        <span className="text-lg font-black text-purple-600">{totalMonth}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

// --- MODALS (Milky Glass Theme) ---

const Modal = ({ title, onClose, children }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
        <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/50 animate-slide-in-up">
            <div className="flex justify-between items-center p-4 border-b border-slate-200/50">
                <h3 className="text-lg font-bold text-slate-700">{title}</h3>
                <button onClick={onClose}><IconX className="w-6 h-6 text-slate-400 hover:text-red-500" /></button>
            </div>
            <div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div>
        </div>
    </div>
);

const CalendarModal = ({ currentDate, onClose, onDateSelect }: any) => {
    const [viewDate, setViewDate] = useState(currentDate);
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    
    return (
        <Modal title="Selecionar Data" onClose={onClose}>
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}><IconChevronLeft className="w-6 h-6 text-slate-600"/></button>
                <span className="font-bold text-slate-700 capitalize">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}><IconChevronRight className="w-6 h-6 text-slate-600"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="text-xs font-bold text-slate-400">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = i + 1;
                    const isSelected = d === currentDate.getDate() && viewDate.getMonth() === currentDate.getMonth() && viewDate.getFullYear() === currentDate.getFullYear();
                    return (
                        <button 
                            key={d} 
                            onClick={() => onDateSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), d))}
                            className={`p-2 rounded-lg text-sm font-medium transition-all ${isSelected ? 'bg-cyan-500 text-white shadow-md' : 'hover:bg-slate-100 text-slate-700'}`}
                        >
                            {d}
                        </button>
                    );
                })}
            </div>
            <button onClick={() => onDateSelect(new Date())} className="w-full mt-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Ir para Hoje</button>
        </Modal>
    );
};

const DownloadModal = ({ appData, currentDate, onClose }: any) => {
    const [range, setRange] = useState<'day' | 'month'>('day');

    const handleDownload = (format: 'word' | 'excel') => {
        const { data, label } = getDataInRange(appData, currentDate, range);
        
        let content = '';
        let mimeType = '';
        let extension = '';

        if (format === 'word') {
            mimeType = 'application/msword';
            extension = 'doc';
            content = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>Relatório</title></head><body>
                <h1 style="text-align:center; color:#333;">Relatório de Equipamentos - ${label}</h1>
                ${CATEGORIES.map(cat => {
                    const items = data[cat] || [];
                    if (items.length === 0) return '';
                    return `
                        <h2 style="background:#eee; padding:5px; border-left: 5px solid #0ea5e9;">${cat}</h2>
                        <table border="1" style="width:100%; border-collapse:collapse;">
                            <tr style="background:#f9f9f9;"><th>QT</th><th>Contrato</th><th>Serial</th></tr>
                            ${items.map((item: any) => `<tr><td align="center">${item.qt}</td><td align="center">${item.contract}</td><td align="center">${item.serial}</td></tr>`).join('')}
                        </table>
                    `;
                }).join('')}
                <br/><p>Gerado por Controle de Equipamentos</p></body></html>
            `;
        } else {
            mimeType = 'application/vnd.ms-excel';
            extension = 'xls';
            content = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body>
                <table>
                    <thead><tr><th colspan="4" style="font-size:16px; font-weight:bold;">Relatório - ${label}</th></tr>
                    <tr><th>Categoria</th><th>QT</th><th>Contrato</th><th>Serial</th></tr></thead>
                    <tbody>
                    ${CATEGORIES.flatMap(cat => (data[cat]||[]).map((item: any) => 
                        `<tr><td>${cat}</td><td>${item.qt}</td><td>${item.contract}</td><td>${item.serial}</td></tr>`
                    )).join('')}
                    </tbody>
                </table></body></html>
            `;
        }

        const blob = new Blob(['\ufeff', content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Equipamentos_${label.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal title="Salvar Manualmente" onClose={onClose}>
            <div className="space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setRange('day')} className={`flex-1 py-1 rounded-md text-sm font-bold ${range === 'day' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Apenas Hoje</button>
                    <button onClick={() => setRange('month')} className={`flex-1 py-1 rounded-md text-sm font-bold ${range === 'month' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Mês até Hoje</button>
                </div>
                <p className="text-sm text-slate-500 text-center">Exportar dados de: <b>{range === 'day' ? 'Hoje' : 'Todo o mês atual'}</b></p>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleDownload('word')} className="flex flex-col items-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 border border-blue-200">
                        <IconFileWord className="w-8 h-8 text-blue-600 mb-2" />
                        <span className="font-bold text-blue-700">Word</span>
                    </button>
                    <button onClick={() => handleDownload('excel')} className="flex flex-col items-center p-4 bg-green-50 rounded-xl hover:bg-green-100 border border-green-200">
                        <IconFileExcel className="w-8 h-8 text-green-600 mb-2" />
                        <span className="font-bold text-green-700">Excel</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const ShareModal = ({ appData, currentDate, onClose, isSharingApp }: any) => {
    const [range, setRange] = useState<'day' | 'month'>('day');

    const handleShare = (platform: 'whatsapp' | 'telegram' | 'email') => {
        let text = '';
        
        if (isSharingApp) {
            text = `Baixe o App Controle de Equipamentos aqui: ${window.location.href}`;
        } else {
            const { data, label } = getDataInRange(appData, currentDate, range);
            let report = `*Relatório - ${label}*\n\n`;
            CATEGORIES.forEach(cat => {
                const items = data[cat] || [];
                if(items.length > 0) {
                    report += `*${cat}* (${items.length})\n`;
                    items.forEach((item: any) => {
                        report += `- QT: ${item.qt || 1} | SN: ${item.serial}\n`;
                    });
                    report += '\n';
                }
            });
            text = report;
        }

        const encoded = encodeURIComponent(text);
        let url = '';
        if (platform === 'whatsapp') url = `https://wa.me/?text=${encoded}`;
        else if (platform === 'telegram') url = `https://t.me/share/url?url=${window.location.href}&text=${encoded}`;
        else if (platform === 'email') url = `mailto:?subject=Relatório Equipamentos&body=${encoded}`;
        
        window.open(url, '_blank');
    };

    return (
        <Modal title={isSharingApp ? "Compartilhar App" : "Exportar Relatório"} onClose={onClose}>
            {!isSharingApp && (
                 <div className="mb-6">
                    <div className="flex bg-slate-100 p-1 rounded-lg mb-2">
                        <button onClick={() => setRange('day')} className={`flex-1 py-1 rounded-md text-sm font-bold ${range === 'day' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Apenas Hoje</button>
                        <button onClick={() => setRange('month')} className={`flex-1 py-1 rounded-md text-sm font-bold ${range === 'month' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Mês até Hoje</button>
                    </div>
                 </div>
            )}
            <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handleShare('whatsapp')} className="flex flex-col items-center p-3 bg-green-50 rounded-xl border border-green-100 hover:bg-green-100"><IconWhatsapp className="w-8 h-8 text-green-500 mb-1"/><span className="text-xs font-bold text-green-700">WhatsApp</span></button>
                <button onClick={() => handleShare('telegram')} className="flex flex-col items-center p-3 bg-sky-50 rounded-xl border border-sky-100 hover:bg-sky-100"><IconTelegram className="w-8 h-8 text-sky-500 mb-1"/><span className="text-xs font-bold text-sky-700">Telegram</span></button>
                <button onClick={() => handleShare('email')} className="flex flex-col items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100"><IconEmail className="w-8 h-8 text-slate-500 mb-1"/><span className="text-xs font-bold text-slate-700">E-mail</span></button>
            </div>
        </Modal>
    );
};

const AboutModal = ({ onClose, onShareClick }: any) => (
    <Modal title="Sobre" onClose={onClose}>
        <div className="text-center space-y-4">
            <CustomMenuIcon className="w-24 h-24 mx-auto drop-shadow-xl" />
            <div>
                <h2 className="text-xl font-black text-slate-700">Controle de Equipamentos</h2>
                <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded text-xs font-bold">V0.0.1b</span>
            </div>
            <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-xl">
                <p>Desenvolvido para gestão ágil de ativos.</p>
                <p className="font-bold mt-2">Dono: Leo Luz</p>
            </div>
            <button onClick={onShareClick} className="w-full py-3 bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30 hover:bg-cyan-600 active:scale-95 flex items-center justify-center gap-2">
                <IconShare className="w-5 h-5" /> Compartilhar App
            </button>
        </div>
    </Modal>
);

const SettingsModal = ({ onClose, onClearData }: any) => (
    <Modal title="Configurações" onClose={onClose}>
        <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <h4 className="font-bold text-red-600 mb-1">Zona de Perigo</h4>
                <p className="text-xs text-red-400 mb-3">Esta ação não pode ser desfeita.</p>
                <button onClick={onClearData} className="w-full py-2 bg-white border border-red-200 text-red-500 font-bold rounded-lg hover:bg-red-50">
                    Apagar Todos os Dados
                </button>
            </div>
        </div>
    </Modal>
);

const ConfirmationModal = ({ message, onConfirm, onCancel }: any) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-xs w-full text-center border border-white/50 animate-slide-in-up">
            <IconTrash className="w-12 h-12 text-red-500 mx-auto mb-3 bg-red-50 p-2 rounded-full" />
            <h3 className="text-lg font-bold text-slate-800 mb-6">{message}</h3>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl">Cancelar</button>
                <button onClick={onConfirm} className="flex-1 py-2 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/30">Confirmar</button>
            </div>
        </div>
    </div>
);

const PhotoGalleryModal = ({ item, onClose, onUpdatePhotos, setConfirmation }: any) => {
    const [viewPhoto, setViewPhoto] = useState<string | null>(null);
    
    const handleDelete = (index: number) => {
        setConfirmation({
            message: 'Apagar esta foto?',
            onConfirm: () => {
                const newPhotos = item.photos.filter((_: any, i: number) => i !== index);
                onUpdatePhotos(newPhotos);
                if (viewPhoto === item.photos[index]) setViewPhoto(null);
            }
        });
    };

    const handleSharePhoto = async (base64: string) => {
        try {
            const res = await fetch(base64);
            const blob = await res.blob();
            const file = new File([blob], "equipamento.jpg", { type: "image/jpeg" });
            if (navigator.share) {
                await navigator.share({ files: [file] });
            } else {
                alert("Compartilhamento não suportado neste navegador.");
            }
        } catch (e) { console.error(e); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col animate-fade-in">
            <div className="flex justify-between items-center p-4 text-white">
                <h3 className="font-bold">Galeria ({item.photos.length})</h3>
                <button onClick={onClose}><IconX className="w-8 h-8" /></button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                {viewPhoto ? (
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                         <img src={viewPhoto} className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
                         <div className="flex gap-4 mt-4">
                            <button onClick={() => handleSharePhoto(viewPhoto)} className="p-3 bg-blue-600 rounded-full text-white"><IconShare className="w-6 h-6"/></button>
                            <button onClick={() => handleDelete(item.photos.indexOf(viewPhoto))} className="p-3 bg-red-600 rounded-full text-white"><IconTrash className="w-6 h-6"/></button>
                         </div>
                         <button onClick={() => setViewPhoto(null)} className="mt-4 text-white underline">Voltar</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 w-full max-w-lg overflow-y-auto max-h-full content-start">
                        {item.photos.map((p: string, i: number) => (
                            <button key={i} onClick={() => setViewPhoto(p)} className="aspect-square relative group overflow-hidden rounded-lg border border-white/20">
                                <img src={p} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            </button>
                        ))}
                         {item.photos.length === 0 && <p className="col-span-3 text-center text-slate-500 mt-10">Nenhuma foto.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

const CameraModal = ({ onClose, onCapture }: any) => {
    const [isCameraReady, setIsCameraReady] = useState(false);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: 250, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
            false
        );
        scannerRef.current = scanner;

        scanner.render((decodedText) => {
            // Play beep
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.play().catch(() => {});
            
            if(confirm(`Código detectado: ${decodedText}\nUsar este código?`)) {
                 onCapture(null, decodedText);
            }
        }, (err) => { console.log(err); });

        setIsCameraReady(true);

        return () => {
            scanner.clear().catch(e => console.error(e));
        };
    }, []);

    const takePhoto = () => {
        const video = document.querySelector('#reader video') as HTMLVideoElement;
        if (video) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg');
            onCapture(base64, null);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
             <div className="flex justify-between p-4 text-white bg-black/50 backdrop-blur-md z-10">
                <h3 className="font-bold">Câmera / Scanner</h3>
                <button onClick={onClose}><IconX className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 relative bg-black flex items-center justify-center">
                <div id="reader" className="w-full max-w-md"></div>
                {!isCameraReady && <div className="text-white">Iniciando câmera...</div>}
            </div>
            <div className="p-6 bg-black/80 flex justify-center gap-8">
                <button onClick={takePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 active:scale-90 flex items-center justify-center shadow-lg">
                    <div className="w-12 h-12 bg-white rounded-full border-2 border-black" />
                </button>
            </div>
        </div>
    );
};

const SearchModal = ({ onClose, appData, onSelect }: any) => {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<any[]>([]);

    useEffect(() => {
        if (term.length < 2) { setResults([]); return; }
        const res: any[] = [];
        Object.entries(appData).forEach(([date, dailyData]: [string, any]) => {
            CATEGORIES.forEach(cat => {
                (dailyData[cat]||[]).forEach((item: any) => {
                    if ((item.serial?.includes(term) || item.contract?.includes(term)) && isItemActive(item)) {
                        res.push({ date, category: cat, item });
                    }
                })
            })
        });
        setResults(res.sort((a,b) => b.date.localeCompare(a.date)));
    }, [term, appData]);

    return (
        <Modal title="Buscar Item" onClose={onClose}>
            <input 
                autoFocus
                value={term}
                onChange={e => setTerm(e.target.value)}
                placeholder="Digite Serial ou Contrato..."
                className="w-full p-3 bg-slate-100 rounded-xl border border-slate-200 outline-none focus:ring-2 ring-cyan-400 font-bold text-slate-700 mb-4"
            />
            <div className="space-y-2">
                {results.map((res, i) => (
                    <div key={i} onClick={() => onSelect(res)} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:bg-blue-50 cursor-pointer">
                        <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                            <span>{res.date}</span>
                            <span className="uppercase text-cyan-600">{res.category}</span>
                        </div>
                        <div className="font-mono text-sm text-slate-700">
                            {res.item.serial && <div>SN: <span className="font-bold">{res.item.serial}</span></div>}
                            {res.item.contract && <div>CT: <span className="font-bold">{res.item.contract}</span></div>}
                        </div>
                    </div>
                ))}
                {term.length > 1 && results.length === 0 && <p className="text-center text-slate-400 mt-4">Nenhum resultado.</p>}
            </div>
        </Modal>
    );
};
