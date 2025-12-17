import { EquipmentCategory } from './types';

export const CATEGORIES: EquipmentCategory[] = [
  EquipmentCategory.BOX,
  EquipmentCategory.BOX_SOUND,
  EquipmentCategory.CONTROLE_REMOTO,
  EquipmentCategory.CAMERA,
  EquipmentCategory.CHIP,
];

// Format: MM-DD
export const HOLIDAYS: Record<string, string> = {
    '01-01': 'Confraternização Universal',
    '01-25': 'Aniversário de São Paulo',
    '04-21': 'Tiradentes',
    '05-01': 'Dia do Trabalho',
    '07-09': 'Revolução Constitucionalista (SP)',
    '09-07': 'Independência do Brasil',
    '10-12': 'Nossa Senhora Aparecida',
    '11-02': 'Finados',
    '11-15': 'Proclamação da República',
    '11-20': 'Dia da Consciência Negra',
    '12-25': 'Natal',
};