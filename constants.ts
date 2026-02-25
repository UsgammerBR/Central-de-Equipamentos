
import { EquipmentCategory } from './types';

export const CATEGORIES: EquipmentCategory[] = [
  EquipmentCategory.BOX,
  EquipmentCategory.BOX_SOUND,
  EquipmentCategory.CONTROLE,
  EquipmentCategory.CAMERA,
  EquipmentCategory.CHIP,
];

export const HOLIDAYS_SP: Record<string, { name: string; icon: string; color: string; description: string }> = {
  "01-01": { 
    name: "Ano Novo", 
    icon: "🎆", 
    color: "bg-blue-400",
    description: "Celebração universal do início do calendário gregoriano, simbolizando renovação e esperança."
  },
  "01-25": { 
    name: "Aniversário de SP", 
    icon: "🏙️", 
    color: "bg-sky-500",
    description: "Comemora a fundação da cidade de São Paulo em 1554, iniciada com uma missa no Pátio do Colégio."
  },
  "03-04": { 
    name: "Carnaval", 
    icon: "🎭", 
    color: "bg-purple-500",
    description: "A maior festa popular do Brasil, marcada por desfiles, blocos de rua e manifestações culturais diversas."
  },
  "04-18": { 
    name: "Sexta-feira Santa", 
    icon: "✝️", 
    color: "bg-amber-600",
    description: "Data religiosa cristã que relembra a crucificação de Jesus Cristo e sua morte no Calvário."
  },
  "04-21": { 
    name: "Tiradentes", 
    icon: "🦷", 
    color: "bg-red-500",
    description: "Homenagem a Joaquim José da Silva Xavier, mártir da Inconfidência Mineira e patrono cívico do Brasil."
  },
  "05-01": { 
    name: "Dia do Trabalho", 
    icon: "🛠️", 
    color: "bg-orange-500",
    description: "Homenagem às conquistas históricas dos trabalhadores e à luta por direitos e melhores condições."
  },
  "07-09": { 
    name: "Revolução de 1932", 
    icon: "🎖️", 
    color: "bg-slate-700",
    description: "Recorda o levante constitucionalista do estado de São Paulo contra o governo de Getúlio Vargas."
  },
  "09-07": { 
    name: "Independência", 
    icon: "🇧🇷", 
    color: "bg-green-600",
    description: "Marco da emancipação política do Brasil em relação a Portugal, ocorrida em 1822 às margens do Ipiranga."
  },
  "10-12": { 
    name: "Nossa Sra. Aparecida", 
    icon: "🙏", 
    color: "bg-blue-600",
    description: "Dia da Padroeira do Brasil, data de profunda devoção religiosa e também celebração do Dia das Crianças."
  },
  "11-02": { 
    name: "Finados", 
    icon: "🕯️", 
    color: "bg-gray-600",
    description: "Dia dedicado à memória e respeito aos entes queridos que já faleceram."
  },
  "11-15": { 
    name: "Proclamação da República", 
    icon: "⚖️", 
    color: "bg-emerald-600",
    description: "Celebra o fim do período imperial e o início do regime republicano no Brasil em 1889."
  },
  "11-20": { 
    name: "Consciência Negra", 
    icon: "✊🏿", 
    color: "bg-yellow-800",
    description: "Reflexão sobre a inserção do negro na sociedade brasileira e homenagem a Zumbi dos Palmares."
  },
  "12-25": { 
    name: "Natal", 
    icon: "🎄", 
    color: "bg-red-600",
    description: "Celebração do nascimento de Jesus Cristo, marcada pelo espírito de união, presentes e confraternização familiar."
  }
};
