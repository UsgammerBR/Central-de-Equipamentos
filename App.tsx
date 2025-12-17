import React, { useState, useEffect, useReducer, useCallback, useMemo, useRef, ReactNode, Component } from 'react';
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
  | { type: 'DELETE_SINGLE_ITEM'; payload: { date: string; category: EquipmentCategory; itemId: string } }
  | { type: 'CLEAR_ALL_DATA' };

const dataReducer = (state: AppData, action: Action): AppData => {
    switch(action.type) {
        case 'SET_DATA': 
            return action.payload;
            
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
            
            return {
                ...state,
                [date]: {
                    ...currentDay,
                    [category]: [...currentCategoryItems, newItem]
                }
            };
        }

        case 'UPDATE_ITEM': {
            const { date, category, item } = action.payload;
            const currentDay = state[date];
            if (!currentDay) return state;
            
            const currentCategoryItems = currentDay[category] || [];
            const itemIndex = currentCategoryItems.findIndex((i: EquipmentItem) => i.id === item.id);
            
            let newCategoryItems;
            if (itemIndex > -1) {
                newCategoryItems = [...currentCategoryItems];
                newCategoryItems[itemIndex] = item;
            } else {
                newCategoryItems = [...currentCategoryItems, item];
            }

            return {
                ...state,
                [date]: {
                    ...currentDay,
                    [category]: newCategoryItems
                }
            };
        }

        case 'DELETE_ITEMS': {
            const { date, category, itemIds } = action.payload;
            const currentDay = state[date];
            if (!currentDay) return state;

            let newCategoryItems = (currentDay[category] || []).filter((item: EquipmentItem) => !itemIds.includes(item.id));
            
            if (newCategoryItems.length === 0) {
                 newCategoryItems = [{ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() }];
            }

            return {
                ...state,
                [date]: {
                    ...currentDay,
                    [category]: newCategoryItems
                }
            };
        }

        case 'DELETE_SINGLE_ITEM': {
             const { date, category, itemId } = action.payload;
             const currentDay = state[date];
             if (!currentDay) return state;

             let newCategoryItems = (currentDay[category] || []).filter((item: EquipmentItem) => item.id !== itemId);
             
             if (newCategoryItems.length === 0) {
                 newCategoryItems = [{ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() }];
             }

             return {
                ...state,
                [date]: {
                    ...currentDay,
                    [category]: newCategoryItems
                }
            };
        }

        case 'CLEAR_ALL_DATA': return {};
        default: return state;
    }
}

const isItemActive = (item: EquipmentItem): boolean => {
    return (item.contract && item.contract.trim() !== '') || (item.serial && item.serial.trim() !== '') || item.photos.length > 0;
};

// --- COMPONENTS ---

const ActionButton = ({ children, onClick, isPrimary, isDanger, disabled, theme }: any) => {
    // Dynamic styles based on theme (Christmas vs Normal)
    const baseStyle = "w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm border";
    
    let colorStyle = "";
    if (disabled) {
        colorStyle = "opacity-50 cursor-not-allowed bg-slate-200 border-transparent";
    } else if (isPrimary) {
        colorStyle = theme.isXmas 
            ? "bg-red-600 text-white border-transparent hover:bg-red-500" // Xmas Primary
            : "bg-cyan-600 text-white border-transparent hover:bg-cyan-500"; // Normal Primary
    } else if (isDanger) {
        colorStyle = "bg-red-50 text-red-500 border-red-100";
    } else {
        colorStyle = theme.isXmas
            ? "bg-white text-red-700 border-red-100 hover:bg-red-50" // Xmas Secondary
            : "bg-white text-cyan-700 border-cyan-100 hover:bg-cyan-50"; // Normal Secondary
    }

    return (
        <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${colorStyle}`}>
            {children}
        </button>
    );
};

const ModalOverlay = ({ children, onClose }: { children?: React.ReactNode, onClose: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in relative" onClick={(e) => e.stopPropagation()}>
           <div className="p-6">
              {children}
           </div>
        </div>
    </div>
);

const ConfirmationModal = ({ message, onConfirm, onCancel }: { message: string, onConfirm: () => void, onCancel: () => void }) => (
    <ModalOverlay onClose={onCancel}>
        <div className="text-center">
             <h3 className="text-lg font-bold text-slate-800 mb-4">{message}</h3>
             <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-slate-200 font-bold text-slate-700">Cancelar</button>
                <button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-cyan-600 text-white font-bold">Confirmar</button>
             </div>
        </div>
    </ModalOverlay>
);

const AccessDeniedModal = ({ onClose, onRequest }: { onClose: () => void, onRequest: () => void }) => (
    <ModalOverlay onClose={onClose}>
        <div className="text-center">
            <IconBell className="w-12 h-12 text-red-500 mx-auto mb-3"/>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Acesso Restrito</h3>
            <p className="text-slate-600 mb-6">Você está em modo de leitura. Solicite permissão para editar.</p>
            <button onClick={onRequest} className="w-full py-3 rounded-xl bg-cyan-600 text-white font-bold shadow-lg active:scale-95">Solicitar Permissão</button>
        </div>
    </ModalOverlay>
);

const NotificationsModal = ({ notifications, onClose }: { notifications: AppNotification[], onClose: () => void }) => (
   <ModalOverlay onClose={onClose}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Notificações</h3>
            <button onClick={onClose}><IconX className="w-5 h-5"/></button>
        </div>
        <div className="max-h-60 overflow-y-auto space-y-2">
            {notifications.length === 0 && <p className="text-center text-slate-400 py-4">Nenhuma notificação.</p>}
            {notifications.map((n: AppNotification) => (
                <div key={n.id} className={`p-3 rounded-lg border-l-4 ${n.type === 'error' ? 'border-red-500 bg-red-50' : n.type === 'success' ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'}`}>
                    <p className="text-sm font-medium">{n.message}</p>
                    {n.actionLabel && (
                        <button onClick={n.onAction} className="mt-2 text-xs font-bold underline">{n.actionLabel}</button>
                    )}
                    <span className="text-[10px] opacity-60 block mt-1">{new Date(n.timestamp).toLocaleTimeString()}</span>
                </div>
            ))}
        </div>
   </ModalOverlay>
);

const SearchModal = ({ onClose, appData, onSelect, onGallery }: any) => {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<any[]>([]);

    useEffect(() => {
        if(term.length < 2) { setResults([]); return; }
        const res: any[] = [];
        Object.entries(appData).forEach(([date, dayData]: [string, any]) => {
            Object.entries(dayData).forEach(([cat, items]: [string, any]) => {
                items.forEach((item: EquipmentItem) => {
                    if ((item.contract && item.contract.includes(term)) || (item.serial && item.serial.includes(term))) {
                        res.push({ date, category: cat, item });
                    }
                });
            });
        });
        setResults(res.slice(0, 50));
    }, [term, appData]);

    return (
        <ModalOverlay onClose={onClose}>
            <div className="flex items-center gap-2 mb-4 bg-slate-100 p-2 rounded-xl">
                <IconSearch className="w-5 h-5 text-slate-500"/>
                <input autoFocus value={term} onChange={e=>setTerm(e.target.value)} placeholder="Buscar contrato ou serial..." className="bg-transparent w-full outline-none text-slate-800 font-bold"/>
                <button onClick={onClose}><IconX className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
                {results.map((r, i) => {
                    const timeStr = r.item.createdAt ? new Date(r.item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    return (
                        <div key={i} className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm flex justify-between items-center" onClick={() => onSelect(r)}>
                            <div>
                                <p className="font-bold text-sm text-slate-700">{r.item.contract || 'Sem Contrato'} / {r.item.serial || 'Sem Serial'}</p>
                                <p className="text-xs text-slate-500 flex items-center gap-2">
                                    <span>{r.date}</span>
                                    {timeStr && <span className="bg-slate-200 px-1.5 rounded text-[10px] text-slate-600 font-mono">{timeStr}</span>}
                                    <span>- {r.category}</span>
                                </p>
                            </div>
                            {r.item.photos.length > 0 && <button onClick={(e)=>{e.stopPropagation(); onGallery(r.item)}}><IconGallery className="w-5 h-5 text-cyan-600"/></button>}
                        </div>
                    );
                })}
                {results.length === 0 && term.length > 1 && <p className="text-center text-slate-400">Nenhum resultado.</p>}
            </div>
        </ModalOverlay>
    );
};

const CalendarModal = ({ currentDate, onClose, onDateSelect }: any) => (
    <ModalOverlay onClose={onClose}>
        <h3 className="font-bold text-lg mb-4 text-center">Selecionar Data</h3>
        <input 
            type="date" 
            value={getFormattedDate(currentDate)} 
            onChange={(e) => { if(e.target.value) onDateSelect(new Date(e.target.value + 'T12:00:00')); }}
            className="w-full p-4 bg-slate-100 rounded-xl font-bold text-center text-xl"
        />
        <div className="mt-4 flex justify-center">
                <button onClick={() => onDateSelect(new Date())} className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg font-bold text-sm">Hoje</button>
        </div>
    </ModalOverlay>
);

const SummaryFooter = ({ data, allData, theme }: { data: DailyData, allData: AppData, theme: any }) => {
    // Helper to count non-empty items
    const countItems = (items: EquipmentItem[]) => items.filter(isItemActive).length;

    // Calculate totals for today per category
    const stats = {
        box: countItems(data[EquipmentCategory.BOX] || []),
        sound: countItems(data[EquipmentCategory.BOX_SOUND] || []),
        remote: countItems(data[EquipmentCategory.CONTROLE_REMOTO] || []),
        camera: countItems(data[EquipmentCategory.CAMERA] || []),
        chip: countItems(data[EquipmentCategory.CHIP] || []),
    };

    // Total today
    const totalToday = Object.values(stats).reduce((a, b) => a + b, 0);

    // Grand Total (All time)
    const totalAllTime = useMemo(() => {
        let sum = 0;
        Object.values(allData).forEach(day => {
            Object.values(day).forEach(items => {
                sum += countItems(items);
            });
        });
        return sum;
    }, [allData]);

    // Theme Colors for Totals
    const textBlue = theme.isXmas ? 'text-red-600' : 'text-blue-600';
    const textPurple = theme.isXmas ? 'text-green-600' : 'text-purple-600';
    const bgBlue = theme.isXmas ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100';
    const bgPurple = theme.isXmas ? 'bg-green-50 border-green-100' : 'bg-purple-50 border-purple-100';
    const labelBlue = theme.isXmas ? 'text-red-400' : 'text-blue-400';
    const labelPurple = theme.isXmas ? 'text-green-400' : 'text-purple-400';

    return (
        <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-300 z-[90] safe-area-pb shadow-[0_-8px_30px_rgba(0,0,0,0.15)] overflow-x-auto">
            <div className="flex items-center gap-4 p-3 min-w-max text-[10px] font-bold uppercase tracking-wide text-slate-600">
                <div className="flex flex-col items-center min-w-[30px]">
                    <span className="text-slate-400 text-[9px]">BOX</span>
                    <span className="text-sm text-slate-800">{stats.box}</span>
                </div>
                <div className="w-px h-6 bg-slate-200"></div>
                
                <div className="flex flex-col items-center min-w-[50px]">
                    <span className="text-slate-400 text-[9px]">BOX SOUND</span>
                    <span className="text-sm text-slate-800">{stats.sound}</span>
                </div>
                <div className="w-px h-6 bg-slate-200"></div>

                <div className="flex flex-col items-center min-w-[80px]">
                    <span className="text-slate-400 text-[9px]">CONTROLE REMOTO</span>
                    <span className="text-sm text-slate-800">{stats.remote}</span>
                </div>
                <div className="w-px h-6 bg-slate-200"></div>

                <div className="flex flex-col items-center min-w-[40px]">
                    <span className="text-slate-400 text-[9px]">CAMERA</span>
                    <span className="text-sm text-slate-800">{stats.camera}</span>
                </div>
                <div className="w-px h-6 bg-slate-200"></div>

                <div className="flex flex-col items-center min-w-[30px]">
                    <span className="text-slate-400 text-[9px]">CHIP</span>
                    <span className="text-sm text-slate-800">{stats.chip}</span>
                </div>
                
                <div className="w-px h-6 bg-slate-300 mx-1"></div>

                <div className={`flex flex-col items-center px-3 py-1 rounded-lg border ${bgBlue} min-w-[60px]`}>
                    <span className={`${labelBlue} text-[9px]`}>TOTAL DIA</span>
                    <span className={`text-base font-extrabold ${textBlue}`}>{totalToday}</span>
                </div>

                <div className={`flex flex-col items-center px-3 py-1 rounded-lg border ${bgPurple} min-w-[60px]`}>
                    <span className={`${labelPurple} text-[9px]`}>SOMA TOTAL</span>
                    <span className={`text-base font-extrabold ${textPurple}`}>{totalAllTime}</span>
                </div>
            </div>
        </div>
    );
}

const PhotoGalleryModal = ({ item, isReadOnly, onClose, onUpdatePhotos, setConfirmation }: any) => (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
        <div className="flex justify-between items-center p-4 text-white">
            <h3 className="font-bold">Galeria ({item.photos.length})</h3>
            <button onClick={onClose}><IconX className="w-6 h-6"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4 content-start">
                {item.photos.map((photo: string, idx: number) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden bg-gray-800 aspect-square">
                        <img src={photo} className="w-full h-full object-cover" />
                        {!isReadOnly && (
                            <button 
                            onClick={() => setConfirmation({ message: 'Apagar foto?', onConfirm: () => {
                                const newPhotos = [...item.photos];
                                newPhotos.splice(idx, 1);
                                onUpdatePhotos(newPhotos);
                            }})}
                            className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <IconTrash className="w-4 h-4"/>
                            </button>
                        )}
                        <a href={photo} download={`photo_${idx}.jpg`} className="absolute bottom-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100">
                            <IconDownload className="w-4 h-4"/>
                        </a>
                    </div>
                ))}
                {item.photos.length === 0 && <p className="col-span-2 text-center text-gray-500 mt-10">Sem fotos</p>}
        </div>
    </div>
);

const DownloadModal = ({ onClose }: any) => (
    <ModalOverlay onClose={onClose}>
        <div className="text-center">
            <IconSave className="w-12 h-12 text-cyan-600 mx-auto mb-2"/>
            <h3 className="font-bold text-lg">Salvo Automaticamente</h3>
            <p className="text-sm text-slate-500 mb-4">Seus dados são salvos no banco de dados do seu navegador assim que você digita.</p>
            <button onClick={onClose} className="w-full py-2 bg-slate-100 rounded-lg font-bold">Ok</button>
        </div>
    </ModalOverlay>
);

const ShareModal = ({ appData, currentDate, onClose, isExportMode, isSharingApp, isSharingData, onImportData }: any) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExportJSON = () => {
        const json = JSON.stringify(appData);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_equipamentos_${getFormattedDate(currentDate)}.json`;
        a.click();
    };

    const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                if (data && typeof data === 'object') {
                    onImportData(data);
                    onClose();
                } else {
                    alert('Arquivo inválido ou corrompido.');
                }
            } catch (err) {
                console.error(err);
                alert('Erro ao ler arquivo.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <ModalOverlay onClose={onClose}>
             <h3 className="font-bold text-lg mb-4 text-center">
                 {isExportMode ? 'Backup e Sincronização' : isSharingApp ? 'Compartilhar App' : 'Compartilhar Dados'}
             </h3>
             <div className="grid gap-4">
                 {isExportMode && (
                     <>
                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-xs font-bold text-blue-700 uppercase mb-2">Sincronização Offline</p>
                        <p className="text-[11px] text-blue-600 mb-3 leading-tight">
                            Salve seus dados na memória do celular. Se limpar o cache ou mudar de aparelho, use o botão "Carregar" para restaurar tudo.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleExportJSON} className="flex flex-col items-center justify-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-blue-200 active:scale-95 transition-transform">
                                <IconDownload className="w-6 h-6 text-blue-600"/> 
                                <span className="text-xs font-bold text-blue-800">Salvar Arquivo</span>
                            </button>
                            
                            <button onClick={() => fileInputRef.current?.click()} className="relative flex flex-col items-center justify-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-blue-200 active:scale-95 transition-transform">
                                <IconExport className="w-6 h-6 text-blue-600 rotate-180"/> 
                                <span className="text-xs font-bold text-blue-800">Carregar Arquivo</span>
                                <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="absolute inset-0 opacity-0 w-full h-full" />
                            </button>
                        </div>
                     </div>

                     <div className="space-y-2 pt-2 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase">Compartilhar Online</p>
                        <button onClick={() => {
                             if(navigator.share) navigator.share({ title: 'Stream+ Control', url: window.location.href });
                             else navigator.clipboard.writeText(window.location.href);
                         }} className="w-full flex items-center gap-3 p-3 bg-cyan-50 rounded-xl font-bold text-cyan-700 active:scale-95 transition-transform">
                             <IconShare className="w-5 h-5"/> Enviar Link do App
                         </button>
                         <button onClick={() => {
                             const json = JSON.stringify(appData);
                             const b64 = btoa(json);
                             const url = `${window.location.origin}${window.location.pathname}#data=${b64}`;
                             if(navigator.share) navigator.share({ title: 'Dados Equipamentos', url });
                             else navigator.clipboard.writeText(url);
                         }} className="w-full flex items-center gap-3 p-3 bg-green-50 rounded-xl font-bold text-green-700 active:scale-95 transition-transform">
                             <IconShare className="w-5 h-5"/> Enviar Link dos Dados
                         </button>
                     </div>
                     </>
                 )}
                 {isSharingApp && !isExportMode && (
                     <button onClick={() => {
                         if(navigator.share) navigator.share({ title: 'Stream+ Control', url: window.location.href });
                         else navigator.clipboard.writeText(window.location.href);
                     }} className="flex items-center gap-3 p-3 bg-cyan-100 rounded-xl font-bold text-cyan-700">
                         <IconShare className="w-5 h-5"/> Link do App
                     </button>
                 )}
                 {isSharingData && !isExportMode && (
                     <div className="text-center">
                         <p className="text-sm text-slate-500 mb-2">Gera um link com os dados atuais para visualização em outro dispositivo.</p>
                         <button onClick={() => {
                             const json = JSON.stringify(appData);
                             const b64 = btoa(json);
                             const url = `${window.location.origin}${window.location.pathname}#data=${b64}`;
                             if(navigator.share) navigator.share({ title: 'Dados Equipamentos', url });
                             else navigator.clipboard.writeText(url);
                         }} className="w-full flex items-center justify-center gap-3 p-3 bg-green-100 rounded-xl font-bold text-green-700">
                             <IconShare className="w-5 h-5"/> Gerar Link
                         </button>
                     </div>
                 )}
             </div>
        </ModalOverlay>
    );
};

const AboutModal = ({ userProfile, onClose, onShareClick, onShareDataClick }: any) => (
    <ModalOverlay onClose={onClose}>
        <div className="text-center">
            <CustomMenuIcon className="w-16 h-16 mx-auto mb-2"/>
            <h2 className="font-bold text-xl">Stream+ Control</h2>
            <p className="text-xs text-slate-400 mb-2">v.1.0.1</p>
            <p className="text-sm text-slate-600 font-bold mb-6">Proprietário: Leo Luz</p>
            
            <div className="space-y-3">
                <button onClick={onShareClick} className="w-full py-3 bg-slate-100 rounded-xl font-bold text-slate-700 flex items-center justify-center gap-2">
                    <IconShare className="w-5 h-5"/> Compartilhar App
                </button>
                 <button onClick={onShareDataClick} className="w-full py-3 bg-slate-100 rounded-xl font-bold text-slate-700 flex items-center justify-center gap-2">
                    <IconExport className="w-5 h-5"/> Compartilhar Dados
                </button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
                <p>Desenvolvido para controle de equipamentos.</p>
            </div>
        </div>
    </ModalOverlay>
);

const SettingsModal = ({ userProfile, onSaveProfile, onClose, onClearData, installPrompt, onOpenCamera }: any) => {
    const [name, setName] = useState(userProfile.name);
    const [cpf, setCpf] = useState(userProfile.cpf || '');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => { onSaveProfile({ ...userProfile, name, cpf }); onClose(); };

    const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                onSaveProfile({ ...userProfile, photo: base64 });
            };
            reader.readAsDataURL(file);
        }
    };

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
                
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={onOpenCamera} className="py-3 rounded-xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 active:scale-95 transition-transform flex flex-col items-center justify-center gap-1 text-xs">
                        <IconCameraLens className="w-6 h-6"/> Tirar Foto
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="relative py-3 rounded-xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 active:scale-95 transition-transform flex flex-col items-center justify-center gap-1 text-xs">
                        <IconGallery className="w-6 h-6"/> Carregar da Galeria
                        <input type="file" ref={fileInputRef} onChange={handleGalleryUpload} accept="image/*" className="absolute inset-0 opacity-0 w-full h-full" />
                    </button>
                </div>

                {userProfile.photo && (
                    <button onClick={() => onSaveProfile({ ...userProfile, photo: undefined })} className="w-full py-2 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs active:scale-95">
                        Restaurar Ícone Padrão
                    </button>
                )}

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-700">
                    <p className="font-bold mb-1">Armazenamento Seguro (IndexedDB)</p>
                    <p>Seus dados são salvos no navegador. Use a função "Exportar" para fazer backup caso precise limpar o cache.</p>
                </div>

                <div className="pt-4 space-y-3">
                    <button onClick={handleSave} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg active:scale-95 transition-transform">Confirmar</button>
                    
                    {installPrompt && (
                        <button onClick={() => installPrompt.prompt()} className="w-full py-3 rounded-xl bg-cyan-600 text-white font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                            <IconDownload className="w-5 h-5" /> Instalar App (Android)
                        </button>
                    )}

                    {isIOS && (
                        <div className="p-3 bg-gray-100 rounded-xl text-center text-xs text-gray-600">
                            <p className="font-bold mb-1">Instalar no iPhone:</p>
                            <p>Toque no botão Compartilhar do Safari e escolha "Adicionar à Tela de Início".</p>
                        </div>
                    )}

                    <button onClick={onClearData} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-bold border border-red-100 active:scale-95 transition-transform">Limpar Todos os Dados</button>
                </div>
            </div>
        </ModalOverlay>
    );
};

const ScannerComponent = ({ onScan }: { onScan: (decodedText: string) => void }) => {
  useEffect(() => {
    // @ts-ignore
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
    scanner.render((decodedText: string) => {
         scanner.clear();
         onScan(decodedText);
    }, (error: any) => {});
    return () => { scanner.clear().catch(console.error); };
  }, [onScan]);
  return null;
};

const CameraModal = ({ onClose, onCapture, addNotification, forcePhotoMode }: any) => {
    const [mode, setMode] = useState<'options' | 'scan_qr' | 'scan_bar' | 'photo'>(forcePhotoMode ? 'photo' : 'options');
    const [addressInfo, setAddressInfo] = useState<string>('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Stop camera when closing
    useEffect(() => {
        return () => {
            if(streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if(mode === 'photo' && videoRef.current) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => { 
                    streamRef.current = stream;
                    if(videoRef.current) videoRef.current.srcObject = stream; 
                })
                .catch(err => addNotification('error', 'Erro na câmera: ' + err));
            
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                        const data = await response.json();
                        const addr = data.address;
                        const street = addr.road || addr.pedestrian || '';
                        const number = addr.house_number || '';
                        const suburb = addr.suburb || addr.neighbourhood || '';
                        const postcode = addr.postcode || '';
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
            ctx.drawImage(videoRef.current, 0, 0);
            
            if (!forcePhotoMode) {
                const gradient = ctx.createLinearGradient(0, canvas.height - 150, 0, canvas.height);
                gradient.addColorStop(0, "transparent");
                gradient.addColorStop(1, "rgba(0,0,0,0.8)");
                ctx.fillStyle = gradient;
                ctx.fillRect(0, canvas.height - 150, canvas.width, 150);

                ctx.fillStyle = 'white';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.textAlign = 'left';

                const now = new Date();
                const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
                ctx.font = 'bold 30px Arial';
                ctx.fillText(dateStr, 30, canvas.height - 80);

                ctx.font = '24px Arial';
                const lines = addressInfo.split('\n');
                let y = canvas.height - 40;
                if (lines.length > 1) y -= 25; 
                lines.forEach((line, i) => {
                    ctx.fillText(line, 30, y + (i * 30));
                });
            }
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9); 
            
            if (!forcePhotoMode) {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `EVIDENCIA_${Date.now()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                addNotification('success', 'Foto salva no dispositivo.');
            }
            
            onCapture(null, dataUrl); 
        }
    };

    const handleScanSuccess = (decodedText: string) => {
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
                    
                    {!forcePhotoMode && (
                    <div className="absolute top-6 left-4 right-14">
                        <div className="bg-black/50 backdrop-blur-md rounded-lg p-3 border border-white/10">
                            <p className="text-xs text-slate-300 font-bold uppercase flex items-center gap-1 mb-1"><IconMapPin className="w-3 h-3 text-cyan-400"/> Localização</p>
                            <p className="text-white text-xs font-mono leading-tight whitespace-pre-wrap">{addressInfo || "Buscando endereço..."}</p>
                        </div>
                    </div>
                    )}

                    <button onClick={takePhoto} className="absolute bottom-12 w-20 h-20 rounded-full border-4 border-white bg-white/20 backdrop-blur-md active:scale-90 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)] z-20"></button>
                </div>
            )}

            {(mode === 'scan_qr' || mode === 'scan_bar') && (
                <div className="relative w-full h-full bg-black flex flex-col">
                     <div id="reader" className="w-full h-full bg-black"></div>
                     <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div 
                            className={`border-2 border-cyan-400 rounded-2xl shadow-[0_0_100px_rgba(34,211,238,0.4)] relative bg-transparent z-10 transition-all duration-300 ${
                                mode === 'scan_qr' ? 'w-64 h-64' : 'w-80 h-40'
                            }`}
                        >
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-cyan-400 animate-[scan_2s_infinite] shadow-[0_0_10px_#22d3ee]"></div>
                            
                            {mode === 'scan_bar' && (
                                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                            )}

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

const EquipmentSection = React.memo(({ category, allCategoryItems, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isHistoryVisible, onToggleHistory, onOpenCamera, isReadOnly, onTriggerReadOnly, theme }: any) => {
    const sortedItems = useMemo(() => {
        return [...allCategoryItems].sort((a: EquipmentItem, b: EquipmentItem) => (a.createdAt || 0) - (b.createdAt || 0));
    }, [allCategoryItems]);

    const itemsToDisplay = isHistoryVisible ? sortedItems : sortedItems.slice(-1);
    const copyToClipboard = (text: string) => { if(text) navigator.clipboard.writeText(text); };
    
    const activeCount = allCategoryItems.filter(isItemActive).length;

    // Theme Styles
    const headerGradient = theme.isXmas 
        ? 'from-red-600 via-green-600 to-red-500' // Christmas Gradient
        : 'from-indigo-500/90 via-blue-500/90 to-cyan-500/90'; // Normal Gradient
        
    // Badge is ALWAYS GREEN in standard mode as requested, but we keep the christmas override logic just in case the user wants it theme-consistent during xmas
    // However, the prompt specifically asked for "DEIXE NA COR VERDE".
    // I'll make it green-based.
    
    const badgeColor = theme.isXmas 
        ? 'bg-green-100 text-green-800 border-green-200' 
        : 'bg-green-100 text-green-800 border-green-200';

    const focusRing = theme.isXmas ? 'focus:ring-red-400' : 'focus:ring-cyan-400';

    return (
        <div className="relative">
             <div 
                className={`w-full p-4 rounded-xl flex items-center justify-between transition-all duration-300 shadow-md relative overflow-hidden border border-white/50 
                    ${isHistoryVisible 
                        ? `bg-gradient-to-br ${headerGradient} text-white scale-[1.02] backdrop-blur-md` 
                        : 'bg-white/80 text-slate-700 hover:bg-white backdrop-blur-sm'
                    }`}
            >
                <button onClick={onToggleHistory} className="flex items-center gap-3 relative z-10 flex-1 text-left focus:outline-none w-full active:scale-95 transition-transform">
                    <span className="font-extrabold text-lg tracking-wide uppercase">{category}</span>
                    <span 
                        key={activeCount} 
                        className={`px-3 py-1 rounded-full text-xs font-black shadow-sm border animate-pulse-green ${badgeColor}`}
                    >
                        {activeCount}
                    </span>
                    <div className="ml-auto">
                        {isHistoryVisible ? <IconChevronDown className="w-5 h-5 opacity-60"/> : <IconChevronRight className="w-5 h-5 opacity-60"/>}
                    </div>
                </button>
            </div>

            <div className="mt-3 grid gap-3 animate-slide-in-up">
                {itemsToDisplay.map((item: EquipmentItem) => {
                    const timeString = isHistoryVisible && item.createdAt 
                        ? new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                        : '';

                    return (
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
                            {timeString && (
                                <div className="min-w-[40px] w-12 flex-shrink-0 text-center flex flex-col justify-center">
                                    <span className="text-[10px] font-mono text-slate-500 font-bold leading-tight">{timeString}</span>
                                </div>
                            )}

                            <div className="relative w-24 shrink-0">
                                <input 
                                    type="number" 
                                    placeholder="CONTRATO" 
                                    value={item.contract}
                                    readOnly={isReadOnly}
                                    onClick={isReadOnly ? onTriggerReadOnly : undefined}
                                    onChange={(e) => onUpdateItem({ ...item, contract: e.target.value })}
                                    onBlur={() => onUpdateItem(item, 'contract')} 
                                    className={`w-full bg-white/80 rounded-lg py-3 pl-1 pr-6 text-center font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 ${focusRing} transition-all shadow-inner text-xs border-none`}
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
                                    className={`w-full bg-white/80 rounded-lg py-3 pl-1 pr-6 text-center font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 ${focusRing} transition-all shadow-inner text-xs border-none`}
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
                )})}
            </div>
        </div>
    );
});

// --- ERROR BOUNDARY ---

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-600">
            <h1>Erro inesperado</h1>
            <button onClick={() => window.location.reload()}>Recarregar</button>
        </div>
      );
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
  const [galleryItem, setGalleryItem] = useState<EquipmentItem | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [historyVisibleCategories, setHistoryVisibleCategories] = useState<EquipmentCategory[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [duplicateAlert, setDuplicateAlert] = useState<{ foundValue: string; type: string; onConfirm: () => void; onCancel: () => void; } | null>(null);
  const [cameraModalItem, setCameraModalItem] = useState<EquipmentItem | null>(null);
  const [isProfileCameraOpen, setIsProfileCameraOpen] = useState(false);
  const [isGlobalDeleteMode, setIsGlobalDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '' });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [popupNotification, setPopupNotification] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const formattedDate = getFormattedDate(currentDate);

  // --- THEME & HOLIDAY LOGIC ---

  const currentHoliday = useMemo(() => {
    // Check against National/SP holidays list (MM-DD)
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    const key = `${month}-${day}`;
    return HOLIDAYS[key] || null;
  }, [currentDate]);

  const isChristmasTheme = useMemo(() => {
      // Logic: Only Dec 20, 21, 22, 23, 24
      const m = currentDate.getMonth(); // 11 is Dec
      const d = currentDate.getDate();
      return m === 11 && (d >= 20 && d <= 24);
  }, [currentDate]);

  const theme = {
      isXmas: isChristmasTheme,
      bg: isChristmasTheme 
          ? "from-red-50 via-green-50 to-slate-100" // Xmas BG
          : "from-[#f0f4f8] via-[#e0f2fe] to-[#cbd5e1]", // Normal BG
      text: isChristmasTheme ? "text-slate-800" : "text-slate-800",
  };

  const handleHolidayClick = () => {
      if (currentHoliday) {
          const query = encodeURIComponent(`feriado ${currentHoliday}`);
          window.open(`https://www.google.com/search?q=${query}`, '_blank');
      }
  };

  useEffect(() => {
      const initApp = async () => {
          try {
              const migrated = await migrateLocalStorageToDB();
              if (migrated) addNotification('success', 'Dados migrados para o novo banco de dados.');

              const dbData = await loadAppDataFromDB();
              dispatch({ type: 'SET_DATA', payload: dbData });

              const dbProfile = await loadUserProfileFromDB();
              if (dbProfile) setUserProfile(dbProfile);

          } catch (e) {
              console.error("Init Error", e);
              addNotification('error', 'Erro ao carregar dados.');
          } finally {
              setTimeout(() => setIsLoading(false), 2000); 
          }
      };

      initApp();
      checkHash();
      
      // SW Registration
      if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('./sw.js').catch(err => console.error("SW fail", err));
      }

      window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          setInstallPrompt(e);
      });
  }, []);

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
                    addNotification('info', 'Visualizando dados compartilhados.');
                    window.history.pushState("", document.title, window.location.pathname);
                }
            } catch (e) {
                addNotification('error', 'Link inválido.');
            }
        }
  };

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
    setHistory(prev => [appData, ...prev].slice(0, 3)); // Reduced history size for memory optimization
    dispatch(action);
  };

  useEffect(() => {
    if (!appData[formattedDate]) {
      dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } });
    }
  }, [appData, formattedDate]);

  useEffect(() => {
      if (isReadOnly || isLoading) return;
      const handler = setTimeout(() => {
          saveAppDataToDB(appData).catch(err => console.error("Auto-save error", err));
      }, 2000); // Increased debounce to reduce DB writes
      return () => clearTimeout(handler);
  }, [appData, isReadOnly, isLoading]);

  const saveProfile = (p: UserProfile) => {
      setUserProfile(p);
      saveUserProfileToDB(p);
  };

  const handleRequestAlteration = () => {
      setShowAccessDenied(false);
      setPopupNotification("Solicitação enviada");
      setTimeout(() => {
          setPopupNotification(null);
          addNotification('request', `Permitir edição?`, 'Sim', () => {
              setIsReadOnly(false);
              addNotification('success', 'Edição habilitada.');
          });
      }, 2000);
  };

  const handleImportData = (data: AppData) => {
      dispatchWithHistory({ type: 'SET_DATA', payload: data });
      addNotification('success', 'Backup restaurado com sucesso!');
  };

  const currentDayData: DailyData = appData[formattedDate] || createEmptyDailyData();

  const checkDuplicate = useCallback((type: 'contract' | 'serial', value: string, currentId: string) => {
      if (!value || value.length < 3) return false;
      let isDuplicate = false;
      for (const dateKey in appData) {
          const day = appData[dateKey];
          for (const catKey in day) {
              const items = day[catKey as EquipmentCategory];
              for (const item of items) {
                  if (item.id !== currentId) {
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
  }, [appData]);

  const handleGlobalAdd = useCallback(() => {
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
      if (addedAny) addNotification('success', 'Linha adicionada.');
  }, [isReadOnly, currentDayData, formattedDate]);

  const handleUpdateItem = useCallback((category: EquipmentCategory, item: EquipmentItem, checkField?: 'contract' | 'serial') => {
      if (isReadOnly) { setShowAccessDenied(true); return; }
      if (checkField) {
          const value = checkField === 'contract' ? item.contract : item.serial;
          if (checkDuplicate(checkField, value, item.id)) {
             setDuplicateAlert({
                 foundValue: value,
                 type: checkField === 'contract' ? 'Contrato' : 'Serial',
                 onConfirm: () => {
                     dispatchWithHistory({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } });
                     setDuplicateAlert(null);
                 },
                 onCancel: () => {
                     const clearedItem = { ...item, [checkField]: '' };
                     dispatchWithHistory({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item: clearedItem } });
                     setDuplicateAlert(null);
                 }
             });
             return; 
          }
      }
      dispatchWithHistory({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } });
  }, [isReadOnly, formattedDate, checkDuplicate]);

  const handleUndo = () => {
    if (isReadOnly) { setShowAccessDenied(true); return; }
    if (history.length > 0) {
      const previousState = history[0];
      setHistory(history.slice(1));
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

  const toggleHistoryVisibility = useCallback((cat: EquipmentCategory) => {
      setHistoryVisibleCategories(prev => 
        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
      );
  }, []);

  if (isLoading) return <LoadingScreen />;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.bg} ${theme.text} font-sans pb-32 transition-colors duration-700`}>
       {isMenuOpen && <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={(modal) => { setActiveModal(modal); setIsMenuOpen(false); }} />}
      
      <header className="sticky top-0 z-30 bg-white/40 backdrop-blur-xl py-2 px-4 shadow-sm border-b border-white/30 flex flex-col gap-2">
        <div className="flex items-center justify-between w-full">
            <div className="flex-shrink-0 z-20">
                <div className="active:scale-95 transition-transform cursor-pointer drop-shadow-[0_12px_24px_rgba(0,0,0,0.25)]" onClick={() => setIsMenuOpen(true)}>
                     {userProfile.photo ? (
                         <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white/80 shadow-[0_10px_20px_rgba(0,0,0,0.2)] transform perspective-500 rotate-y-12 hover:rotate-0 transition-transform duration-500 bg-white">
                             <img src={userProfile.photo} alt="Perfil" className="w-full h-full object-cover" />
                         </div>
                     ) : (
                         isChristmasTheme ? <ChristmasMenuIcon className="w-24 h-24 animate-pop-in" /> : <CustomMenuIcon className="w-24 h-24" />
                     )}
                </div>
            </div>

            <div className="flex items-center gap-2 z-20">
                <ActionButton onClick={handleGlobalAdd} disabled={isReadOnly} theme={theme}><IconPlus className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={handleToggleDeleteMode} isDanger={isGlobalDeleteMode} disabled={isReadOnly} theme={theme}><IconMinus className="w-4 h-4" /></ActionButton>
                {isGlobalDeleteMode && Object.values(selectedItems).reduce<number>((acc, items: string[]) => acc + items.length, 0) > 0 && (
                <ActionButton onClick={handleConfirmGlobalDelete} isDanger={true} disabled={isReadOnly} theme={theme}><IconTrash className="w-4 h-4" /></ActionButton>
                )}
                <ActionButton onClick={handleUndo} disabled={isReadOnly} theme={theme}><IconUndo className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={() => setIsSearchActive(!isSearchActive)} theme={theme}><IconSearch className="w-4 h-4" /></ActionButton>
                <div className="relative">
                    <ActionButton onClick={() => setActiveModal('notifications')} theme={theme}><IconBell className="w-4 h-4" /></ActionButton>
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
                </div>
            </div>
        </div>

        <div className="flex flex-col items-center justify-center w-full animate-fade-in -mt-1 pb-1 relative">
            {userProfile.name && (
                <div className="w-full text-center px-4 mb-2 mt-2">
                    <h1 className="text-2xl font-sans font-black text-slate-800 tracking-tighter uppercase truncate max-w-[90%] mx-auto drop-shadow-sm">
                        {userProfile.name}
                    </h1>
                </div>
            )}
            <div className="relative flex items-center justify-center gap-2">
                <button onClick={() => setActiveModal('calendar')} className={`inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-white/70 border border-white/50 backdrop-blur-md shadow-sm active:scale-95 transition-transform hover:bg-white/90 ${isChristmasTheme ? 'text-red-700' : 'text-cyan-800'}`}>
                    <span className="text-base font-extrabold tracking-tight">
                        {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <IconChevronDown className={`w-4 h-4 ${isChristmasTheme ? 'text-red-500' : 'text-cyan-600'}`}/>
                </button>
                {/* Holiday Icon Button - Only appears on holidays */}
                {currentHoliday && (
                    <button 
                        onClick={handleHolidayClick} 
                        className="p-2 rounded-full bg-yellow-300 text-yellow-800 shadow-md animate-bounce active:scale-90 transition-transform"
                        title={`Feriado: ${currentHoliday}`}
                    >
                        <IconHoliday className="w-5 h-5" />
                    </button>
                )}
            </div>
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
                theme={theme}
            />
        ))}
      </main>

      <SummaryFooter data={currentDayData} allData={appData} theme={theme} />
            
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
                            addNotification('success', 'Código capturado.');
                        }
                    }
                }
                
                if (!duplicateFound && photo) {
                    const cat = Object.keys(currentDayData).find(k => currentDayData[k as EquipmentCategory].some(i => i.id === cameraModalItem.id)) as EquipmentCategory;
                    if(cat) {
                        const updated = { ...cameraModalItem, photos: [...cameraModalItem.photos, photo] };
                        handleUpdateItem(cat, updated);
                    }
                }
                setCameraModalItem(null);
            }} 
            addNotification={addNotification}
      />}

      {isProfileCameraOpen && <CameraModal 
            onClose={() => setIsProfileCameraOpen(false)}
            onCapture={(code: string | null, photo?: string) => {
                if(photo) {
                    saveProfile({ ...userProfile, photo: photo });
                    addNotification('success', 'Foto atualizada!');
                }
                setIsProfileCameraOpen(false);
            }}
            addNotification={addNotification}
            forcePhotoMode={true} 
      />}

      {activeModal === 'calendar' && <CalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={(d: Date) => { setCurrentDate(d); setActiveModal(null); }}/>}
      {activeModal === 'save' && <DownloadModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} />}
      {activeModal === 'export' && <ShareModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} isExportMode={true} onImportData={handleImportData} />}
      {activeModal === 'settings' && <SettingsModal 
            userProfile={userProfile} 
            onSaveProfile={saveProfile} 
            onClose={() => setActiveModal(null)} 
            installPrompt={installPrompt}
            onOpenCamera={() => setIsProfileCameraOpen(true)}
            onClearData={() => setConfirmation({ message: "Isso apagará o banco de dados. Tem certeza?", onConfirm: () => { dispatchWithHistory({ type: 'CLEAR_ALL_DATA' }); setActiveModal(null); } })}
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
                        Este {duplicateAlert.type} <strong>{duplicateAlert.foundValue}</strong> já existe.
                    </p>
                    <p className="text-sm text-slate-500 mb-6">Usar novamente?</p>
                    
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