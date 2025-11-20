
import React, { useState, useEffect, useCallback, useReducer, useRef, useMemo } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileWord, IconFileExcel, IconWhatsapp, IconTelegram, IconEmail 
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem } from './types';
import { CATEGORIES } from './constants';

const getFormattedDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Robust ID generator
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

// Reducer for complex state logic
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

const App = () => {
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

  useEffect(() => {
    if (!appData[formattedDate]) {
      dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } });
    }
  }, [appData, formattedDate]);


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

  const handleAddItem = () => {
    if (!activeCategory) return;
    const categoryItems = currentDayData[activeCategory] || [];
    const lastItem = categoryItems[categoryItems.length - 1];
    
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

  // Camera Modal Handlers
  const openCamera = (item: EquipmentItem) => {
      setCameraModalItem(item);
  }

  const handleCameraCapture = (photo: string, scannedCode?: string) => {
      if (!cameraModalItem) return;
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
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={handleOpenModal}/>
      
      <header className="sticky top-0 z-30 bg-gray-100/80 backdrop-blur-md shadow-lg p-3">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex-1 flex justify-start items-center gap-2">
            <button
                onClick={() => setIsMenuOpen(true)}
                className="active:scale-95 transition-transform"
                aria-label="Open menu"
                >
                <CustomMenuIcon className="w-12 h-12" />
            </button>
            <span className="text-lg font-bold text-cyan-900 hidden sm:block">C. Equipamentos</span>
          </div>
          
          <div className="flex-initial text-center px-4">
            <div className="text-2xl font-extrabold text-gray-700">
              {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>

          <div className="flex-1 flex justify-end">
            <div className="flex items-center bg-white rounded-full p-1 shadow-inner border border-gray-200 gap-1">
                <ActionButton onClick={handleAddItem}><IconPlus /></ActionButton>
                <ActionButton onClick={handleToggleDeleteMode} isDanger={isGlobalDeleteMode}><IconMinus /></ActionButton>
                {isGlobalDeleteMode && hasSelectedItems && (
                  <ActionButton onClick={handleConfirmGlobalDelete} isDanger={true}>
                    <IconTrash className="w-5 h-5" />
                  </ActionButton>
                )}
                <ActionButton onClick={handleUndo}><IconUndo /></ActionButton>
                <ActionButton onClick={handleSearchToggle}><IconSearch /></ActionButton>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 pb-32">
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

/* --- MODALS & COMPONENTS --- */

// Camera Modal with Live Preview & Basic Logic for Scanning
const CameraModal = ({ onClose, onCapture }: { onClose: () => void, onCapture: (photo: string, code?: string) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isScanning, setIsScanning] = useState(true);

    useEffect(() => {
        let stream: MediaStream;
        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                
                // Experimental Barcode Detection Logic
                // Note: BarcodeDetector is not available in all browsers, but works in many modern Android Chrome versions.
                if ('BarcodeDetector' in window) {
                     // @ts-ignore
                     const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
                     const scanInterval = setInterval(async () => {
                         if (videoRef.current && videoRef.current.readyState === 4) {
                             try {
                                 const barcodes = await barcodeDetector.detect(videoRef.current);
                                 if (barcodes.length > 0) {
                                     const code = barcodes[0].rawValue;
                                     // Capture photo automatically on scan
                                     takePhoto(code);
                                     clearInterval(scanInterval);
                                 }
                             } catch (e) { console.log("Detection failed", e); }
                         }
                     }, 500);
                     return () => clearInterval(scanInterval);
                }

            } catch (err) {
                console.error("Camera error:", err);
                alert("Não foi possível acessar a câmera.");
                onClose();
            }
        };
        startCamera();
        return () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    }, []);

    const takePhoto = (scannedCode?: string) => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            const photoData = canvas.toDataURL('image/jpeg');
            onCapture(photoData, scannedCode);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            <div className="absolute top-4 right-4 z-50">
                <button onClick={onClose} className="p-2 bg-white/20 rounded-full text-white"><IconX className="w-8 h-8"/></button>
            </div>
            <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="absolute min-w-full min-h-full object-cover" />
                {/* Scanner Overlay */}
                <div className="absolute inset-0 border-2 border-cyan-400/50 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-4 border-cyan-500 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.5)] relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 animate-[slideInUp_2s_infinite]"></div>
                    </div>
                </div>
                <div className="absolute bottom-10 w-full flex justify-center items-center gap-8">
                    <button 
                        onClick={() => takePhoto()} 
                        className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-lg active:scale-95 transition-transform flex items-center justify-center"
                    >
                        <div className="w-16 h-16 bg-gray-200 rounded-full border-2 border-gray-400"></div>
                    </button>
                </div>
                <div className="absolute top-10 bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-md">
                    Aponte para QR Code / Barras ou tire uma foto
                </div>
            </div>
        </div>
    )
}

type ConfirmationModalProps = { message: string; onConfirm: () => void; onCancel: () => void; };
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-blue-900/40 backdrop-blur-sm flex justify-center items-center z-[60] p-4 animate-fade-in" onClick={onCancel}>
        <div className="bg-blue-600/80 backdrop-blur-xl border border-blue-400/30 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-in-up text-white" onClick={e => e.stopPropagation()}>
            <p className="text-lg mb-6 text-center font-medium">{message}</p>
            <div className="flex justify-around items-center">
                <button onClick={onCancel} className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors">Cancelar</button>
                <button onClick={onConfirm} className="px-6 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-bold shadow-lg transition-colors">Confirmar</button>
            </div>
        </div>
    </div>
);


type ModalProps = { children?: React.ReactNode, onClose: () => void, title: string, size?: 'md' | 'lg' | 'xl' };
const Modal = ({ children, onClose, title, size = 'md' }: ModalProps) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div 
        className={`bg-blue-600/80 backdrop-blur-2xl border border-blue-400/30 rounded-2xl shadow-2xl w-full text-white ${
            size === 'md' ? 'max-w-md' : size === 'lg' ? 'max-w-lg' : 'max-w-4xl'
        } p-6 animate-slide-in-up`} 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold tracking-wide">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20"><IconX className="w-6 h-6"/></button>
        </div>
        {children}
      </div>
    </div>
);

type SearchResult = {
  date: string;
  category: EquipmentCategory;
  item: EquipmentItem;
}

type SearchModalProps = {
    onClose: () => void;
    appData: AppData;
    onSelect: (result: SearchResult) => void;
};

const SearchModal: React.FC<SearchModalProps> = ({ onClose, appData, onSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (query.trim().length < 2) {
                setResults([]);
                return;
            }
            const lowerCaseQuery = query.toLowerCase();
            const foundResults: SearchResult[] = [];
            Object.entries(appData).forEach(([date, dailyData]) => {
                Object.entries(dailyData).forEach(([category, items]) => {
                    items.forEach(item => {
                        const inContract = item.contract.toLowerCase().includes(lowerCaseQuery);
                        const inSerial = item.serial.toLowerCase().includes(lowerCaseQuery);
                        if (inContract || inSerial) {
                            foundResults.push({ date, category: category as EquipmentCategory, item });
                        }
                    });
                });
            });
            foundResults.sort((a, b) => b.date.localeCompare(a.date)); // Newest first
            setResults(foundResults);
        }, 300);

        return () => { clearTimeout(handler); };
    }, [query, appData]);

    return (
        <Modal onClose={onClose} title="Buscar Equipamento" size="lg">
            <div className="relative mb-4">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Digite o serial ou contrato..."
                    className="w-full p-3 pl-10 text-lg bg-white/10 border-2 border-white/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 text-white placeholder-white/50"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/70 pointer-events-none">
                    <IconSearch className="w-5 h-5" />
                </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {results.length > 0 ? (
                    <ul className="space-y-2">
                        {results.map(({ date, category, item }) => (
                            <li key={item.id} onClick={() => onSelect({ date, category, item })} className="p-3 bg-white/10 rounded-lg hover:bg-white/20 cursor-pointer transition-colors border border-white/10">
                                <div className="font-bold text-cyan-200">{new Date(date.replace(/-/g, '\/')).toLocaleDateString('pt-BR')} - <span className="text-white">{category}</span></div>
                                <div className="text-sm text-white/80">Contrato: {item.contract} / Serial: {item.serial}</div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    query.length > 1 && <p className="text-center text-white/60 p-4">Nenhum resultado encontrado.</p>
                )}
            </div>
        </Modal>
    );
};


type CalendarModalProps = { currentDate: Date, onClose: () => void, onDateSelect: (date: Date) => void };
const CalendarModal = ({ currentDate, onClose, onDateSelect }: CalendarModalProps) => {
    const [displayDate, setDisplayDate] = useState(new Date(currentDate));

    const changeMonth = (amount: number) => {
        setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
    };

    const daysInMonth = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(displayDate.getFullYear(), displayDate.getMonth(), 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

    const isSelected = (day: number) => {
        const d = new Date(displayDate.getFullYear(), displayDate.getMonth(), day);
        return d.toDateString() === currentDate.toDateString();
    }

    return (
        <Modal onClose={onClose} title="Selecionar Data">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-white/10 text-white"><IconChevronLeft /></button>
                <div className="text-xl font-semibold text-white">{displayDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</div>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-white/10 text-white"><IconChevronRight /></button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={`${d}-${i}`} className="font-bold text-cyan-300">{d}</div>)}
                {blanks.map(b => <div key={`blank-${b}`}></div>)}
                {days.map(day => (
                    <button 
                        key={day} 
                        onClick={() => onDateSelect(new Date(displayDate.getFullYear(), displayDate.getMonth(), day))}
                        className={`p-2 rounded-full transition-colors font-medium ${isSelected(day) ? 'bg-cyan-500 text-white shadow-md' : 'hover:bg-white/20 text-white'}`}
                    >
                        {day}
                    </button>
                ))}
            </div>
        </Modal>
    );
};

type DownloadModalProps = { data: DailyData, date: string, onClose: () => void };
const DownloadModal = ({ data, date, onClose }: DownloadModalProps) => {
    const generateContent = (type: 'doc' | 'xls'): [string, string] => {
        if (type === 'doc') {
            // Generate HTML content to trick Word into opening it as a document
            let content = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Relatório</title></head><body>
            <h1>Controle de Equipamentos - ${date}</h1>`;
            Object.entries(data).forEach(([category, items]) => {
                content += `<h2>${category}</h2><ul>`;
                const activeItems = items.filter(isItemActive);
                if (activeItems.length === 0) content += "<li>Nenhum item registrado.</li>";
                else activeItems.forEach(item => { content += `<li><strong>QT:</strong> ${item.qt || 1}, <strong>Contrato:</strong> ${item.contract}, <strong>Serial:</strong> ${item.serial}</li>`; });
                content += "</ul><br>";
            });
            content += "</body></html>";
            return [content, 'application/msword'];
        } else { // Excel (XLS via HTML table)
            let content = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"></head>
            <body><table><tr><th>Categoria</th><th>QT</th><th>Contrato</th><th>Serial</th></tr>`;
            Object.entries(data).forEach(([category, items]) => {
                 items.filter(isItemActive).forEach(item => {
                    content += `<tr><td>${category}</td><td>${item.qt || 1}</td><td>${item.contract}</td><td>${item.serial}</td></tr>`;
                });
            });
            content += "</table></body></html>";
            return [content, 'application/vnd.ms-excel'];
        }
    };
    
    const handleDownload = (type: 'doc' | 'xls') => {
        const [content, mimeType] = generateContent(type);
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Controle_Equipamentos_${date}.${type}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onClose();
    };

    return (
        <Modal onClose={onClose} title="Salvar Manualmente">
            <div className="flex justify-around items-center p-4 gap-4">
                <button onClick={() => handleDownload('doc')} className="flex flex-col items-center gap-2 p-6 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 w-full">
                    <IconFileWord className="text-blue-300 w-12 h-12" />
                    <span className="font-semibold text-white">Word</span>
                </button>
                <button onClick={() => handleDownload('xls')} className="flex flex-col items-center gap-2 p-6 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 w-full">
                    <IconFileExcel className="text-green-300 w-12 h-12" />
                    <span className="font-semibold text-white">Excel</span>
                </button>
            </div>
        </Modal>
    );
};

type ShareModalProps = { data?: DailyData, date?: string, onClose: () => void, isSharingApp?: boolean };
const ShareModal = ({ data, date, onClose, isSharingApp = false }: ShareModalProps) => {
    
    const getContent = () => {
        if (isSharingApp) {
            return {
                title: 'Controle de Equipamentos App',
                text: 'Confira este app para controle de equipamentos!',
                url: window.location.href
            };
        }
        let text = `Resumo de Equipamentos - ${date}\n\n`;
        Object.entries(data!).forEach(([category, items]) => { text += `${category}: ${items.filter(isItemActive).length} itens\n`; });
        return { title: 'Controle de Equipamentos', text };
    };

    const { title, text, url } = getContent();

    const share = (platform: 'whatsapp' | 'telegram' | 'email') => {
        const encodedText = encodeURIComponent(text + (url ? `\n${url}` : ''));
        let shareUrl = '';
        switch(platform) {
            case 'whatsapp': shareUrl = `https://api.whatsapp.com/send?text=${encodedText}`; break;
            case 'telegram': shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url || '')}&text=${encodedText}`; break;
            case 'email': shareUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}`; break;
        }
        window.open(shareUrl, '_blank');
        onClose();
    };

    return (
        <Modal onClose={onClose} title={isSharingApp ? "Compartilhar App" : "Exportar Dados"}>
            <div className="flex justify-around items-center p-4 gap-2">
                <button onClick={() => share('whatsapp')} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-white/10 transition-colors text-white">
                    <IconWhatsapp className="text-green-400 w-10 h-10" /><span>WhatsApp</span>
                </button>
                <button onClick={() => share('telegram')} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-white/10 transition-colors text-white">
                    <IconTelegram className="text-blue-400 w-10 h-10" /><span>Telegram</span>
                </button>
                <button onClick={() => share('email')} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-white/10 transition-colors text-white">
                    <IconEmail className="text-gray-300 w-10 h-10" /><span>Email</span>
                </button>
            </div>
        </Modal>
    );
};

type SettingsModalProps = { onClose: () => void, onClearData: () => void };
const SettingsModal = ({ onClose, onClearData }: SettingsModalProps) => {
    return (
        <Modal onClose={onClose} title="Configurações">
            <div className="p-2 space-y-4">
                <p className="text-white/80">Aqui você pode gerenciar as configurações do aplicativo.</p>
                <button onClick={onClearData} className="w-full text-left flex items-center gap-3 p-4 bg-red-500/40 hover:bg-red-500/60 border border-red-400 rounded-lg transition-colors text-white">
                    <IconTrash className="w-6 h-6" />
                    <span className='font-medium'>Limpar Todos os Dados Locais</span>
                </button>
            </div>
        </Modal>
    );
};

type AboutModalProps = { onClose: () => void, onShareClick: () => void };
const AboutModal = ({ onClose, onShareClick }: AboutModalProps) => {
    return (
        <Modal onClose={onClose} title="Sobre o App">
             <div className="flex flex-col items-start gap-4 p-3">
                <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl w-full border border-white/10">
                    <CustomMenuIcon className="w-16 h-16 drop-shadow-lg"/>
                    <div>
                        <h2 className="text-xl font-bold text-white">Controle de Equipamentos</h2>
                        <p className="text-cyan-300 font-mono">V0.0.1b</p>
                    </div>
                </div>
                
                <button onClick={onShareClick} className="flex items-center justify-center gap-3 p-4 rounded-lg bg-cyan-500/80 hover:bg-cyan-500 text-lg transition-all w-full text-white shadow-lg">
                    <IconShare className="w-6 h-6" />
                    <span>Compartilhar App</span>
                </button>
                <p className="text-white/50 ml-2 mt-4 text-sm">Dono: Leo Luz</p>
            </div>
        </Modal>
    );
};


type ActionButtonProps = { children?: React.ReactNode; onClick?: () => void; isPrimary?: boolean; isDanger?: boolean; };
const ActionButton = ({ children, onClick, isPrimary = false, isDanger = false }: ActionButtonProps) => (
    <button 
        onClick={onClick} 
        className={`p-2 rounded-full transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95 ${
            isPrimary ? 'bg-cyan-500 hover:bg-cyan-400 text-white' : 
            isDanger ? 'bg-red-500 hover:bg-red-400 text-white' :
            'hover:bg-gray-200 text-gray-600'
        }`}
    >
        {children}
    </button>
);

type EquipmentSectionProps = { 
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
};
const EquipmentSection: React.FC<EquipmentSectionProps> = ({ category, items, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isActive, onActivate, onOpenCamera }) => {
    return (
        <div className="mb-6" onClick={onActivate}>
            <h2 className="text-2xl font-bold text-cyan-600 mb-2 ml-2">{category}</h2>
            <section className={`p-3 bg-white/60 backdrop-blur-sm border-2 rounded-xl shadow-lg transition-all ${isActive ? 'border-cyan-500 shadow-xl' : 'border-blue-400/30'}`}>
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

type EquipmentRowProps = { item: EquipmentItem; onUpdate: (item: EquipmentItem) => void; isDeleteMode: boolean; isSelected: boolean; onToggleSelect: () => void; onViewGallery: () => void; onOpenCamera: () => void; };
const EquipmentRow: React.FC<EquipmentRowProps> = ({ item, onUpdate, isDeleteMode, isSelected, onToggleSelect, onViewGallery, onOpenCamera }) => {
    const handleChange = (field: keyof Omit<EquipmentItem, 'id'|'photos'>, value: string) => onUpdate({ ...item, [field]: value });
    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);
    
    return (
        <div className={`flex items-center gap-1 p-1 rounded-lg transition-all ${isSelected ? 'bg-red-500/20' : 'bg-gray-500/10'}`}>
            {isDeleteMode && isItemActive(item) && <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="form-checkbox h-5 w-5 rounded bg-gray-100 border-gray-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer mr-1 flex-shrink-0"/>}
            {isDeleteMode && !isItemActive(item) && <div className="w-5 mr-1 flex-shrink-0"></div>}
            
            {/* Flex container for input row - optimized for mobile space */}
            <div className="flex flex-1 items-center gap-0.5 min-w-0">
                {/* QT Field: Compact fixed width */}
                <div className="w-9 flex-shrink-0">
                     <InputWithLabel 
                        placeholder="QT" 
                        type="number"
                        value={item.qt} 
                        onChange={e => {
                            const val = e.target.value;
                            if (val === '' || (/^\d{1,2}$/.test(val) && parseInt(val, 10) < 100)) {
                               handleChange('qt', val);
                            }
                        }} 
                        containerClassName="px-0.5"
                    />
                </div>

                {/* Contract & Serial: Distributed flex space. Serial gets more. */}
                <div className="flex-1 flex gap-0.5 min-w-0">
                     {/* Contrato: 35% of remaining space */}
                     <div className="flex-[35] min-w-0">
                        <InputWithLabel placeholder="Contrato" value={item.contract} onChange={e => handleChange('contract', e.target.value)} maxLength={10} onCopy={() => copyToClipboard(item.contract)} />
                     </div>
                     {/* Serial: 65% of remaining space to fit 20 digits */}
                     <div className="flex-[65] min-w-0">
                        <InputWithLabel placeholder="Serial" value={item.serial} onChange={e => handleChange('serial', e.target.value)} maxLength={20} onCopy={() => copyToClipboard(item.serial)} />
                     </div>
                </div>

                {/* Buttons: Extremely Tightly packed for mobile */}
                <div className="flex-shrink-0 flex items-center justify-center gap-0.5 ml-0.5">
                    <button onClick={onOpenCamera} className="p-1 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors active:scale-95 text-gray-700"><IconCamera className="w-4 h-4"/></button>
                    <button onClick={onViewGallery} className="relative p-1 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700" disabled={item.photos.length === 0}>
                        <IconGallery className="w-4 h-4"/>
                        {item.photos.length > 0 && <span className="absolute -top-1 -right-1 flex justify-center items-center w-3 h-3 text-[9px] font-bold text-white bg-cyan-500 rounded-full shadow-sm">{item.photos.length}</span>}
                    </button>
                </div>
            </div>
        </div>
    );
};
type InputWithLabelProps = React.InputHTMLAttributes<HTMLInputElement> & { onCopy?: () => void; containerClassName?: string; };
const InputWithLabel = ({ onCopy, containerClassName, ...rest }: InputWithLabelProps) => (
    <div className={`relative w-full ${containerClassName || ''}`}>
        <input {...rest} className="w-full bg-white border border-gray-300 rounded-md py-1.5 pl-1 pr-4 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-colors placeholder-gray-400 text-gray-800 text-sm font-medium truncate"/>
        {onCopy && <button onClick={onCopy} className="absolute inset-y-0 right-0 flex items-center pr-0.5 text-gray-400 hover:text-cyan-600 active:scale-90 transition-all"><IconClipboard className="w-3 h-3"/></button>}
    </div>
);

type PhotoGalleryModalProps = { 
    item: EquipmentItem, 
    onClose: () => void, 
    onUpdatePhotos: (photos: string[]) => void, 
    setConfirmation: React.Dispatch<React.SetStateAction<{ message: string; onConfirm: () => void; } | null>> 
};

const PhotoGalleryModal = ({ item, onClose, onUpdatePhotos, setConfirmation }: PhotoGalleryModalProps) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const deleteCurrentImage = () => {
        setConfirmation({
            message: "Tem certeza que deseja apagar esta foto?",
            onConfirm: () => {
                const newPhotos = item.photos.filter((_, index) => index !== currentIndex);
                onUpdatePhotos(newPhotos);
                if (currentIndex >= newPhotos.length && newPhotos.length > 0) setCurrentIndex(newPhotos.length - 1);
                else if (newPhotos.length === 0) onClose();
            }
        });
    }
    
    const handleSharePhoto = async () => {
        const base64Photo = item.photos[currentIndex];
        if (!base64Photo) return;

        try {
            const res = await fetch(base64Photo);
            const blob = await res.blob();
            const file = new File([blob], "equipment-photo.jpg", { type: "image/jpeg" });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Foto de Equipamento (${item.serial || 'N/A'})`,
                    text: `Foto do equipamento com serial: ${item.serial}`,
                });
            } else {
                alert('O compartilhamento de arquivos não é suportado neste navegador.');
            }
        } catch (error) {
            console.error('Erro ao compartilhar foto:', error);
            alert('Ocorreu um erro ao tentar compartilhar a foto.');
        }
    };
    
    if (item.photos.length === 0) return null;
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col justify-center items-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-blue-600/20 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-4 flex flex-col animate-slide-in-up text-white" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 z-20"><IconX className="w-6 h-6"/></button>
                <div className="relative flex-grow h-[60vh] flex justify-center items-center mb-4 bg-black/40 rounded-lg overflow-hidden">
                    <img src={item.photos[currentIndex]} alt={`Equipment Photo ${currentIndex + 1}`} className="max-h-full max-w-full object-contain" />
                     <div className="absolute top-4 left-4 flex gap-3 z-10">
                        <button onClick={deleteCurrentImage} className="p-3 bg-red-600/80 rounded-full hover:bg-red-500 active:scale-95 transition-all shadow-lg"><IconTrash className="w-5 h-5"/></button>
                        {navigator.share && <button onClick={handleSharePhoto} className="p-3 bg-cyan-600/80 rounded-full hover:bg-cyan-500 active:scale-95 transition-all shadow-lg"><IconShare className="w-5 h-5"/></button>}
                     </div>
                </div>
                <div className="flex-shrink-0 h-24 overflow-x-auto custom-scrollbar"><div className="flex items-center justify-center gap-3 p-2">{item.photos.map((photo, index) => <img key={index} src={photo} alt={`Thumbnail ${index + 1}`} onClick={() => setCurrentIndex(index)} className={`w-20 h-20 object-cover rounded-lg cursor-pointer border-2 transition-all ${currentIndex === index ? 'border-cyan-400 scale-105 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}/>)}</div></div>
            </div>
        </div>
    )
}

type SummaryFooterProps = { data: DailyData, allData: AppData, currentDate: string };
const SummaryFooter = ({ data, allData, currentDate }: SummaryFooterProps) => {
    const calculateCategoryTotal = (catData: EquipmentItem[]) => {
        return catData.reduce((sum, item) => {
            if (isItemActive(item)) {
                const quantity = parseInt(item.qt, 10);
                return sum + (isNaN(quantity) || quantity <= 0 ? 1 : quantity);
            }
            return sum;
        }, 0);
    };

    const dayGrandTotal = useMemo(() => {
        return CATEGORIES.reduce((sum, cat) => sum + calculateCategoryTotal(data[cat] || []), 0);
    }, [data]);

    const monthTotal = useMemo(() => {
        const currentMonthPrefix = currentDate.substring(0, 7); // YYYY-MM
        let total = 0;
        Object.keys(allData).forEach(dateKey => {
            if (dateKey.startsWith(currentMonthPrefix)) {
                 CATEGORIES.forEach(cat => {
                     total += calculateCategoryTotal(allData[dateKey][cat] || []);
                 });
            }
        });
        return total;
    }, [allData, currentDate]);

    return (
        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-blue-600/95 backdrop-blur-xl border-t border-white/20 text-white overflow-x-auto hide-scrollbar">
            <div className="container mx-auto flex items-center min-w-max p-2 gap-2">
                {CATEGORIES.map(cat => {
                    const dayTotal = calculateCategoryTotal(data[cat] || []);
                    return (
                         <div key={cat} className="flex flex-col items-center bg-white/10 px-3 py-1 rounded-lg min-w-[80px] border border-white/5">
                            <span className="text-[10px] uppercase tracking-wider text-blue-100 font-semibold truncate max-w-[80px]">{cat}</span>
                            <div className="flex gap-1 text-xs items-baseline">
                                <span className="text-white/60">Dia:</span>
                                <span className="text-lg font-bold">{dayTotal}</span>
                            </div>
                        </div>
                    );
                })}
                
                <div className="w-px h-10 bg-white/20 mx-2"></div>

                {/* Total do Dia Box */}
                <div className="flex flex-col items-center bg-blue-500/40 px-4 py-1 rounded-lg border border-blue-300/30 shadow-lg">
                    <span className="text-[10px] uppercase tracking-wider text-blue-100 font-bold">TOTAL DIA</span>
                    <span className="text-xl font-extrabold text-white">{dayGrandTotal}</span>
                </div>

                {/* Soma Total Box */}
                <div className="flex flex-col items-center bg-cyan-500/20 px-4 py-1 rounded-lg border border-cyan-400/30 shadow-lg">
                    <span className="text-[10px] uppercase tracking-wider text-cyan-200 font-bold">SOMA TOTAL</span>
                    <span className="text-xl font-extrabold text-white">{monthTotal}</span>
                </div>
            </div>
        </footer>
    );
};

export default App;
