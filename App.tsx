
import React, { Component, useState, useEffect, useReducer, useRef, useMemo, ReactNode } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, LoadingBoxIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileWord, IconFileExcel, IconWhatsapp, IconTelegram, IconEmail, IconSave, IconStack, IconChevronDown, IconBell, IconQrCode, IconBarcode, IconCameraLens, IconMapPin, IconDownload, IconSettings, IconExport, IconCalendar, IconInfo
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem, AppNotification, UserProfile } from './types';
import { CATEGORIES, HOLIDAYS_SP } from './constants';

// --- UTILITIES ---

const getFormattedDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const createEmptyDailyData = (): DailyData => {
  const data = {} as Partial<DailyData>;
  CATEGORIES.forEach(category => {
    data[category] = [{ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() }];
  });
  return data as DailyData;
};

// Christmas Theme Detection (Dec 20th - Dec 25th)
const isChristmasPeriod = (): boolean => {
  const now = new Date();
  const month = now.getMonth(); // 11 is December
  const day = now.getDate();
  return month === 11 && day >= 20 && day <= 25;
};

// --- REDUCER ---

type Action =
  | { type: 'SET_DATA'; payload: AppData }
  | { type: 'MERGE_DATA'; payload: AppData }
  | { type: 'ENSURE_DAY_DATA'; payload: { date: string; dayData: DailyData } }
  | { type: 'ADD_ITEM'; payload: { date: string; category: EquipmentCategory } }
  | { type: 'UPDATE_ITEM'; payload: { date: string; category: EquipmentCategory; item: EquipmentItem } }
  | { type: 'DELETE_ITEMS'; payload: { date: string; category: EquipmentCategory; itemIds: string[] } }
  | { type: 'DELETE_SINGLE_ITEM'; payload: { date: string; category: EquipmentCategory; itemId: string } }
  | { type: 'CLEAR_ALL_DATA' };

const dataReducer = (state: AppData, action: Action): AppData => {
    switch(action.type) {
        case 'SET_DATA': return action.payload;
        case 'MERGE_DATA': return { ...state, ...action.payload };
        case 'ENSURE_DAY_DATA': {
            const { date, dayData } = action.payload;
            if (state[date]) return state;
            return { ...state, [date]: dayData };
        }
        case 'ADD_ITEM': {
            const { date, category } = action.payload;
            const newState = JSON.parse(JSON.stringify(state));
            if (!newState[date]) newState[date] = createEmptyDailyData();
            newState[date][category].push({ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() });
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
                 newState[date][category].push({ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() });
            }
            return newState;
        }
        case 'DELETE_SINGLE_ITEM': {
             const { date, category, itemId } = action.payload;
             const newState = JSON.parse(JSON.stringify(state));
             const dayData = newState[date]?.[category];
             if (!dayData) return state;
             newState[date][category] = dayData.filter((item: EquipmentItem) => item.id !== itemId);
             if (newState[date][category].length === 0) {
                 newState[date][category].push({ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() });
             }
             return newState;
        }
        case 'CLEAR_ALL_DATA': return {} as AppData;
        default: return state;
    }
}

const isItemActive = (item: EquipmentItem): boolean => {
    return (item.contract && item.contract.trim() !== '') || (item.serial && item.serial.trim() !== '') || item.photos.length > 0;
};

// --- ERROR BOUNDARY ---

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

// Fixed class component definition to resolve state and props visibility errors by using named Component import and override state property
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-center text-red-600"><h1>Erro inesperado</h1><button onClick={() => window.location.reload()}>Recarregar</button></div>;
    }
    return this.props.children;
  }
}

const LoadingScreen = () => (
    <div className="fixed inset-0 z-[100] bg-slate-100 flex items-center justify-center flex-col animate-fade-in">
        <LoadingBoxIcon className="w-64 h-64 drop-shadow-2xl" />
        <p className="mt-4 text-cyan-600 font-bold animate-pulse tracking-widest text-xs uppercase">Iniciando Controle...</p>
    </div>
);

// --- MAIN APP ---

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appData, dispatch] = useReducer(dataReducer, {} as AppData);
  const [history, setHistory] = useState<AppData[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [galleryItem, setGalleryItem] = useState<EquipmentItem | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [historyVisibleCategories, setHistoryVisibleCategories] = useState<EquipmentCategory[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [cameraModalItem, setCameraModalItem] = useState<EquipmentItem | null>(null);
  const [isGlobalDeleteMode, setIsGlobalDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '', cpf: '', profileImage: '' });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [popupNotification, setPopupNotification] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [lastChangedCategory, setLastChangedCategory] = useState<string | null>(null);
  const [holidayTooltip, setHolidayTooltip] = useState<string | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const isChristmas = isChristmasPeriod();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const formattedDate = getFormattedDate(currentDate);

  useEffect(() => {
      const timer = setTimeout(() => setIsLoading(false), 2000);
      const savedData = localStorage.getItem('equipmentData');
      if (savedData) dispatch({ type: 'SET_DATA', payload: JSON.parse(savedData) });
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) setUserProfile(JSON.parse(savedProfile));
      
      window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          setInstallPrompt(e);
      });
      return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!appData[formattedDate] && !isLoading) {
      dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } });
    }
  }, [appData, formattedDate, isLoading]);

  useEffect(() => {
    if (!isRestoring && !isReadOnly && !isLoading) localStorage.setItem('equipmentData', JSON.stringify(appData));
  }, [appData, isRestoring, isReadOnly, isLoading]);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const addNotification = (type: any, message: string) => {
    const newNotif: AppNotification = { id: generateId(), type, message, timestamp: Date.now(), read: false };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const currentDayData: DailyData = useMemo(() => {
    const day = appData[formattedDate];
    if (day && CATEGORIES.every(cat => Array.isArray(day[cat]))) {
        return day as DailyData;
    }
    return createEmptyDailyData();
  }, [appData, formattedDate]);

  const handleUpdateItem = (category: EquipmentCategory, item: EquipmentItem) => {
      if (isReadOnly) { setShowAccessDenied(true); return; }
      setLastChangedCategory(category);
      dispatch({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } });
      setTimeout(() => setLastChangedCategory(null), 1000);
  };

  const saveProfile = (profile: UserProfile) => {
      setUserProfile(profile);
      localStorage.setItem('userProfile', JSON.stringify(profile));
  };

  const getTodayHoliday = () => {
      const key = `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      return HOLIDAYS_SP[key];
  };

  const todayHoliday = getTodayHoliday();

  if (isLoading) return <LoadingScreen />;

  // Dynamic Theme Colors
  const themeClass = isChristmas 
    ? 'bg-red-900/5 text-white ChristmasMode' 
    : isDarkMode 
      ? 'bg-slate-900 text-slate-100' 
      : 'bg-slate-100 text-slate-800';

  const headerTheme = isChristmas 
    ? 'bg-red-800/80 border-gold-400/20' 
    : isDarkMode 
      ? 'bg-slate-900/80 border-white/5' 
      : 'bg-white/70 border-white/40';

  const accentColor = isChristmas ? 'text-amber-400' : 'text-cyan-600';

  return (
    <div className={`min-h-screen ${themeClass} font-sans pb-32 select-none overflow-x-hidden transition-all duration-500`}>
       <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={setActiveModal} userProfile={userProfile} />
      
      <header className={`sticky top-0 z-30 ${headerTheme} backdrop-blur-xl py-4 px-4 shadow-sm border-b flex flex-col gap-2 transition-all`}>
        <div className="flex items-center justify-between w-full">
            <div className="flex-shrink-0 z-20">
                <div className="active:scale-95 transition-all cursor-pointer drop-shadow-lg" onClick={() => setIsMenuOpen(true)}>
                     {userProfile.profileImage ? (
                         <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-2xl transition-all hover:scale-110">
                             <img src={userProfile.profileImage} className="w-full h-full object-cover" />
                         </div>
                     ) : <CustomMenuIcon className="w-24 h-24" />}
                </div>
            </div>

            <div className="flex items-center gap-3 z-20">
                <ActionButton isDark={isDarkMode} isChristmas={isChristmas} onClick={() => { if(isReadOnly) setShowAccessDenied(true); else CATEGORIES.forEach(cat => dispatch({ type: 'ADD_ITEM', payload: { date: formattedDate, category: cat } })); }}><IconPlus className="w-6 h-6" /></ActionButton>
                <ActionButton isDark={isDarkMode} isChristmas={isChristmas} onClick={() => setIsGlobalDeleteMode(!isGlobalDeleteMode)} isDanger={isGlobalDeleteMode}><IconMinus className="w-6 h-6" /></ActionButton>
                <ActionButton isDark={isDarkMode} isChristmas={isChristmas} onClick={() => { if(isReadOnly) setShowAccessDenied(true); else if(history.length > 0) dispatch({ type: 'SET_DATA', payload: history[0] }); }}><IconUndo className="w-6 h-6" /></ActionButton>
                <ActionButton isDark={isDarkMode} isChristmas={isChristmas} onClick={() => setIsSearchActive(true)}><IconSearch className="w-6 h-6" /></ActionButton>
                <div className="relative"><ActionButton isDark={isDarkMode} isChristmas={isChristmas} onClick={() => setActiveModal('notifications')}><IconBell className="w-6 h-6" /></ActionButton></div>
            </div>
        </div>

        <div className="flex flex-col items-center justify-center w-full animate-fade-in pb-1 relative">
            <div className="flex items-center gap-2">
                <button onClick={() => setActiveModal('calendar')} className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full ${isChristmas ? 'bg-white/20 border-white/30' : isDarkMode ? 'bg-white/10 border-white/5' : 'bg-white/70 border-white/50'} backdrop-blur-md shadow-sm active:scale-95 transition-all hover:scale-105`}>
                    <span className={`text-base font-extrabold ${isChristmas ? 'text-white' : isDarkMode ? 'text-cyan-400' : 'text-cyan-800'}`}>
                        {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <IconChevronDown className={`w-4 h-4 ${isChristmas ? 'text-white' : 'text-cyan-600'}`}/>
                </button>
                {(todayHoliday || isChristmas) && (
                    <button onClick={() => setHolidayTooltip(isChristmas ? "Período de Natal" : todayHoliday!.name)} className={`w-12 h-12 flex items-center justify-center ${isChristmas ? 'bg-white/20' : isDarkMode ? 'bg-white/10' : 'bg-white/80'} rounded-full text-2xl shadow-xl animate-bounce hover:scale-110 transition-all`}>
                        {isChristmas ? '🎅' : todayHoliday!.icon}
                    </button>
                )}
            </div>
            {holidayTooltip && (
                <div className={`absolute top-14 ${isChristmas ? 'bg-red-800' : 'bg-slate-900/95'} text-white p-5 rounded-3xl text-xs z-50 shadow-2xl animate-pop-in border border-white/10 backdrop-blur-md`} onClick={() => setHolidayTooltip(null)}>
                    <div className="flex items-center gap-4 mb-2">
                        <span className="text-3xl">{isChristmas ? '🎄' : todayHoliday?.icon}</span>
                        <div className="font-black text-base tracking-tighter uppercase">{holidayTooltip}</div>
                    </div>
                    <div className="opacity-50 text-[10px] font-bold uppercase tracking-[3px] text-center">Toque para fechar</div>
                </div>
            )}
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-4 mt-2">
        {CATEGORIES.map(category => (
            <EquipmentSection 
                key={`${formattedDate}-${category}`} 
                category={category} 
                allCategoryItems={currentDayData[category] || []}
                onUpdateItem={(item: EquipmentItem) => handleUpdateItem(category, item)}
                onViewGallery={setGalleryItem}
                isDeleteMode={isGlobalDeleteMode}
                selectedItems={selectedItems[category] || []}
                onToggleSelect={(id: string) => setSelectedItems(prev => ({ ...prev, [category]: prev[category]?.includes(id) ? prev[category].filter(i => i !== id) : [...(prev[category]||[]), id] }))}
                isHistoryVisible={historyVisibleCategories.includes(category)}
                onToggleHistory={() => setHistoryVisibleCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category])}
                onOpenCamera={(item: EquipmentItem) => { if(isReadOnly) setShowAccessDenied(true); else setCameraModalItem(item); }}
                isReadOnly={isReadOnly}
                isPulsing={lastChangedCategory === category}
                isDark={isDarkMode}
                isChristmas={isChristmas}
            />
        ))}
      </main>

      <SummaryFooter data={currentDayData} allData={appData} currentDate={formattedDate} isDark={isDarkMode} isChristmas={isChristmas} />
            
      {galleryItem && <PhotoGalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} />}
      
      {activeModal === 'calendar' && <CalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={(d: Date) => { setCurrentDate(d); setActiveModal(null); }} isDark={isDarkMode} isChristmas={isChristmas}/>}
      
      {activeModal === 'settings' && (
          <ModalOverlay onClose={() => setActiveModal(null)} isDark={isDarkMode} isChristmas={isChristmas}>
              <h2 className={`text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter ${isChristmas ? 'text-white' : 'text-cyan-500'}`}><IconSettings className="w-6 h-6"/> Configurações</h2>
              <div className="space-y-6">
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                      <input type="text" value={userProfile.name} onChange={(e) => setUserProfile({...userProfile, name: e.target.value})} placeholder="Seu Nome" className={`w-full ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'} rounded-2xl p-4 outline-none border focus:border-cyan-500 transition-colors font-bold`}/>
                  </div>
                  
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Perfil e Mídia</label>
                      <div className="flex gap-2">
                        <button onClick={() => setCameraModalItem({ id: 'PROFILE', photos: [], contract: '', serial: '' })} className={`flex-1 aspect-square ${isChristmas ? 'bg-green-700' : isDarkMode ? 'bg-slate-700' : 'bg-slate-800'} text-white rounded-2xl font-black text-[9px] uppercase tracking-widest flex flex-col items-center justify-center gap-2 active:scale-95 shadow-xl transition-all`}>
                            <IconCamera className="w-8 h-8"/> <span>Foto</span>
                        </button>
                        <button onClick={() => profileFileInputRef.current?.click()} className={`flex-1 aspect-square ${isChristmas ? 'bg-white border-gold-400/30' : isDarkMode ? 'bg-slate-800 border-white/5' : 'bg-white border-slate-100'} border-4 rounded-2xl font-black text-[9px] uppercase tracking-widest flex flex-col items-center justify-center gap-2 active:scale-95 shadow-lg transition-all`}>
                            <IconGallery className={`w-8 h-8 ${isChristmas ? 'text-red-600' : 'text-cyan-600'}`}/> <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>Galeria</span>
                        </button>
                      </div>
                      <input type="file" ref={profileFileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if(file) {
                              const r = new FileReader();
                              r.onload = (ev) => setUserProfile({...userProfile, profileImage: ev.target?.result as string});
                              r.readAsDataURL(file);
                          }
                      }} />
                  </div>

                  <div className="pt-1">
                    <button onClick={() => setConfirmation({ message: "Restaurar ícone padrão?", onConfirm: () => { setUserProfile({...userProfile, profileImage: undefined}); addNotification('info', 'Ícone restaurado.'); } })} className={`w-full py-3.5 ${isDarkMode ? 'bg-red-900/10 text-red-400' : 'bg-red-50 text-red-500'} rounded-2xl font-black text-[9px] uppercase tracking-[4px] border border-red-500/10 active:scale-95 transition-all shadow-sm`}>
                        Restaurar Ícone Padrão
                    </button>
                  </div>

                  <div className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}></div>

                  {/* CUSTOM THEME SWITCH */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Alterar Tema</label>
                    <div className={`w-full p-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} rounded-[2rem] flex items-center justify-between shadow-inner`}>
                        <button onClick={() => setIsDarkMode(false)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] transition-all duration-300 ${!isDarkMode ? 'bg-white shadow-xl scale-[1.05] text-amber-500' : 'text-slate-500 opacity-40'}`}>
                            <div className={`w-2 h-2 rounded-full ${!isDarkMode ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]' : 'bg-slate-600'}`}></div>
                            <span className="text-[11px] font-black uppercase tracking-widest">Dia</span>
                            <span>☀️</span>
                        </button>
                        <button onClick={() => setIsDarkMode(true)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.5rem] transition-all duration-300 ${isDarkMode ? 'bg-slate-900 shadow-xl scale-[1.05] text-indigo-400' : 'text-slate-500 opacity-40'}`}>
                            <span>🌙</span>
                            <span className="text-[11px] font-black uppercase tracking-widest">Noite</span>
                            <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-indigo-400 animate-pulse shadow-[0_0_8px_#818cf8]' : 'bg-slate-600'}`}></div>
                        </button>
                    </div>
                  </div>

                  <button onClick={() => { saveProfile(userProfile); setActiveModal(null); addNotification('success', 'Perfil salvo!'); }} className={`w-full py-5 ${isChristmas ? 'bg-green-600' : 'bg-emerald-500'} text-white rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all mt-2 uppercase tracking-[5px] text-xs`}>Salvar Tudo</button>
              </div>
          </ModalOverlay>
      )}
      
      {activeModal === 'about' && (
        <ModalOverlay onClose={() => setActiveModal(null)} isDark={isDarkMode} isChristmas={isChristmas}>
            <div className="text-center flex flex-col items-center">
                <div className="mb-4 transform transition-transform hover:scale-110">
                    {userProfile.profileImage ? (
                        <img src={userProfile.profileImage} className="w-32 h-32 rounded-full border-4 border-white shadow-2xl object-cover" />
                    ) : <CustomMenuIcon className="w-32 h-32 drop-shadow-2xl" />}
                </div>
                
                <div className="mb-8">
                    <p className={`font-black text-2xl uppercase tracking-tighter ${isChristmas ? 'text-amber-400' : isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Dono: Leo Luz</p>
                    {userProfile.name && <p className="text-[10px] text-slate-500 uppercase font-black tracking-[4px] mt-1">{userProfile.name}</p>}
                </div>

                <div className="w-full space-y-4 mb-10">
                    <button onClick={() => setActiveModal('shareApp')} className={`w-full p-5 ${isChristmas ? 'bg-red-700' : isDarkMode ? 'bg-slate-800' : 'bg-slate-900'} text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[4px] flex items-center justify-center gap-3 active:scale-95 shadow-2xl transition-all`}>
                        <IconShare className="w-6 h-6 text-cyan-400"/> Compartilhar App
                    </button>
                    <button onClick={() => setActiveModal('export')} className={`w-full p-5 ${isDarkMode ? 'bg-slate-700/50 text-slate-100' : 'bg-white border-2 border-slate-100 text-slate-700'} rounded-[2rem] font-black text-[11px] uppercase tracking-[4px] flex items-center justify-center gap-3 active:scale-95 shadow-sm transition-all`}>
                        <IconStack className="w-6 h-6 text-cyan-600"/> Compartilhar Dados
                    </button>
                </div>

                <div className="py-2 mb-6">
                    <h2 className={`text-3xl font-black tracking-tighter ${isChristmas ? 'text-amber-400' : isDarkMode ? 'text-cyan-500' : 'text-slate-900'}`}>Controle</h2>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-[8px] font-black">V 1.0.1</p>
                </div>

                <div className="mt-4 mb-8">
                    <p className="text-[10px] text-slate-400 uppercase tracking-[6px] font-black leading-relaxed opacity-50">
                        Desenvolvido para<br/>controle de equipamentos
                    </p>
                </div>

                <button onClick={() => setActiveModal(null)} className={`w-full py-5 rounded-[2rem] ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'} font-black active:scale-95 transition-all text-xs uppercase tracking-widest`}>Fechar</button>
            </div>
        </Overlay>
      )}

      {/* SHARE OPTIONS MODAL */}
      {(activeModal === 'shareApp' || activeModal === 'shareData') && (
          <ModalOverlay onClose={() => setActiveModal('about')} isDark={isDarkMode} isChristmas={isChristmas}>
              <h3 className="text-center font-black uppercase text-xs tracking-[5px] mb-8 text-slate-400">Enviar via</h3>
              <div className="grid grid-cols-1 gap-4">
                  <a href={`https://wa.me/?text=Confira o App Controle de Equipamentos!`} target="_blank" className={`flex items-center gap-5 p-5 ${isDarkMode ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'} rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-100'} shadow-lg`}>
                      <IconWhatsapp className="w-8 h-8"/> WhatsApp
                  </a>
                  <a href={`https://t.me/share/url?url=${window.location.href}&text=App Controle`} target="_blank" className={`flex items-center gap-5 p-5 ${isDarkMode ? 'bg-sky-900/20 text-sky-400' : 'bg-sky-50 text-sky-700'} rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all border ${isDarkMode ? 'border-sky-800/30' : 'border-sky-100'} shadow-lg`}>
                      <IconTelegram className="w-8 h-8"/> Telegram
                  </a>
                  <a href={`mailto:?subject=App Controle&body=Link: ${window.location.href}`} className={`flex items-center gap-5 p-5 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'} rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all border border-transparent shadow-lg`}>
                      <IconEmail className="w-8 h-8"/> Email
                  </a>
              </div>
              <button onClick={() => setActiveModal('about')} className="w-full mt-8 py-3 text-slate-500 font-black uppercase text-[10px] tracking-[5px]">Voltar</button>
          </ModalOverlay>
      )}

      {cameraModalItem && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6">
              <button onClick={() => setCameraModalItem(null)} className="absolute top-4 right-4 text-white p-3"><IconX className="w-10 h-10"/></button>
              <div className="text-white text-2xl font-black mb-12 tracking-[15px] uppercase">CÂMERA</div>
              <div className="w-full aspect-square max-w-sm rounded-[3rem] border-8 border-dashed border-white/10 flex items-center justify-center mb-16 overflow-hidden bg-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                  <IconCameraLens className="w-24 h-24 text-white/5" />
              </div>
              <button onClick={() => {
                  const fakeImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
                  if(cameraModalItem.id === 'PROFILE') saveProfile({...userProfile, profileImage: fakeImg});
                  else handleUpdateItem(Object.keys(currentDayData).find(k => currentDayData[k as any]?.some((i: any) => i.id === cameraModalItem.id)) as any, { ...cameraModalItem, photos: [...cameraModalItem.photos, fakeImg] });
                  setCameraModalItem(null);
              }} className="w-24 h-24 bg-white rounded-full border-[10px] border-slate-300 shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-90 transition-transform"></button>
          </div>
      )}

      {confirmation && <ConfirmationModal message={confirmation.message} onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} onCancel={() => setConfirmation(null)} isDark={isDarkMode} isChristmas={isChristmas} />}
    </div>
  );
};

// --- COMPONENTES AUXILIARES ---

const ActionButton = ({ children, onClick, isDanger, disabled, isDark, isChristmas }: any) => (
    <button onClick={onClick} disabled={disabled} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-xl border ${isDanger ? 'bg-red-500 text-white border-red-400' : isChristmas ? 'bg-green-700 text-white border-white/20' : isDark ? 'bg-slate-800 text-cyan-400 border-white/5' : 'bg-white text-cyan-700 border-cyan-100 hover:scale-110'}`}>{children}</button>
);

const EquipmentSection = ({ category, allCategoryItems, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isHistoryVisible, onToggleHistory, onOpenCamera, isReadOnly, isPulsing, isDark, isChristmas }: any) => {
    const itemsToDisplay = isHistoryVisible ? allCategoryItems : allCategoryItems.slice(-1);
    const activeCount = allCategoryItems.filter(isItemActive).length;
    
    const headerBg = isHistoryVisible 
      ? isChristmas ? 'bg-red-700 shadow-red-900/40' : 'bg-indigo-600 shadow-indigo-900/30' 
      : isChristmas ? 'bg-white/10 border-white/20' : isDark ? 'bg-slate-800 border-white/5' : 'bg-white border-white/40';

    return (
        <div className="relative group">
             <div onClick={onToggleHistory} className={`w-full p-5 rounded-[1.8rem] flex items-center justify-between transition-all duration-500 shadow-lg border ${headerBg} ${isHistoryVisible ? 'text-white scale-[1.02]' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <div className="flex items-center gap-4">
                    <span className="font-black text-[11px] uppercase tracking-[3px]">{category}</span>
                    <span className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all ${isPulsing ? 'bg-emerald-500 text-white animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.6)]' : isChristmas ? 'bg-amber-400 text-red-900' : isDark ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-800'}`}>
                        {activeCount}
                    </span>
                </div>
                {isHistoryVisible ? <IconChevronDown className="w-5 h-5 opacity-60"/> : <IconChevronRight className="w-5 h-5 opacity-40 group-hover:translate-x-1 transition-transform"/>}
            </div>
            <div className="mt-3 grid gap-3 animate-slide-in-up">
                {itemsToDisplay.map((item: EquipmentItem) => (
                    <div key={item.id} className={`relative p-3 ${isChristmas ? 'bg-white/10 border-white/20' : isDark ? 'bg-slate-800/40 border-white/5' : 'bg-white/50 border-white/40'} backdrop-blur-md rounded-[1.8rem] shadow-sm flex items-center border ${isDeleteMode ? 'pl-12' : ''} transition-all`}>
                        {isDeleteMode && <div className="absolute left-4"><input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => onToggleSelect(item.id)} className="w-6 h-6 rounded-lg text-cyan-600" /></div>}
                        <div className="flex items-center gap-2 w-full">
                            <input type="number" placeholder="CONTRATO" value={item.contract} readOnly={isReadOnly} onChange={(e) => onUpdateItem({ ...item, contract: e.target.value })} className={`w-24 ${isDark || isChristmas ? 'bg-black/20 text-white' : 'bg-white/80 text-slate-800'} rounded-xl py-3 text-[11px] font-black border-none outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all shadow-inner`} />
                            <input type="text" placeholder="SERIAL" value={item.serial} readOnly={isReadOnly} onChange={(e) => onUpdateItem({ ...item, serial: e.target.value })} className={`flex-1 ${isDark || isChristmas ? 'bg-black/20 text-white' : 'bg-white/80 text-slate-800'} rounded-xl py-3 text-[11px] font-black border-none outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all shadow-inner`} />
                            <div className="flex gap-2">
                                <button onClick={() => onOpenCamera(item)} className={`aspect-square w-11 h-11 flex items-center justify-center rounded-xl active:scale-95 transition-all shadow-md ${isChristmas ? 'bg-amber-400 text-red-900' : isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-cyan-600 border border-slate-100'}`}>
                                    <IconCameraLens className="w-5 h-5" />
                                </button>
                                <button onClick={() => onViewGallery(item)} className={`aspect-square w-11 h-11 flex items-center justify-center rounded-xl active:scale-95 transition-all shadow-md ${item.photos.length > 0 ? (isChristmas ? 'bg-green-600 shadow-green-900/30' : 'bg-indigo-600 shadow-indigo-900/30') + ' text-white scale-110' : isDark || isChristmas ? 'bg-black/20 text-white/20' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                                    <IconGallery className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SummaryFooter = ({ data, allData, currentDate, isDark, isChristmas }: any) => {
    const categoryCounts: Record<string, number> = {};
    CATEGORIES.forEach(cat => { categoryCounts[cat] = (data[cat] || []).filter(isItemActive).length; });
    const totalToday = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    const [year, month] = currentDate.split('-');
    const monthlyTotal = Object.entries(allData).reduce((sum: number, [date, dayData]: [string, any]) => {
        if (dayData && date && date.startsWith(`${year}-${month}`)) {
            return sum + Object.values(dayData).flat().filter((i: any) => isItemActive(i)).length;
        }
        return sum;
    }, 0);
    
    const footerBg = isChristmas ? 'bg-red-900/90 border-white/10' : isDark ? 'bg-slate-900/90 border-white/5' : 'bg-white/90 border-white/40';

    return (
        <footer className={`fixed bottom-0 left-0 right-0 ${footerBg} backdrop-blur-2xl border-t shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 pb-safe px-6 py-5 flex gap-8 overflow-x-auto hide-scrollbar transition-all duration-500`}>
            {CATEGORIES.map(cat => (
                <div key={cat} className="flex flex-col items-center min-w-[70px] transition-all hover:scale-110">
                    <span className={`text-[10px] font-black ${isChristmas ? 'text-white/40' : 'text-slate-500'} uppercase tracking-tighter`}>{cat}</span>
                    <span className={`text-xl font-black ${isChristmas ? 'text-amber-400' : isDark ? 'text-slate-200' : 'text-slate-900'}`}>{categoryCounts[cat]}</span>
                </div>
            ))}
            <div className={`flex flex-col items-center min-w-[70px] border-l ${isChristmas ? 'border-white/10' : isDark ? 'border-white/5' : 'border-slate-100'} pl-6`}>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Hoje</span>
                <span className="text-xl font-black text-blue-600">{totalToday}</span>
            </div>
            <div className="flex flex-col items-center min-w-[70px]">
                <span className={`text-[10px] font-black ${isChristmas ? 'text-green-400' : 'text-purple-500'} uppercase tracking-tighter`}>Mês</span>
                <span className={`text-xl font-black ${isChristmas ? 'text-green-500' : 'text-purple-600'}`}>{monthlyTotal}</span>
            </div>
        </footer>
    );
};

const ModalOverlay = ({ onClose, children, isDark, isChristmas }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />
        <div className={`relative ${isChristmas ? 'bg-red-900/95 border-white/20 shadow-red-900/50' : isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-white/20'} rounded-[3rem] shadow-2xl w-full max-w-sm p-8 overflow-hidden animate-pop-in border transition-all duration-500`}>{children}</div>
    </div>
);

const CalendarModal = ({ currentDate, onClose, onDateSelect, isDark, isChristmas }: any) => {
    const [viewDate, setViewDate] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: 42 }).map((_, i) => {
        const d = i - firstDay + 1;
        return d > 0 && d <= daysInMonth ? d : null;
    });

    const isHoliday = (day: number | null) => {
        if (!day) return null;
        const key = `${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return HOLIDAYS_SP[key];
    };

    return (
        <ModalOverlay onClose={onClose} isDark={isDark} isChristmas={isChristmas}>
            <div className="flex justify-between items-center mb-8">
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className={`p-3 ${isDark || isChristmas ? 'bg-white/10 text-white' : 'bg-slate-100'} rounded-full active:scale-90`}><IconChevronLeft className="w-5 h-5"/></button>
                <h3 className={`text-base font-black uppercase tracking-[3px] ${isChristmas ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-800'}`}>{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className={`p-3 ${isDark || isChristmas ? 'bg-white/10 text-white' : 'bg-slate-100'} rounded-full active:scale-90`}><IconChevronRight className="w-5 h-5"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
                {['D','S','T','Q','Q','S','S'].map(d => <div key={d} className="text-[11px] font-black text-slate-500 mb-3">{d}</div>)}
                {days.map((d, i) => {
                    const holiday = isHoliday(d);
                    const isSelected = d === currentDate.getDate() && viewDate.getMonth() === currentDate.getMonth() && viewDate.getFullYear() === currentDate.getFullYear();
                    return (
                        <button key={i} disabled={!d} onClick={() => d && onDateSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), d))} className={`h-12 rounded-2xl text-xs font-black transition-all ${!d ? 'invisible' : holiday ? `${holiday.color} text-white shadow-lg scale-110 z-10` : isSelected ? 'bg-cyan-600 text-white shadow-xl scale-110' : isDark || isChristmas ? 'bg-white/5 text-slate-300' : 'bg-slate-50 text-slate-700 hover:bg-white hover:shadow-md'}`}>
                            {d}
                            {holiday && <div className="text-[9px] mt-0.5">{holiday.icon}</div>}
                        </button>
                    );
                })}
            </div>
        </ModalOverlay>
    );
};

const ConfirmationModal = ({ message, onConfirm, onCancel, isDark, isChristmas }: any) => (
    <ModalOverlay onClose={onCancel} isDark={isDark} isChristmas={isChristmas}>
        <div className="text-center">
            <h3 className={`font-black mb-8 text-xl uppercase tracking-tighter ${isChristmas ? 'text-white' : isDark ? 'text-white' : 'text-slate-900'}`}>{message}</h3>
            <div className="flex gap-4">
                <button onClick={onCancel} className={`flex-1 py-5 ${isDark || isChristmas ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'} rounded-[1.8rem] font-black text-xs active:scale-95 transition-all`}>Não</button>
                <button onClick={onConfirm} className={`flex-1 py-5 ${isChristmas ? 'bg-green-600' : 'bg-red-500'} text-white rounded-[1.8rem] font-black text-xs active:scale-95 transition-all shadow-2xl`}>Sim</button>
            </div>
        </div>
    </ModalOverlay>
);

const PhotoGalleryModal = ({ item, onClose }: any) => (
    <div className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-3xl flex flex-col p-8 overflow-hidden">
        <div className="flex justify-between items-center text-white mb-10">
            <h3 className="font-black text-2xl tracking-[10px] uppercase text-white/50">Fotos</h3>
            <button onClick={onClose} className="p-4 bg-white/10 rounded-full active:scale-90"><IconX className="w-8 h-8"/></button>
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-1 gap-6 pb-20">
            {item.photos.map((p: any, i: any) => (
                <div key={i} className="group relative aspect-video overflow-hidden rounded-[3rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] bg-slate-900">
                    <img src={p} className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" />
                </div>
            ))}
            {item.photos.length === 0 && <div className="col-span-1 py-40 text-center text-white/10 font-black uppercase tracking-[20px] text-lg">Sem Imagens</div>}
        </div>
    </div>
);

const ShareModal = ({ appData, currentDate, isExportMode, onClose }: any) => {
    const handleExportCsv = (scope: 'day' | 'month') => {
        let items: any[] = [];
        const dateStr = getFormattedDate(currentDate);
        const prefix = dateStr.substring(0, 7);
        Object.entries(appData).forEach(([d, dayData]: [string, any]) => {
            if (dayData && ((scope === 'day' && d === dateStr) || (scope === 'month' && d.startsWith(prefix)))) {
                CATEGORIES.forEach(cat => {
                    dayData[cat].forEach((i: any) => { if (isItemActive(i)) items.push({ ...i, d, cat }); });
                });
            }
        });
        let csv = "Data,Categoria,Contrato,Serial\n" + items.map(i => `${i.d},${i.cat},${i.contract},${i.serial}`).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `relatorio_${scope}_${dateStr}.csv`;
        link.click();
        onClose();
    };

    return (
        <div className="space-y-4">
            <button onClick={() => handleExportCsv('day')} className="w-full py-5 bg-white border-4 border-slate-50 rounded-[2rem] font-black text-[11px] uppercase tracking-[3px] flex items-center justify-center gap-3 active:scale-95 shadow-xl text-slate-800">
                <IconFileExcel className="w-6 h-6 text-emerald-600"/> Planilha do Dia
            </button>
            <button onClick={() => handleExportCsv('month')} className="w-full py-5 bg-white border-4 border-slate-50 rounded-[2rem] font-black text-[11px] uppercase tracking-[3px] flex items-center justify-center gap-3 active:scale-95 shadow-xl text-slate-800">
                <IconFileExcel className="w-6 h-6 text-emerald-600"/> Planilha do Mês
            </button>
        </div>
    );
};

const App = () => (<ErrorBoundary><AppContent /></ErrorBoundary>)
export default App;
