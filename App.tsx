
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
                [date]: { ...currentDay, [category]: newCategoryItems }
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
                [date]: { ...currentDay, [category]: newCategoryItems }
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
                [date]: { ...currentDay, [category]: newCategoryItems }
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
        colorStyle = theme.isXmas ? "bg-red-600 text-white border-transparent hover:bg-red-500" : "bg-cyan-600 text-white border-transparent hover:bg-cyan-500"; 
    } else if (isDanger) {
        colorStyle = "bg-red-50 text-red-500 border-red-100";
    } else {
        colorStyle = theme.isXmas ? "bg-white text-red-700 border-red-100 hover:bg-red-50" : "bg-white text-cyan-700 border-cyan-100 hover:bg-cyan-50"; 
    }
    return <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${colorStyle}`}>{children}</button>;
};

const ModalOverlay = ({ children, onClose }: { children?: React.ReactNode, onClose: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in relative" onClick={(e) => e.stopPropagation()}>
           <div className="p-6">{children}</div>
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
                    {n.actionLabel && <button onClick={n.onAction} className="mt-2 text-xs font-bold underline">{n.actionLabel}</button>}
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
                    if ((item.contract && item.contract.toString().includes(term)) || (item.serial && item.serial.includes(term))) {
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
        Object.values(allData).forEach(day => Object.values(day).forEach(items => sum += countItems(items)));
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
                <div className="flex flex-col items-center min-w-[30px]"><span className="text-slate-400 text-[9px]">BOX</span><span className="text-sm text-slate-800">{stats.box}</span></div>
                <div className="w-px h-6 bg-slate-200"></div>
                <div className="flex flex-col items-center min-w-[50px]"><span className="text-slate-400 text-[9px]">BOX SOUND</span><span className="text-sm text-slate-800">{stats.sound}</span></div>
                <div className="w-px h-6 bg-slate-200"></div>
                <div className="flex flex-col items-center min-w-[80px]"><span className="text-slate-400 text-[9px]">CONTROLE REMOTO</span><span className="text-sm text-slate-800">{stats.remote}</span></div>
                <div className="w-px h-6 bg-slate-200"></div>
                <div className="flex flex-col items-center min-w-[40px]"><span className="text-slate-400 text-[9px]">CAMERA</span><span className="text-sm text-slate-800">{stats.camera}</span></div>
                <div className="w-px h-6 bg-slate-200"></div>
                <div className="flex flex-col items-center min-w-[30px]"><span className="text-slate-400 text-[9px]">CHIP</span><span className="text-sm text-slate-800">{stats.chip}</span></div>
                <div className="w-px h-6 bg-slate-300 mx-1"></div>
                <div className={`flex flex-col items-center px-3 py-1 rounded-lg border ${bgBlue} min-w-[60px]`}><span className={`${labelBlue} text-[9px]`}>TOTAL DIA</span><span className={`text-base font-extrabold ${textBlue}`}>{totalToday}</span></div>
                <div className={`flex flex-col items-center px-3 py-1 rounded-lg border ${bgPurple} min-w-[60px]`}><span className={`${labelPurple} text-[9px]`}>SOMA TOTAL</span><span className={`text-base font-extrabold ${textPurple}`}>{totalAllTime}</span></div>
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
                            <button onClick={() => setConfirmation({ message: 'Apagar foto?', onConfirm: () => {
                                const newPhotos = [...item.photos];
                                newPhotos.splice(idx, 1);
                                onUpdatePhotos(newPhotos);
                            }})} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash className="w-4 h-4"/></button>
                        )}
                        <a href={photo} download={`photo_${idx}.jpg`} className="absolute bottom-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100"><IconDownload className="w-4 h-4"/></a>
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
            const text = e.target?.result;
            if (typeof text !== 'string') return;
            try {
                const data = JSON.parse(text);
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    onImportData(data);
                    onClose();
                }
            } catch (err) { alert('Erro ao processar arquivo.'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    };
    return (
        <ModalOverlay onClose={onClose}>
             <h3 className="font-bold text-lg mb-4 text-center">{isExportMode ? 'Backup e Sincronização' : isSharingApp ? 'Compartilhar App' : 'Compartilhar Dados'}</h3>
             <div className="grid gap-4">
                 {isExportMode && (
                     <>
                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-xs font-bold text-blue-700 uppercase mb-2">Sincronização Offline</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleExportJSON} className="flex flex-col items-center justify-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-blue-200 active:scale-95"><IconDownload className="w-6 h-6 text-blue-600"/><span className="text-xs font-bold text-blue-800">Salvar</span></button>
                            <div className="relative">
                                <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-blue-200 active:scale-95"><IconExport className="w-6 h-6 text-blue-600 rotate-180"/><span className="text-xs font-bold text-blue-800">Carregar</span></button>
                            </div>
                        </div>
                     </div>
                     <div className="space-y-2 pt-2 border-t border-slate-100">
                        <button onClick={() => { if(navigator.share) navigator.share({ title: 'Stream+ Control', url: window.location.href }); }} className="w-full flex items-center gap-3 p-3 bg-cyan-50 rounded-xl font-bold text-cyan-700"><IconShare className="w-5 h-5"/> Enviar Link App</button>
                        <button onClick={() => { const b64 = btoa(JSON.stringify(appData)); const url = `${window.location.origin}${window.location.pathname}#data=${b64}`; if(navigator.share) navigator.share({ title: 'Dados Equipamentos', url }); }} className="w-full flex items-center gap-3 p-3 bg-green-50 rounded-xl font-bold text-green-700"><IconShare className="w-5 h-5"/> Enviar Link Dados</button>
                     </div>
                     </>
                 )}
                 {isSharingApp && !isExportMode && <button onClick={() => { if(navigator.share) navigator.share({ title: 'Stream+ Control', url: window.location.href }); }} className="flex items-center gap-3 p-3 bg-cyan-100 rounded-xl font-bold text-cyan-700"><IconShare className="w-5 h-5"/> Link do App</button>}
             </div>
        </ModalOverlay>
    );
};

const SettingsModal = ({ userProfile, onSaveProfile, onClose, onClearData, installPrompt, onOpenCamera }: any) => {
    const [name, setName] = useState(userProfile.name);
    const [cpf, setCpf] = useState(userProfile.cpf || '');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleSave = () => { onSaveProfile({ ...userProfile, name, cpf }); onClose(); };
    const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => onSaveProfile({ ...userProfile, photo: event.target?.result as string });
            reader.readAsDataURL(file);
        }
    };
    return (
        <ModalOverlay onClose={onClose}>
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><IconSettings className="w-6 h-6"/> Configurações</h2><button onClick={onClose}><IconX className="w-6 h-6 text-slate-400"/></button></div>
            <div className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-100 rounded-xl p-3 text-left"/></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF</label><input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full bg-slate-100 rounded-xl p-3 text-left"/></div>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={onOpenCamera} className="py-3 rounded-xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 flex flex-col items-center justify-center gap-1 text-xs"><IconCameraLens className="w-6 h-6"/> Foto</button>
                    <button onClick={() => fileInputRef.current?.click()} className="relative py-3 rounded-xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 flex flex-col items-center justify-center gap-1 text-xs"><IconGallery className="w-6 h-6"/> Galeria<input type="file" ref={fileInputRef} onChange={handleGalleryUpload} accept="image/*" className="absolute inset-0 opacity-0 w-full h-full" /></button>
                </div>
                <div className="pt-4 space-y-3">
                    <button onClick={handleSave} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg">Confirmar</button>
                    <button onClick={onClearData} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-bold border border-red-100">Limpar Dados</button>
                </div>
            </div>
        </ModalOverlay>
    );
};

const ScannerComponent = ({ onScan }: { onScan: (decodedText: string) => void }) => {
  useEffect(() => {
    // @ts-ignore
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
    scanner.render((decodedText: string) => { scanner.clear(); onScan(decodedText); }, (error: any) => {});
    return () => { scanner.clear().catch(console.error); };
  }, [onScan]);
  return null;
};

const CameraModal = ({ onClose, onCapture, addNotification, forcePhotoMode }: any) => {
    const [mode, setMode] = useState<'options' | 'scan_qr' | 'scan_bar' | 'photo'>(forcePhotoMode ? 'photo' : 'options');
    const [addressInfo, setAddressInfo] = useState<string>('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if(mode === 'photo' && videoRef.current) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(stream => { streamRef.current = stream; if(videoRef.current) videoRef.current.srcObject = stream; })
                .catch(err => addNotification('error', 'Erro na câmera: ' + err));
            navigator.geolocation.getCurrentPosition(async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                        const data = await response.json();
                        setAddressInfo(`${data.address.road || ''}, ${data.address.house_number || ''} - ${data.address.suburb || ''}`);
                    } catch (e) { setAddressInfo(`Lat: ${latitude.toFixed(5)}, Long: ${longitude.toFixed(5)}`); }
                }, () => setAddressInfo('Localização indisponível'), { enableHighAccuracy: true });
        }
        return () => { if(streamRef.current) streamRef.current.getTracks().forEach(track => track.stop()); };
    }, [mode]);

    const takePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            if (!forcePhotoMode) {
                ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
                ctx.fillStyle = 'white'; ctx.font = '24px Arial';
                ctx.fillText(new Date().toLocaleString(), 20, canvas.height - 60);
                ctx.fillText(addressInfo, 20, canvas.height - 20);
            }
            onCapture(null, canvas.toDataURL('image/jpeg', 0.9)); 
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col justify-center overflow-hidden">
            <button onClick={onClose} className="absolute top-4 right-4 text-white z-20 p-2 bg-black/40 rounded-full"><IconX className="w-8 h-8"/></button>
            {mode === 'options' && (
                <div className="flex flex-col gap-6 items-center w-full px-8">
                    <button onClick={() => setMode('photo')} className="w-full py-6 rounded-2xl bg-blue-600 flex items-center justify-center text-white gap-4 shadow-xl font-bold uppercase">Tirar Foto</button>
                    <button onClick={() => setMode('scan_qr')} className="w-full py-6 rounded-2xl bg-slate-700 flex items-center justify-center text-white gap-4 shadow-xl font-bold uppercase">QR Code</button>
                    <button onClick={() => setMode('scan_bar')} className="w-full py-6 rounded-2xl bg-slate-700 flex items-center justify-center text-white gap-4 shadow-xl font-bold uppercase">Cód. Barras</button>
                </div>
            )}
            {mode === 'photo' && (
                <div className="relative w-full h-full flex items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <button onClick={takePhoto} className="absolute bottom-12 w-20 h-20 rounded-full border-4 border-white bg-white/20 active:scale-90 transition-transform z-20"></button>
                </div>
            )}
            {(mode === 'scan_qr' || mode === 'scan_bar') && <div className="w-full h-full"><div id="reader"></div><ScannerComponent onScan={(txt) => onCapture(txt)} /></div>}
        </div>
    );
};

const EquipmentSection = React.memo(({ category, allCategoryItems, onUpdateItem, onViewGallery, isDeleteMode, selectedItems, onToggleSelect, isHistoryVisible, onToggleHistory, onOpenCamera, isReadOnly, onTriggerReadOnly, theme }: any) => {
    const itemsToDisplay = isHistoryVisible ? allCategoryItems : allCategoryItems.slice(-1);
    const badgeColor = theme.isXmas ? 'bg-green-100 text-green-800' : 'bg-green-100 text-green-800';
    return (
        <div className="relative">
             <div className={`w-full p-4 rounded-xl flex items-center justify-between shadow-md relative overflow-hidden border ${isHistoryVisible ? `bg-gradient-to-br from-blue-500 to-cyan-500 text-white` : 'bg-white text-slate-700'}`}>
                <button onClick={onToggleHistory} className="flex items-center gap-3 flex-1 text-left active:scale-95 transition-transform">
                    <span className="font-extrabold text-lg uppercase">{category}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${badgeColor}`}>{allCategoryItems.filter(isItemActive).length}</span>
                    <div className="ml-auto">{isHistoryVisible ? <IconChevronDown className="w-5 h-5 opacity-60"/> : <IconChevronRight className="w-5 h-5 opacity-60"/>}</div>
                </button>
            </div>
            <div className="mt-3 grid gap-3 animate-slide-in-up">
                {itemsToDisplay.map((item: EquipmentItem) => (
                    <div key={item.id} className={`relative p-2 bg-white/40 backdrop-blur-sm rounded-2xl shadow-lg flex items-center border ${isDeleteMode ? 'pl-10' : ''}`}>
                        {isDeleteMode && <div className="absolute left-3"><input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => onToggleSelect(item.id)} className="w-5 h-5" /></div>}
                        <div className="flex items-center gap-2 w-full overflow-hidden">
                            <input type="number" placeholder="CONTRATO" value={item.contract} readOnly={isReadOnly} onChange={(e) => onUpdateItem({ ...item, contract: e.target.value })} className="w-24 bg-white/80 rounded-lg py-3 font-bold text-xs border-none" />
                            <input type="text" placeholder="SERIAL" value={item.serial} readOnly={isReadOnly} onChange={(e) => onUpdateItem({ ...item, serial: e.target.value })} className="flex-1 bg-white/80 rounded-lg py-3 font-bold text-xs border-none" />
                            <div className="flex gap-2"><button onClick={() => onOpenCamera(item)} className="bg-slate-800 text-white p-2 rounded-lg w-10 h-10"><IconCamera className="w-5 h-5" /></button><button onClick={() => onViewGallery(item)} className={`p-2 rounded-lg w-10 h-10 ${item.photos.length > 0 ? 'bg-slate-600 text-white' : 'bg-white text-slate-400'}`}><IconGallery className="w-5 h-5" /></button></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

// --- ERROR BOUNDARY ---

// Interface for ErrorBoundary props
interface ErrorBoundaryProps {
  children: ReactNode;
}

// Interface for ErrorBoundary state
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ErrorBoundary class component to catch rendering errors in the app tree
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("ErrorBoundary caught an error", error, errorInfo); }
  render() {
    if (this.state.hasError) return <div className="p-8 text-center text-red-600"><h1>Erro inesperado</h1><button onClick={() => window.location.reload()}>Recarregar</button></div>;
    return this.props.children;
  }
}

// --- MAIN APP ---

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
  const [cameraModalItem, setCameraModalItem] = useState<EquipmentItem | null>(null);
  const [isGlobalDeleteMode, setIsGlobalDeleteMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: '' });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const formattedDate = getFormattedDate(currentDate);
  const theme = { isXmas: currentDate.getMonth() === 11 && currentDate.getDate() >= 20 && currentDate.getDate() <= 24, bg: "from-[#f0f4f8] to-[#cbd5e1]", text: "text-slate-800" };

  useEffect(() => {
      const initApp = async () => {
          try {
              await migrateLocalStorageToDB();
              const dbData = await loadAppDataFromDB();
              dispatch({ type: 'SET_DATA', payload: dbData });
              const dbProfile = await loadUserProfileFromDB();
              if (dbProfile) setUserProfile(dbProfile);
          } catch (e) { console.error("Init Error", e); }
          finally { setTimeout(() => setIsLoading(false), 1500); }
      };
      initApp();
      if ('serviceWorker' in navigator) {
          // Fixed SW registration using simple relative path to avoid 'same-origin' scope errors
          navigator.serviceWorker.register('sw.js').catch(err => console.error("SW fail", err));
      }
  }, []);

  useEffect(() => {
    if (!appData[formattedDate]) dispatch({ type: 'ENSURE_DAY_DATA', payload: { date: formattedDate, dayData: createEmptyDailyData() } });
  }, [appData, formattedDate]);

  useEffect(() => {
      if (isReadOnly || isLoading) return;
      const h = setTimeout(() => saveAppDataToDB(appData), 2000);
      return () => clearTimeout(h);
  }, [appData, isReadOnly, isLoading]);

  const addNotification = (type: any, message: string) => setNotifications(p => [{id: generateId(), type, message, timestamp: Date.now(), read: false}, ...p]);
  const handleUpdateItem = useCallback((cat: EquipmentCategory, item: EquipmentItem) => {
      if (isReadOnly) return;
      dispatch({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category: cat, item } });
  }, [isReadOnly, formattedDate]);

  if (isLoading) return <div className="fixed inset-0 bg-slate-100 flex items-center justify-center flex-col animate-fade-in"><LoadingBoxIcon className="w-64 h-64"/><p className="mt-4 text-cyan-600 font-bold tracking-widest text-xs">INICIANDO...</p></div>;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.bg} ${theme.text} font-sans pb-32`}>
       {isMenuOpen && <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={(m) => { setActiveModal(m); setIsMenuOpen(false); }} />}
      <header className="sticky top-0 z-30 bg-white/40 backdrop-blur-xl py-2 px-4 shadow-sm border-b border-white/30 flex flex-col gap-2">
        <div className="flex items-center justify-between w-full">
            <div className="flex-shrink-0 cursor-pointer" onClick={() => setIsMenuOpen(true)}>
                {userProfile.photo ? <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-white"><img src={userProfile.photo} className="w-full h-full object-cover" /></div> : <CustomMenuIcon className="w-16 h-16" />}
            </div>
            <div className="flex items-center gap-2">
                <ActionButton onClick={() => dispatch({ type: 'ADD_ITEM', payload: { date: formattedDate, category: CATEGORIES[0] } })} theme={theme}><IconPlus className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={() => setIsGlobalDeleteMode(!isGlobalDeleteMode)} isDanger={isGlobalDeleteMode} theme={theme}><IconMinus className="w-4 h-4" /></ActionButton>
                <ActionButton onClick={() => setIsSearchActive(true)} theme={theme}><IconSearch className="w-4 h-4" /></ActionButton>
                <div className="relative"><ActionButton onClick={() => setActiveModal('notifications')} theme={theme}><IconBell className="w-4 h-4" /></ActionButton></div>
            </div>
        </div>
        <div className="text-center pb-2">
            <h1 className="text-xl font-black text-slate-800 uppercase">{userProfile.name || 'Controle Equip.'}</h1>
            <button onClick={() => setActiveModal('calendar')} className="text-sm font-bold text-cyan-700 flex items-center justify-center gap-1 mx-auto">{currentDate.toLocaleDateString('pt-BR')} <IconChevronDown className="w-3 h-3"/></button>
        </div>
      </header>
      <main className="container mx-auto p-3 space-y-4">
        {CATEGORIES.map(cat => <EquipmentSection key={cat} category={cat} allCategoryItems={appData[formattedDate]?.[cat] || []} onUpdateItem={(i:any) => handleUpdateItem(cat, i)} onViewGallery={(i:any) => setGalleryItem(i)} isDeleteMode={isGlobalDeleteMode} selectedItems={selectedItems[cat] || []} onToggleSelect={(id:string) => setSelectedItems(p=>({...p, [cat]: p[cat]?.includes(id) ? p[cat].filter(x=>x!==id) : [...(p[cat]||[]), id]}))} isHistoryVisible={historyVisibleCategories.includes(cat)} onToggleHistory={() => setHistoryVisibleCategories(p=>p.includes(cat) ? p.filter(x=>x!==cat) : [...p, cat])} onOpenCamera={(i:any) => setCameraModalItem(i)} isReadOnly={isReadOnly} theme={theme} />)}
      </main>
      <SummaryFooter data={appData[formattedDate] || createEmptyDailyData()} allData={appData} theme={theme} />
      {galleryItem && <PhotoGalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} onUpdatePhotos={(p:any) => handleUpdateItem(Object.keys(appData[formattedDate]).find(k=>appData[formattedDate][k as any].some((x:any)=>x.id===galleryItem.id)) as any, {...galleryItem, photos:p})} setConfirmation={setConfirmation} />}
      {cameraModalItem && <CameraModal onClose={() => setCameraModalItem(null)} onCapture={(txt:any, photo:any) => { const cat = Object.keys(appData[formattedDate]).find(k=>appData[formattedDate][k as any].some((x:any)=>x.id===cameraModalItem.id)) as any; if(cat) handleUpdateItem(cat, {...cameraModalItem, serial: txt || cameraModalItem.serial, photos: photo ? [...cameraModalItem.photos, photo] : cameraModalItem.photos}); setCameraModalItem(null); }} addNotification={addNotification} />}
      {activeModal === 'calendar' && <CalendarModal currentDate={currentDate} onClose={() => setActiveModal(null)} onDateSelect={(d:any) => { setCurrentDate(d); setActiveModal(null); }}/>}
      {activeModal === 'export' && <ShareModal appData={appData} currentDate={currentDate} onClose={() => setActiveModal(null)} isExportMode={true} onImportData={(d:any) => dispatch({type:'SET_DATA', payload:d})} />}
      {activeModal === 'settings' && <SettingsModal userProfile={userProfile} onSaveProfile={(p:any) => { setUserProfile(p); saveUserProfileToDB(p); }} onClose={() => setActiveModal(null)} onClearData={() => { if(confirm('Apagar tudo?')){ dispatch({type:'CLEAR_ALL_DATA'}); setActiveModal(null); } }} />}
      {activeModal === 'notifications' && <NotificationsModal notifications={notifications} onClose={() => setActiveModal(null)} />}
      {isSearchActive && <SearchModal onClose={() => setIsSearchActive(false)} appData={appData} onSelect={(r:any) => { setCurrentDate(new Date(r.date+'T12:00:00')); setIsSearchActive(false); }} onGallery={(i:any) => setGalleryItem(i)} />}
      {confirmation && <ConfirmationModal message={confirmation.message} onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} onCancel={() => setConfirmation(null)} />}
    </div>
  );
};

const App = () => (<ErrorBoundary><AppContent /></ErrorBoundary>)
export default App;
