
import React, { useState, useEffect, useReducer, useRef, useMemo } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileWord, IconFileExcel, IconWhatsapp, IconTelegram, IconEmail, IconSave
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem } from './types';
import { CATEGORIES } from './constants';

// --- UTILITIES ---

const getFormattedDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Robust ID generator compatible with all browsers
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const createEmptyDailyData = (): DailyData => {
  const data = CATEGORIES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as DailyData);

  // Initialize each category with one empty row
  CATEGORIES.forEach(category => {
    data[category].push({ id: generateId(), qt: '', contract: '', serial: '', photos: [] });
  });

  return data;
};

// --- REDUCER & STATE MANAGEMENT ---

type Action =
  | { type: 'SET_DATA'; payload: AppData }
  | { type: 'ENSURE_DAY_DATA'; payload: { date: string; dayData: DailyData } }
  | { type: 'ADD_ITEM'; payload: { date: string; category: EquipmentCategory } }
  | { type: 'UPDATE_ITEM'; payload: { date: string; category: EquipmentCategory; item: EquipmentItem } }
  | { type: 'DELETE_ITEMS'; payload: { date: string; category: EquipmentCategory; itemIds: string[] } }
  | { type: 'CLEAR_ALL_DATA' };

const dataReducer = (state: AppData, action: Action): AppData => {
    switch(action.type) {
        case 'SET_DATA':
            return action.payload;
        case 'ENSURE_DAY_DATA': {
            const { date, dayData } = action.payload;
            if (state[date]) return state; // Don't overwrite existing
            const newState = { ...state };
            newState[date] = dayData;
            return newState;
        }
        case 'ADD_ITEM': {
            const { date, category } = action.payload;
            const newState = JSON.parse(JSON.stringify(state)); // Deep copy
            if (!newState[date]) newState[date] = createEmptyDailyData();
            const newItem: EquipmentItem = {
                id: generateId(),
                qt: '', contract: '', serial: '', photos: []
            };
            newState[date][category].push(newItem);
            return newState;
        }
        case 'UPDATE_ITEM': {
            const { date, category, item } = action.payload;
            const newState = JSON.parse(JSON.stringify(state));
            const dayData = newState[date]?.[category];
            if (!dayData) return state;

            const itemIndex = dayData.findIndex((i: EquipmentItem) => i.id === item.id);
            if (itemIndex > -1) {
                dayData[itemIndex] = item;
            } else {
                dayData.push(item);
            }
            return newState;
        }
        case 'DELETE_ITEMS': {
            const { date, category, itemIds } = action.payload;
            const newState = JSON.parse(JSON.stringify(state));
            const dayData = newState[date]?.[category];
            if (!dayData) return state;
            newState[date][category] = dayData.filter((item: EquipmentItem) => !itemIds.includes(item.id));

            // Ensure there's always one row
            if (newState[date][category].length === 0) {
                 newState[date][category].push({ id: generateId(), qt: '', contract: '', serial: '', photos: [] });
            }

            return newState;
        }
        case 'CLEAR_ALL_DATA':
            return {};
        default:
            return state;
    }
}

const isItemActive = (item: EquipmentItem): boolean => {
    return (item.qt && item.qt.trim() !== '') || (item.contract && item.contract.trim() !== '') || (item.serial && item.serial.trim() !== '') || item.photos.length > 0;
};

// --- ERROR BOUNDARY ---

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Algo deu errado.</h1>
          <p className="text-gray-600 mb-4">Por favor, recarregue a página.</p>
          <pre className="text-xs bg-gray-100 p-2 rounded text-left overflow-auto">{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Recarregar</button>
        </div>
      )
    }
    return this.props.children;
  }
}

// --- MAIN APP COMPONENT ---

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

  // History Manager
  const dispatchWithHistory = (action: Action) => {
    setHistory(prev => [appData, ...prev].slice(0, 10)); 
    dispatch(action);
  };

  // Load Data
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('equipmentData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        dispatch({ type: 'SET_DATA', payload: parsedData });
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);

  // Ensure Data for Today exists
  useEffect(() => {
    if (!appData[formattedDate]) {
      dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } });
    }
  }, [appData, formattedDate]);

  // Save Data
  useEffect(() => {
    if (isRestoring) {
        setIsRestoring(false);
        return;
    }
    try {
        localStorage.setItem('equipmentData', JSON.stringify(appData));
    } catch (error) {
        console.error("Failed to save data to localStorage", error);
    }
  }, [appData, isRestoring]);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getDate() !== currentDate.getDate()) {
        setCurrentDate(now);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  const currentDayData: DailyData = appData[formattedDate] || createEmptyDailyData();

  // Actions
  const handleAddItem = () => {
    if (!activeCategory) return;
    const categoryItems = currentDayData[activeCategory] || [];
    const lastItem = categoryItems[categoryItems.length - 1];
    
    // Only add if the last item has data
    if (!lastItem || isItemActive(lastItem)) {
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
    } else {
        setConfirmation({ message: "Nenhuma ação para desfazer.", onConfirm: () => {} });
    }
  }
  
  const handleOpenModal = (modalName: string) => {
    setActiveModal(modalName);
    setIsMenuOpen(false);
  };
  
  const handleToggleDeleteMode = () => {
    setIsGlobalDeleteMode(prev => !prev);
    setSelectedItems({}); 
  };
  
  const handleToggleItemSelection = (category: EquipmentCategory, itemId: string) => {
    setSelectedItems(prev => {
        const newCategorySelection = prev[category] ? [...prev[category]] : [];
        if (newCategorySelection.includes(itemId)) {
            return { ...prev, [category]: newCategorySelection.filter(id => id !== itemId) };
        } else {
            return { ...prev, [category]: [...newCategorySelection, itemId] };
        }
    });
  };
  
  const hasSelectedItems = useMemo(() => {
    return Object.values(selectedItems).some((items) => Array.isArray(items) && items.length > 0);
  }, [selectedItems]);

  const handleConfirmGlobalDelete = () => {
      const totalSelected = Object.entries(selectedItems).reduce((sum: number, [, itemIds]) => {
           return sum + (Array.isArray(itemIds) ? itemIds.length : 0);
      }, 0);

      if (totalSelected > 0) {
        setConfirmation({
            message: `Tem certeza que deseja apagar ${totalSelected} item(s)?`,
            onConfirm: () => {
                Object.entries(selectedItems).forEach(([category, itemIds]) => {
                    if (Array.isArray(itemIds) && itemIds.length > 0) {
                        dispatchWithHistory({ type: 'DELETE_ITEMS', payload: { date: formattedDate, category: category as EquipmentCategory, itemIds: itemIds as string[] } });
                    }
                });
                handleToggleDeleteMode(); 
            }
        });
      }
  };

  const handleSearchToggle = () => {
    if (isSearchActive) {
      setCurrentDate(new Date());
      setIsSearchActive(false);
    } else {
      setIsSearchActive(true);
    }
  };

  const handleSearchResultSelect = (result: { date: string; category: EquipmentCategory; item: EquipmentItem }) => {
    const [year, month, day] = result.date.split('-').map(Number);
    setCurrentDate(new Date(year, month - 1, day));
    setIsSearchActive(false);
  };

  // Camera & Gallery
  const openCamera = (item: EquipmentItem) => {
      setCameraModalItem(item);
  }

  const handleCameraCapture = (photo: string, scannedCode?: string) => {
      if (!cameraModalItem) return;
      // Find category of item
      const category = Object.entries(currentDayData).find(([, items]) => items.some(it => it.id === cameraModalItem.id))?.[0] as EquipmentCategory | undefined;
      
      if (category) {
          const updatedItem = { ...cameraModalItem };
          if (photo) {
              updatedItem.photos = [...updatedItem.photos, photo];
          }
          if (scannedCode) {
              updatedItem.serial = scannedCode;
          }
          handleUpdateItem(category, updatedItem);
      }
      setCameraModalItem(null);
  }


  return (
    // Updated Background: Glossy Silver/White Gradient
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-gray-800 font-sans pb-32">
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={handleOpenModal}/>
      
      {/* Header: Crystal White Glass */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-2xl shadow-sm border-b border-white/60 pt-3 pb-2 px-4">
        <div className="container mx-auto">
            <div className="flex justify-between items-center mb-2">
                {/* Menu Icon */}
                <button
                    onClick={() => setIsMenuOpen(true)}
                    className="active:scale-95 transition-transform drop-shadow-md"
                    aria-label="Open menu"
                >
                    <CustomMenuIcon className="w-14 h-14" />
                </button>

                {/* Action Buttons: Recessed Glossy Box */}
                <div className="flex items-center gap-0.5 bg-slate-50/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] p-1.5 rounded-2xl border border-white/60 backdrop-blur-sm">
                    <ActionButton onClick={handleAddItem}><IconPlus className="w-5 h-5" /></ActionButton>
                    <ActionButton onClick={handleToggleDeleteMode} isDanger={isGlobalDeleteMode}><IconMinus className="w-5 h-5" /></ActionButton>
                    {isGlobalDeleteMode && hasSelectedItems && (
                    <ActionButton onClick={handleConfirmGlobalDelete} isDanger={true}>
                        <IconTrash className="w-5 h-5" />
                    </ActionButton>
                    )}
                    <ActionButton onClick={handleUndo}><IconUndo className="w-5 h-5" /></ActionButton>
                    <ActionButton onClick={handleSearchToggle}><IconSearch className="w-5 h-5" /></ActionButton>
                </div>
            </div>

            {/* Date: Centered below */}
            <div className="text-center">
                <div className="inline-block px-6 py-1 rounded-full bg-white/60 border border-white/80 backdrop-blur-xl shadow-sm">
                    <div className="text-lg font-extrabold text-gray-500 tracking-tight">
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
                onUpdateItem={(item) => handleUpdateItem(category, item)}
                onViewGallery={(item) => setGalleryItem(item)}
                isDeleteMode={isGlobalDeleteMode}
                selectedItems={selectedItems[category] || []}
                onToggleSelect={(itemId) => handleToggleItemSelection(category, itemId)}
                isActive={category === activeCategory}
                onActivate={() => setActiveCategory(category)}
                onOpenCamera={openCamera}
            />
        ))}
      </main>

      <SummaryFooter data={currentDayData} allData={appData} currentDate={formattedDate} />
            
      {/* Modals */}
      {galleryItem && <PhotoGalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} onUpdatePhotos={(updatedPhotos) => {
        const category = Object.entries(currentDayData).find(([, items]) => items.some(it => it.id === galleryItem.id))?.[0] as EquipmentCategory | undefined;
        if(category) {
            const updatedItem = { ...galleryItem, photos: updatedPhotos };
            handleUpdateItem(category, updatedItem);
            setGalleryItem(updatedItem);
        }
      }}
      setConfirmation={setConfirmation}
      />}
      
      {cameraModalItem && <CameraModal onClose={() => setCameraModalItem(null)} onCapture={handleCameraCapture} />}

      {activeModal === 'calendar' && <CalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={date => {setCurrentDate(date); setActiveModal(null);}}/>}
      {activeModal === 'save' && <DownloadModal data={currentDayData} date={formattedDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'export' && <ShareModal data={currentDayData} date={formattedDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'settings' && <SettingsModal onClose={() => setActiveModal(null)} onClearData={() => {
        setConfirmation({
            message: "Você tem certeza? Todos os dados salvos serão apagados permanentemente.",
            onConfirm: () => {
                dispatchWithHistory({ type: 'CLEAR_ALL_DATA' });
                setActiveModal(null);
            }
        });
      }}/>}
      {activeModal === 'about' && <AboutModal onClose={() => setActiveModal(null)} onShareClick={() => setActiveModal('shareApp')}/>}
      {activeModal === 'shareApp' && <ShareModal isSharingApp onClose={() => setActiveModal(null)} />}
      {isSearchActive && <SearchModal onClose={() => setIsSearchActive(false)} appData={appData} onSelect={handleSearchResultSelect} />}
      {confirmation && <ConfirmationModal message={confirmation.message} onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} onCancel={() => setConfirmation(null)} />}
    </div>
  );
};

const App = () => (
    <ErrorBoundary>
        <AppContent />
    </ErrorBoundary>
)

/* --- SUB-COMPONENTS & MODALS --- */

const ActionButton = ({ children, onClick, isPrimary = false, isDanger = false }: { children?: React.ReactNode; onClick?: () => void; isPrimary?: boolean; isDanger?: boolean; }) => (
    <button 
        onClick={onClick} 
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-100 ease-in-out shadow-sm border active:shadow-inner active:scale-95 active:translate-y-px ${
            isPrimary ? 'bg-gradient-to-b from-cyan-400 to-cyan-500 border-cyan-600 text-white hover:from-cyan-300 hover:to-cyan-400' : 
            isDanger ? 'bg-gradient-to-b from-red-50 to-red-100 border-red-200 text-red-500 hover:from-red-100 hover:to-red-200' :
            'bg-gradient-to-b from-white to-gray-50 border-gray-200 text-gray-600 hover:from-gray-50 hover:to-gray-100'
        }`}
    >
        {children}
    </button>
);

const EquipmentSection: React.FC<{ 
    category: EquipmentCategory; 
    items: EquipmentItem[]; 
    onUpdateItem: (item: EquipmentItem) => void; 
    onViewGallery: (item: EquipmentItem) => void;
    isDeleteMode: boolean;
    selectedItems: string[];
    onToggleSelect: (itemId: string) => void;
    isActive: boolean;
    onActivate: () => void;
    onOpenCamera: (item: EquipmentItem) => void;
}> = ({ category, items, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isActive, onActivate, onOpenCamera }) => {
    return (
        <div onClick={onActivate}>
            <h2 className="text-lg font-bold text-cyan-700 uppercase tracking-widest drop-shadow-sm mb-2 ml-2">{category}</h2>
            {/* Glass Prism Card */}
            <section className={`p-2 bg-white/60 backdrop-blur-md border border-white/80 rounded-xl shadow-lg shadow-slate-200/50 transition-all duration-300 ${isActive ? 'ring-1 ring-white shadow-xl scale-[1.01]' : ''}`}>
                <div className="space-y-2">
                    {items.map(item => (
                        <EquipmentRow 
                            key={item.id} 
                            item={item} 
                            onUpdate={onUpdateItem} 
                            isDeleteMode={isDeleteMode}
                            isSelected={selectedItems.includes(item.id)} 
                            onToggleSelect={() => onToggleSelect(item.id)} 
                            onViewGallery={() => onViewGallery(item)} 
                            onOpenCamera={() => onOpenCamera(item)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

const EquipmentRow: React.FC<{ item: EquipmentItem; onUpdate: (item: EquipmentItem) => void; isDeleteMode: boolean; isSelected: boolean; onToggleSelect: () => void; onViewGallery: () => void; onOpenCamera: () => void; }> = ({ item, onUpdate, isDeleteMode, isSelected, onToggleSelect, onViewGallery, onOpenCamera }) => {
    const handleChange = (field: keyof Omit<EquipmentItem, 'id'|'photos'>, value: string) => onUpdate({ ...item, [field]: value });
    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);
    
    return (
        <div className={`flex items-center gap-1 p-1 rounded-lg transition-all ${isSelected ? 'bg-red-500/10 border border-red-200' : 'bg-white/30'}`}>
            {isDeleteMode && <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="form-checkbox h-5 w-5 rounded bg-gray-100 border-gray-300 text-cyan-600 mr-1 flex-shrink-0"/>}
            
            {/* Input Container: Optimized for Mobile Widths */}
            <div className="flex flex-1 items-center gap-0.5 min-w-0">
                {/* QT: Tiny fixed width */}
                <div className="w-9 flex-shrink-0">
                     <InputWithLabel 
                        placeholder="QT" 
                        type="number"
                        value={item.qt} 
                        onChange={e => {
                            const val = e.target.value;
                            if (val === '' || (/^\d{1,2}$/.test(val) && parseInt(val, 10) < 100)) handleChange('qt', val);
                        }} 
                    />
                </div>

                {/* Contract (40%) & Serial (60%) */}
                <div className="flex-1 flex gap-0.5 min-w-0">
                     <div className="flex-[2] min-w-0">
                        <InputWithLabel placeholder="Contrato" value={item.contract} onChange={e => handleChange('contract', e.target.value)} maxLength={10} onCopy={() => copyToClipboard(item.contract)} />
                     </div>
                     <div className="flex-[3] min-w-0">
                        <InputWithLabel placeholder="Serial" value={item.serial} onChange={e => handleChange('serial', e.target.value)} maxLength={20} onCopy={() => copyToClipboard(item.serial)} />
                     </div>
                </div>

                {/* Buttons: Tightly Packed */}
                <div className="flex-shrink-0 flex items-center justify-center gap-0.5 ml-0.5">
                    <button onClick={onOpenCamera} className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 rounded-md active:scale-95 text-gray-600 shadow-sm border border-gray-200"><IconCamera className="w-4 h-4"/></button>
                    <button onClick={onViewGallery} className="relative w-7 h-7 flex items-center justify-center bg-gradient-to-b from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 rounded-md active:scale-95 disabled:opacity-50 text-gray-600 shadow-sm border border-gray-200" disabled={item.photos.length === 0}>
                        <IconGallery className="w-4 h-4"/>
                        {item.photos.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[8px] w-3 h-3 flex items-center justify-center rounded-full shadow-sm">{item.photos.length}</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Updated Input: Carved Glass Style (Inner Shadow)
const InputWithLabel = ({ placeholder, value, onChange, type = "text", maxLength, onCopy }: any) => (
    <div className="relative group w-full">
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={maxLength}
            className="w-full bg-slate-50/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] border border-gray-200 rounded-md px-0 py-1.5 text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:bg-white placeholder-gray-400 transition-all text-center"
        />
        {onCopy && value && (
            <button 
                onClick={onCopy} 
                className="absolute right-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
            >
                <IconClipboard className="w-3 h-3 text-gray-400 hover:text-cyan-600" />
            </button>
        )}
    </div>
);

const SummaryFooter = ({ data, allData, currentDate }: { data: DailyData; allData: AppData; currentDate: string }) => {
    const calculateTotal = (items: EquipmentItem[]) => items.reduce((acc, item) => {
         if (!isItemActive(item)) return acc;
         const qty = parseInt(item.qt, 10);
         return acc + (isNaN(qty) ? 1 : qty);
    }, 0);

    const dailyTotal = useMemo(() => {
        return Object.values(data).reduce((acc, items) => acc + calculateTotal(items), 0);
    }, [data]);

    const monthlyTotal = useMemo(() => {
        const [currentYear, currentMonth] = currentDate.split('-');
        let total = 0;
        Object.entries(allData).forEach(([dateKey, dayData]) => {
            const [y, m] = dateKey.split('-');
            if (y === currentYear && m === currentMonth) {
                 Object.values(dayData).forEach(items => {
                     total += calculateTotal(items);
                 });
            }
        });
        return total;
    }, [allData, currentDate]);

    return (
        <footer className="fixed bottom-0 left-0 w-full bg-slate-100/90 backdrop-blur-xl border-t border-white/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-3 z-40 pb-safe">
            <div className="container mx-auto">
                <div className="flex overflow-x-auto gap-3 pb-2 hide-scrollbar snap-x">
                    {CATEGORIES.map(category => (
                        <div key={category} className="flex-shrink-0 snap-start bg-white/60 border border-white/80 rounded-xl px-4 py-2 min-w-[100px] flex flex-col items-center justify-center shadow-sm">
                            <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider mb-1">{category}</span>
                            <span className="text-xl font-black text-slate-700">{calculateTotal(data[category] || [])}</span>
                        </div>
                    ))}
                    
                    {/* Total Dia Box */}
                    <div className="flex-shrink-0 snap-start bg-blue-50/80 border border-blue-100/80 rounded-xl px-4 py-2 min-w-[110px] flex flex-col items-center justify-center shadow-sm ring-1 ring-blue-200/50">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">TOTAL DIA</span>
                        <span className="text-xl font-black text-blue-800">{dailyTotal}</span>
                    </div>

                     {/* Soma Total Box */}
                    <div className="flex-shrink-0 snap-start bg-cyan-50/80 border border-cyan-100/80 rounded-xl px-4 py-2 min-w-[110px] flex flex-col items-center justify-center shadow-sm ring-1 ring-cyan-200/50">
                        <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider mb-1">SOMA TOTAL</span>
                        <span className="text-xl font-black text-cyan-800">{monthlyTotal}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

// --- MODALS (Updated to Milky Glass Theme) ---

const Modal = ({ children, onClose }: { children?: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
    <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/50 animate-slide-in-up" onClick={e => e.stopPropagation()}>
      <div className="p-4 max-h-[80vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1"><IconX className="w-5 h-5"/></button>
        {children}
      </div>
    </div>
    <div className="absolute inset-0 -z-10" onClick={onClose} />
  </div>
);

const CalendarModal = ({ currentDate, onClose, onDateSelect }: { currentDate: Date; onClose: () => void; onDateSelect: (d: Date) => void }) => {
    const [viewDate, setViewDate] = useState(currentDate);
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const startDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    
    const changeMonth = (delta: number) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));

    return (
        <Modal onClose={onClose}>
            <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-gray-700 mb-4">Selecionar Data</h3>
                <div className="flex justify-between items-center mb-4 px-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100"><IconChevronLeft className="w-5 h-5 text-gray-600"/></button>
                    <span className="font-bold text-gray-700 text-lg capitalize">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100"><IconChevronRight className="w-5 h-5 text-gray-600"/></button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="text-xs font-bold text-gray-400">{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const d = i + 1;
                        const isSelected = d === currentDate.getDate() && viewDate.getMonth() === currentDate.getMonth() && viewDate.getFullYear() === currentDate.getFullYear();
                        return (
                            <button 
                                key={d} 
                                onClick={() => onDateSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), d))}
                                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${isSelected ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-200' : 'hover:bg-gray-100 text-gray-600'}`}
                            >
                                {d}
                            </button>
                        );
                    })}
                </div>
            </div>
        </Modal>
    );
};

const DownloadModal = ({ data, date, onClose }: { data: DailyData; date: string; onClose: () => void }) => {
    const generateTextContent = () => {
        let text = `RELATÓRIO DE EQUIPAMENTOS - ${date}\n\n`;
        CATEGORIES.forEach(cat => {
            const items = data[cat] || [];
            if(items.length === 0) return;
            text += `--- ${cat} ---\n`;
            items.forEach(item => {
                if(isItemActive(item)) {
                     text += `QT: ${item.qt || '1'} | Contrato: ${item.contract} | Serial: ${item.serial}\n`;
                }
            });
            text += '\n';
        });
        return text;
    };

    const downloadFile = (type: 'word' | 'excel') => {
        let blob: Blob;
        let filename = `equipamentos_${date}`;
        
        if (type === 'word') {
            // HTML content for Word to preserve formatting better than plain text
            const content = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>Relatório</title></head>
                <body>
                <h1>Relatório de Equipamentos - ${date}</h1>
                ${CATEGORIES.map(cat => {
                    const items = data[cat] || [];
                    if (!items.some(isItemActive)) return '';
                    return `
                        <h3>${cat}</h3>
                        <ul>
                        ${items.filter(isItemActive).map(item => `<li><b>QT:</b> ${item.qt || '1'} | <b>Contrato:</b> ${item.contract} | <b>Serial:</b> ${item.serial}</li>`).join('')}
                        </ul>
                    `;
                }).join('')}
                </body></html>
            `;
            blob = new Blob(['\ufeff', content], { type: 'application/msword' });
            filename += '.doc';
        } else {
            // HTML Table for Excel
             const content = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head><meta charset="UTF-8"></head>
                <body>
                <table>
                    <thead>
                        <tr><th>Categoria</th><th>QT</th><th>Contrato</th><th>Serial</th></tr>
                    </thead>
                    <tbody>
                        ${CATEGORIES.flatMap(cat => (data[cat] || []).filter(isItemActive).map(item => `
                            <tr>
                                <td>${cat}</td>
                                <td>${item.qt || '1'}</td>
                                <td>${item.contract}</td>
                                <td>${item.serial}</td>
                            </tr>
                        `)).join('')}
                    </tbody>
                </table>
                </body></html>
            `;
            blob = new Blob(['\ufeff', content], { type: 'application/vnd.ms-excel' });
            filename += '.xls';
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Modal onClose={onClose}>
            <h3 className="text-xl font-bold text-center mb-6 text-gray-700">Salvar Manualmente</h3>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => downloadFile('word')} className="flex flex-col items-center justify-center p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
                    <IconFileWord className="w-12 h-12 text-blue-600 mb-2" />
                    <span className="font-bold text-blue-800">Word</span>
                </button>
                <button onClick={() => downloadFile('excel')} className="flex flex-col items-center justify-center p-4 bg-green-50 border border-green-100 rounded-xl hover:bg-green-100 transition-colors">
                    <IconFileExcel className="w-12 h-12 text-green-600 mb-2" />
                    <span className="font-bold text-green-800">Excel</span>
                </button>
            </div>
        </Modal>
    );
};

const ShareModal = ({ data, date, onClose, isSharingApp }: { data?: DailyData; date?: string; onClose: () => void, isSharingApp?: boolean }) => {
    const shareText = isSharingApp 
        ? "Confira o App Controle de Equipamentos! Organize seu dia a dia." 
        : `Confira os equipamentos do dia ${date}.`;

    const handleShare = (platform: 'whatsapp' | 'telegram' | 'email') => {
        let url = '';
        if (platform === 'whatsapp') url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        if (platform === 'telegram') url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareText)}`;
        if (platform === 'email') url = `mailto:?subject=${encodeURIComponent('Controle de Equipamentos')}&body=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank');
    };

    return (
        <Modal onClose={onClose}>
            <h3 className="text-xl font-bold text-center mb-6 text-gray-700">{isSharingApp ? 'Compartilhar App' : 'Exportar'}</h3>
             <div className="flex justify-around">
                <button onClick={() => handleShare('whatsapp')} className="flex flex-col items-center"><IconWhatsapp className="w-12 h-12 text-green-500 mb-1"/><span className="text-xs font-medium">WhatsApp</span></button>
                <button onClick={() => handleShare('telegram')} className="flex flex-col items-center"><IconTelegram className="w-12 h-12 text-blue-500 mb-1"/><span className="text-xs font-medium">Telegram</span></button>
                <button onClick={() => handleShare('email')} className="flex flex-col items-center"><IconEmail className="w-12 h-12 text-gray-500 mb-1"/><span className="text-xs font-medium">E-mail</span></button>
            </div>
        </Modal>
    );
};

const SettingsModal = ({ onClose, onClearData }: { onClose: () => void; onClearData: () => void }) => (
    <Modal onClose={onClose}>
        <h3 className="text-xl font-bold text-center mb-6 text-gray-700">Configurações</h3>
        <div className="space-y-3">
            <button onClick={onClearData} className="w-full p-3 bg-red-50 text-red-600 rounded-xl font-bold border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                <IconTrash className="w-5 h-5"/> Limpar Tudo
            </button>
             <p className="text-xs text-center text-gray-400 mt-4">Versão Beta v0.0.1b</p>
        </div>
    </Modal>
);

const AboutModal = ({ onClose, onShareClick }: { onClose: () => void; onShareClick: () => void }) => (
    <Modal onClose={onClose}>
         <div className="text-center">
            <CustomMenuIcon className="w-24 h-24 mx-auto mb-4 drop-shadow-xl" />
            <h2 className="text-2xl font-black text-gray-800 mb-1">Controle de Equipamentos</h2>
            <p className="text-sm font-mono text-cyan-600 bg-cyan-50 inline-block px-2 py-1 rounded mb-4">V0.0.1b</p>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left space-y-2 border border-gray-100">
                <p className="text-sm text-gray-600"><span className="font-bold text-gray-800">Dono:</span> Leo Luz</p>
                <p className="text-sm text-gray-600">App de gestão otimizado para mobile.</p>
            </div>

            <button onClick={onShareClick} className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95">
                Compartilhar App
            </button>
         </div>
    </Modal>
);

const ConfirmationModal = ({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-white/60 transform scale-100 animate-fade-in">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Confirmação</h3>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="flex justify-end gap-3">
                <button onClick={onCancel} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 shadow-md">Confirmar</button>
            </div>
        </div>
    </div>
);

const PhotoGalleryModal = ({ item, onClose, onUpdatePhotos, setConfirmation }: { item: EquipmentItem; onClose: () => void; onUpdatePhotos: (photos: string[]) => void; setConfirmation: any }) => {
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const photos = item.photos;

    if (photos.length === 0) return null;

    const handleDelete = () => {
        setConfirmation({
            message: "Excluir esta foto?",
            onConfirm: () => {
                const newPhotos = photos.filter((_, i) => i !== currentPhotoIndex);
                onUpdatePhotos(newPhotos);
                if (newPhotos.length === 0) onClose();
                else setCurrentPhotoIndex(prev => Math.min(prev, newPhotos.length - 1));
            }
        });
    };

    const handleShare = async () => {
        const base64 = photos[currentPhotoIndex];
        const blob = await (await fetch(base64)).blob();
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        if (navigator.share) {
            try { await navigator.share({ files: [file] }); } catch (e) { console.log(e); }
        } else {
            alert("Compartilhamento nativo não suportado.");
        }
    };
    
    const handleDownload = () => {
         const link = document.createElement("a");
         link.href = photos[currentPhotoIndex];
         link.download = `equipamento-${item.serial || 'foto'}-${currentPhotoIndex + 1}.jpg`;
         link.click();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col backdrop-blur-md">
            <div className="flex justify-between items-center p-4 text-white">
                <span className="font-mono text-sm opacity-70">{currentPhotoIndex + 1} / {photos.length}</span>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full"><IconX className="w-6 h-6"/></button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
                 <img src={photos[currentPhotoIndex]} alt="Equipment" className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
                 
                 {photos.length > 1 && (
                     <>
                        <button onClick={() => setCurrentPhotoIndex(i => (i > 0 ? i - 1 : photos.length - 1))} className="absolute left-4 p-2 bg-black/50 text-white rounded-full"><IconChevronLeft/></button>
                        <button onClick={() => setCurrentPhotoIndex(i => (i < photos.length - 1 ? i + 1 : 0))} className="absolute right-4 p-2 bg-black/50 text-white rounded-full"><IconChevronRight/></button>
                     </>
                 )}
            </div>

            <div className="p-6 bg-black/40 backdrop-blur-xl flex justify-around items-center pb-safe">
                <button onClick={handleDelete} className="flex flex-col items-center text-red-400 hover:text-red-300 gap-1"><IconTrash className="w-6 h-6"/><span className="text-xs">Excluir</span></button>
                <button onClick={handleDownload} className="flex flex-col items-center text-blue-400 hover:text-blue-300 gap-1"><IconSave className="w-6 h-6"/><span className="text-xs">Baixar</span></button>
                <button onClick={handleShare} className="flex flex-col items-center text-green-400 hover:text-green-300 gap-1"><IconShare className="w-6 h-6"/><span className="text-xs">Compartilhar</span></button>
            </div>
        </div>
    );
};

const CameraModal = ({ onClose, onCapture }: { onClose: () => void; onCapture: (photo: string, code?: string) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string|null>(null);

    useEffect(() => {
        let stream: MediaStream;
        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // Experimental Barcode Detection
                    if ('BarcodeDetector' in window) {
                        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
                        const detect = setInterval(async () => {
                             if (videoRef.current) {
                                 try {
                                     const barcodes = await barcodeDetector.detect(videoRef.current);
                                     if (barcodes.length > 0) {
                                         clearInterval(detect);
                                         // Flash effect or sound could go here
                                         onCapture('', barcodes[0].rawValue);
                                     }
                                 } catch(e) {}
                             }
                        }, 500);
                    }
                }
            } catch (e) {
                setError("Erro ao acessar a câmera. Verifique as permissões.");
            }
        };
        startCamera();
        return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
    }, []);

    const takePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            onCapture(canvas.toDataURL('image/jpeg'));
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                {error ? <p className="text-white p-4 text-center">{error}</p> : <video ref={videoRef} autoPlay playsInline className="absolute w-full h-full object-cover" />}
                 <div className="absolute inset-0 border-2 border-white/30 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-white/50 rounded-lg relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-cyan-400 -mt-1 -ml-1"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-cyan-400 -mt-1 -mr-1"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-cyan-400 -mb-1 -ml-1"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-cyan-400 -mb-1 -mr-1"></div>
                    </div>
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white"><IconX className="w-8 h-8"/></button>
            </div>
            <div className="p-8 bg-black/80 flex justify-center pb-safe">
                <button onClick={takePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 shadow-lg active:scale-95 transition-transform"></button>
            </div>
        </div>
    );
};

const SearchModal = ({ onClose, appData, onSelect }: { onClose: () => void; appData: AppData; onSelect: (res: any) => void }) => {
    const [query, setQuery] = useState('');
    const results = useMemo(() => {
        if (query.length < 2) return [];
        const res: any[] = [];
        const q = query.toLowerCase();
        Object.entries(appData).forEach(([date, dayData]) => {
            Object.entries(dayData).forEach(([cat, items]) => {
                (items as EquipmentItem[]).forEach(item => {
                    if (item.serial.toLowerCase().includes(q) || item.contract.toLowerCase().includes(q)) {
                        res.push({ date, category: cat, item });
                    }
                });
            });
        });
        return res.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [query, appData]);

    return (
        <Modal onClose={onClose}>
             <h3 className="text-xl font-bold text-gray-700 mb-4">Buscar Equipamento</h3>
             <div className="relative mb-4">
                 <IconSearch className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"/>
                 <input 
                    autoFocus
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-400 outline-none" 
                    placeholder="Digite Serial ou Contrato..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                 />
             </div>
             <div className="max-h-60 overflow-y-auto space-y-2">
                 {results.length === 0 && query.length > 1 && <p className="text-center text-gray-400 text-sm py-4">Nenhum resultado encontrado.</p>}
                 {results.map((res, idx) => (
                     <button key={idx} onClick={() => onSelect(res)} className="w-full text-left p-3 bg-white border border-gray-100 rounded-lg hover:bg-cyan-50 transition-colors shadow-sm">
                         <div className="flex justify-between items-center mb-1">
                             <span className="text-xs font-bold text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded">{res.category}</span>
                             <span className="text-xs text-gray-400">{res.date}</span>
                         </div>
                         <div className="text-sm text-gray-700">
                             <span className="font-semibold">S:</span> {res.item.serial} <span className="mx-1 text-gray-300">|</span> <span className="font-semibold">C:</span> {res.item.contract}
                         </div>
                     </button>
                 ))}
             </div>
        </Modal>
    );
};

export default App;
