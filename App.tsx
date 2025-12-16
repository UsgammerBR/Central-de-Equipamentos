import React, { useState, useEffect, useReducer, useRef, useMemo, ReactNode, Component } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, LoadingBoxIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileWord, IconFileExcel, IconWhatsapp, IconTelegram, IconEmail, IconSave, IconStack, IconChevronDown, IconBell, IconQrCode, IconBarcode, IconCameraLens, IconMapPin, IconDownload, IconSettings, IconExport, IconCalendar, IconInfo
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem, AppNotification, UserProfile } from './types';
import { CATEGORIES } from './constants';
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5Qrcode } from "html5-qrcode";

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
  | { type: 'DELETE_SINGLE_ITEM'; payload: { date: string; category: EquipmentCategory; itemId: string } }
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
            const newItem: EquipmentItem = { id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() };
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
        case 'CLEAR_ALL_DATA': return {};
        default: return state;
    }
}

const isItemActive = (item: EquipmentItem): boolean => {
    return (item.contract && item.contract.trim() !== '') || (item.serial && item.serial.trim() !== '') || item.photos.length > 0;
};

// --- ERROR BOUNDARY ---

interface ErrorBoundaryProps { children?: ReactNode; }
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

// --- LOADING SCREEN ---
const LoadingScreen = () => (
    <div className="fixed inset-0 z-[100] bg-slate-100 flex items-center justify-center flex-col animate-fade-in">
        <LoadingBoxIcon className="w-64 h-64 drop-shadow-2xl" />
        <p className="mt-4 text-cyan-600 font-bold animate-pulse tracking-widest text-xs">INICIANDO SISTEMA...</p>
    </div>
);

// --- MAIN APP ---

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appData, dispatch] = useReducer(dataReducer, {});
  const [history, setHistory] = useState<AppData[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [galleryItem, setGalleryItem] = useState<EquipmentItem | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  const [historyVisibleCategories, setHistoryVisibleCategories] = useState<EquipmentCategory[]>([]);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [duplicateAlert, setDuplicateAlert] = useState<{ foundValue: string; type: string; onConfirm: () => void; onCancel: () => void; } | null>(null);
  
  const [cameraModalItem, setCameraModalItem] = useState<EquipmentItem | null>(null);
  const [isGlobalDeleteMode, setIsGlobalDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '' });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [popupNotification, setPopupNotification] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const formattedDate = getFormattedDate(currentDate);

  // Simulated Loading
  useEffect(() => {
      const timer = setTimeout(() => setIsLoading(false), 2500);
      return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkHash = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#data=')) {
            try {
                const b64 = hash.replace('#data=', '');
                const json = atob(b64);
                const sharedData = JSON.parse(json);
                if (sharedData && typeof sharedData === 'object') {
                    dispatch({ type: 'SET_DATA', payload: sharedData });
                    setIsReadOnly(true);
                    addNotification('info', 'Você está visualizando uma cópia compartilhada dos dados. Modo Somente Leitura.');
                    window.history.pushState("", document.title, window.location.pathname);
                }
            } catch (e) {
                console.error("Shared data parse error", e);
                addNotification('error', 'Link de dados inválido ou corrompido.');
            }
        }
    }
    checkHash();
  }, []);

  useEffect(() => {
      window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          setInstallPrompt(e);
      });
  }, []);

  const addNotification = (type: 'info' | 'error' | 'success' | 'request', message: string, actionLabel?: string, onAction?: () => void) => {
    const newNotif: AppNotification = {
        id: generateId(),
        type, message, timestamp: Date.now(), read: false, actionLabel, onAction
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const dispatchWithHistory = (action: Action) => {
    if (isReadOnly) {
        setShowAccessDenied(true);
        return;
    }
    setHistory(prev => [appData, ...prev].slice(0, 10)); 
    dispatch(action);
  };

  useEffect(() => {
    const savedData = localStorage.getItem('equipmentData');
    if (savedData && !isReadOnly) dispatch({ type: 'SET_DATA', payload: JSON.parse(savedData) });
    
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));
  }, []);

  useEffect(() => {
    if (!appData[formattedDate]) {
      dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } });
    }
  }, [appData, formattedDate]);

  useEffect(() => {
    if (!isRestoring && !isReadOnly) localStorage.setItem('equipmentData', JSON.stringify(appData));
  }, [appData, isRestoring, isReadOnly]);

  const saveProfile = (p: UserProfile) => {
      setUserProfile(p);
      localStorage.setItem('userProfile', JSON.stringify(p));
  };

  const handleRequestAlteration = () => {
      setShowAccessDenied(false);
      setPopupNotification("Solicitação enviada ao dono do App");
      setTimeout(() => {
          setPopupNotification(null);
          addNotification('request', `Solicitação de alteração recebida de Convidado.`, 'Permitir', () => {
              setIsReadOnly(false);
              addNotification('success', 'Modo de edição habilitado.');
          });
      }, 5000);
  };

  const currentDayData: DailyData = appData[formattedDate] || createEmptyDailyData();

  // Duplicate Logic
  const checkDuplicate = (type: 'contract' | 'serial', value: string, currentId: string) => {
      if (!value || value.length < 3) return false;
      
      let isDuplicate = false;
      // Iterate through all dates in appData
      for (const dateKey in appData) {
          const day = appData[dateKey];
          for (const catKey in day) {
              const items = day[catKey as EquipmentCategory];
              for (const item of items) {
                  if (item.id !== currentId) { // ignore self
                      if ((type === 'contract' && item.contract === value) || (type === 'serial' && item.serial === value)) {
                          isDuplicate = true;
                          break;
                      }
                  }
              }
              if(isDuplicate) break;
          }
          if(isDuplicate) break;
      }
      return isDuplicate;
  };

  const handleGlobalAdd = () => {
      if (isReadOnly) { setShowAccessDenied(true); return; }
      
      let addedAny = false;
      CATEGORIES.forEach(cat => {
          const items = currentDayData[cat] || [];
          const lastItem = items[items.length - 1];
          if (lastItem && (lastItem.contract || lastItem.serial || lastItem.photos.length > 0)) {
              dispatchWithHistory({ type: 'ADD_ITEM', payload: { date: formattedDate, category: cat } });
              addedAny = true;
          }
      });

      if (addedAny) {
          addNotification('success', 'Nova linha adicionada.');
      }
  };

  const handleDeleteSingleItem = (category: EquipmentCategory, itemId: string) => {
      if (isReadOnly) { setShowAccessDenied(true); return; }
      dispatchWithHistory({ type: 'DELETE_SINGLE_ITEM', payload: { date: formattedDate, category, itemId } });
  };

  const handleUpdateItem = (category: EquipmentCategory, item: EquipmentItem, checkField?: 'contract' | 'serial') => {
      if (isReadOnly) { setShowAccessDenied(true); return; }
      
      if (checkField) {
          const value = checkField === 'contract' ? item.contract : item.serial;
          if (checkDuplicate(checkField, value, item.id)) {
             setDuplicateAlert({
                 foundValue: value,
                 type: checkField === 'contract' ? 'Contrato' : 'Serial',
                 onConfirm: () => {
                     // User clicked Sim (Green) - Keep the value
                     dispatchWithHistory({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } });
                     setDuplicateAlert(null);
                 },
                 onCancel: () => {
                     // User clicked Nao (Red) - Clear the field
                     const clearedItem = { ...item, [checkField]: '' };
                     dispatchWithHistory({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item: clearedItem } });
                     setDuplicateAlert(null);
                 }
             });
             return; 
          }
      }

      dispatchWithHistory({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } });
  };

  const handleUndo = () => {
    if (isReadOnly) { setShowAccessDenied(true); return; }
    if (history.length > 0) {
      const previousState = history[0];
      setHistory(history.slice(1));
      setIsRestoring(true);
      dispatch({ type: 'SET_DATA', payload: previousState });
    }
  }

  const handleToggleDeleteMode = () => {
    if (isReadOnly) { setShowAccessDenied(true); return; }
    setIsGlobalDeleteMode(prev => !prev);
    setSelectedItems({}); 
  };

  const handleConfirmGlobalDelete = () => {
      if (isReadOnly) { setShowAccessDenied(true); return; }
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

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleHistoryVisibility = (cat: EquipmentCategory) => {
      setHistoryVisibleCategories(prev => 
        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
      );
  };

  const handleInstallApp = () => {
      if (installPrompt) {
          installPrompt.prompt();
          installPrompt.userChoice.then((choice: any) => {
             // Handle choice
          });
      }
  };

  if (isLoading) return <LoadingScreen />;

  return (
    // FIX: CHANGED BACKGROUND TO LIGHTER/COLORFUL GRADIENT
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] via-[#e0f2fe] to-[#cbd5e1] text-slate-800 font-sans pb-32">
       {/* MENU OVERLAY */}
       {isMenuOpen && <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={(modal) => { setActiveModal(modal); setIsMenuOpen(false); }} />}
      
      {/* GLOBAL HEADER */}
      <header className="sticky top-0 z-30 bg-white/40 backdrop-blur-xl py-2 px-4 shadow-sm border-b border-white/30 flex flex-col gap-2">
        <div className="flex items-center justify-between w-full">
            <div className="flex-shrink-0 z-20">
                {/* 3D Button Style - Large Size */}
                <div className="active:scale-95 transition-transform cursor-pointer drop-shadow-[0_12px_24px_rgba(0,0,0,0.25)]" onClick={() => setIsMenuOpen(true)}>
                     <CustomMenuIcon className="w-16 h-16" />
                </div>
            </div>

            <div className="flex items-center gap-2 z-20">
                {/* SMALLER BUTTONS w-8 h-8 - NOW WHITE WITH COLORED ICONS */}
                <ActionButton onClick={handleGlobalAdd} disabled={isReadOnly}><IconPlus className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={handleToggleDeleteMode} isDanger={isGlobalDeleteMode} disabled={isReadOnly}><IconMinus className="w-4 h-4" /></ActionButton>
                {isGlobalDeleteMode && Object.values(selectedItems).reduce<number>((acc, items: string[]) => acc + items.length, 0) > 0 && (
                <ActionButton onClick={handleConfirmGlobalDelete} isDanger={true} disabled={isReadOnly}><IconTrash className="w-4 h-4" /></ActionButton>
                )}
                <ActionButton onClick={handleUndo} disabled={isReadOnly}><IconUndo className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={() => setIsSearchActive(!isSearchActive)}><IconSearch className="w-4 h-4" /></ActionButton>
                <div className="relative">
                    <ActionButton onClick={() => setActiveModal('notifications')}><IconBell className="w-4 h-4" /></ActionButton>
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
                </div>
            </div>
        </div>

        <div className="flex flex-col items-center justify-center w-full animate-fade-in -mt-1 pb-1">
            {userProfile.name && (
                <div className="w-full text-center px-4 mb-2 mt-2">
                    <h1 className="text-2xl font-sans font-black text-slate-800 tracking-tighter uppercase truncate max-w-[90%] mx-auto drop-shadow-sm">
                        {userProfile.name}
                    </h1>
                </div>
            )}
            <button onClick={() => setActiveModal('calendar')} className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-white/70 border border-white/50 backdrop-blur-md shadow-sm active:scale-95 transition-transform hover:bg-white/90 mx-auto mb-1">
                <span className="text-base font-extrabold text-cyan-800 tracking-tight">
                    {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
                <IconChevronDown className="w-4 h-4 text-cyan-600"/>
            </button>
        </div>
      </header>

      <main className="container mx-auto p-3 space-y-5 mt-2">
        {CATEGORIES.map(category => (
            <EquipmentSection 
                key={`${formattedDate}-${category}`} 
                category={category} 
                allCategoryItems={currentDayData[category] || []}
                onUpdateItem={(item: EquipmentItem, checkField?: 'contract' | 'serial') => handleUpdateItem(category, item, checkField)}
                onViewGallery={(item: EquipmentItem) => setGalleryItem(item)}
                isDeleteMode={isGlobalDeleteMode}
                selectedItems={selectedItems[category] || []}
                onToggleSelect={(id: string) => setSelectedItems(prev => ({ ...prev, [category]: prev[category]?.includes(id) ? prev[category].filter(i => i !== id) : [...(prev[category]||[]), id] }))}
                isHistoryVisible={historyVisibleCategories.includes(category)}
                onToggleHistory={() => toggleHistoryVisibility(category)}
                onOpenCamera={(item: EquipmentItem) => {
                    if(isReadOnly) setShowAccessDenied(true);
                    else setCameraModalItem(item);
                }}
                isReadOnly={isReadOnly}
                onTriggerReadOnly={() => setShowAccessDenied(true)}
            />
        ))}
      </main>

      <SummaryFooter data={currentDayData} allData={appData} currentDate={formattedDate} />
            
      {galleryItem && <PhotoGalleryModal item={galleryItem} isReadOnly={isReadOnly} onClose={() => setGalleryItem(null)} onUpdatePhotos={(photos: string[]) => {
        const cat = Object.keys(currentDayData).find(k => currentDayData[k as EquipmentCategory].some(i => i.id === galleryItem.id)) as EquipmentCategory;
        if(cat) {
            const updated = { ...galleryItem, photos };
            handleUpdateItem(cat, updated);
            setGalleryItem(updated);
        }
      }} setConfirmation={setConfirmation} />}
      
      {cameraModalItem && <CameraModal 
            onClose={() => setCameraModalItem(null)} 
            onCapture={(code: string | null, photo?: string) => {
                let duplicateFound = false;
                if (code) {
                    const cat = Object.keys(currentDayData).find(k => currentDayData[k as EquipmentCategory].some(i => i.id === cameraModalItem.id)) as EquipmentCategory;
                    if (cat) {
                        // Check Duplicate before scanning
                        if (checkDuplicate('serial', code, cameraModalItem.id)) {
                             duplicateFound = true;
                             setDuplicateAlert({
                                 foundValue: code,
                                 type: 'Serial',
                                 onConfirm: () => {
                                     const updated = { ...cameraModalItem, serial: code };
                                     handleUpdateItem(cat, updated);
                                     addNotification('success', 'Código capturado (Duplicado Aceito).');
                                     setDuplicateAlert(null);
                                 },
                                 onCancel: () => {
                                     setDuplicateAlert(null);
                                 }
                             });
                        } else {
                            const updated = { ...cameraModalItem, serial: code };
                            handleUpdateItem(cat, updated);
                            addNotification('success', 'Código capturado com sucesso.');
                        }
                    }
                }
                
                if (!duplicateFound) {
                     // Only process photo if no duplicate modal is blocking, or if photo logic is separate
                     if (photo) {
                        const cat = Object.keys(currentDayData).find(k => currentDayData[k as EquipmentCategory].some(i => i.id === cameraModalItem.id)) as EquipmentCategory;
                        if(cat) {
                            const updated = { ...cameraModalItem, photos: [...cameraModalItem.photos, photo] };
                            handleUpdateItem(cat, updated);
                        }
                    }
                }
                
                setCameraModalItem(null);
            }} 
            addNotification={addNotification}
      />}

      {activeModal === 'calendar' && <CalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={(d: Date) => { setCurrentDate(d); setActiveModal(null); }}/>}
      {activeModal === 'save' && <DownloadModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'export' && <ShareModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} isExportMode={true} />}
      {activeModal === 'settings' && <SettingsModal 
            userProfile={userProfile} 
            onSaveProfile={saveProfile} 
            onClose={() => setActiveModal(null)} 
            installPrompt={installPrompt}
            onClearData={() => setConfirmation({ message: "Apagar tudo permanentemente?", onConfirm: () => { dispatchWithHistory({ type: 'CLEAR_ALL_DATA' }); setActiveModal(null); } })}
      />}
      {activeModal === 'about' && <AboutModal userProfile={userProfile} onClose={() => setActiveModal(null)} onShareClick={() => setActiveModal('shareApp')} onShareDataClick={() => setActiveModal('shareData')} />}
      {activeModal === 'shareApp' && <ShareModal appData={appData} currentDate={currentDate} isSharingApp onClose={() => setActiveModal(null)} />}
      {activeModal === 'shareData' && <ShareModal appData={appData} currentDate={currentDate} isSharingData onClose={() => setActiveModal(null)} />}
      {activeModal === 'notifications' && <NotificationsModal notifications={notifications} onClose={() => {
          setActiveModal(null);
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }} />}
      
      {isSearchActive && <SearchModal onClose={() => setIsSearchActive(false)} appData={appData} onSelect={(res: any) => { 
          const [y, m, d] = res.date.split('-'); 
          setCurrentDate(new Date(y, m-1, d)); 
          setIsSearchActive(false); 
      }} onGallery={(item: EquipmentItem) => setGalleryItem(item)} />}
      
      {confirmation && <ConfirmationModal message={confirmation.message} onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} onCancel={() => setConfirmation(null)} />}
      
      {duplicateAlert && (
          <ModalOverlay onClose={duplicateAlert.onCancel}>
               <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 mx-auto flex items-center justify-center mb-4">
                        <IconBell className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Atenção: Duplicidade</h3>
                    <p className="text-slate-600 mb-4 font-medium">
                        Este {duplicateAlert.type} <strong>{duplicateAlert.foundValue}</strong> já foi usado anteriormente.
                    </p>
                    <p className="text-sm text-slate-500 mb-6">Deseja usar novamente?</p>
                    
                    <div className="flex gap-3">
                        <button onClick={duplicateAlert.onCancel} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold shadow-lg active:scale-95 transition-all">Não</button>
                        <button onClick={duplicateAlert.onConfirm} className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold shadow-lg active:scale-95 transition-all">Sim</button>
                    </div>
               </div>
          </ModalOverlay>
      )}

      {showAccessDenied && (
          <AccessDeniedModal onClose={() => setShowAccessDenied(false)} onRequest={handleRequestAlteration} />
      )}

      {popupNotification && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-800/90 backdrop-blur-md text-white px-6 py-4 rounded-xl shadow-2xl z-[80] animate-fade-in flex items-center gap-3">
              <IconBell className="w-6 h-6 text-yellow-400" />
              <span className="font-bold">{popupNotification}</span>
          </div>
      )}
    </div>
  );
};

const App = () => (<ErrorBoundary><AppContent /></ErrorBoundary>)
export default App;

// --- COMPONENTS ---

// FIX: BUTTON STYLE CHANGED TO WHITE BG AND COLORED ICONS
const ActionButton = ({ children, onClick, isPrimary, isDanger, disabled }: any) => (
    <button 
        onClick={onClick} 
        disabled={disabled}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm border ${
            disabled ? 'opacity-50 cursor-not-allowed bg-slate-200 border-transparent' :
            isPrimary ? 'bg-cyan-600 text-white border-transparent hover:bg-cyan-500' : 
            isDanger ? 'bg-red-50 text-red-500 border-red-100' :
            'bg-white text-cyan-700 border-cyan-100 hover:bg-cyan-50'
        }`}
    >
        {children}
    </button>
);

const EquipmentSection = ({ category, allCategoryItems, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isHistoryVisible, onToggleHistory, onOpenCamera, isReadOnly, onTriggerReadOnly }: any) => {
    const itemsToDisplay = isHistoryVisible ? allCategoryItems : allCategoryItems.slice(-1);
    const copyToClipboard = (text: string) => { if(text) navigator.clipboard.writeText(text); };

    return (
        <div className="relative">
             <div 
                className={`w-full p-4 rounded-xl flex items-center justify-between transition-all duration-300 shadow-md relative overflow-hidden border border-white/50 
                    ${isHistoryVisible 
                        ? 'bg-gradient-to-br from-indigo-500/90 via-blue-500/90 to-cyan-500/90 text-white scale-[1.02] backdrop-blur-md' 
                        : 'bg-white/80 text-slate-700 hover:bg-white backdrop-blur-sm'
                    }`}
            >
                <button onClick={onToggleHistory} className="flex items-center gap-3 relative z-10 flex-1 text-left focus:outline-none w-full active:scale-95 transition-transform">
                    <span className="font-extrabold text-lg tracking-wide uppercase">{category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isHistoryVisible ? 'bg-white/20' : 'bg-slate-200/50'}`}>
                        {allCategoryItems.filter(isItemActive).length}
                    </span>
                    <div className="ml-auto">
                        {isHistoryVisible ? <IconChevronDown className="w-5 h-5 opacity-60"/> : <IconChevronRight className="w-5 h-5 opacity-60"/>}
                    </div>
                </button>
            </div>

            <div className="mt-3 grid gap-3 animate-slide-in-up">
                {itemsToDisplay.map((item: EquipmentItem) => (
                    // TRANSPARENT ITEM BACKGROUND WITH SHADOW
                    <div key={item.id} className={`relative p-2 bg-white/40 backdrop-blur-sm rounded-2xl shadow-lg flex items-center border border-white/30 ${isDeleteMode ? 'pl-10' : ''}`}>
                        {isDeleteMode && (
                            <div className="absolute left-3 z-10">
                                <input 
                                    type="checkbox" 
                                    checked={selectedItems.includes(item.id)}
                                    onChange={() => onToggleSelect(item.id)}
                                    disabled={isReadOnly}
                                    className="w-5 h-5 rounded text-cyan-600 focus:ring-cyan-500"
                                />
                            </div>
                        )}
                        
                        <div className="flex items-center gap-2 w-full overflow-hidden">
                            <div className="relative w-24 shrink-0">
                                <input 
                                    type="number" 
                                    placeholder="CONTRATO" 
                                    value={item.contract}
                                    readOnly={isReadOnly}
                                    onClick={isReadOnly ? onTriggerReadOnly : undefined}
                                    onChange={(e) => onUpdateItem({ ...item, contract: e.target.value })}
                                    onBlur={() => onUpdateItem(item, 'contract')} 
                                    className="w-full bg-white/80 rounded-lg py-3 pl-1 pr-6 text-center font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all shadow-inner text-xs border-none"
                                />
                                {item.contract && item.contract.toString().length > 0 && (
                                    <button onClick={() => copyToClipboard(item.contract)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-cyan-600 z-20 active:scale-90">
                                        <IconClipboard className="w-3.5 h-3.5"/>
                                    </button>
                                )}
                            </div>

                            <div className="relative flex-1 min-w-0">
                                    <input 
                                    type="text" 
                                    placeholder="SERIAL" 
                                    value={item.serial}
                                    readOnly={isReadOnly}
                                    onClick={isReadOnly ? onTriggerReadOnly : undefined}
                                    onChange={(e) => onUpdateItem({ ...item, serial: e.target.value })}
                                    onBlur={() => onUpdateItem(item, 'serial')}
                                    className="w-full bg-white/80 rounded-lg py-3 pl-1 pr-6 text-center font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all shadow-inner text-xs border-none"
                                />
                                    {item.serial && item.serial.length > 0 && (
                                    <button onClick={() => copyToClipboard(item.serial)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-cyan-600 z-20 active:scale-90">
                                        <IconClipboard className="w-3.5 h-3.5"/>
                                    </button>
                                    )}
                            </div>

                            <div className="flex gap-2 shrink-0">
                                <button 
                                    onClick={() => onOpenCamera(item)}
                                    // CAMERA BUTTON COLOR: Slate-800 (matching text)
                                    className="bg-slate-800 text-white p-2 rounded-lg shadow-md hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center w-10 h-10 border-none"
                                >
                                    <IconCamera className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => onViewGallery(item)}
                                    className={`p-2 rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center w-10 h-10 border-none ${
                                        item.photos.length > 0 
                                        ? 'bg-slate-600 text-white hover:bg-slate-500' 
                                        : 'bg-white text-slate-400 hover:bg-slate-50'
                                    }`}
                                >
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

const SummaryFooter = ({ data, allData, currentDate }: any) => {
    // Calculate category counts ensuring all CATEGORIES (including CHIP) are present
    const categoryCounts: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
        categoryCounts[cat] = (data[cat] || []).filter(isItemActive).length;
    });

    const totalToday = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    const [year, month] = currentDate.split('-');
    
    // Monthly total calculation logic
    const monthlyTotal = Object.entries(allData).reduce((sum: number, [date, dayData]: [string, any]) => {
        if (date.startsWith(`${year}-${month}`)) {
            return sum + Object.values(dayData as DailyData).flat().filter(isItemActive).length;
        }
        return sum;
    }, 0);

    const items = [
        ...CATEGORIES.map(cat => ({ label: cat, value: categoryCounts[cat], color: 'text-slate-700' })),
        { label: 'Total Dia', value: totalToday, color: 'text-blue-600' },
        { label: 'Soma Total', value: monthlyTotal, color: 'text-purple-600' }
    ];

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-white/40 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-20 pb-safe">
            <div className="flex items-center px-4 py-3 gap-6 overflow-x-auto hide-scrollbar">
                {items.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center min-w-[60px] flex-shrink-0 active:scale-95 transition-transform cursor-pointer">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 whitespace-nowrap">{item.label}</span>
                        <span className={`text-xl font-black ${item.color}`}>{item.value}</span>
                    </div>
                ))}
            </div>
        </footer>
    );
};

// --- MODALS ---

const ModalOverlay = ({ onClose, children }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-sm p-6 border border-white/50 animate-pop-in overflow-hidden max-h-[90vh] overflow-y-auto">
            {children}
        </div>
    </div>
);

const AccessDeniedModal = ({ onClose, onRequest }: { onClose: () => void, onRequest: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-red-500/10 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-sm p-8 border border-red-500/30 animate-pop-in flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                <IconBell className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-red-600 mb-2">Acesso Negado</h2>
            <p className="text-slate-600 mb-6 font-medium">Para alterar dados, solicite permissão ao dono do app.</p>
            <button onClick={onRequest} className="w-full py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg hover:bg-red-700 active:scale-95 transition-all">Solicitar Alteração</button>
        </div>
    </div>
);

const SettingsModal = ({ userProfile, onSaveProfile, onClose, onClearData, installPrompt }: any) => {
    const [name, setName] = useState(userProfile.name);
    const [cpf, setCpf] = useState(userProfile.cpf || '');

    const handleSave = () => { onSaveProfile({ name, cpf }); onClose(); };

    return (
        <ModalOverlay onClose={onClose}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><IconSettings className="w-6 h-6"/> Configurações</h2>
                <button onClick={onClose}><IconX className="w-6 h-6 text-slate-400 active:scale-95" /></button>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Usuário</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu Nome" className="w-full bg-slate-100 rounded-xl p-3 text-left border-none focus:ring-2 focus:ring-cyan-500"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF (Opcional)</label>
                    <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className="w-full bg-slate-100 rounded-xl p-3 text-left border-none focus:ring-2 focus:ring-cyan-500"/>
                </div>
                <div className="pt-4 space-y-3">
                    <button onClick={handleSave} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg active:scale-95 transition-transform">Confirmar</button>
                    {installPrompt && (
                        <button onClick={() => installPrompt.prompt()} className="w-full py-3 rounded-xl bg-cyan-600 text-white font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                            <IconDownload className="w-5 h-5" /> Instalar App
                        </button>
                    )}
                    <button onClick={onClearData} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-bold border border-red-100 active:scale-95 transition-transform">Limpar Todos os Dados</button>
                </div>
            </div>
        </ModalOverlay>
    );
};

const AboutModal = ({ userProfile, onClose, onShareClick, onShareDataClick }: any) => (
  <ModalOverlay onClose={onClose}>
    <div className="text-center space-y-6">
        <CustomMenuIcon className="w-32 h-32 mx-auto drop-shadow-2xl" />
        <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Controle</h2>
            <p className="text-slate-500 font-medium">de Equipamentos</p>
            <p className="text-xs text-slate-400 mt-1">v1.0.0</p>
             <p className="text-lg font-sans font-bold text-slate-800 mt-2">Dono: Leo Luz</p>
        </div>
        {(userProfile.name || userProfile.cpf) && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Proprietário</p>
                {userProfile.name && <p className="font-bold text-slate-700 text-lg">{userProfile.name}</p>}
                {userProfile.cpf && <p className="text-sm text-slate-500 font-mono mt-1">{userProfile.cpf}</p>}
            </div>
        )}
        <div className="grid gap-3">
             <button onClick={onShareClick} className="w-full py-3 rounded-xl bg-cyan-50 text-cyan-600 font-bold border border-cyan-100 active:scale-95 flex items-center justify-center gap-2">
                <IconShare className="w-5 h-5" /> Compartilhar App
            </button>
            <button onClick={onShareDataClick} className="w-full py-3 rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-100 active:scale-95 flex items-center justify-center gap-2">
                <IconClipboard className="w-5 h-5" /> Compartilhar com Dados
            </button>
        </div>
    </div>
  </ModalOverlay>
);

const ShareModal = ({ appData, currentDate, isSharingApp, isSharingData, isExportMode, onClose }: any) => {
    // Generate the share link if sharing data
    const shareUrl = useMemo(() => {
        let url = window.location.origin + window.location.pathname;
        if (isSharingData) {
            const safeData = JSON.parse(JSON.stringify(appData));
            Object.keys(safeData).forEach(date => {
                Object.keys(safeData[date]).forEach(cat => {
                    safeData[date][cat].forEach((item: any) => item.photos = []);
                });
            });
            const b64 = btoa(JSON.stringify(safeData));
            url += `#data=${b64}`;
        }
        return url;
    }, [appData, isSharingData]);

    const title = "Controle de Equipamentos";
    const text = isSharingData ? "Estou compartilhando meus dados de equipamentos com você." : "Confira este app para gerenciar equipamentos.";

    // Simple Copy Link Function
    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        alert("Link copiado!");
        onClose();
    };

    if (isExportMode) {
         const handleExport = (scope: 'day' | 'month') => {
            let itemsToExport: any[] = [];
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth();
            const dateStr = getFormattedDate(currentDate);

            Object.entries(appData).forEach(([dKey, dayData]: [string, any]) => {
                const dObj = new Date(dKey);
                const isSameMonth = dObj.getFullYear() === currentYear && dObj.getMonth() === currentMonth;
                const isSameDay = dKey === dateStr;

                if ((scope === 'day' && isSameDay) || (scope === 'month' && isSameMonth)) {
                    CATEGORIES.forEach(cat => {
                        (dayData[cat] || []).forEach((item: EquipmentItem) => {
                            if (isItemActive(item)) {
                                itemsToExport.push({ ...item, date: dKey, category: cat });
                            }
                        });
                    });
                }
            });

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Data,Hora,Categoria,Contrato,Serial\n";
            itemsToExport.forEach(i => {
                const time = i.createdAt ? new Date(i.createdAt).toLocaleTimeString() : '00:00:00';
                csvContent += `${i.date},${time},${i.category},${i.contract},${i.serial}\n`;
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            const filename = `relatorio_${scope}_${dateStr}.csv`;
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            onClose();
        };

        return (
            <ModalOverlay onClose={onClose}>
                 <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-50 mx-auto flex items-center justify-center mb-4">
                        <IconExport className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Exportar Relatório</h3>
                    <div className="space-y-3">
                        <button onClick={() => handleExport('day')} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95"><IconFileExcel className="w-5 h-5"/> Exportar Dia (Excel)</button>
                        <button onClick={() => handleExport('month')} className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95"><IconFileExcel className="w-5 h-5"/> Exportar Mês (Excel)</button>
                    </div>
                </div>
            </ModalOverlay>
        );
    }

    return (
        <ModalOverlay onClose={onClose}>
            <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-cyan-50 mx-auto flex items-center justify-center mb-4">
                    <IconShare className="w-8 h-8 text-cyan-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                    {isSharingData ? 'Compartilhar Dados' : 'Compartilhar App'}
                </h3>
                <p className="text-slate-500 mb-6 text-sm">
                    {isSharingData 
                        ? 'Envie os registros atuais para alguém.' 
                        : 'Envie o link para instalação.'}
                </p>
                
                {/* Social Share Buttons for BOTH App and Data Sharing */}
                <div className="flex gap-4 mb-6 justify-center">
                    <a href={`https://wa.me/?text=${encodeURIComponent(text + ' ' + shareUrl)}`} target="_blank" rel="noreferrer" className="p-4 bg-green-100 rounded-full text-green-600 hover:scale-110 transition shadow-sm active:scale-95"><IconWhatsapp className="w-6 h-6"/></a>
                    <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="p-4 bg-blue-100 rounded-full text-blue-500 hover:scale-110 transition shadow-sm active:scale-95"><IconTelegram className="w-6 h-6"/></a>
                    <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + shareUrl)}`} className="p-4 bg-slate-100 rounded-full text-slate-600 hover:scale-110 transition shadow-sm active:scale-95"><IconEmail className="w-6 h-6"/></a>
                </div>

                <button onClick={handleCopyLink} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg hover:bg-slate-700 transition-colors active:scale-95">
                    Copiar Link
                </button>
            </div>
        </ModalOverlay>
    );
};

// --- OTHER MODALS ---

const NotificationsModal = ({ notifications, onClose }: any) => (
    <ModalOverlay onClose={onClose}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><IconBell className="w-5 h-5"/> Notificações</h2>
            <button onClick={onClose}><IconX className="w-5 h-5 text-slate-400 active:scale-95"/></button>
        </div>
        <div className="max-h-80 overflow-y-auto space-y-3 -mx-2 px-2">
            {notifications.length === 0 ? <p className="text-center text-slate-400 py-4">Nenhuma notificação.</p> : 
            notifications.map((n: AppNotification) => (
                <div key={n.id} className={`p-3 rounded-xl border ${n.type === 'request' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${n.type === 'error' ? 'bg-red-100 text-red-600' : n.type === 'success' ? 'bg-green-100 text-green-600' : n.type === 'request' ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{n.type}</span>
                        <span className="text-[10px] text-slate-400">{new Date(n.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">{n.message}</p>
                    {n.actionLabel && n.onAction && (
                        <button onClick={() => { n.onAction!(); onClose(); }} className="mt-2 text-xs font-bold text-blue-600 hover:underline active:scale-95">{n.actionLabel}</button>
                    )}
                </div>
            ))}
        </div>
    </ModalOverlay>
);

const CalendarModal = ({ currentDate, onClose, onDateSelect }: any) => {
    const [viewDate, setViewDate] = useState(new Date(currentDate));
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay, year, month };
    };
    const { days, firstDay, year, month } = getDaysInMonth(viewDate);
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const changeMonth = (offset: number) => setViewDate(new Date(year, month + offset, 1));

    return (
        <ModalOverlay onClose={onClose}>
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-100 rounded-full active:scale-95"><IconChevronLeft className="w-5 h-5"/></button>
                <h3 className="text-lg font-bold text-slate-800">{monthNames[month]} {year}</h3>
                <button onClick={() => changeMonth(1)} className="p-2 bg-slate-100 rounded-full active:scale-95"><IconChevronRight className="w-5 h-5"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="text-xs font-bold text-slate-400">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                    const d = i + 1;
                    const isSelected = d === currentDate.getDate() && month === currentDate.getMonth() && year === currentDate.getFullYear();
                    return (
                        <button key={d} onClick={() => onDateSelect(new Date(year, month, d))} className={`p-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${isSelected ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-200'}`}>{d}</button>
                    )
                })}
            </div>
        </ModalOverlay>
    );
};

const DownloadModal = ({ appData, currentDate, onClose }: any) => {
    const handleDownload = () => {
        const json = JSON.stringify(appData);
        const blob = new Blob([json], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `backup_equipamentos_${getFormattedDate(currentDate)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onClose();
    };
    return (
        <ModalOverlay onClose={onClose}>
            <div className="text-center">
                <IconSave className="w-12 h-12 mx-auto text-slate-400 mb-4"/>
                <h3 className="text-lg font-bold mb-2">Backup Manual</h3>
                <button onClick={handleDownload} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold active:scale-95">Baixar JSON</button>
            </div>
        </ModalOverlay>
    );
};

const SearchModal = ({ onClose, appData, onSelect, onGallery }: any) => {
    const [term, setTerm] = useState('');
    const results = useMemo(() => {
        if (!term) return [];
        const res: any[] = [];
        Object.entries(appData).forEach(([date, dayData]: [string, any]) => {
            CATEGORIES.forEach(cat => {
                dayData[cat].forEach((item: EquipmentItem) => {
                    if ((item.serial.toLowerCase().includes(term.toLowerCase()) || item.contract.toLowerCase().includes(term.toLowerCase())) && isItemActive(item)) {
                        res.push({ date, category: cat, item });
                    }
                });
            });
        });
        return res;
    }, [term, appData]);
    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);
    return (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-xl p-4 flex flex-col animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 bg-slate-100 rounded-xl flex items-center px-4 py-3 border border-slate-200">
                    <IconSearch className="w-5 h-5 text-slate-400 mr-2"/>
                    <input autoFocus value={term} onChange={e => setTerm(e.target.value)} placeholder="Buscar contrato ou serial..." className="bg-transparent w-full outline-none font-medium"/>
                </div>
                <button onClick={onClose} className="p-3 bg-slate-200 rounded-xl font-bold text-slate-600 active:scale-95">Fechar</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
                {results.map((r, i) => (
                    <div key={i} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between mb-2">
                             <div className="flex items-center gap-2">
                                <span onClick={() => onSelect(r)} className="text-xs font-bold bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded cursor-pointer hover:bg-cyan-200">{r.date}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{r.item.createdAt ? new Date(r.item.createdAt).toLocaleTimeString() : ''}</span>
                             </div>
                            <span className="text-xs font-bold text-slate-400">{r.category}</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="text-xs font-bold text-slate-500 w-16">CONTRATO</span>
                                <span onClick={() => onSelect(r)} className="font-mono text-sm font-semibold text-slate-700 flex-1 cursor-pointer">{r.item.contract}</span>
                                <button onClick={() => copyToClipboard(r.item.contract)}><IconClipboard className="w-4 h-4 text-slate-400 hover:text-cyan-600 active:scale-95"/></button>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="text-xs font-bold text-slate-500 w-16">SERIAL</span>
                                <span onClick={() => onSelect(r)} className="font-mono text-sm font-semibold text-slate-700 flex-1 cursor-pointer">{r.item.serial}</span>
                                <button onClick={() => copyToClipboard(r.item.serial)}><IconClipboard className="w-4 h-4 text-slate-400 hover:text-cyan-600 active:scale-95"/></button>
                            </div>
                        </div>
                        {r.item.photos.length > 0 && (
                             <button onClick={() => onGallery(r.item)} className="mt-2 w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-100 active:scale-95"><IconGallery className="w-4 h-4"/> Ver Foto</button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ConfirmationModal = ({ message, onConfirm, onCancel }: any) => (
    <ModalOverlay onClose={onCancel}>
        <div className="text-center">
            <h3 className="text-lg font-bold text-slate-800 mb-6">{message}</h3>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-100 font-bold text-slate-600 active:scale-95">Cancelar</button>
                <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold shadow-lg active:scale-95">Confirmar</button>
            </div>
        </div>
    </ModalOverlay>
);

const PhotoGalleryModal = ({ item, isReadOnly, onClose, onUpdatePhotos, setConfirmation }: any) => {
    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
             <div className="p-4 flex justify-between items-center text-white bg-gradient-to-b from-black/80 to-transparent">
                <h3 className="font-bold">Fotos do Item</h3>
                <button onClick={onClose}><IconX className="w-6 h-6 active:scale-95"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
                <div className="col-span-2 text-center text-white/50 mt-10">
                    <p>Visualização de Galeria</p>
                    {isReadOnly && <p className="text-xs text-red-400 mt-2">Modo Leitura: Downloads apenas</p>}
                </div>
            </div>
        </div>
    );
};

const CameraModal = ({ onClose, onCapture, addNotification }: any) => {
    // Modes: Entry menu (options), or active modes
    const [mode, setMode] = useState<'options' | 'scan_qr' | 'scan_bar' | 'photo'>('options');
    const [addressInfo, setAddressInfo] = useState<string>('');
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if(mode === 'photo' && videoRef.current) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => { if(videoRef.current) videoRef.current.srcObject = stream; })
                .catch(err => addNotification('error', 'Erro na câmera: ' + err));
            
            // Get Geolocation and then Reverse Geocode for Address
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    try {
                        // OpenStreetMap Reverse Geocoding (Free, rate limited, sufficient for demo)
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                        const data = await response.json();
                        const addr = data.address;
                        const street = addr.road || addr.pedestrian || '';
                        const number = addr.house_number || '';
                        const suburb = addr.suburb || addr.neighbourhood || '';
                        const postcode = addr.postcode || '';
                        // Format: "Rua X, 123 - Bairro - CEP"
                        const fullAddress = `${street}${number ? ', ' + number : ''}${suburb ? ' - ' + suburb : ''}${postcode ? '\nCEP: ' + postcode : ''}`;
                        setAddressInfo(fullAddress);
                    } catch (e) {
                        setAddressInfo(`Lat: ${latitude.toFixed(5)}, Long: ${longitude.toFixed(5)}`);
                    }
                },
                (err) => {
                    console.error("Geo error", err);
                    setAddressInfo('Localização indisponível');
                },
                { enableHighAccuracy: true }
            );
        }
    }, [mode]);

    const takePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // 1. Draw Video
            ctx.drawImage(videoRef.current, 0, 0);
            
            // 2. Add Overlay (Watermark)
            // Gradient Background for text legibility
            const gradient = ctx.createLinearGradient(0, canvas.height - 150, 0, canvas.height);
            gradient.addColorStop(0, "transparent");
            gradient.addColorStop(1, "rgba(0,0,0,0.8)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, canvas.height - 150, canvas.width, 150);

            // Text Settings
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.textAlign = 'left';

            // Draw Date/Time
            const now = new Date();
            const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
            ctx.font = 'bold 30px Arial';
            ctx.fillText(dateStr, 30, canvas.height - 80);

            // Draw Address (Split lines if needed)
            ctx.font = '24px Arial';
            const lines = addressInfo.split('\n');
            let y = canvas.height - 40;
            if (lines.length > 1) y -= 25; // adjust up if multiline
            lines.forEach((line, i) => {
                ctx.fillText(line, 30, y + (i * 30));
            });
            
            // 3. Generate Blob/URL
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // High quality
            
            // 4. Trigger Direct Download (Saving to Memory)
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `EVIDENCIA_${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            addNotification('success', 'Foto salva no dispositivo.');
            
            // 5. Pass back to app (Optional: pass dataUrl if we want to preview it, otherwise just null to save memory)
            // We pass it to keep the "Gallery" feature functional, knowing it hits memory limits eventually.
            onCapture(null, dataUrl); 
        }
    };

    const handleScanSuccess = (decodedText: string) => {
        // Html5QrcodeScanner cleanup is handled by wrapper
        onCapture(decodedText);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col justify-center overflow-hidden">
            <button onClick={onClose} className="absolute top-4 right-4 text-white z-20 p-2 bg-black/40 rounded-full active:scale-95"><IconX className="w-8 h-8"/></button>
            
            {mode === 'options' && (
                <div className="flex flex-col gap-6 items-center animate-pop-in w-full px-8 z-10">
                    <h2 className="text-white text-2xl font-bold mb-4 tracking-tight">Selecionar Modo</h2>
                    
                    <button onClick={() => setMode('photo')} className="w-full py-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 border border-white/10 flex items-center justify-center text-white gap-4 shadow-2xl shadow-blue-900/50 active:scale-95 transition-all">
                        <IconCameraLens className="w-10 h-10"/>
                        <span className="text-xl font-bold uppercase tracking-wider">Tirar Foto</span>
                    </button>
                    
                    <button onClick={() => setMode('scan_qr')} className="w-full py-6 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center text-white gap-4 shadow-2xl active:scale-95 transition-all">
                        <IconQrCode className="w-10 h-10"/>
                        <span className="text-xl font-bold uppercase tracking-wider">Ler QR Code</span>
                    </button>

                    <button onClick={() => setMode('scan_bar')} className="w-full py-6 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center text-white gap-4 shadow-2xl active:scale-95 transition-all">
                        <IconBarcode className="w-10 h-10"/>
                        <span className="text-xl font-bold uppercase tracking-wider">Cód. Barras</span>
                    </button>
                </div>
            )}

            {mode === 'photo' && (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    
                    {/* Location Badge */}
                    <div className="absolute top-6 left-4 right-14">
                        <div className="bg-black/50 backdrop-blur-md rounded-lg p-3 border border-white/10">
                            <p className="text-xs text-slate-300 font-bold uppercase flex items-center gap-1 mb-1"><IconMapPin className="w-3 h-3 text-cyan-400"/> Localização</p>
                            <p className="text-white text-xs font-mono leading-tight whitespace-pre-wrap">{addressInfo || "Buscando endereço..."}</p>
                        </div>
                    </div>

                    <button onClick={takePhoto} className="absolute bottom-12 w-20 h-20 rounded-full border-4 border-white bg-white/20 backdrop-blur-md active:scale-90 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)] z-20"></button>
                </div>
            )}

            {(mode === 'scan_qr' || mode === 'scan_bar') && (
                <div className="relative w-full h-full bg-black flex flex-col">
                     <div id="reader" className="w-full h-full bg-black"></div>
                     {/* Custom Overlay for Scanner */}
                     <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        {/* Dynamic Box based on Scan Mode */}
                        <div 
                            className={`border-2 border-cyan-400 rounded-2xl shadow-[0_0_100px_rgba(34,211,238,0.4)] relative bg-transparent z-10 transition-all duration-300 ${
                                mode === 'scan_qr' ? 'w-64 h-64' : 'w-80 h-40'
                            }`}
                        >
                            {/* Scanning Line Animation */}
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-cyan-400 animate-[scan_2s_infinite] shadow-[0_0_10px_#22d3ee]"></div>
                            
                            {/* Red Focus Line for Barcode Mode */}
                            {mode === 'scan_bar' && (
                                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                            )}

                            {/* Corners */}
                            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl"></div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl"></div>
                            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl"></div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-xl"></div>
                        </div>
                        <p className="absolute bottom-20 text-white font-bold uppercase tracking-widest text-sm bg-black/60 px-4 py-2 rounded-full backdrop-blur-sm">
                            Aponte para o {mode === 'scan_qr' ? 'QR Code' : 'Código'}
                        </p>
                     </div>
                     
                     <div className="hidden">
                        <ScannerComponent onScan={handleScanSuccess} />
                     </div>
                </div>
            )}
        </div>
    );
};

// Helper Scanner Component to handle Html5QrcodeScanner lifecycle in full screen mode
const ScannerComponent = ({ onScan }: { onScan: (code: string) => void }) => {
    useEffect(() => {
        // Use Html5Qrcode directly for more control or Scanner for ease. 
        // Using Scanner with specific config to fill element
        const scanner = new Html5QrcodeScanner("reader", { 
            fps: 10, 
            qrbox: 250, 
            aspectRatio: window.innerWidth / window.innerHeight 
        }, false);
        
        scanner.render((decodedText) => {
            scanner.clear();
            onScan(decodedText);
        }, (error) => {});

        return () => { try { scanner.clear(); } catch(e) {} };
    }, []);
    return null;
};