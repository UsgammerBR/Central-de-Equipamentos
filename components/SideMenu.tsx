import React from 'react';
import { IconCalendar, IconSave, IconExport, IconSettings, IconInfo, IconX, CustomMenuIcon } from './icons';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onMenuClick: (modalName: string) => void;
}

export const SideMenu = ({ isOpen, onClose, onMenuClick }: SideMenuProps) => {

  const menuItems = [
    { label: 'Data', icon: IconCalendar, modal: 'calendar' },
    { label: 'Salvar Manualmente', icon: IconSave, modal: 'save' },
    { label: 'Exportar', icon: IconExport, modal: 'export' },
    { label: 'Configurações', icon: IconSettings, modal: 'settings' },
    { label: 'Sobre', icon: IconInfo, modal: 'about' }
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {/* Light Glass Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white/70 backdrop-blur-xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-r border-white/40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">
           <div className="flex items-center justify-between mb-8">
             <CustomMenuIcon className="w-20 h-20 drop-shadow-xl" />
             <button onClick={onClose} className="p-2 rounded-full bg-black/5 hover:bg-red-500/10 transition-colors border border-black/5 active:scale-90">
                <IconX className="w-6 h-6 text-slate-700"/>
            </button>
          </div>

          <nav className="flex flex-col gap-3">
            {menuItems.map(item => (
              <button 
                key={item.label}
                onClick={() => onMenuClick(item.modal)} 
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/50 text-lg transition-all text-left border border-transparent hover:border-white/60 active:scale-95 shadow-sm hover:shadow-md group text-slate-800"
              >
                {/* Fixed Color: text-cyan-600 */}
                <item.icon className="w-6 h-6 text-cyan-600 group-hover:scale-110 transition-transform" />
                <span className="font-bold tracking-wide text-slate-800">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};