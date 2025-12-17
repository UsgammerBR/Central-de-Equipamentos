
import React, { useState, useEffect, useReducer, useCallback, useMemo, useRef, ReactNode } from 'react';
import { SideMenu } from './components/SideMenu';
import { 
    CustomMenuIcon, ChristmasMenuIcon, LoadingBoxIcon, IconPlus, IconMinus, IconTrash, IconUndo, IconSearch, IconCamera, IconGallery, IconClipboard, IconX, IconShare, IconChevronRight,
    IconSave, IconChevronDown, IconBell, IconQrCode, IconBarcode, IconCameraLens, IconMapPin, IconDownload, IconSettings, IconExport, IconCalendar, IconHoliday
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem, AppNotification, UserProfile } from './types';
import { CATEGORIES, HOLIDAYS } from './constants';
import { 
    saveDayData, loadDayData, getGrandTotalCount, getAllDataForBackup, 
    saveUserProfileToDB, loadUserProfileFromDB, migrateLocalStorageToDB 
} from './db';

const getFormattedDate = (date: Date): string => date.toISOString().split('T')[0];
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

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

// COMPONENTES DE APOIO
const ActionButton = ({ children, onClick, isPrimary, isDanger, disabled, theme }: any) => {
    const baseStyle = "w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm border";
    let colorStyle = disabled ? "opacity-50 cursor-not-allowed bg-slate-200 border-transparent" :
                     isPrimary ? (theme.isXmas ? "bg-red-600 text-white" : "bg-cyan-600 text-white") :
                     isDanger ? "bg-red-50 text-red-500 border-red-100" :
                     (theme.isXmas ? "bg-white text-red-700" : "bg-white text-cyan-700");
    return <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${colorStyle}`}>{children}</button>;
};

const ModalOverlay = ({ children, onClose }: { children?: React.ReactNode, onClose: () => void }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in relative" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
);

// BARRA DE TOTAIS (CORREÇÃO DE MEMÓRIA E ESTILO)
const SummaryFooter = ({ dayData, grandTotal, theme }: { dayData: DailyData, grandTotal: number, theme: any }) => {
    const countItems = (items: EquipmentItem[]) => items.filter(i => i.contract || i.serial || i.photos.length > 0).length;
    
    const stats = {
        box: countItems(dayData[EquipmentCategory.BOX] || []),
        sound: countItems(dayData[EquipmentCategory.BOX_SOUND] || []),
        remote: countItems(dayData[EquipmentCategory.CONTROLE_REMOTO] || []),
        camera: countItems(dayData[EquipmentCategory.CAMERA] || []),
        chip: countItems(dayData[EquipmentCategory.CHIP] || []),
    };
    const totalToday = Object.values(stats).reduce((a, b) => a + b, 0);

    return (
        <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-300 z-[90] safe-area-pb shadow-[0_-8px_30px_rgba(0,0,0,0.15)] overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-4 p-3 min-w-max text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {[
                    { l: 'BOX', v: stats.box },
                    { l: 'BOX SOUND', v: stats.sound },
                    { l: 'CONTROLE REMOTO', v: stats.remote },
                    { l: 'CAMERA', v: stats.camera },
                    { l: 'CHIP', v: stats.chip }
                ].map((item, idx) => (
                    <React.Fragment key={item.l}>
                        <div className="flex flex-col items-center min-w-[40px]">
                            <span className="text-slate-400 text-[8px] whitespace-nowrap">{item.l}</span>
                            <span key={item.v} className="text-sm text-green-600 animate-pulse-green px-2 rounded bg-green-50">{item.v}</span>
                        </div>
                        {idx < 4 && <div className="w-px h-6 bg-slate-200"></div>}
                    </React.Fragment>
                ))}
                
                <div className="w-px h-6 bg-slate-400 mx-1"></div>

                <div className="flex flex-col items-center px-3 py-1 rounded-lg border border-green-200 bg-green-50 min-w-[70px]">
                    <span className="text-green-500 text-[8px]">TOTAL DIA</span>
                    <span key={totalToday} className="text-base font-extrabold text-green-700 animate-pulse-green">{totalToday}</span>
                </div>

                <div className="flex flex-col items-center px-3 py-1 rounded-lg border border-cyan-200 bg-cyan-50 min-w-[70px]">
                    <span className="text-cyan-500 text-[8px]">SOMA TOTAL</span>
                    <span key={grandTotal} className="text-base font-extrabold text-cyan-700">{grandTotal}</span>
                </div>
            </div>
        </div>
    );
};

// SECTION INDIVIDUAL
const EquipmentSection = React.memo(({ category, items, onUpdate, onViewGallery, isReadOnly, theme }: any) => {
    const activeCount = items.filter((i: any) => i.contract || i.serial || i.photos.length > 0).length;
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="relative mb-4">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full p-4 rounded-xl flex items-center justify-between shadow-md transition-all ${isExpanded ? 'bg-slate-800 text-white scale-[1.02]' : 'bg-white text-slate-700'}`}
            >
                <span className="font-extrabold text-sm tracking-widest uppercase">{category}</span>
                <div className="flex items-center gap-3">
                    <span key={activeCount} className="px-3 py-1 rounded-full text-xs font-black bg-green-100 text-green-800 animate-pulse-green">{activeCount}</span>
                    <IconChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isExpanded && (
                <div className="mt-2 space-y-2 animate-slide-in-up">
                    {items.map((item: EquipmentItem) => (
                        <div key={item.id} className="p-2 bg-white/60 backdrop-blur-sm rounded-lg flex items-center gap-2 border border-white/40">
                            <input type="number" placeholder="CONTRATO" value={item.contract} readOnly={isReadOnly} 
                                onChange={e => onUpdate({ ...item, contract: e.target.value })}
                                className="w-24 bg-white/80 rounded py-2 text-xs font-bold focus:ring-2 focus:ring-green-400 outline-none" 
                            />
                            <input type="text" placeholder="SERIAL" value={item.serial} readOnly={isReadOnly} 
                                onChange={e => onUpdate({ ...item, serial: e.target.value })}
                                className="flex-1 bg-white/80 rounded py-2 text-xs font-bold focus:ring-2 focus:ring-green-400 outline-none" 
                            />
                            <div className="flex gap-1">
                                <button onClick={() => onViewGallery(item, 'camera')} className="bg-slate-800 text-white p-2 rounded"><IconCamera className="w-4 h-4" /></button>
                                <button onClick={() => onViewGallery(item, 'gallery')} className={`p-2 rounded ${item.photos.length > 0 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-400'}`}><IconGallery className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                    {!isReadOnly && (
                        <button onClick={() => onUpdate({ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() }, true)} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-bold text-xs">+ ADICIONAR LINHA</button>
                    )}
                </div>
            )}
        </div>
    );
});

// MAIN APP
const AppContent = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dayData, setDayData] = useState<DailyData>(createEmptyDailyData());
    const [grandTotal, setGrandTotal] = useState(0);
    const [userProfile, setUserProfile] = useState<UserProfile>({ name: '' });
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
    
    const formattedDate = getFormattedDate(currentDate);
    const isChristmas = currentDate.getMonth() === 11 && currentDate.getDate() >= 20;
    const theme = { isXmas: isChristmas, bg: isChristmas ? "from-red-50 to-green-50" : "from-slate-50 to-cyan-50" };

    // CARGA INICIAL E TROCA DE DATA (MEMÓRIA EFICIENTE)
    useEffect(() => {
        const init = async () => {
            await migrateLocalStorageToDB();
            const profile = await loadUserProfileFromDB();
            if (profile) setUserProfile(profile);
            await refreshDay(formattedDate);
            setIsLoading(false);
        };
        init();
    }, []);

    useEffect(() => { refreshDay(formattedDate); }, [formattedDate]);

    const refreshDay = async (date: string) => {
        const data = await loadDayData(date);
        setDayData(data || createEmptyDailyData());
        const total = await getGrandTotalCount();
        setGrandTotal(total);
    };

    const handleUpdate = async (cat: EquipmentCategory, item: EquipmentItem, isNew = false) => {
        const newData = { ...dayData };
        if (isNew) {
            newData[cat] = [...newData[cat], item];
        } else {
            newData[cat] = newData[cat].map(i => i.id === item.id ? item : i);
        }
        setDayData(newData);
        await saveDayData(formattedDate, newData);
        const total = await getGrandTotalCount();
        setGrandTotal(total);
    };

    const handleExport = async () => {
        const all = await getAllDataForBackup();
        const blob = new Blob([JSON.stringify(all)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_equipamentos_${formattedDate}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (isLoading) return <div className="fixed inset-0 flex items-center justify-center bg-slate-900 text-white"><LoadingBoxIcon /><p className="ml-4 font-bold animate-pulse">CONTROLE LEO LUZ...</p></div>;

    return (
        <div className={`min-h-screen bg-gradient-to-br ${theme.bg} pb-32`}>
            {isMenuOpen && <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onMenuClick={m => { setActiveModal(m); setIsMenuOpen(false); }} />}
            
            <header className="p-4 bg-white/60 backdrop-blur-md sticky top-0 z-40 border-b flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-4">
                    <div onClick={() => setIsMenuOpen(true)} className="cursor-pointer">
                        {userProfile.photo ? <img src={userProfile.photo} className="w-16 h-16 rounded-2xl border-2 border-white shadow-lg object-cover" /> : <CustomMenuIcon className="w-16 h-16" />}
                    </div>
                    <div className="text-center">
                        <h1 className="text-lg font-black text-slate-800 uppercase leading-none">{userProfile.name || "Controle"}</h1>
                        <button onClick={() => setActiveModal('calendar')} className="text-xs font-bold text-cyan-600 flex items-center gap-1 mt-1 justify-center">
                            {currentDate.toLocaleDateString('pt-BR')} <IconChevronDown className="w-3 h-3"/>
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setActiveModal('export')} className="p-2 bg-slate-100 rounded-full"><IconExport className="w-5 h-5 text-slate-600" /></button>
                    </div>
                </div>
            </header>

            <main className="p-4">
                {CATEGORIES.map(cat => (
                    <EquipmentSection key={cat} category={cat} items={dayData[cat] || []} theme={theme}
                        onUpdate={(item: any, isNew: boolean) => handleUpdate(cat, item, isNew)}
                        onViewGallery={(item: any, type: string) => { setSelectedItem(item); setActiveModal(type === 'camera' ? 'camera' : 'gallery'); }}
                    />
                ))}
            </main>

            <SummaryFooter dayData={dayData} grandTotal={grandTotal} theme={theme} />

            {activeModal === 'calendar' && (
                <ModalOverlay onClose={() => setActiveModal(null)}>
                    <div className="p-6 text-center">
                        <h3 className="font-bold mb-4">Escolher Data</h3>
                        <input type="date" value={formattedDate} onChange={e => { setCurrentDate(new Date(e.target.value + 'T12:00:00')); setActiveModal(null); }} className="w-full p-3 bg-slate-100 rounded-xl font-bold" />
                    </div>
                </ModalOverlay>
            )}

            {activeModal === 'export' && (
                <ModalOverlay onClose={() => setActiveModal(null)}>
                    <div className="p-6 text-center">
                        <h3 className="font-bold mb-4">Backup e Dados</h3>
                        <button onClick={handleExport} className="w-full py-4 bg-cyan-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"><IconDownload /> Exportar JSON</button>
                        <p className="text-[10px] text-slate-400 mt-4 uppercase">Backup completo em arquivo físico</p>
                    </div>
                </ModalOverlay>
            )}

            {activeModal === 'settings' && (
                <ModalOverlay onClose={() => setActiveModal(null)}>
                    <div className="p-6">
                        <h3 className="font-bold mb-4">Perfil</h3>
                        <input type="text" placeholder="Seu Nome" value={userProfile.name} onChange={e => { const p = { ...userProfile, name: e.target.value }; setUserProfile(p); saveUserProfileToDB(p); }} className="w-full p-3 bg-slate-100 rounded-lg mb-4" />
                        <button onClick={() => setActiveModal(null)} className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold">Salvar</button>
                    </div>
                </ModalOverlay>
            )}
        </div>
    );
};

const App = () => <AppContent />;
export default App;
