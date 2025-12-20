
import React from 'react';
import { IconCalendar, IconSave, IconExport, IconSettings, IconInfo, IconX, CustomMenuIcon } from './icons';
import { UserProfile } from '../types';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onMenuClick: (modalName: string) => void;
  userProfile?: UserProfile;
}

export const SideMenu = ({ isOpen, onClose, onMenuClick, userProfile }: SideMenuProps) => {

  const menuItems = [
    { label: 'Calendário', icon: IconCalendar, modal: 'calendar' },
    { label: 'Exportar / Importar', icon: IconExport, modal: 'export' },
    { label: 'Configurações', icon: IconSettings, modal: 'settings' },
    { label: 'Sobre o App', icon: IconInfo, modal: 'about' }
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-500 ${
          isOpen ? 'opacity-100 bg-black/40' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) border-r border-white/10 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 h-full flex flex-col">
           <div className="flex items-center justify-between mb-10">
             {userProfile?.profileImage ? (
                <div className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 overflow-hidden shadow-2xl transition-transform hover:scale-105 active:scale-95">
                   <img src={userProfile.profileImage} alt="Profile" className="w-full h-full object-cover" />
                </div>
             ) : (
                <CustomMenuIcon className="w-32 h-32 drop-shadow-2xl" />
             )}
             <button onClick={onClose} className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-500/10 transition-all border border-black/5 active:scale-90">
                <IconX className="w-8 h-8 text-slate-700 dark:text-slate-400"/>
            </button>
          </div>

          <div className="mb-8 px-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Controle de Equipamentos</h2>
            <p className="text-[10px] text-cyan-600 font-black uppercase tracking-[5px] mt-2 opacity-50">V 1.0.1</p>
          </div>

          <nav className="flex flex-col gap-4 flex-1">
            {menuItems.map(item => (
              <button 
                key={item.label}
                onClick={() => { onMenuClick(item.modal); onClose(); }} 
                className="flex items-center gap-5 p-5 rounded-3xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xl transition-all text-left border border-transparent hover:border-slate-100 dark:hover:border-white/5 active:scale-95 shadow-sm group"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-cyan-600 group-hover:text-white transition-all shadow-inner">
                    <item.icon className="w-6 h-6" />
                </div>
                <span className="font-black tracking-tight text-slate-800 dark:text-slate-200 uppercase text-xs">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="pt-8 border-t border-slate-100 dark:border-white/5 pb-2 text-center">
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[8px] opacity-30">Desenvolvido para Leo Luz</p>
          </div>
        </div>
      </div>
    </>
  );
};
