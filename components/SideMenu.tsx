
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
      {/* Ice Glass Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white/20 backdrop-blur-xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-r border-white/40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">
           <div className="flex items-center justify-between mb-8">
             <CustomMenuIcon className="w-20 h-20 drop-shadow-2xl" />
             <button onClick={onClose} className="p-2 rounded-full bg-white/20 hover:bg-red-500/20 transition-colors backdrop-blur-md border border-white/30">
                <IconX className="w-6 h-6 text-white shadow-sm"/>
            </button>
          </div>

          <nav className="flex flex-col gap-3">
            {menuItems.map(item => (
              <button 
                key={item.label}
                onClick={() => onMenuClick(item.modal)} 
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/20 text-lg transition-all text-left border border-transparent hover:border-white/30 active:scale-95 shadow-sm hover:shadow-md group"
              >
                <item.icon className="w-6 h-6 text-white group-hover:text-cyan-200 drop-shadow-md" />
                <span className="font-bold tracking-wide text-white drop-shadow-md">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};
