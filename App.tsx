
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
    const baseStyle = "w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm border";
    let colorStyle = "";
    if (disabled) {
        colorStyle = "opacity-50 cursor-not-allowed bg-slate-200 border-transparent";
    } else if (isPrimary) {
        colorStyle = theme.isXmas 
            ? "bg-red-600 text-white border-transparent hover:bg-red-500" 
            : "bg-cyan-600 text-white border-transparent hover:bg-cyan-500";
    } else if (isDanger) {
        colorStyle = "bg-red-50 text-red-500 border-red-100";
    } else {
        colorStyle = theme.isXmas
            ? "bg-white text-red-700 border-red-100 hover:bg-red-50"
            : "bg-white text-cyan-700 border-cyan-100 hover:bg-cyan-50";
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
    const countItems = (items: EquipmentItem[]) => items.filter(isItemActive).length;
    const stats = {
        box: countItems(data[EquipmentCategory.BOX] || []),
        sound: countItems(data[EquipmentCategory.BOX_SOUND] || []),
        remote: countItems(data[EquipmentCategory.CONTROLE_REMOTO] || []),
        camera: countItems(data[EquipmentCategory.CAMERA] || []),
        chip: countItems(data[EquipmentCategory.CHIP] || []),
    };
    const totalToday = Object.values(stats).reduce((a, b) => a + b, 0);
    const totalAllTime = useMemo(() => {
        let sum = 0;
        Object.values(allData).forEach(day => {
            Object.values(day).forEach(items => { sum += countItems(items); });
        });
        return sum;
    }, [allData]);

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
        try {
            const json = JSON.stringify(appData, null, 2);
            const blob = new Blob([json], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_equipamentos_${getFormattedDate(currentDate)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export error", err);
            alert("Erro ao exportar arquivo.");
        }
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
                alert('Erro ao processar o arquivo. Verifique o formato JSON.');
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
                            Salve seus dados. Se limpar o cache ou mudar de aparelho, carregue o arquivo para restaurar tudo.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleExportJSON} className="flex flex-col items-center justify-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-blue-200 active:scale-95 transition-transform">
                                <IconDownload className="w-6 h-6 text-blue-600"/> 
                                <span className="text-xs font-bold text-blue-800">Exportar</span>
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="relative flex flex-col items-center justify-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-blue-200 active:scale-95 transition-transform">
                                <IconExport className="w-6 h-6 text-blue-600 rotate-180"/> 
                                <span className="text-xs font-bold text-blue-800">Importar</span>
                                <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                            </button>
                        </div>
                     </div>
                     <div className="space-y-2 pt-2 border-t border-slate-100">
                        <button onClick={() => {
                             if(navigator.share) navigator.share({ title: 'Stream+ Control', url: window.location.origin + window.location.pathname });
                             else navigator.clipboard.writeText(window.location.origin + window.location.pathname).then(() => alert("Link copiado!"));
                         }} className="w-full flex items-center gap-3 p-3 bg-cyan-50 rounded-xl font-bold text-cyan-700 active:scale-95 transition-transform">
                             <IconShare className="w-5 h-5"/> Compartilhar Link do App
                         </button>
                     </div>
                     </>
                 )}
                 {isSharingApp && !isExportMode && (
                     <button onClick={() => {
                         if(navigator.share) navigator.share({ title: 'Stream+ Control', url: window.location.origin + window.location.pathname });
                         else navigator.clipboard.writeText(window.location.origin + window.location.pathname).then(() => alert("Link copiado!"));
                     }} className="flex items-center gap-3 p-3 bg-cyan-100 rounded-xl font-bold text-cyan-700">
                         <IconShare className="w-5 h-5"/> Link do App
                     </button>
                 )}
             </div>
        </ModalOverlay>
    );
};

const AboutModal = ({ userProfile, onClose, onShareClick }: any) => (
    <ModalOverlay onClose={onClose}>
        <div className="text-center">
            <CustomMenuIcon className="w-16 h-16 mx-auto mb-2"/>
            <h2 className="font-bold text-xl">Stream+ Control</h2>
            <p className="text-xs text-slate-400 mb-2">v.1.0.2</p>
            <p className="text-sm text-slate-600 font-bold mb-6">Proprietário: Leo Luz</p>
            <div className="space-y-3">
                <button onClick={onShareClick} className="w-full py-3 bg-slate-100 rounded-xl font-bold text-slate-700 flex items-center justify-center gap-2">
                    <IconShare className="w-5 h-5"/> Compartilhar App
                </button>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
                <p>Desenvolvido para controle de equipamentos com suporte multiplataforma.</p>
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
                        <IconGallery className="w-6 h-6"/> Galeria
                        <input type="file" ref={fileInputRef} onChange={handleGalleryUpload} accept="image/*" className="absolute inset-0 opacity-0 w-full h-full" />
                    </button>
                </div>
                <div className="pt-4 space-y-3">
                    <button onClick={handleSave} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg active:scale-95 transition-transform">Confirmar</button>
                    {installPrompt && (
                        <button onClick={() => installPrompt.prompt()} className="w-full py-3 rounded-xl bg-cyan-600 text-white font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                            <IconDownload className="w-5 h-5" /> Instalar App
                        </button>
                    )}
                    {isIOS && (
                        <div className="p-3 bg-gray-100 rounded-xl text-center text-xs text-gray-600">
                            <p className="font-bold mb-1">Instalar no iPhone:</p>
                            <p>Toque em "Compartilhar" e "Adicionar à Tela de Início".</p>
                        </div>
                    )}
                    <button onClick={onClearData} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-bold border border-red-100 active:scale-95 transition-transform">Limpar Todos os Dados</button>
                </div>
            </div>
        </ModalOverlay>
    );
};

const EquipmentSection = React.memo(({ category, allCategoryItems, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isHistoryVisible, onToggleHistory, onOpenCamera, isReadOnly, theme }: any) => {
    const sortedItems = useMemo(() => {
        return [...allCategoryItems].sort((a: EquipmentItem, b: EquipmentItem) => (a.createdAt || 0) - (b.createdAt || 0));
    }, [allCategoryItems]);
    const itemsToDisplay = isHistoryVisible ? sortedItems : sortedItems.slice(-1);
    const activeCount = allCategoryItems.filter(isItemActive).length;
    const headerGradient = theme.isXmas ? 'from-red-600 via-green-600 to-red-500' : 'from-indigo-500/90 via-blue-500/90 to-cyan-500/90';
    const focusRing = theme.isXmas ? 'focus:ring-red-400' : 'focus:ring-cyan-400';

    return (
        <div className="relative">
             <div className={`w-full p-4 rounded-xl flex items-center justify-between transition-all duration-300 shadow-md relative overflow-hidden border border-white/50 ${isHistoryVisible ? `bg-gradient-to-br ${headerGradient} text-white scale-[1.02] backdrop-blur-md` : 'bg-white/80 text-slate-700 hover:bg-white backdrop-blur-sm'}`}>
                <button onClick={onToggleHistory} className="flex items-center gap-3 relative z-10 flex-1 text-left focus:outline-none w-full active:scale-95 transition-transform">
                    <span className="font-extrabold text-lg tracking-wide uppercase">{category}</span>
                    <span key={activeCount} className={`px-3 py-1 rounded-full text-xs font-black shadow-sm border animate-pulse-green bg-green-100 text-green-800 border-green-200`}>
                        {activeCount}
                    </span>
                    <div className="ml-auto">
                        {isHistoryVisible ? <IconChevronDown className="w-5 h-5 opacity-60"/> : <IconChevronRight className="w-5 h-5 opacity-60"/>}
                    </div>
                </button>
            </div>
            <div className="mt-3 grid gap-3 animate-slide-in-up">
                {itemsToDisplay.map((item: EquipmentItem) => {
                    const timeString = isHistoryVisible && item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    return (
                    <div key={item.id} className={`relative p-2 bg-white/40 backdrop-blur-sm rounded-2xl shadow-lg flex items-center border border-white/30 ${isDeleteMode ? 'pl-10' : ''}`}>
                        {isDeleteMode && (
                            <div className="absolute left-3 z-10">
                                <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => onToggleSelect(item.id)} disabled={isReadOnly} className="w-5 h-5 rounded text-cyan-600 focus:ring-cyan-500" />
                            </div>
                        )}
                        <div className="flex items-center gap-2 w-full overflow-hidden">
                            {timeString && <div className="min-w-[40px] w-12 flex-shrink-0 text-center"><span className="text-[10px] font-mono text-slate-500 font-bold">{timeString}</span></div>}
                            <div className="relative w-24 shrink-0">
                                <input type="number" placeholder="CONTRATO" value={item.contract} readOnly={isReadOnly} onChange={(e) => onUpdateItem({ ...item, contract: e.target.value })} onBlur={() => onUpdateItem(item, 'contract')} className={`w-full bg-white/80 rounded-lg py-3 pl-1 pr-6 text-center font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 ${focusRing} transition-all shadow-inner text-xs border-none`}/>
                            </div>
                            <div className="relative flex-1 min-w-0">
                                <input type="text" placeholder="SERIAL" value={item.serial} readOnly={isReadOnly} onChange={(e) => onUpdateItem({ ...item, serial: e.target.value })} onBlur={() => onUpdateItem(item, 'serial')} className={`w-full bg-white/80 rounded-lg py-3 pl-1 pr-6 text-center font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 ${focusRing} transition-all shadow-inner text-xs border-none`}/>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => onOpenCamera(item)} className="bg-slate-800 text-white p-2 rounded-lg shadow-md active:scale-95 transition-all w-10 h-10 flex items-center justify-center"><IconCamera className="w-5 h-5" /></button>
                                <button onClick={() => onViewGallery(item)} className={`p-2 rounded-lg shadow-md transition-all active:scale-95 w-10 h-10 flex items-center justify-center ${item.photos.length > 0 ? 'bg-slate-600 text-white' : 'bg-white text-slate-400'}`}><IconGallery className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                )})}
            </div>
        </div>
    );
});

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; }

// Corrected ErrorBoundary implementation using React.Component to ensure props/state exist and handle lifecycle properly
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: any): ErrorBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-600 font-bold">
          Ocorreu um erro inesperado. 
          <button className="underline" onClick={() => window.location.reload()}>Recarregar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appData, dispatch] = useReducer(dataReducer, {});
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
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const formattedDate = getFormattedDate(currentDate);

  const currentHoliday = useMemo(() => {
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    return HOLIDAYS[`${month}-${day}`] || null;
  }, [currentDate]);

  const isChristmasTheme = useMemo(() => {
      const m = currentDate.getMonth();
      const d = currentDate.getDate();
      return m === 11 && (d >= 20 && d <= 24);
  }, [currentDate]);

  const theme = { isXmas: isChristmasTheme, bg: isChristmasTheme ? "from-red-50 via-green-50 to-slate-100" : "from-[#f0f4f8] via-[#e0f2fe] to-[#cbd5e1]", text: "text-slate-800" };

  useEffect(() => {
      const initApp = async () => {
          try {
              await migrateLocalStorageToDB();
              const dbData = await loadAppDataFromDB();
              dispatch({ type: 'SET_DATA', payload: dbData });
              const dbProfile = await loadUserProfileFromDB();
              if (dbProfile) setUserProfile(dbProfile);
          } catch (e) { console.error(e); }
          finally { setTimeout(() => setIsLoading(false), 1500); }
      };
      initApp();
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); setInstallPrompt(e); });
      if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js').catch(() => {}); }
  }, []);

  useEffect(() => {
      if (isReadOnly || isLoading) return;
      const handler = setTimeout(() => { saveAppDataToDB(appData).catch(() => {}); }, 1500);
      return () => clearTimeout(handler);
  }, [appData, isReadOnly, isLoading]);

  const currentDayData: DailyData = appData[formattedDate] || createEmptyDailyData();

  const handleUpdateItem = useCallback((category: EquipmentCategory, item: EquipmentItem) => {
      if (isReadOnly) return;
      dispatch({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category, item } });
  }, [isReadOnly, formattedDate]);

  if (isLoading) return <div className="fixed inset-0 bg-slate-50 flex items-center justify-center flex-col animate-fade-in"><LoadingBoxIcon className="w-48 h-48 drop-shadow-xl" /><p className="mt-4 text-cyan-600 font-bold animate-pulse">CARREGANDO SISTEMA...</p></div>;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.bg} ${theme.text} font-sans pb-32 transition-colors duration-700`}>
       {isMenuOpen && <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={(m) => { setActiveModal(m); setIsMenuOpen(false); }} />}
      <header className="sticky top-0 z-30 bg-white/40 backdrop-blur-xl py-2 px-4 shadow-sm border-b border-white/30 flex flex-col gap-2">
        <div className="flex items-center justify-between w-full">
            <div className="flex-shrink-0" onClick={() => setIsMenuOpen(true)}>
                <div className="active:scale-95 transition-transform cursor-pointer drop-shadow-lg">
                     {userProfile.photo ? (
                         <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white/80 shadow-md bg-white">
                             <img src={userProfile.photo} alt="Perfil" className="w-full h-full object-cover" />
                         </div>
                     ) : ( isChristmasTheme ? <ChristmasMenuIcon className="w-20 h-20" /> : <CustomMenuIcon className="w-20 h-20" /> )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <ActionButton onClick={() => setIsSearchActive(!isSearchActive)} theme={theme}><IconSearch className="w-4 h-4" /></ActionButton>
                <div className="relative">
                    <ActionButton onClick={() => setActiveModal('notifications')} theme={theme}><IconBell className="w-4 h-4" /></ActionButton>
                    {notifications.some(n=>!n.read) && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
                </div>
            </div>
        </div>
        <div className="flex flex-col items-center justify-center w-full pb-1">
            {userProfile.name && <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase mb-1">{userProfile.name}</h1>}
            <div className="flex items-center gap-2">
                <button onClick={() => setActiveModal('calendar')} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-white/50 backdrop-blur-md shadow-sm font-extrabold text-cyan-800">
                    {currentDate.toLocaleDateString('pt-BR')} <IconChevronDown className="w-4 h-4"/>
                </button>
                {currentHoliday && <button onClick={() => window.open(`https://www.google.com/search?q=feriado ${currentHoliday}`, '_blank')} className="p-2 rounded-full bg-yellow-300 text-yellow-800 shadow-md animate-bounce"><IconHoliday className="w-5 h-5" /></button>}
            </div>
        </div>
      </header>

      <main className="container mx-auto p-3 space-y-4">
        {CATEGORIES.map(category => (
            <EquipmentSection key={`${formattedDate}-${category}`} category={category} allCategoryItems={currentDayData[category] || []}
                onUpdateItem={(item: EquipmentItem) => handleUpdateItem(category, item)}
                onViewGallery={(item: EquipmentItem) => setGalleryItem(item)}
                isDeleteMode={isGlobalDeleteMode} selectedItems={selectedItems[category] || []}
                onToggleSelect={(id: string) => setSelectedItems(prev => ({ ...prev, [category]: prev[category]?.includes(id) ? prev[category].filter(i => i !== id) : [...(prev[category]||[]), id] }))}
                isHistoryVisible={historyVisibleCategories.includes(category)}
                onToggleHistory={() => setHistoryVisibleCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category])}
                onOpenCamera={(item: EquipmentItem) => setCameraModalItem(item)}
                isReadOnly={isReadOnly} theme={theme}
            />
        ))}
      </main>

      <SummaryFooter data={currentDayData} allData={appData} theme={theme} />
            
      {galleryItem && <PhotoGalleryModal item={galleryItem} isReadOnly={isReadOnly} onClose={() => setGalleryItem(null)} onUpdatePhotos={(photos: string[]) => {
        const cat = Object.keys(currentDayData).find(k => currentDayData[k as EquipmentCategory].some(i => i.id === galleryItem.id)) as EquipmentCategory;
        if(cat) { const updated = { ...galleryItem, photos }; handleUpdateItem(cat, updated); setGalleryItem(updated); }
      }} setConfirmation={setConfirmation} />}
      
      {activeModal === 'calendar' && <CalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={(d: Date) => { setCurrentDate(d); setActiveModal(null); }}/>}
      {activeModal === 'export' && <ShareModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} isExportMode={true} onImportData={(d: AppData) => dispatch({ type: 'SET_DATA', payload: d })} />}
      {activeModal === 'settings' && <SettingsModal userProfile={userProfile} onSaveProfile={(p: UserProfile) => { setUserProfile(p); saveUserProfileToDB(p); }} onClose={() => setActiveModal(null)} installPrompt={installPrompt} onClearData={() => setConfirmation({ message: "Apagar tudo?", onConfirm: () => { dispatch({ type: 'CLEAR_ALL_DATA' }); setActiveModal(null); } })} />}
      {activeModal === 'about' && <AboutModal userProfile={userProfile} onClose={() => setActiveModal(null)} onShareClick={() => setActiveModal('shareApp')} />}
      {confirmation && <ConfirmationModal message={confirmation.message} onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} onCancel={() => setConfirmation(null)} />}
    </div>
  );
};

const App = () => (<ErrorBoundary><AppContent /></ErrorBoundary>);
export default App;
