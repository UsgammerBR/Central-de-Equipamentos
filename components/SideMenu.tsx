
import React from 'react';
import { IconCalendar, IconExport, IconSettings, IconInfo, IconX, CustomMenuIcon } from './icons';
import { UserProfile } from '../types';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onMenuClick: (modalName: string) => void;
  userProfile?: UserProfile;
  isChristmas?: boolean;
}

export const SideMenu = ({ isOpen, onClose, onMenuClick, userProfile, isChristmas }: SideMenuProps) => {

  const menuItems = [
    { label: 'Calendário', icon: IconCalendar, modal: 'calendar' },
    { label: 'Relatórios', icon: IconExport, modal: 'export' },
    { label: 'Configurações', icon: IconSettings, modal: 'settings' },
    { label: 'Sobre o App', icon: IconInfo, modal: 'about' }
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-500 ${
          isOpen ? 'opacity-100 bg-black/20 backdrop-blur-[2px]' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-[20px_0_60px_rgba(0,0,0,0.05)] z-50 transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) border-r ${isChristmas ? 'border-red-500/20' : 'border-slate-100'} ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-8 h-full flex flex-col">
           <div className="flex items-center justify-between mb-12">
             <div className="active:scale-95 transition-all cursor-pointer">
               {userProfile?.profileImage ? (
                  <div className={`w-24 h-24 rounded-[2rem] border-2 ${isChristmas ? 'border-emerald-500/50' : 'border-slate-100'} overflow-hidden shadow-sm`}>
                     <img src={userProfile.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  </div>
               ) : (
                  <CustomMenuIcon className="w-24 h-24 drop-shadow-xl" isChristmas={isChristmas} />
               )}
             </div>
             <button onClick={onClose} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 active:scale-95 transition-all">
                <IconX className="w-6 h-6 text-slate-400"/>
            </button>
          </div>

          <div className="mb-10 px-1">
            <h2 className={`text-2xl font-black ${isChristmas ? 'text-emerald-600' : 'text-slate-900'} uppercase tracking-tighter leading-tight`}>
              Controle de<br/>Equipamentos
            </h2>
            <div className="h-1 w-12 bg-blue-600 mt-4 rounded-full"></div>
          </div>

          <nav className="flex flex-col gap-2 flex-1">
            {menuItems.map(item => (
              <button 
                key={item.label}
                onClick={() => { onMenuClick(item.modal); onClose(); }} 
                className="flex items-center gap-4 p-4 rounded-[1.8rem] hover:bg-slate-50 transition-all text-left active:scale-95 group"
              >
                <div className={`w-12 h-12 rounded-2xl ${isChristmas ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-blue-600'} flex items-center justify-center group-hover:scale-110 transition-all border border-slate-100`}>
                    <item.icon className="w-5 h-5" />
                </div>
                <span className={`font-black uppercase text-[9px] tracking-[4px] ${isChristmas ? 'text-emerald-900' : 'text-slate-700'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="pt-8 text-center flex flex-col items-center gap-4">
             <p className={`text-[10px] ${isChristmas ? 'text-emerald-900' : 'text-slate-400'} font-black uppercase tracking-[10px] opacity-40`}>
               Leo Luz
             </p>
          </div>
        </div>
      </div>
    </>
  );
};
