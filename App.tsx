
import React, { useState, useEffect, useReducer, useRef, useMemo } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileWord, IconFileExcel, IconWhatsapp, IconTelegram, IconEmail 
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
  children: React.ReactNode;
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
    // Updated Background: Glossy White Gradient
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50 to-slate-100 text-gray-800 font-sans pb-32">
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={handleOpenModal}/>
      
      {/* Header: Milky Glass Theme */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl shadow-sm border-b border-white/60 pt-3 pb-2 px-4">
        <div className="container mx-auto">
            <div className="flex justify-between items-center mb-2">
                {/* Menu Icon */}
                <button
                    onClick={() => setIsMenuOpen(true)}
                    className="active:scale-95 transition-transform"
                    aria-label="Open menu"
                >
                    <CustomMenuIcon className="w-14 h-14 drop-shadow-md" />
                </button>

                {/* Action Buttons: Recessed Light Box for Depth */}
                <div className="flex items-center gap-0.5 bg-slate-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] p-1.5 rounded-2xl border border-white">
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
                <div className="inline-block px-6 py-1 rounded-full bg-white/50 border border-white/60 backdrop-blur-md shadow-sm">
                    <div className="text-lg font-extrabold text-gray-600 tracking-tight">
                        {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                </div>
            </div>
        </div>
      </header>

      <main className="container mx-auto p-3">
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
            isPrimary ? 'bg-cyan-500 border-cyan-600 text-white hover:bg-cyan-400' : 
            isDanger ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100 active:bg-red-200' :
            'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
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
        <div className="mb-6" onClick={onActivate}>
            <h2 className="text-xl font-bold text-gray-500 uppercase tracking-widest drop-shadow-sm mb-2 ml-2">{category}</h2>
            <section className={`p-2 bg-white/60 backdrop-blur-lg border border-white/80 rounded-xl shadow-sm transition-all ${isActive ? 'ring-2 ring-white/60' : ''}`}>
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
        <div className={`flex items-center gap-1 p-1 rounded-lg transition-all ${isSelected ? 'bg-red-500/10' : 'bg-white/40'}`}>
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
                    <button onClick={onOpenCamera} className="w-7 h-7 flex items-center justify-center bg-white/80 hover:bg-white rounded-md active:scale-95 text-gray-600 shadow-sm border border-gray-200"><IconCamera className="w-4 h-4"/></button>
                    <button onClick={onViewGallery} className="relative w-7 h-7 flex items-center justify-center bg-white/80 hover:bg-white rounded-md active:scale-95 disabled:opacity-50 text-gray-600 shadow-sm border border-gray-200" disabled={item.photos.length === 0}>
                        <IconGallery className="w-4 h-4"/>
                        {item.photos.length > 0 && <span className="absolute -top-1 -right-1 flex justify-center items-center w-3 h-3 text-[9px] font-bold text-white bg-cyan-500 rounded-full shadow-sm">{item.photos.length}</span>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Input: Zero padding + Centered text to ensure no hidden characters on mobile
const InputWithLabel = ({ onCopy, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { onCopy?: () => void }) => (
    <div className="relative w-full h-full">
        <input {...rest} className="w-full h-9 bg-white/80 border border-gray-200 rounded-md py-0 px-0 text-center focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-colors placeholder-gray-400 text-gray-700 text-sm font-medium truncate shadow-sm"/>
        {onCopy && <button onClick={onCopy} className="absolute inset-y-0 right-0 flex items-center pr-0.5 text-gray-400 hover:text-cyan-600 active:scale-90 transition-all"><IconClipboard className="w-3 h-3"/></button>}
    </div>
);

// --- MODAL COMPONENTS (White/Milky Glass Theme) ---

const Modal = ({ children, onClose, title, size = 'md' }: { children?: React.ReactNode, onClose: () => void, title: string, size?: string }) => (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className={`bg-white/95 backdrop-blur-2xl border border-white rounded-2xl shadow-2xl w-full ${size === 'lg' ? 'max-w-lg' : 'max-w-md'} p-6 animate-slide-in-up text-gray-800`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
          <h2 className="text-xl font-bold text-gray-700">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"><IconX className="w-5 h-5"/></button>
        </div>
        {children}
      </div>
    </div>
);

const ConfirmationModal = ({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) => (
    <div className="fixed inset-0 bg-slate-500/20 backdrop-blur-sm flex justify-center items-center z-[60] p-4" onClick={onCancel}>
        <div className="bg-white/95 backdrop-blur-2xl border border-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-in-up" onClick={e => e.stopPropagation()}>
            <p className="text-lg mb-6 text-center font-medium text-gray-700">{message}</p>
            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 font-bold">Cancelar</button>
                <button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-cyan-500 text-white font-bold shadow-md">Confirmar</button>
            </div>
        </div>
    </div>
);

const CameraModal = ({ onClose, onCapture }: { onClose: () => void, onCapture: (photo: string, code?: string) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
        let stream: MediaStream;
        const start = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (videoRef.current) videoRef.current.srcObject = stream;
                
                if ('BarcodeDetector' in window) {
                     // @ts-ignore
                     const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
                     const interval = setInterval(async () => {
                         if (videoRef.current && videoRef.current.readyState === 4) {
                             try {
                                 const barcodes = await barcodeDetector.detect(videoRef.current);
                                 if (barcodes.length > 0) {
                                     capture(barcodes[0].rawValue);
                                     clearInterval(interval);
                                 }
                             } catch {}
                         }
                     }, 500);
                     return () => clearInterval(interval);
                }
            } catch (e) { console.error(e); onClose(); }
        };
        start();
        return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
    }, []);

    const capture = (code?: string) => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            onCapture(canvas.toDataURL('image/jpeg'), code);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-white/20 rounded-full text-white"><IconX className="w-8 h-8"/></button>
            <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover" />
            <div className="absolute bottom-10 w-full flex justify-center">
                <button onClick={() => capture()} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-lg flex items-center justify-center"><div className="w-16 h-16 bg-gray-200 rounded-full border-2 border-gray-400"></div></button>
            </div>
        </div>
    )
}

const PhotoGalleryModal = ({ item, onClose, onUpdatePhotos, setConfirmation }: { item: EquipmentItem, onClose: () => void, onUpdatePhotos: (p: string[]) => void, setConfirmation: any }) => {
    const [idx, setIdx] = useState(0);
    const deletePhoto = () => setConfirmation({ message: "Apagar foto?", onConfirm: () => {
        const newPhotos = item.photos.filter((_, i) => i !== idx);
        onUpdatePhotos(newPhotos);
        if (newPhotos.length === 0) onClose();
        else if (idx >= newPhotos.length) setIdx(newPhotos.length - 1);
    }});
    
    const share = async () => {
        try {
            const res = await fetch(item.photos[idx]);
            const blob = await res.blob();
            const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
            if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file] });
        } catch {}
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col p-4" onClick={onClose}>
            <div className="relative flex-1 flex justify-center items-center bg-black rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <img src={item.photos[idx]} className="max-w-full max-h-full object-contain"/>
                <div className="absolute top-4 left-4 flex gap-4">
                    <button onClick={deletePhoto} className="p-3 bg-red-600 rounded-full text-white"><IconTrash className="w-6 h-6"/></button>
                    <button onClick={share} className="p-3 bg-blue-600 rounded-full text-white"><IconShare className="w-6 h-6"/></button>
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 p-3 bg-gray-700 rounded-full text-white"><IconX className="w-6 h-6"/></button>
            </div>
            <div className="h-24 mt-4 flex gap-2 overflow-x-auto" onClick={e => e.stopPropagation()}>
                {item.photos.map((src, i) => <img key={i} src={src} onClick={() => setIdx(i)} className={`h-full rounded border-2 ${i===idx?'border-cyan-500':'border-transparent opacity-50'}`}/>)}
            </div>
        </div>
    )
}

const DownloadModal = ({ data, date, onClose }: { data: DailyData, date: string, onClose: () => void }) => {
    const download = (type: 'doc' | 'xls') => {
        let mime = type === 'doc' ? 'application/msword' : 'application/vnd.ms-excel';
        let ext = type;
        let content = `<html><head><meta charset='utf-8'></head><body>`;
        
        if (type === 'doc') {
             content += `<h1>Relatório - ${date}</h1>`;
             Object.entries(data).forEach(([cat, items]) => {
                 content += `<h2>${cat}</h2><ul>${items.filter(isItemActive).map(i => `<li>QT:${i.qt||1} | CT:${i.contract} | SN:${i.serial}</li>`).join('')}</ul>`;
             });
        } else {
             content += `<table border='1'><tr><th>CAT</th><th>QT</th><th>CT</th><th>SN</th></tr>`;
             Object.entries(data).forEach(([cat, items]) => {
                 items.filter(isItemActive).forEach(i => content += `<tr><td>${cat}</td><td>${i.qt||1}</td><td>${i.contract}</td><td>${i.serial}</td></tr>`);
             });
             content += `</table>`;
        }
        content += `</body></html>`;
        
        const blob = new Blob(['\ufeff', content], { type: mime });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Relatorio_${date}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onClose();
    };

    return (
        <Modal onClose={onClose} title="Salvar">
            <div className="flex gap-4 justify-center">
                <button onClick={() => download('doc')} className="flex flex-col items-center p-4 bg-blue-50 rounded-xl w-24"><IconFileWord className="w-10 h-10 text-blue-600"/><span>Word</span></button>
                <button onClick={() => download('xls')} className="flex flex-col items-center p-4 bg-green-50 rounded-xl w-24"><IconFileExcel className="w-10 h-10 text-green-600"/><span>Excel</span></button>
            </div>
        </Modal>
    );
};

const ShareModal = ({ data, date, onClose, isSharingApp }: { data?: DailyData, date?: string, onClose: () => void, isSharingApp?: boolean }) => {
    const share = (platform: string) => {
        const text = isSharingApp ? "Baixe o App Controle de Equipamentos!" : `Resumo ${date}: ${Object.keys(data!).length} categorias.`;
        const url = window.location.href;
        let link = '';
        if(platform === 'wa') link = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`;
        if(platform === 'tg') link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        if(platform === 'em') link = `mailto:?subject=App&body=${encodeURIComponent(text + ' ' + url)}`;
        window.open(link, '_blank');
        onClose();
    };
    return (
        <Modal onClose={onClose} title="Compartilhar">
            <div className="flex gap-2 justify-around">
                <button onClick={() => share('wa')} className="p-4 bg-green-50 rounded-lg"><IconWhatsapp className="w-8 h-8 text-green-600"/></button>
                <button onClick={() => share('tg')} className="p-4 bg-blue-50 rounded-lg"><IconTelegram className="w-8 h-8 text-blue-500"/></button>
                <button onClick={() => share('em')} className="p-4 bg-yellow-50 rounded-lg"><IconEmail className="w-8 h-8 text-yellow-600"/></button>
            </div>
        </Modal>
    );
};

const SearchModal = ({ onClose, appData, onSelect }: { onClose: () => void, appData: AppData, onSelect: (r: any) => void }) => {
    const [q, setQ] = useState('');
    const results = useMemo(() => {
        if(q.length < 2) return [];
        const res: any[] = [];
        Object.entries(appData).forEach(([d, day]) => Object.entries(day).forEach(([c, items]) => {
            // @ts-ignore
            items.forEach(i => { if(i.serial.includes(q) || i.contract.includes(q)) res.push({ date: d, category: c, item: i }); });
        }));
        return res.reverse();
    }, [q, appData]);

    return (
        <Modal onClose={onClose} title="Buscar" size="lg">
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Digite..." className="w-full p-3 border rounded-lg mb-4"/>
            <ul className="max-h-60 overflow-y-auto space-y-2">
                {results.map((r, i) => (
                    <li key={i} onClick={() => onSelect(r)} className="p-2 border rounded hover:bg-gray-50 cursor-pointer">
                        <div className="font-bold">{r.date} - {r.category}</div>
                        <div className="text-sm">{r.item.serial}</div>
                    </li>
                ))}
            </ul>
        </Modal>
    );
};

const CalendarModal = ({ currentDate, onClose, onDateSelect }: { currentDate: Date, onClose: () => void, onDateSelect: (d: Date) => void }) => {
    const [viewDate, setViewDate] = useState(new Date(currentDate));
    const days = Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1);
    
    return (
        <Modal onClose={onClose} title="Calendário">
             <div className="flex justify-between mb-4">
                 <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth()-1)))}><IconChevronLeft/></button>
                 <span className="font-bold">{viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                 <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth()+1)))}><IconChevronRight/></button>
             </div>
             <div className="grid grid-cols-7 gap-2">
                 {days.map(d => (
                     <button key={d} onClick={() => onDateSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), d))} 
                     className={`p-2 rounded-full ${d === currentDate.getDate() && viewDate.getMonth() === currentDate.getMonth() ? 'bg-cyan-500 text-white' : 'hover:bg-gray-100'}`}>{d}</button>
                 ))}
             </div>
        </Modal>
    )
}

const SettingsModal = ({ onClose, onClearData }: { onClose: () => void, onClearData: () => void }) => (
    <Modal onClose={onClose} title="Configurações">
        <button onClick={onClearData} className="w-full p-4 bg-red-50 text-red-600 rounded-lg flex gap-2 items-center"><IconTrash className="w-6 h-6"/> Limpar Dados</button>
    </Modal>
);

const AboutModal = ({ onClose, onShareClick }: { onClose: () => void, onShareClick: () => void }) => (
    <Modal onClose={onClose} title="Sobre">
        <div className="text-center p-4">
            <CustomMenuIcon className="w-20 h-20 mx-auto mb-2"/>
            <h2 className="text-xl font-bold">Controle de Equipamentos</h2>
            <p className="text-cyan-600">V0.0.1b</p>
            <button onClick={onShareClick} className="mt-4 w-full p-3 bg-cyan-500 text-white rounded-lg">Compartilhar App</button>
            <p className="mt-4 text-xs text-gray-400">Dono: Leo Luz</p>
        </div>
    </Modal>
);

const SummaryFooter = ({ data, allData, currentDate }: { data: DailyData, allData: AppData, currentDate: string }) => {
    const calc = (items: EquipmentItem[]) => items.reduce((acc, i) => acc + (isItemActive(i) ? (parseInt(i.qt)||1) : 0), 0);
    const dayTotal = CATEGORIES.reduce((sum, c) => sum + calc(data[c]||[]), 0);
    const monthTotal = Object.keys(allData).filter(k => k.startsWith(currentDate.slice(0,7))).reduce((sum, k) => sum + CATEGORIES.reduce((s, c) => s + calc(allData[k][c]||[]), 0), 0);

    return (
        <footer className="fixed bottom-0 w-full bg-white/80 backdrop-blur-xl border-t border-white/50 shadow-lg z-30 overflow-x-auto hide-scrollbar">
            <div className="flex p-2 gap-2 min-w-max">
                {CATEGORIES.map(c => (
                    <div key={c} className="flex flex-col items-center bg-white/60 border border-white/60 rounded px-2 py-1 min-w-[70px]">
                        <span className="text-[9px] font-bold text-gray-500 uppercase truncate w-full text-center">{c}</span>
                        <span className="font-bold text-gray-800">{calc(data[c]||[])}</span>
                    </div>
                ))}
                <div className="w-px bg-gray-300 mx-1"/>
                <div className="flex flex-col items-center bg-blue-50/80 border border-blue-100 rounded px-3 min-w-[80px]">
                    <span className="text-[9px] font-bold text-blue-600">DIA</span>
                    <span className="font-bold text-blue-800">{dayTotal}</span>
                </div>
                <div className="flex flex-col items-center bg-green-50/80 border border-green-100 rounded px-3 min-w-[80px]">
                    <span className="text-[9px] font-bold text-green-600">TOTAL</span>
                    <span className="font-bold text-green-800">{monthTotal}</span>
                </div>
            </div>
        </footer>
    );
};

export default App;
