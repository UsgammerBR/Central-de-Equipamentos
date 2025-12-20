
import { EquipmentCategory } from './types';

export const CATEGORIES: EquipmentCategory[] = [
  EquipmentCategory.BOX,
  EquipmentCategory.BOX_SOUND,
  EquipmentCategory.CONTROLE,
  EquipmentCategory.CAMERA,
  EquipmentCategory.CHIP,
];

// Feriados São Paulo (Baseado em 2024/2025)
export const HOLIDAYS_SP: Record<string, { name: string; icon: string; color: string }> = {
  "01-01": { name: "Ano Novo", icon: "🎆", color: "bg-blue-400" },
  "01-25": { name: "Aniversário de SP", icon: "🏙️", color: "bg-sky-500" },
  "03-04": { name: "Carnaval", icon: "🎭", color: "bg-purple-500" }, // Exemplo 2025
  "04-18": { name: "Sexta-feira Santa", icon: "✝️", color: "bg-amber-600" },
  "04-21": { name: "Tiradentes", icon: "🦷", color: "bg-red-500" },
  "05-01": { name: "Dia do Trabalho", icon: "🛠️", color: "bg-orange-500" },
  "06-19": { name: "Corpus Christi", icon: "🍷", color: "bg-indigo-400" },
  "07-09": { name: "Revolução Constitucionalista", icon: "🎖️", color: "bg-slate-700" },
  "09-07": { name: "Independência do Brasil", icon: "🇧🇷", color: "bg-green-600" },
  "10-12": { name: "Nossa Sra. Aparecida", icon: "🙏", color: "bg-blue-600" },
  "11-02": { name: "Finados", icon: "🕯️", color: "bg-gray-600" },
  "11-15": { name: "Proclamação da República", icon: "⚖️", color: "bg-emerald-600" },
  "11-20": { name: "Consciência Negra", icon: "✊🏿", color: "bg-yellow-800" },
  "12-25": { name: "Natal", icon: "🎄", color: "bg-red-600" }
};
