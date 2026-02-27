
import React, { useState, useEffect, useReducer, useRef, useMemo, ReactNode, Component, ErrorInfo } from 'react';
import { SideMenu } from './components/SideMenu';
import { CameraModal } from './components/CameraModal';
import { 
    CustomMenuIcon, LoadingBoxIcon, IconPlus, IconMinus, IconUndo, IconSearch, IconCamera, IconGallery, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileExcel, IconWhatsapp, IconTelegram, IconEmail, IconStack, IconChevronDown, IconBell, IconCameraLens, IconSettings, IconExport, IconCalendar, IconInfo, IconSun, IconMoon, IconSave, IconDownload,
    IconBox, IconSpeaker, IconRemote, IconChip, IconTrash, IconCloud, IconCloudOff
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem, AppNotification, UserProfile } from './types';
import { CATEGORIES, HOLIDAYS_SP } from './constants';

const getFormattedDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const createEmptyDailyData = (): DailyData => {
  const data = {} as Partial<DailyData>;
  CATEGORIES.forEach(category => {
    data[category] = [{ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() }];
  });
  return data as DailyData;
};

const isChristmasPeriod = (): boolean => {
  const now = new Date();
  const month = now.getMonth(); 
  const day = now.getDate();
  return month === 11 && day >= 20 && day <= 25;
};

const generateMonthlyReport = (data: AppData, date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    let report = `Relatório Mensal - ${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}\n\n`;
    const totals: Record<string, number> = {};
    
    CATEGORIES.forEach(cat => {
        report += `--- ${cat.toUpperCase()} ---\n`;
        let catEntries = 0;
        
        const sortedDates = Object.keys(data).sort();
        
        sortedDates.forEach(dateStr => {
            const d = new Date(dateStr + 'T12:00:00');
            if (d.getMonth() === month && d.getFullYear() === year) {
                const dayData = data[dateStr][cat] || [];
                dayData.filter(isItemActive).forEach(item => {
                    const time = new Date(item.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    report += `Data: ${d.toLocaleDateString('pt-BR')} | Hora: ${time}\n`;
                    report += `Contrato: ${item.contract || '-'} | Serial: ${item.serial || '-'}\n`;
                    report += `----------------------------\n`;
                    catEntries++;
                });
            }
        });
        
        totals[cat] = catEntries;
        if (catEntries === 0) report += `Nenhum registro.\n`;
        report += `\n`;
    });

    report += `\n============================\n`;
    report += `RESUMO DE TOTAIS DO MÊS\n`;
    report += `============================\n`;
    CATEGORIES.forEach(cat => {
        report += `${cat}; ${totals[cat]}\n`;
    });
    report += `============================\n`;
    
    return report;
};

const downloadReport = (report: string, filename: string) => {
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

type Action =
  | { type: 'SET_DATA'; payload: AppData }
  | { type: 'ADD_ITEM'; payload: { date: string; category: EquipmentCategory } }
  | { type: 'UPDATE_ITEM'; payload: { date: string; category: EquipmentCategory; item: EquipmentItem } }
  | { type: 'DELETE_SINGLE_ITEM'; payload: { date: string; category: EquipmentCategory; itemId: string } }
  | { type: 'DELETE_MULTIPLE_ITEMS'; payload: { date: string; category: EquipmentCategory; itemIds: string[] } };

const dataReducer = (state: AppData, action: Action): AppData => {
    switch(action.type) {
        case 'SET_DATA': return action.payload;
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
            if (!newState[date]) newState[date] = createEmptyDailyData();
            const dayData = newState[date][category];
            const itemIndex = dayData.findIndex((i: EquipmentItem) => i.id === item.id);
            if (itemIndex > -1) dayData[itemIndex] = item;
            else dayData.push(item);

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
        case 'DELETE_MULTIPLE_ITEMS': {
            const { date, category, itemIds } = action.payload;
            if (!itemIds || itemIds.length === 0) return state;
            const newState = JSON.parse(JSON.stringify(state));
            if (!newState[date] || !newState[date][category]) return state;
            
            newState[date][category] = newState[date][category].filter((item: EquipmentItem) => !itemIds.includes(item.id));
            
            if (newState[date][category].length === 0) {
                newState[date][category].push({ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() });
            }
            return newState;
        }
        default: return state;
    }
}

const isItemActive = (item: EquipmentItem): boolean => (item.contract && item.contract.trim() !== '') || (item.serial && item.serial.trim() !== '') || item.photos.length > 0;

// Tipagem correta para o ErrorBoundary
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false };
  props: any;
  
  constructor(props: any) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-600 bg-slate-950 min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-black mb-4 uppercase tracking-tighter">Erro Crítico</h1>
          <p className="mb-8 opacity-60 text-xs font-bold uppercase tracking-widest">Ocorreu um erro inesperado</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-[3px] text-[10px] active:scale-95 transition-all shadow-xl shadow-red-600/20"
          >
            Recarregar App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const getCategoryIcon = (category: EquipmentCategory) => {
    switch(category) {
        case EquipmentCategory.BOX: return IconBox;
        case EquipmentCategory.BOX_SOUND: return IconSpeaker;
        case EquipmentCategory.CONTROLE: return IconRemote;
        case EquipmentCategory.CAMERA: return IconCameraLens;
        case EquipmentCategory.CHIP: return IconChip;
        default: return IconStack;
    }
};

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  // Carregar notificações do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('equipment_notifications');
    if (saved) setNotifications(JSON.parse(saved));
  }, []);

  // Salvar notificações
  useEffect(() => {
    localStorage.setItem('equipment_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (type: string, details: string) => {
    const newNotif = {
        id: Date.now(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type,
        details
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
    setHasNewNotifications(true);
  };
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appData, dispatch] = useReducer(dataReducer, {} as AppData);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
      const saved = localStorage.getItem('userProfile');
      return saved ? JSON.parse(saved) : { name: 'Leo Luz', cpf: '', profileImage: '' };
  });
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<EquipmentCategory>(CATEGORIES[0]);
  const [cameraTarget, setCameraTarget] = useState<{ category: EquipmentCategory, item: EquipmentItem | 'profile' } | null>(null);
  const [galleryItem, setGalleryItem] = useState<EquipmentItem | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [history, setHistory] = useState<AppData[]>([]);
  const [focusedInput, setFocusedInput] = useState<{ itemId: string, field: 'contract' | 'serial' } | null>(null);
  const [showAllTimeTotals, setShowAllTimeTotals] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    CATEGORIES.forEach(cat => initial[cat] = true);
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [holidayModal, setHolidayModal] = useState<{ name: string, icon: string, description: string } | null>(null);
  
  const isChristmas = isChristmasPeriod();
  const formattedDate = getFormattedDate(currentDate);
  
  const currentHoliday = useMemo(() => {
    const dayMonth = `${String(currentDate.getDate()).padStart(2, '0')}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    return HOLIDAYS_SP[dayMonth];
  }, [currentDate]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    
    // Load local data first
    const savedData = localStorage.getItem('equipmentData');
    if (savedData) dispatch({ type: 'SET_DATA', payload: JSON.parse(savedData) });
    
    // Then try to fetch from server
    const fetchServerData = async () => {
        try {
            const response = await fetch('/api/data');
            if (response.ok) {
                const serverData = await response.json();
                if (Object.keys(serverData).length > 0) {
                    dispatch({ type: 'SET_DATA', payload: serverData });
                    localStorage.setItem('equipmentData', JSON.stringify(serverData));
                }
            }
        } catch (err) {
            console.error("Failed to fetch from server", err);
            setSyncStatus('offline');
        }
    };
    
    fetchServerData();
    return () => clearTimeout(timer);
  }, []);

  // Sync with server whenever appData changes
  useEffect(() => {
    if (isLoading) return;
    
    localStorage.setItem('equipmentData', JSON.stringify(appData));
    
    const syncWithServer = async () => {
        if (!navigator.onLine) {
            setSyncStatus('offline');
            return;
        }
        
        setSyncStatus('syncing');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                setSyncStatus('synced');
            } else {
                setSyncStatus('error');
            }
        } catch (err) {
            setSyncStatus('error');
        }
    };

    const debounceTimer = setTimeout(syncWithServer, 3000);
    return () => clearTimeout(debounceTimer);
  }, [appData, isLoading]);

  useEffect(() => {
    const handleOnline = () => setSyncStatus('synced');
    const handleOffline = () => setSyncStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
  }, [userProfile]);

  const currentDayData = useMemo(() => appData[formattedDate] || createEmptyDailyData(), [appData, formattedDate]);

  const handleUndo = () => {
    if (deleteMode) {
        setDeleteMode(false);
        setSelectedForDelete([]);
        return;
    }
    
    // Se houver um campo focado, limpa o conteúdo dele em vez de desfazer o estado global
    if (focusedInput) {
        const { itemId, field } = focusedInput;
        const item = currentDayData[activeCategory].find(i => i.id === itemId);
        if (item) {
            onUpdateItem({ ...item, [field]: '' });
            addNotification('Limpar', `Campo ${field === 'contract' ? 'Contrato' : 'Serial'} limpo`);
            return;
        }
    }

    if (history.length > 0) {
        const lastState = history[history.length - 1];
        dispatch({ type: 'SET_DATA', payload: lastState });
        setHistory(prev => prev.slice(0, -1));
        addNotification('Desfazer', 'Ação desfeita com sucesso');
    }
  };

  const onUpdateItem = (item: EquipmentItem) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category: activeCategory, item } });
  };

  const addToHistory = (state: AppData) => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(state))]);
  };

  const handleAddItem = () => {
    addToHistory(appData);
    dispatch({ type: 'ADD_ITEM', payload: { date: formattedDate, category: activeCategory } });
    // Não expande mais automaticamente ao adicionar, para permitir que o item "suma" se estiver colapsado
    addNotification('Adição', `Novo item em ${activeCategory}`);
  };

  const handleDeleteSelected = () => {
    if (selectedForDelete.length > 0) {
        addToHistory(appData);
        dispatch({ type: 'DELETE_MULTIPLE_ITEMS', payload: { date: formattedDate, category: activeCategory, itemIds: selectedForDelete } });
        addNotification('Exclusão', `${selectedForDelete.length} itens removidos de ${activeCategory}`);
        setSelectedForDelete([]);
        setDeleteMode(false);
    }
  };

  const somaTotalGeral = useMemo(() => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentDay = currentDate.getDate();
    
    return Object.entries(appData).reduce((acc: number, [dateStr, day]) => {
        if (!day) return acc;
        const d = new Date(dateStr + 'T12:00:00');
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear && d.getDate() <= currentDay) {
            const dayTotal = Object.values(day).flat().filter(isItemActive).length;
            return acc + dayTotal;
        }
        return acc;
    }, 0);
  }, [appData, currentDate]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
        let count = 0;
        Object.values(appData).forEach(day => {
            if (day && day[cat]) {
                count += day[cat].filter(isItemActive).length;
            }
        });
        totals[cat] = count;
    });
    return totals;
  }, [appData]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const results: { date: string; category: EquipmentCategory; item: EquipmentItem }[] = [];
    Object.entries(appData).forEach(([date, dayData]) => {
      if (!dayData) return;
      Object.entries(dayData).forEach(([category, items]) => {
        items.forEach(item => {
          if (
            item.contract.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.serial.toLowerCase().includes(searchQuery.toLowerCase())
          ) {
            results.push({ date, category: category as EquipmentCategory, item });
          }
        });
      });
    });
    return results.sort((a, b) => b.item.createdAt! - a.item.createdAt!);
  }, [appData, searchQuery]);

  const handleCameraCapture = (data: string, type: 'qr' | 'photo') => {
    if (!cameraTarget) return;

    if (cameraTarget.item === 'profile') {
        setUserProfile(prev => ({ ...prev, profileImage: data }));
    } else {
        const item = cameraTarget.item as EquipmentItem;
        if (type === 'qr') {
            if ('vibrate' in navigator) navigator.vibrate(100);
            dispatch({ 
                type: 'UPDATE_ITEM', 
                payload: { 
                    date: formattedDate, 
                    category: cameraTarget.category, 
                    item: { ...item, serial: data } 
                } 
            });
        } else {
            dispatch({ 
                type: 'UPDATE_ITEM', 
                payload: { 
                    date: formattedDate, 
                    category: cameraTarget.category, 
                    item: { ...item, photos: [...item.photos, data] } 
                } 
            });
        }
    }
    setCameraTarget(null);
  };

  if (isLoading) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f0f0f0] z-[100]">
        <LoadingBoxIcon/>
        <p className="mt-4 font-black uppercase tracking-widest text-[10px] text-slate-400 animate-pulse">Iniciando Controle...</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen relative w-full overflow-x-hidden bg-[#f0f0f0] animate-fade-in">
      
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-[#f0f0f0] to-slate-100"></div>
          <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/5 blur-[120px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <SideMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        onMenuClick={setActiveModal} 
        userProfile={userProfile} 
        isChristmas={isChristmas} 
      />

      {isChristmas && (
          <div className="fixed top-0 left-0 right-0 h-48 pointer-events-none z-[60] overflow-hidden">
                <div className="absolute left-0 top-14 animate-[santaRide_24s_linear_infinite] flex items-center">
                    <div className="relative flex items-end">
                        <span className="text-8xl drop-shadow-[0_10px_20px_rgba(0,0,0,1)]" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🛷</span>
                        <span className="absolute bottom-6 left-10 text-6xl drop-shadow-lg" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🎅</span>
                        <div className="absolute bottom-8 left-18 flex items-baseline gap-0.5">
                            <span className="text-3xl drop-shadow-md">🎁</span>
                            <span className="text-2xl drop-shadow-md">📦</span>
                            <span className="text-2xl drop-shadow-md">🎁</span>
                        </div>
                        <svg className="absolute top-0 left-24 w-80 h-20 pointer-events-none overflow-visible">
                            <path d="M 0,14 Q 40,8 80,12" fill="none" stroke="#fcd34d" strokeWidth="1" strokeOpacity="0.4" />
                            <path d="M 0,17 Q 40,11 80,15" fill="none" stroke="#fcd34d" strokeWidth="1" strokeOpacity="0.4" />
                        </svg>
                    </div>
                    <div className="flex -space-x-5 items-center ml-14">
                        <span className="text-5xl drop-shadow-2xl" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🦌</span>
                        <span className="text-5xl drop-shadow-2xl" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🦌</span>
                        <span className="text-5xl drop-shadow-2xl" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🦌</span>
                    </div>
                </div>
          </div>
      )}

      <header className="sticky top-0 z-30 bg-[#f0f0f0]/80 backdrop-blur-xl border-b border-slate-300/50 px-4 pt-8 pb-3">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div onClick={() => setIsMenuOpen(true)} className="active:scale-95 transition-all cursor-pointer">
                    {userProfile.profileImage ? (
                        <div className="w-12 h-12 rounded-full border-2 border-slate-200 overflow-hidden shadow-sm">
                            <img src={userProfile.profileImage} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <CustomMenuIcon className="w-12 h-12 drop-shadow-md" isChristmas={isChristmas}/>
                    )}
                </div>
                <div className="flex flex-col">
                    <h1 className="text-sm font-black text-slate-900 uppercase tracking-tighter">
                        {userProfile.name || 'Controle'}
                    </h1>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[3px]">
                        Equipamentos
                    </span>
                </div>
            </div>
            
            <div className="flex gap-2 items-center">
                <button 
                    onClick={handleAddItem} 
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-linear-to-r from-blue-600 to-blue-500 text-white border border-blue-500 active:scale-90 shadow-[0_4px_0_#2563eb,0_8px_16px_rgba(37,99,235,0.3)] active:shadow-none active:translate-y-[4px] transition-all duration-75"
                >
                    <IconPlus className="w-3.5 h-3.5"/>
                </button>
                <button 
                    onClick={() => {
                        if (deleteMode) {
                            if (selectedForDelete.length > 0) {
                                handleDeleteSelected();
                            } else {
                                setDeleteMode(false);
                                setSelectedForDelete([]);
                            }
                        } else {
                            setDeleteMode(true);
                        }
                    }} 
                    className={`w-8 h-8 rounded-full flex items-center justify-center border active:scale-90 transition-all duration-75 active:translate-y-[4px] ${deleteMode ? 'bg-red-500 text-white border-red-400 shadow-[0_4px_0_#dc2626,0_8px_16px_rgba(220,38,38,0.3)] active:shadow-none' : 'bg-white text-slate-600 border-slate-200 shadow-[0_4px_0_#e2e8f0,0_8px_16px_rgba(0,0,0,0.05)] active:shadow-none'}`}
                >
                    {deleteMode && selectedForDelete.length > 0 ? <IconTrash className="w-3.5 h-3.5"/> : <IconMinus className="w-3.5 h-3.5"/>}
                </button>
                <button 
                    onClick={handleUndo} 
                    disabled={!deleteMode && history.length === 0}
                    className={`w-8 h-8 rounded-full flex items-center justify-center bg-white text-slate-600 border border-slate-200 active:scale-90 shadow-[0_4px_0_#e2e8f0,0_8px_16px_rgba(0,0,0,0.05)] active:shadow-none active:translate-y-[4px] transition-all duration-75 ${(!deleteMode && history.length === 0) ? 'opacity-30' : ''}`}
                >
                    <IconUndo className="w-3.5 h-3.5"/>
                </button>
                <button onClick={() => setActiveModal('search')} className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-slate-600 border border-slate-200 active:scale-90 shadow-[0_4px_0_#e2e8f0,0_8px_16px_rgba(0,0,0,0.05)] active:shadow-none active:translate-y-[4px] transition-all duration-75">
                    <IconSearch className="w-3.5 h-3.5"/>
                </button>
                <button 
                    onClick={() => {
                        setActiveModal('notifications');
                        setHasNewNotifications(false);
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-slate-600 border border-slate-200 active:scale-90 shadow-[0_4px_0_#e2e8f0,0_8px_16px_rgba(0,0,0,0.05)] active:shadow-none active:translate-y-[4px] transition-all duration-75 relative"
                >
                    <IconBell className="w-3.5 h-3.5"/>
                    {hasNewNotifications && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
                    )}
                </button>
            </div>
        </div>

        <div className="flex flex-col items-center mb-6 relative gap-2">
            <div className="flex items-center gap-2">
                <button onClick={() => setActiveModal('calendar')} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white border border-slate-200 active:scale-95 active:translate-y-[2px] transition-all shadow-[0_4px_0_#e2e8f0,0_8px_16px_rgba(0,0,0,0.05)] active:shadow-none">
                    <span className="font-black text-[11px] tracking-[3px] text-slate-700">
                        {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                </button>
                {currentHoliday && (
                    <button 
                        onClick={() => setHolidayModal(currentHoliday)}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-200 shadow-[0_2px_0_#e2e8f0,0_4px_8px_rgba(0,0,0,0.05)] active:scale-90 active:shadow-none active:translate-y-[1px] transition-all group"
                    >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border border-white shadow-inner ${currentHoliday.color}`}>
                            <span className="text-[10px] drop-shadow-sm">{currentHoliday.icon}</span>
                        </div>
                    </button>
                )}
            </div>
        </div>

        {/* Seletor de Categorias Horizontal */}
        <div className="relative">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-3 px-2 -mx-2">
                {CATEGORIES.map(cat => {
                    const Icon = getCategoryIcon(cat);
                    return (
                        <button 
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex flex-col items-center gap-1.5 min-w-[60px] p-2 rounded-[1.2rem] transition-all active:scale-95 relative ${activeCategory === cat ? 'bg-linear-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-100 text-slate-400'}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${activeCategory === cat ? 'bg-white/20' : 'bg-white/50'}`}>
                                <Icon className="w-4 h-4"/>
                            </div>
                            <span className="text-[6px] font-black uppercase tracking-[1px] whitespace-nowrap">{cat}</span>
                            <CountBadge count={appData[formattedDate]?.[cat]?.filter(isItemActive).length || 0} data={appData[formattedDate]?.[cat]} />
                        </button>
                    );
                })}
            </div>
        </div>
      </header>

      <main className="flex-1 px-4 space-y-4 mt-6 pb-48 relative z-10">
          <div 
            onClick={() => setCollapsedCategories(prev => ({ ...prev, [activeCategory]: !prev[activeCategory] }))}
            className={`flex items-center justify-between px-6 py-2 rounded-full shadow-lg transition-all duration-500 cursor-pointer active:scale-[0.98] mb-4 border ${
                collapsedCategories[activeCategory] 
                ? 'bg-white border-slate-100' 
                : 'bg-linear-to-r from-blue-700 via-blue-600 to-blue-500 text-white border-blue-400'
            }`}
          >
              <div className="flex items-center gap-3">
                  <span className={`text-[16px] font-black uppercase tracking-[1px] ${collapsedCategories[activeCategory] ? 'text-slate-800' : 'text-white'}`}>
                      {activeCategory}
                  </span>
              </div>
              <div className="p-1">
                  {collapsedCategories[activeCategory] ? (
                      <IconChevronRight className="w-5 h-5 text-slate-400"/>
                  ) : (
                      <IconChevronDown className="w-5 h-5 text-white"/>
                  )}
              </div>
          </div>

          <EquipmentSection 
            category={activeCategory} 
            items={collapsedCategories[activeCategory] 
                ? [currentDayData[activeCategory][currentDayData[activeCategory].length - 1]]
                : currentDayData[activeCategory]
            } 
            onUpdate={(item: any) => {
                addToHistory(appData);
                onUpdateItem(item);
            }}
            onDelete={(id: string) => {
                addToHistory(appData);
                dispatch({ type: 'DELETE_SINGLE_ITEM', payload: { date: formattedDate, category: activeCategory, itemId: id } });
            }}
            onGallery={setGalleryItem}
            onCamera={(item: any) => setCameraTarget({ category: activeCategory, item })}
            deleteMode={deleteMode}
            selectedForDelete={selectedForDelete}
            onToggleSelect={(id: string) => setSelectedForDelete(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
            isChristmas={isChristmas}
            syncStatus={syncStatus}
            onFocusInput={(itemId: string, field: 'contract' | 'serial') => setFocusedInput({ itemId, field })}
          />

          {collapsedCategories[activeCategory] && currentDayData[activeCategory].filter(isItemActive).length > 0 && (
              <div className="mt-4 p-4 rounded-[2rem] bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 opacity-60">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[2px]">
                      {currentDayData[activeCategory].filter(isItemActive).length} itens concluídos ocultos
                  </span>
                  <button 
                    onClick={() => setCollapsedCategories(prev => ({ ...prev, [activeCategory]: false }))}
                    className="text-[7px] font-black text-blue-500 uppercase tracking-widest underline underline-offset-4"
                  >
                      Expandir para ver todos
                  </button>
              </div>
          )}
      </main>

      {/* Rodapé customizado conforme solicitado */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 border-t border-slate-200 p-4 pb-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur-3xl max-w-[480px] mx-auto w-full">
          <div className="flex items-center justify-between">
              {/* Contagens individuais */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar flex-1 pr-4">
                  {CATEGORIES.map(cat => {
                      const Icon = getCategoryIcon(cat);
                      const count = showAllTimeTotals ? categoryTotals[cat] : (currentDayData[cat] || []).filter(isItemActive).length;
                      return (
                        <div key={cat} className={`flex flex-col items-center min-w-[32px] transition-all ${activeCategory === cat ? 'scale-110' : 'opacity-30'}`}>
                            <Icon className={`w-4 h-4 mb-1 ${activeCategory === cat ? 'text-blue-600' : 'text-slate-400'}`}/>
                            <span className={`text-[10px] font-black ${activeCategory === cat ? 'text-blue-600' : 'text-slate-500'}`}>
                                {count}
                            </span>
                        </div>
                      );
                  })}
              </div>
              
              <div className="h-10 w-px bg-slate-200 shrink-0"></div>

              {/* Totais */}
              <div className="flex items-center gap-4 pl-4 shrink-0">
                <div className="flex flex-col items-center min-w-[40px]">
                    <span className="text-[7px] font-black text-blue-600 uppercase tracking-widest mb-1">Dia</span>
                    <span className="text-xl font-black leading-none text-blue-600">
                        {Object.values(currentDayData).flat().filter(isItemActive).length}
                    </span>
                </div>
                <button 
                    onClick={() => setShowAllTimeTotals(!showAllTimeTotals)}
                    className="flex flex-col items-center active:scale-95 transition-transform"
                >
                    <span className={`text-[7px] font-black uppercase tracking-widest mb-1 transition-colors ${showAllTimeTotals ? 'text-purple-600' : 'text-purple-400'}`}>
                        {showAllTimeTotals ? 'Dia' : 'Mês'}
                    </span>
                    <div className={`rounded-2xl px-5 py-2.5 border transition-all duration-500 ${showAllTimeTotals ? 'bg-purple-600 text-white border-purple-400 shadow-[0_5px_15px_rgba(168,85,247,0.3)]' : 'bg-purple-50 text-purple-600 border-purple-200 shadow-sm backdrop-blur-xl'}`}>
                        <span className="text-xl font-black leading-none">
                            {somaTotalGeral}
                        </span>
                    </div>
                </button>
              </div>
          </div>
      </footer>

      {holidayModal && (
          <Modal title={holidayModal.name} onClose={() => setHolidayModal(null)}>
              <div className="text-center py-6">
                  <div className="text-6xl mb-6 animate-bounce">{holidayModal.icon}</div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-4">{holidayModal.name}</h3>
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <p className="text-[11px] font-black text-slate-600 uppercase leading-relaxed tracking-widest">
                          {holidayModal.description}
                      </p>
                  </div>
                  <button 
                    onClick={() => setHolidayModal(null)}
                    className="mt-8 w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-lg shadow-blue-600/20"
                  >
                      Entendido
                  </button>
              </div>
          </Modal>
      )}

      {galleryItem && <PhotoGalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} />}
      
      {cameraTarget && (
        <CameraModal 
          target={cameraTarget.item} 
          onClose={() => setCameraTarget(null)} 
          onCapture={handleCameraCapture}
        />
      )}

      {/* MODAIS REVERTIDOS PARA O DESIGN ORIGINAL */}
      
      {activeModal === 'search' && (
          <Modal title="Pesquisar" onClose={() => setActiveModal(null)}>
              <div className="space-y-4">
                  <div className="relative">
                      <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                      <input 
                        type="text" 
                        autoFocus
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Contrato ou Serial..."
                        className="w-full py-4 pl-12 pr-6 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-black text-sm text-slate-800 focus:bg-white transition-all shadow-inner"
                      />
                  </div>
                  <div className="max-h-[350px] overflow-y-auto space-y-2 no-scrollbar">
                      {searchResults.length > 0 ? (
                          searchResults.map((res, i) => (
                              <button 
                                key={i} 
                                onClick={() => {
                                    setCurrentDate(new Date(res.date + 'T12:00:00'));
                                    setActiveCategory(res.category);
                                    setActiveModal(null);
                                }}
                                className="w-full text-left p-4 rounded-2xl bg-white border border-slate-100 flex flex-col gap-1 active:scale-[0.98] transition-all hover:bg-slate-50 shadow-sm"
                              >
                                  <div className="flex justify-between items-center">
                                      <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">{res.category}</span>
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                          {new Date(res.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {new Date(res.item.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                  </div>
                                  <p className="text-xs font-black text-slate-800">CTR: {res.item.contract || '---'}</p>
                                  <p className="text-[10px] font-black text-slate-400 truncate">SN: {res.item.serial || '---'}</p>
                              </button>
                          ))
                      ) : searchQuery ? (
                          <p className="text-center py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhum resultado</p>
                      ) : (
                          <p className="text-center py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">Digite para buscar</p>
                      )}
                  </div>
              </div>
          </Modal>
      )}

      {activeModal === 'notifications' && (
          <Modal title="Notificações" onClose={() => setActiveModal(null)}>
              <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
                  {notifications.map(n => (
                      <div key={n.id} className={`p-4 rounded-2xl border ${n.read ? 'bg-white/5 border-white/5 opacity-60' : 'bg-blue-600/10 border-blue-500/20'}`}>
                          <p className="text-xs font-black text-white mb-1">{n.message}</p>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              {new Date(n.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                      </div>
                  ))}
              </div>
          </Modal>
      )}

      {activeModal === 'calendar' && (
          <Modal title="Calendário" onClose={() => setActiveModal(null)}>
              <div className="p-2">
                  <div className="flex items-center justify-between mb-4 px-2">
                      <button 
                        onClick={() => {
                            const d = new Date(currentDate);
                            d.setMonth(d.getMonth() - 1);
                            setCurrentDate(d);
                        }}
                        className="p-2 rounded-xl bg-slate-50 active:scale-90 transition-all"
                      >
                          <IconChevronLeft className="w-4 h-4 text-slate-400"/>
                      </button>
                      <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[3px]">
                          {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button 
                        onClick={() => {
                            const d = new Date(currentDate);
                            d.setMonth(d.getMonth() + 1);
                            setCurrentDate(d);
                        }}
                        className="p-2 rounded-xl bg-slate-50 active:scale-90 transition-all"
                      >
                          <IconChevronRight className="w-4 h-4 text-slate-400"/>
                      </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                          <div key={d} className="h-6 flex items-center justify-center text-[7px] font-black text-slate-400">{d}</div>
                      ))}
                      {(() => {
                          const year = currentDate.getFullYear();
                          const month = currentDate.getMonth();
                          const firstDay = new Date(year, month, 1).getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const days = [];
                          for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);
                          for (let day = 1; day <= daysInMonth; day++) {
                              const d = new Date(year, month, day);
                              const dateStr = getFormattedDate(d);
                              const isToday = getFormattedDate(new Date()) === dateStr;
                              const isSelected = getFormattedDate(currentDate) === dateStr;
                              const dayMonth = `${String(day).padStart(2, '0')}-${String(month + 1).padStart(2, '0')}`;
                              const holiday = HOLIDAYS_SP[dayMonth];
                              const hasActivity = appData[dateStr] && Object.values(appData[dateStr]).flat().some(isItemActive);

                              days.push(
                                <button 
                                    key={day} 
                                    onClick={() => { 
                                        setCurrentDate(d);
                                        setActiveModal(null);
                                    }} 
                                    className={`h-9 rounded-xl font-black text-[10px] transition-all relative flex flex-col items-center justify-center ${
                                        isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 
                                        holiday?.type === 'feriado' ? 'bg-amber-100 border border-amber-300 text-amber-700 shadow-sm' :
                                        holiday?.type === 'comemorativa' ? 'bg-pink-50 border border-pink-200 text-pink-600 shadow-sm' :
                                        isToday ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400 active:bg-slate-100'
                                    }`}
                                >
                                    <span>{day}</span>
                                    {hasActivity && (
                                        <div className={`absolute inset-0 rounded-xl border-2 pointer-events-none ${isSelected ? 'border-white/40' : 'border-cyan-500/30 bg-cyan-500/5'}`} />
                                    )}
                                    {hasActivity && !isSelected && (
                                        <div className="absolute bottom-1 w-1 h-1 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
                                    )}
                                </button>
                              );
                          }
                          return days;
                      })()}
                  </div>
              </div>
          </Modal>
      )}

      {activeModal === 'settings' && (
          <Modal title="Configurações" onClose={() => setActiveModal(null)}>
              <div className="space-y-6">
                  <div className="flex flex-col items-center mb-4">
                      <div 
                        onClick={() => setCameraTarget({ category: activeCategory, item: 'profile' })}
                        className="relative w-24 h-24 rounded-full bg-white/5 border-2 border-white/10 overflow-hidden cursor-pointer group"
                      >
                          {userProfile.profileImage ? (
                              <img src={userProfile.profileImage} className="w-full h-full object-cover" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                  <IconCamera className="w-8 h-8 text-slate-600"/>
                              </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <IconCameraLens className="w-6 h-6 text-white"/>
                          </div>
                      </div>
                      <p className="mt-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">Foto de Perfil</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-[4px] mb-2 block">Nome de Usuário</label>
                          <input 
                            type="text" 
                            value={userProfile.name} 
                            onChange={e => setUserProfile({...userProfile, name: e.target.value})}
                            className="w-full py-4 px-6 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-black text-sm text-slate-900 focus:bg-white focus:border-blue-200 transition-all"
                            placeholder="Ex: Leo Luz"
                          />
                      </div>
                      <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-[4px] mb-2 block">CPF</label>
                          <input 
                            type="text" 
                            value={userProfile.cpf || ''} 
                            onChange={e => setUserProfile({...userProfile, cpf: e.target.value})}
                            className="w-full py-4 px-6 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-black text-sm text-slate-900 focus:bg-white focus:border-blue-200 transition-all"
                            placeholder="000.000.000-00"
                          />
                      </div>
                  </div>
                  <div className="pt-4 space-y-3">
                      <button onClick={() => setActiveModal(null)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[3px] text-[10px] active:scale-95 transition-all shadow-xl shadow-blue-600/20">
                          Salvar Perfil
                      </button>
                      <button 
                        onClick={() => {
                            if (confirm("Tem certeza que deseja apagar todos os dados? Esta ação é irreversível.")) {
                                localStorage.removeItem('equipmentData');
                                dispatch({ type: 'SET_DATA', payload: {} });
                                setActiveModal(null);
                            }
                        }}
                        className="w-full py-4 bg-red-600/10 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase tracking-[3px] text-[10px] active:scale-95 transition-all"
                      >
                          Limpar Todos os Dados
                      </button>
                  </div>
              </div>
          </Modal>
      )}

      {activeModal === 'export' && (
          <Modal title="Relatórios e Backup" onClose={() => setActiveModal(null)}>
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => {
                          const dataStr = JSON.stringify(appData);
                          const blob = new Blob([dataStr], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `backup_equipamentos_${formattedDate}.json`;
                          link.click();
                      }} className="py-5 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group">
                          <IconDownload className="w-5 h-5 text-cyan-500 group-hover:scale-110 transition-transform"/>
                          <span className="font-black uppercase text-[8px] tracking-[2px] text-slate-300">Exportar JSON</span>
                      </button>
                      <div className="relative">
                          <button className="w-full h-full py-5 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group">
                              <IconExport className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform"/>
                              <span className="font-black uppercase text-[8px] tracking-[2px] text-slate-300">Importar JSON</span>
                          </button>
                          <input 
                            type="file" 
                            accept=".json" 
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const json = JSON.parse(event.target?.result as string);
                                            dispatch({ type: 'SET_DATA', payload: json });
                                            setActiveModal(null);
                                        } catch (err) { alert("Arquivo inválido"); }
                                    };
                                    reader.readAsText(file);
                                }
                            }}
                          />
                      </div>
                  </div>

                  <div className="h-px bg-white/5 my-2"></div>
                  
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-[4px] text-center mb-2">Compartilhar Relatório Mensal</p>
                  
                  <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => {
                            const text = generateMonthlyReport(appData, currentDate);
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                        }}
                        className="py-4 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                      >
                          <IconWhatsapp className="w-5 h-5 text-emerald-500"/>
                      </button>
                      <button 
                        onClick={() => {
                            const text = generateMonthlyReport(appData, currentDate);
                            window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`);
                        }}
                        className="py-4 bg-sky-600/10 border border-sky-500/20 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                      >
                          <IconTelegram className="w-5 h-5 text-sky-500"/>
                      </button>
                      <button 
                        onClick={() => {
                            const text = generateMonthlyReport(appData, currentDate);
                            downloadReport(text, `relatorio_mensal_${currentDate.getMonth() + 1}_${currentDate.getFullYear()}.txt`);
                        }}
                        className="py-4 bg-slate-600/10 border border-slate-500/20 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                      >
                          <IconFileExcel className="w-5 h-5 text-slate-500"/>
                      </button>
                  </div>
              </div>
          </Modal>
      )}

      {activeModal === 'notifications' && (
          <Modal title="Atividades do Dia" onClose={() => setActiveModal(null)}>
              <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                  {notifications.length > 0 ? (
                      notifications.map(notif => (
                          <div key={notif.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                              <div className={`w-2 h-2 rounded-full ${notif.type === 'Adição' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <div className="flex-1">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{notif.type}</span>
                                      <span className="text-[8px] font-black text-slate-400">{notif.time}</span>
                                  </div>
                                  <p className="text-[11px] font-black text-slate-500">{notif.details}</p>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-10">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhuma atividade registrada</p>
                      </div>
                  )}
              </div>
          </Modal>
      )}
      {activeModal === 'about' && (
          <Modal title="Sobre o App" onClose={() => setActiveModal(null)}>
              <div className="text-center py-4">
                  <CustomMenuIcon className="w-24 h-24 mx-auto mb-8 drop-shadow-2xl" isChristmas={isChristmas}/>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Stream+ Control</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[6px] mb-10">Versão 1.0.3</p>
                  <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-[4px] mb-2">Desenvolvido por</p>
                      <p className="text-xl font-black text-cyan-500 uppercase tracking-tighter">Leo Luz</p>
                  </div>
              </div>
          </Modal>
      )}

    </div>
  );
};

const CountBadge = ({ count, data }: { count: number, data?: any }) => {
    const [isAnimating, setIsAnimating] = useState(false);
    const lastDataRef = useRef(JSON.stringify(data));

    useEffect(() => {
        const currentDataStr = JSON.stringify(data);
        if (currentDataStr !== lastDataRef.current) {
            setIsAnimating(true);
            const timer = setTimeout(() => setIsAnimating(false), 1500);
            lastDataRef.current = currentDataStr;
            return () => clearTimeout(timer);
        }
    }, [data]);

    if (count === 0) return null;

    return (
        <div className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center font-black text-[8px] transition-all duration-1000 border border-white shadow-md ${
            isAnimating 
            ? 'bg-[#4ade80] text-white shadow-[0_0_25px_#4ade80,0_0_15px_#4ade80] scale-125 z-10' 
            : 'bg-[#ff3b30] text-white'
        }`}>
            {count}
        </div>
    );
};

const EquipmentSection = ({ category, items, onUpdate, onDelete, onGallery, onCamera, deleteMode, selectedForDelete, onToggleSelect, isChristmas, syncStatus, onFocusInput }: any) => {
    const serialRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
    const inactivityTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    const resetInactivityTimer = (inputEl: HTMLInputElement | null) => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
            if (inputEl) {
                inputEl.blur();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 2000);
    };

    useEffect(() => {
        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, []);

    // Ordenar itens: preenchidos primeiro (por hora), em branco por último
    const sortedItems = [...items].sort((a, b) => {
        const aActive = isItemActive(a);
        const bActive = isItemActive(b);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return (a.createdAt || 0) - (b.createdAt || 0);
    });

    return (
        <div className="space-y-2">
            {sortedItems.map((item: any) => (
                <div key={item.id} className="flex gap-1.5 animate-fade-in">
                    <div className={`flex-1 p-2 rounded-[1.2rem] border shadow-sm flex flex-col gap-2 transition-all duration-500 ${deleteMode && selectedForDelete?.includes(item.id) ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex gap-1.5 items-center">
                            {deleteMode && (
                                <button 
                                    onClick={() => onToggleSelect(item.id)}
                                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${selectedForDelete?.includes(item.id) ? 'bg-red-500 border-red-400 text-white' : 'bg-slate-50 border-slate-200 text-transparent'}`}
                                >
                                    <IconTrash className="w-3 h-3"/>
                                </button>
                            )}
                            
                            {/* Hora à esquerda */}
                            <div className="min-w-[35px] flex flex-col items-center justify-center opacity-30">
                                <span className="text-[8px] font-black text-slate-500">
                                    {new Date(item.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <div className="flex-1 flex flex-col gap-1.5">
                                <div className="flex gap-1 items-center">
                                    {/* Campo Contrato - Ajustado para 10 dígitos */}
                                    <div className="flex flex-col gap-1 w-[100px] shrink-0">
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                placeholder="CONTRATO" 
                                                value={item.contract} 
                                                onFocus={(e) => {
                                                    onFocusInput(item.id, 'contract');
                                                    resetInactivityTimer(e.target as HTMLInputElement);
                                                }}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val.length <= 10) {
                                                        onUpdate({...item, contract: val});
                                                        resetInactivityTimer(e.target as HTMLInputElement);
                                                        if (val.length === 10) {
                                                            serialRefs.current[item.id]?.focus();
                                                        }
                                                    }
                                                }} 
                                                className="w-full py-2 px-1 rounded-lg border border-slate-100 outline-none font-black text-[11px] bg-white text-slate-800 placeholder-slate-300 focus:border-blue-200 transition-all text-center shadow-sm"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Campo Serial - Ajustado para 20 dígitos */}
                                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                                        <div className="relative">
                                            <input 
                                                ref={el => serialRefs.current[item.id] = el}
                                                type="text" 
                                                placeholder="SERIAL" 
                                                value={item.serial} 
                                                onFocus={(e) => {
                                                    onFocusInput(item.id, 'serial');
                                                    resetInactivityTimer(e.target as HTMLInputElement);
                                                }}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val.length <= 20) {
                                                        onUpdate({...item, serial: val});
                                                        resetInactivityTimer(e.target as HTMLInputElement);
                                                        if (val.length === 20) {
                                                            // Recolhe teclado e sobe pro topo
                                                            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
                                                            (e.target as HTMLInputElement).blur();
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }
                                                    }
                                                }} 
                                                className="w-full py-2 px-1 rounded-lg border border-slate-100 outline-none font-black text-[11px] bg-white text-slate-800 placeholder-slate-300 focus:border-blue-200 transition-all text-center shadow-sm truncate"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => onCamera(item)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#111827] text-white active:scale-95 active:translate-y-[2px] transition-all shadow-[0_4px_0_#000,0_8px_16px_rgba(0,0,0,0.2)] active:shadow-none">
                                            <IconCameraLens className="w-4 h-4"/>
                                        </button>
                                        <button onClick={() => onGallery(item)} className={`w-8 h-8 flex items-center justify-center rounded-lg active:scale-95 active:translate-y-[2px] transition-all border ${item.photos.length > 0 ? 'bg-green-50 text-green-600 border-green-100 shadow-[0_4px_0_#dcfce7]' : 'bg-white text-slate-300 border-slate-100 shadow-[0_4px_0_#f1f5f9]'} active:shadow-none`}>
                                            <div className="relative">
                                                <IconGallery className="w-4 h-4"/>
                                                <CountBadge count={item.photos.length} />
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            <div className="flex justify-center mt-4">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/50 backdrop-blur-sm rounded-full border border-slate-100/50 shadow-sm">
                    {syncStatus === 'syncing' && (
                        <div className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {syncStatus === 'synced' && (
                        <IconCloud className="w-2.5 h-2.5 text-emerald-500 opacity-60" />
                    )}
                    {syncStatus === 'offline' && (
                        <IconCloudOff className="w-2.5 h-2.5 text-slate-300" />
                    )}
                    {syncStatus === 'error' && (
                        <IconCloudOff className="w-2.5 h-2.5 text-red-400" />
                    )}
                    <span className="text-[6px] font-black text-slate-400 uppercase tracking-[2px]">
                        {syncStatus === 'syncing' ? 'Sincronizando' : syncStatus === 'synced' ? 'Nuvem OK' : syncStatus === 'offline' ? 'Offline' : 'Erro Sync'}
                    </span>
                </div>
            </div>
        </div>
    );
};

const PhotoGalleryModal = ({ item, onClose }: any) => (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col p-6">
        <div className="flex justify-between items-center mb-10">
            <span className="font-black text-slate-400 text-[10px] uppercase tracking-[12px] opacity-40">GALERIA</span>
            <button onClick={onClose} className="p-4 bg-slate-200 rounded-full text-slate-600 active:scale-95 transition-all"><IconX className="w-7 h-7"/></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar pb-24">
            {item.photos.map((p: any, i: any) => (
                <div key={i} className="aspect-video rounded-[2.5rem] overflow-hidden bg-white border border-slate-100 shadow-xl">
                    <img src={p} className="w-full h-full object-contain" alt={`Equipment ${i}`} />
                </div>
            ))}
        </div>
    </div>
);

const Modal = ({ title, children, onClose }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl p-6 animate-pop-in">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-black uppercase tracking-[5px] text-[9px] text-slate-400">{title}</h3>
                <button onClick={onClose} className="p-2.5 rounded-xl bg-slate-50 active:scale-95 transition-all text-slate-400"><IconX className="w-4 h-4"/></button>
            </div>
            {children}
        </div>
    </div>
);

const App = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;
