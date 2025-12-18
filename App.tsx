
import React, { useState, useEffect, useReducer, useCallback, useMemo, useRef, ReactNode, Component, ErrorInfo } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, ChristmasMenuIcon, LoadingBoxIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronRight,
    IconSave, IconChevronDown, IconBell, IconQrCode, IconBarcode, IconCameraLens, IconMapPin, IconDownload, IconSettings, IconExport, IconCalendar, IconHoliday
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem, AppNotification, UserProfile } from './types';
import { CATEGORIES, HOLIDAYS } from './constants';
import { Html5QrcodeScanner } from "html5-qrcode";
import { saveAppDataToDB, loadAppDataFromDB, saveUserProfileToDB, loadUserProfileFromDB, migrateLocalStorageToDB } from './db';

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
    data[category].push({ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() });
  });

  return data;
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
            return { ...state, [date]: dayData };
        }
        case 'ADD_ITEM': {
            const { date, category } = action.payload;
            const currentDay = state[date] || createEmptyDailyData();
            const currentCategoryItems = currentDay[category] || [];
            const newItem: EquipmentItem = { id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() };
            return { ...state, [date]: { ...currentDay, [category]: [...currentCategoryItems, newItem] } };
        }
        case 'UPDATE_ITEM': {
            const { date, category, item } = action.payload;
            const currentDay = state[date];
            if (!currentDay) return state;
            const currentCategoryItems = currentDay[category] || [];
            const itemIndex = currentCategoryItems.findIndex((i: EquipmentItem) => i.id === item.id);
            let newCategoryItems = [...currentCategoryItems];
            if (itemIndex > -1) newCategoryItems[itemIndex] = item;
            else newCategoryItems.push(item);
            return { ...state, [date]: { ...currentDay, [category]: newCategoryItems } };
        }
        case 'DELETE_ITEMS': {
            const { date, category, itemIds } = action.payload;
            const currentDay = state[date];
            if (!currentDay) return state;
            let newCategoryItems = (currentDay[category] || []).filter((item: EquipmentItem) => !itemIds.includes(item.id));
            if (newCategoryItems.length === 0) {
                 newCategoryItems = [{ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() }];
            }
            return { ...state, [date]: { ...currentDay, [category]: newCategoryItems } };
        }
        case 'CLEAR_ALL_DATA': return {};
        default: return state;
    }
}

const isItemActive = (item: EquipmentItem): boolean => {
    return (item.contract && item.contract.toString().trim() !== '') || (item.serial && item.serial.trim() !== '') || item.photos.length > 0;
};

// --- COMPONENTS ---

const ActionButton = ({ children, onClick, isPrimary, isDanger, disabled, theme }: any) => {
    const baseStyle = "w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm border";
    let colorStyle = "";
    if (disabled) colorStyle = "opacity-50 cursor-not-allowed bg-slate-200 border-transparent";
    else if (isPrimary) colorStyle = theme.isXmas ? "bg-red-600 text-white border-transparent" : "bg-cyan-600 text-white border-transparent"; 
    else if (isDanger) colorStyle = "bg-red-50 text-red-500 border-red-100";
    else colorStyle = theme.isXmas ? "bg-white text-red-700 border-red-100" : "bg-white text-cyan-700 border-cyan-100"; 

    return <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${colorStyle}`}>{children}</button>;
};

const ModalOverlay = ({ children, onClose }: { children?: React.ReactNode, onClose: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in relative" onClick={(e) => e.stopPropagation()}>
           <div className="p-6">{children}</div>
        </div>
    </div>
);

const AboutModal = ({ onClose }: { onClose: () => void }) => (
    <ModalOverlay onClose={onClose}>
        <div className="text-center">
            <CustomMenuIcon className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-1">Stream+ Control</h2>
            <p className="text-sm text-slate-500 mb-6">Versão 1.2.0</p>
            <div className="bg-slate-50 p-4 rounded-xl mb-6">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Proprietário</p>
                <p className="text-lg font-black text-cyan-700">Leo Luz</p>
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold">Fechar</button>
        </div>
    </ModalOverlay>
);

const FullCalendarModal = ({ currentDate, onClose, onDateSelect }: any) => {
    const [viewDate, setViewDate] = useState(new Date(currentDate));
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

    return (
        <ModalOverlay onClose={onClose}>
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2"><IconChevronRight className="w-5 h-5 rotate-180"/></button>
                <h3 className="font-bold text-lg">{monthNames[month]} {year}</h3>
                <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2"><IconChevronRight className="w-5 h-5"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["D", "S", "T", "Q", "Q", "S", "S"].map(d => <div key={d} className="text-[10px] font-bold text-slate-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                    if (!day) return <div key={idx} />;
                    const isSelected = getFormattedDate(day) === getFormattedDate(currentDate);
                    const isToday = getFormattedDate(day) === getFormattedDate(new Date());
                    return (
                        <button key={idx} onClick={() => onDateSelect(day)} className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${isSelected ? 'bg-cyan-600 text-white' : isToday ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'hover:bg-slate-50 text-slate-700'}`}>
                            {day.getDate()}
                        </button>
                    );
                })}
            </div>
            <div className="mt-6 flex gap-2">
                <button onClick={() => onDateSelect(new Date())} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-700">Hoje</button>
                <button onClick={onClose} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold">Fechar</button>
            </div>
        </ModalOverlay>
    );
};

const EquipmentSection = React.memo(({ category, allCategoryItems, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isHistoryVisible, onToggleHistory, onOpenCamera, isReadOnly, theme }: any) => {
    // Organizar por hora se estiver desagrupado (histórico visível)
    const sortedItems = useMemo(() => {
        if (!isHistoryVisible) return allCategoryItems.slice(-1);
        return [...allCategoryItems].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }, [allCategoryItems, isHistoryVisible]);

    return (
        <div className="relative mb-3">
             <div className={`w-full p-3 rounded-xl flex items-center justify-between shadow-md border ${isHistoryVisible ? `bg-gradient-to-br from-indigo-500 to-cyan-500 text-white` : 'bg-white text-slate-700'}`}>
                <button onClick={onToggleHistory} className="flex items-center gap-3 flex-1 text-left active:scale-95 transition-transform">
                    <span className="font-extrabold text-base uppercase tracking-tight">{category}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-green-100 text-green-800">{allCategoryItems.filter(isItemActive).length}</span>
                    <div className="ml-auto">{isHistoryVisible ? <IconChevronDown className="w-5 h-5 opacity-60"/> : <IconChevronRight className="w-5 h-5 opacity-60"/>}</div>
                </button>
            </div>
            <div className="mt-2 space-y-2">
                {sortedItems.map((item: EquipmentItem) => (
                    <div key={item.id} className={`p-2 bg-white/60 backdrop-blur-sm rounded-xl shadow flex items-center gap-2 border ${isDeleteMode ? 'pl-10' : ''}`}>
                        {isDeleteMode && <div className="absolute left-3"><input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => onToggleSelect(item.id)} className="w-5 h-5" /></div>}
                        
                        {isHistoryVisible && item.createdAt && (
                            <span className="text-[9px] font-bold text-slate-400 min-w-[35px] text-center">{new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        )}

                        <div className="flex-shrink-0 w-24">
                            <input 
                                type="text" 
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="CONT." 
                                value={item.contract} 
                                readOnly={isReadOnly} 
                                maxLength={10} 
                                onChange={(e) => { 
                                    const val = e.target.value.replace(/\D/g, ''); // Garante apenas números
                                    if(val.length <= 10) onUpdateItem({ ...item, contract: val }); 
                                }} 
                                onBlur={() => onUpdateItem(item, 'contract')} 
                                className="w-full bg-white rounded-lg py-2.5 text-center font-bold text-xs border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-cyan-500" 
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <input type="text" placeholder="SERIAL" value={item.serial} readOnly={isReadOnly} maxLength={20} onChange={(e) => { if(e.target.value.length <= 20) onUpdateItem({ ...item, serial: e.target.value }); }} onBlur={() => onUpdateItem(item, 'serial')} className="w-full bg-white rounded-lg py-2.5 text-center font-bold text-xs border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-cyan-500 uppercase" />
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <button onClick={() => onOpenCamera(item)} className="bg-slate-800 text-white p-2 rounded-lg w-8 h-8 flex items-center justify-center active:scale-90 -mt-1"><IconCamera className="w-4 h-4" /></button>
                            <button onClick={() => onViewGallery(item)} className={`p-2 rounded-lg w-8 h-8 flex items-center justify-center active:scale-90 ${item.photos.length > 0 ? 'bg-cyan-600 text-white' : 'bg-white text-slate-300 border border-slate-100'}`}><IconGallery className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

// --- MAIN APP CONTENT ---

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appData, dispatch] = useReducer(dataReducer, {});
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [galleryItem, setGalleryItem] = useState<EquipmentItem | null>(null);
  const [historyVisibleCategories, setHistoryVisibleCategories] = useState<EquipmentCategory[]>([]);
  const [cameraModalItem, setCameraModalItem] = useState<EquipmentItem | null>(null);
  const [isGlobalDeleteMode, setIsGlobalDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '' });
  const [duplicateAlert, setDuplicateAlert] = useState<{ value: string; field: string; onAccept: () => void; onReject: () => void } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const formattedDate = getFormattedDate(currentDate);
  const theme = { isXmas: currentDate.getMonth() === 11 && currentDate.getDate() >= 20 && currentDate.getDate() <= 24, bg: "from-slate-100 to-slate-200", text: "text-slate-900" };

  useEffect(() => {
      const initApp = async () => {
          try {
              await migrateLocalStorageToDB();
              const dbData = await loadAppDataFromDB();
              dispatch({ type: 'SET_DATA', payload: dbData });
              const dbProfile = await loadUserProfileFromDB();
              if (dbProfile) setUserProfile(dbProfile);
          } catch (e) { console.error(e); } finally { setTimeout(() => setIsLoading(false), 1200); }
      };
      initApp();
      if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('./sw.js').catch(err => console.error(err));
      }
  }, []);

  useEffect(() => {
    if (!appData[formattedDate]) dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } });
  }, [appData, formattedDate]);

  useEffect(() => {
      if (isLoading) return;
      const h = setTimeout(() => saveAppDataToDB(appData), 1000);
      return () => clearTimeout(h);
  }, [appData, isLoading]);

  const checkDuplicate = (value: string, field: 'contract' | 'serial', currentId: string) => {
      if (!value || value.length < 3) return false;
      let found = false;
      Object.entries(appData).forEach(([date, dayData]) => {
          CATEGORIES.forEach(cat => {
              dayData[cat].forEach(item => {
                  if (item.id !== currentId) {
                      if (field === 'contract' && item.contract.toString() === value) found = true;
                      if (field === 'serial' && item.serial.toUpperCase() === value.toUpperCase()) found = true;
                  }
              });
          });
      });
      return found;
  };

  const handleUpdateItem = useCallback((category: EquipmentCategory, item: EquipmentItem, checkField?: 'contract' | 'serial') => {
      if (checkField) {
          const val = checkField === 'contract' ? item.contract.toString() : item.serial;
          if (checkDuplicate(val, checkField, item.id)) {
              setDuplicateAlert({
                  value: val,
                  field: checkField === 'contract' ? 'CONTRATO' : 'SERIAL',
                  onAccept: () => { dispatch({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } }); setDuplicateAlert(null); },
                  onReject: () => { const cleared = { ...item, [checkField]: '' }; dispatch({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item: cleared } }); setDuplicateAlert(null); }
              });
              return;
          }
      }
      dispatch({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } });
  }, [formattedDate, appData]);

  if (isLoading) return <div className="fixed inset-0 bg-white flex items-center justify-center flex-col animate-fade-in"><LoadingBoxIcon className="w-48 h-48" /><p className="mt-4 text-cyan-600 font-bold tracking-widest text-xs animate-pulse uppercase">Iniciando App...</p></div>;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.bg} ${theme.text} font-sans pb-40`}>
       {isMenuOpen && <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={(m) => { setActiveModal(m); setIsMenuOpen(false); }} />}
      
      <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-xl pt-2 pb-4 px-4 shadow-sm border-b border-white/40">
        <div className="flex items-center justify-between w-full mb-3">
            <button onClick={() => setIsMenuOpen(true)} className="flex-shrink-0 active:scale-95 transition-transform">
                {userProfile.photo ? (
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-white">
                        <img src={userProfile.photo} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <CustomMenuIcon className="w-14 h-14" />
                )}
            </button>
            <div className="flex items-center gap-2">
                <ActionButton onClick={() => dispatch({ type: 'ADD_ITEM', payload: { date: formattedDate, category: CATEGORIES[0] } })} theme={theme} isPrimary><IconPlus className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={() => setIsGlobalDeleteMode(!isGlobalDeleteMode)} isDanger={isGlobalDeleteMode} theme={theme}><IconMinus className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={() => { setCurrentDate(new Date()); }} theme={theme}><IconUndo className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={() => setActiveModal('search')} theme={theme}><IconSearch className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={() => setActiveModal('notifications')} theme={theme}><IconBell className="w-4 h-4" /></ActionButton>
            </div>
        </div>
        <div className="text-center">
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight -mb-1">{userProfile.name || 'Stream+ Control'}</h1>
            <button onClick={() => setActiveModal('calendar')} className="text-[10px] font-bold text-cyan-700 bg-white/50 px-3 py-1 rounded-full border border-white/50 inline-flex items-center gap-1 mt-1">
                {currentDate.toLocaleDateString('pt-BR', {day: '2-digit', month: 'long', year: 'numeric'})} <IconChevronDown className="w-2.5 h-2.5"/>
            </button>
        </div>
      </header>

      <main className="container mx-auto p-4 max-w-lg">
        {CATEGORIES.map(cat => (
            <EquipmentSection 
                key={cat} category={cat} 
                allCategoryItems={appData[formattedDate]?.[cat] || []} 
                onUpdateItem={(i: any, f: any) => handleUpdateItem(cat, i, f)} 
                onViewGallery={(i: any) => setGalleryItem(i)} 
                isDeleteMode={isGlobalDeleteMode} selectedItems={selectedItems[cat] || []} 
                onToggleSelect={(id: string) => setSelectedItems(p => ({ ...p, [cat]: p[cat]?.includes(id) ? p[cat].filter(x => x !== id) : [...(p[cat]||[]), id] }))} 
                isHistoryVisible={historyVisibleCategories.includes(cat)} 
                onToggleHistory={() => setHistoryVisibleCategories(p => p.includes(cat) ? p.filter(c => c !== cat) : [...p, cat])} 
                onOpenCamera={(i: any) => setCameraModalItem(i)} 
                theme={theme} 
            />
        ))}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-2xl border-t border-slate-200 p-4 pb-10 shadow-lg text-center flex justify-around items-center">
          <div><p className="text-[10px] font-bold text-slate-400 uppercase">Hoje</p><p className="text-xl font-black text-cyan-600">{CATEGORIES.reduce((acc, cat) => acc + (appData[formattedDate]?.[cat]?.filter(isItemActive).length || 0), 0)}</p></div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div><p className="text-[10px] font-bold text-slate-400 uppercase">Geral</p><p className="text-xl font-black text-slate-800">{Object.values(appData).reduce((acc, day) => acc + CATEGORIES.reduce((cAcc, cat) => cAcc + (day[cat]?.filter(isItemActive).length || 0), 0), 0)}</p></div>
      </footer>

      {activeModal === 'calendar' && <FullCalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={(d: any) => { setCurrentDate(d); setActiveModal(null); }}/>}
      {activeModal === 'about' && <AboutModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'export' && (
        <ModalOverlay onClose={() => setActiveModal(null)}>
            <h2 className="text-xl font-bold mb-6">Backup de Dados</h2>
            <div className="space-y-4">
                <button onClick={() => {
                    const json = JSON.stringify(appData, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `backup_stream_${formattedDate}.json`;
                    a.click();
                }} className="w-full py-4 bg-cyan-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"><IconDownload className="w-5 h-5"/> Exportar Backup (.json)</button>
                <div className="relative">
                    <button className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center gap-2"><IconExport className="w-5 h-5"/> Carregar Backup</button>
                    <input type="file" accept=".json" onChange={(e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => { try { const d = JSON.parse(ev.target?.result as string); dispatch({ type: 'SET_DATA', payload: d }); alert('Backup carregado!'); setActiveModal(null); } catch(err) { alert('Erro no arquivo!'); } };
                        reader.readAsText(file);
                    }} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
            </div>
        </ModalOverlay>
      )}
      {duplicateAlert && (
          <ModalOverlay onClose={duplicateAlert.onReject}>
              <div className="text-center">
                  <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><IconBell className="w-8 h-8"/></div>
                  <h3 className="text-lg font-bold mb-2">Item Duplicado</h3>
                  <p className="text-xs text-slate-500 mb-6">O {duplicateAlert.field} <strong>{duplicateAlert.value}</strong> já existe no sistema.</p>
                  <div className="flex gap-3">
                      <button onClick={duplicateAlert.onReject} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg">Rejeitar</button>
                      <button onClick={duplicateAlert.onAccept} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg">Aceitar</button>
                  </div>
              </div>
          </ModalOverlay>
      )}
    </div>
  );
};

// ErrorBoundary implemented using imported Component class and explicit generics to fix property access requirements in strict TypeScript environments.
class ErrorBoundary extends Component<{ children?: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(_: Error): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Ops! Algo deu errado.</h1>
            <p className="text-slate-600 mb-6">Ocorreu um erro inesperado no aplicativo. Por favor, tente recarregar a página.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-cyan-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform"
            >
              Recarregar App
            </button>
          </div>
        </div>
      );
    }

    // Using explicit cast to any to bypass potential strict property existence checks on 'this' in specific environments.
    return (this.props as any).children || null;
  }
}

const App = () => (<ErrorBoundary><AppContent /></ErrorBoundary>);
export default App;
