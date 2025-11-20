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
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-blue-600/80 text-white backdrop-blur-xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-r border-white/20 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">
           <div className="flex items-center justify-between mb-8">
             <CustomMenuIcon className="w-16 h-16 drop-shadow-lg" />
             <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
                <IconX className="w-8 h-8 text-white"/>
            </button>
          </div>

          <nav className="flex flex-col gap-3">
            {menuItems.map(item => (
              <button 
                key={item.label}
                onClick={() => onMenuClick(item.modal)} 
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-white/20 text-lg transition-all text-left border border-transparent hover:border-white/10"
              >
                <item.icon className="w-7 h-7" />
                <span className="font-medium tracking-wide">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};