
import { EquipmentCategory } from './types';

export const CATEGORIES: EquipmentCategory[] = [
  EquipmentCategory.BOX,
  EquipmentCategory.BOX_SOUND,
  EquipmentCategory.CONTROLE,
  EquipmentCategory.CAMERA,
  EquipmentCategory.CHIP,
];

export const HOLIDAYS_SP: Record<string, { name: string; icon: string; color: string; description: string }> = {
  // Nacionais Fixos
  "01-01": { name: "Confraternização Universal", icon: "🎆", color: "bg-blue-400", description: "Início do ano civil, feriado nacional." },
  "21-04": { name: "Tiradentes", icon: "🦷", color: "bg-red-500", description: "Homenagem ao mártir da Inconfidência Mineira." },
  "01-05": { name: "Dia do Trabalho", icon: "🛠️", color: "bg-orange-500", description: "Dia Internacional dos Trabalhadores." },
  "07-09": { name: "Independência do Brasil", icon: "🇧🇷", color: "bg-green-600", description: "Proclamação da Independência (1822)." },
  "12-10": { name: "Nossa Senhora Aparecida", icon: "🙏", color: "bg-blue-600", description: "Padroeira do Brasil e Dia das Crianças." },
  "02-11": { name: "Finados", icon: "🕯️", color: "bg-gray-600", description: "Dia de memória aos mortos." },
  "15-11": { name: "Proclamação da República", icon: "⚖️", color: "bg-emerald-600", description: "Proclamação da República (1889)." },
  "20-11": { name: "Dia da Consciência Negra", icon: "✊🏿", color: "bg-yellow-800", description: "Dia Nacional de Zumbi e da Consciência Negra." },
  "25-12": { name: "Natal", icon: "🎄", color: "bg-red-600", description: "Celebração do nascimento de Jesus." },

  // Móveis 2026
  "17-02": { name: "Carnaval", icon: "🎭", color: "bg-purple-500", description: "Terça-feira de Carnaval." },
  "03-04": { name: "Sexta-feira Santa / Paixão de Cristo", icon: "✝️", color: "bg-amber-600", description: "Paixão de Cristo." },
  "05-04": { name: "Páscoa", icon: "🐰", color: "bg-blue-300", description: "Celebração da Ressurreição." },
  "04-06": { name: "Corpus Christi", icon: "🍷", color: "bg-amber-500", description: "Feriado religioso municipal em SP." },

  // Estadual SP
  "09-07": { name: "Revolução Constitucionalista de 1932", icon: "🎖️", color: "bg-slate-700", description: "Data Magna do Estado de São Paulo." },

  // Municipais SP (Exemplos fornecidos)
  "15-08": { name: "Adamantina - Aniversário", icon: "🎂", color: "bg-indigo-400", description: "Feriado Municipal em Adamantina." },
  "25-10": { name: "Aguaí - Aniversário", icon: "🎂", color: "bg-indigo-400", description: "Feriado Municipal em Aguaí." },
  "16-11": { name: "Águas de Lindóia - Aniversário", icon: "🎂", color: "bg-indigo-400", description: "Feriado Municipal em Águas de Lindóia." },
  "27-06": { name: "Americana - Aniversário", icon: "🎂", color: "bg-indigo-400", description: "Feriado Municipal em Americana." },
  "08-04": { name: "Amparo - Aniversário", icon: "🎂", color: "bg-indigo-400", description: "Feriado Municipal em Amparo." },
  "13-07": { name: "Andradina - Aniversário", icon: "🎂", color: "bg-indigo-400", description: "Feriado Municipal em Andradina." },
  "02-12": { name: "Araçatuba - Aniversário", icon: "🎂", color: "bg-indigo-400", description: "Feriado Municipal em Araçatuba." },
  "22-08": { name: "Araraquara - Aniversário", icon: "🎂", color: "bg-indigo-400", description: "Feriado Municipal em Araraquara." },
  "24-03": { name: "Araras - Aniversário", icon: "🎂", color: "bg-indigo-400", description: "Feriado Municipal em Araras." },

  // Datas Comemorativas Adicionais (Mantendo as anteriores que são relevantes)
  "08-03": { name: "Dia da Mulher", icon: "👩", color: "bg-pink-400", description: "Dia Internacional da Mulher." },
  "10-05": { name: "Dia das Mães", icon: "❤️", color: "bg-pink-500", description: "Homenagem às mães." },
  "12-06": { name: "Dia dos Namorados", icon: "💘", color: "bg-rose-400", description: "Celebração do amor." },
  "09-08": { name: "Dia dos Pais", icon: "👔", color: "bg-indigo-500", description: "Homenagem aos pais." },
  "15-10": { name: "Dia dos Professores", icon: "👨‍🏫", color: "bg-emerald-500", description: "Homenagem aos professores." },
  "18-10": { name: "Dia do Médico", icon: "🩺", color: "bg-cyan-600", description: "Homenagem aos médicos." },
  "23-10": { name: "Dia do Aviador", icon: "✈️", color: "bg-sky-400", description: "Homenagem aos aviadores." },
  "28-10": { name: "Dia do Servidor Público", icon: "🏢", color: "bg-slate-500", description: "Homenagem aos servidores." }
};
