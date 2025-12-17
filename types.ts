
export interface EquipmentItem {
  id: string;
  contract: string;
  serial: string;
  photos: string[]; // array of base64 encoded images
  createdAt?: number; // Timestamp
}

export enum EquipmentCategory {
  BOX = "BOX",
  BOX_SOUND = "BOX SOUND",
  CONTROLE_REMOTO = "CONTROLE REMOTO",
  CAMERA = "CAMERA",
  CHIP = "CHIP",
}

export type DailyData = {
  [key in EquipmentCategory]: EquipmentItem[];
};

export type AppData = {
  [date: string]: DailyData; // date format "YYYY-MM-DD"
};

export interface AppNotification {
  id: string;
  type: 'info' | 'error' | 'success' | 'request';
  message: string;
  timestamp: number;
  read: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export interface UserProfile {
    name: string;
    cpf?: string;
    photo?: string; // Base64 photo of the user
}