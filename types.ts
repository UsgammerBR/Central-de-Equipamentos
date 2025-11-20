
export interface EquipmentItem {
  id: string;
  qt: string;
  contract: string;
  serial: string;
  photos: string[]; // array of base64 encoded images
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
