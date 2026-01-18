import type { UmaMusume, Map } from "./types";
import type { Card } from "./types3v3v3";
import { getIconCardId } from "./iconMappings";

// Import JSON data
import characterDataJson from "./data/TerumiCharacterData.json";
import supportCardDataJson from "./data/TerumiSupportCardData.json";

// Type definitions for the JSON data
interface CharacterData {
  charaId: number;
  charaName: string;
  voiceActor: string;
  cardId: number;
  cardTitle: string;
  supportCardId: number;
  startDate: string;
  baseSpeed: number;
  baseStamina: number;
  basePower: number;
  baseGuts: number;
  baseWisdom: number;
  talentSpeed: number;
  talentStamina: number;
  talentPower: number;
  talentGuts: number;
  talentWisdom: number;
  aptitudeTurf: string;
  aptitudeDirt: string;
  aptitudeShort: string;
  aptitudeMile: string;
  aptitudeMiddle: string;
  aptitudeLong: string;
  aptitudeRunner: string;
  aptitudeLeader: string;
  aptitudeBetweener: string;
  aptitudeChaser: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  sex: number;
  height: number;
  bust: number;
  charaCategory: number;
  uraObjectives: number;
  skillIds: string;
}

interface SupportCardData {
  supportCardId: number;
  charaId: number;
  charaName: string;
  supportCardTitle: string;
  rarity: number;
  rarityDisplay: string;
  supportCardType: number;
  supportCardTypeName: string;
  effectTableId: number;
  uniqueEffectId: number;
  skillSetId: number;
  commandType: number;
  commandId: number;
  startDate: string;
  outingMax: number;
  effectId: number;
  effects: unknown[];
  skillHints: unknown[];
}

// Helper function to map support card type number to type string
function mapSupportCardType(
  typeName: string
): "speed" | "stamina" | "power" | "guts" | "wit" | "friend" | undefined {
  const typeMap: Record<
    string,
    "speed" | "stamina" | "power" | "guts" | "wit" | "friend"
  > = {
    Speed: "speed",
    Stamina: "stamina",
    Power: "power",
    Guts: "guts",
    Intelligence: "wit",
    Friend: "friend",
  };
  return typeMap[typeName];
}

// Helper function to map rarity number to string
function mapRarity(rarityDisplay: string): "SSR" | "SR" | "R" {
  if (rarityDisplay === "SSR") return "SSR";
  if (rarityDisplay === "SR") return "SR";
  return "R";
}

// Generate Uma Musume data from JSON
// Each entry in the JSON represents a unique trainable card (charaId + cardId combination)
// Portrait path: ./uma/chara_stand_{charaId}_{iconCardId}.webp
const characterData = characterDataJson.value as CharacterData[];

export const SAMPLE_UMAS: UmaMusume[] = characterData.map((char) => {
  const iconCardId = getIconCardId(char.cardId);
  return {
    id: `${char.cardId}`,
    name: char.charaName,
    imageUrl: `./uma/chara_stand_${char.charaId}_${iconCardId}.webp`,
  };
});

// Generate Support Card data from JSON
// Portrait path: ./card/tex_support_card_{supportCardId}.webp
const supportCardData = supportCardDataJson.value as SupportCardData[];

export const SAMPLE_CARDS: Card[] = supportCardData.map((card) => ({
  id: `${card.supportCardId}`,
  name: card.charaName,
  rarity: mapRarity(card.rarityDisplay),
  type: mapSupportCardType(card.supportCardTypeName),
  imageUrl: `./card/tex_support_card_${card.supportCardId}.webp`,
}));

// Race tracks with distances and surfaces
// TODO: Fill in complete distance/surface data for each track
// Commented tracks are not in game yet
export const SAMPLE_MAPS: Map[] = [
  // Sapporo
  {
    id: "sapporo-1200-turf",
    track: "Sapporo",
    distance: 1200,
    surface: "Turf",
    name: "Sapporo - 1200m Turf",
  },
  {
    id: "sapporo-1500-turf",
    track: "Sapporo",
    distance: 1500,
    surface: "Turf",
    name: "Sapporo - 1500m Turf",
  },
  {
    id: "sapporo-1800-turf",
    track: "Sapporo",
    distance: 1800,
    surface: "Turf",
    name: "Sapporo - 1800m Turf",
  },
  {
    id: "sapporo-2000-turf",
    track: "Sapporo",
    distance: 2000,
    surface: "Turf",
    name: "Sapporo - 2000m Turf",
  },
  {
    id: "sapporo-2600-turf",
    track: "Sapporo",
    distance: 2600,
    surface: "Turf",
    name: "Sapporo - 2600m Turf",
  },
  // {
  //   id: "sapporo-1000-dirt",
  //   track: "Sapporo",
  //   distance: 1000,
  //   surface: "Dirt",
  //   name: "Sapporo - 1000m Dirt",
  // },
  {
    id: "sapporo-1700-dirt",
    track: "Sapporo",
    distance: 1700,
    surface: "Dirt",
    name: "Sapporo - 1700m Dirt",
  },
  // {
  //   id: "sapporo-2400-dirt",
  //   track: "Sapporo",
  //   distance: 2400,
  //   surface: "Dirt",
  //   name: "Sapporo - 2400m Dirt",
  // },

  // Hakodate
  {
    id: "hakodate-1000-turf",
    track: "Hakodate",
    distance: 1000,
    surface: "Turf",
    name: "Hakodate - 1000m Turf",
  },
  {
    id: "hakodate-1200-turf",
    track: "Hakodate",
    distance: 1200,
    surface: "Turf",
    name: "Hakodate - 1200m Turf",
  },
  {
    id: "hakodate-1800-turf",
    track: "Hakodate",
    distance: 1800,
    surface: "Turf",
    name: "Hakodate - 1800m Turf",
  },
  {
    id: "hakodate-2000-turf",
    track: "Hakodate",
    distance: 2000,
    surface: "Turf",
    name: "Hakodate - 2000m Turf",
  },
  {
    id: "hakodate-2600-turf",
    track: "Hakodate",
    distance: 2600,
    surface: "Turf",
    name: "Hakodate - 2600m Turf",
  },
  // {
  //   id: "hakodate-1000-dirt",
  //   track: "Hakodate",
  //   distance: 1000,
  //   surface: "Dirt",
  //   name: "Hakodate - 1000m Dirt",
  // },
  {
    id: "hakodate-1700-dirt",
    track: "Hakodate",
    distance: 1700,
    surface: "Dirt",
    name: "Hakodate - 1700m Dirt",
  },
  // {
  //   id: "hakodate-2400-dirt",
  //   track: "Hakodate",
  //   distance: 2400,
  //   surface: "Dirt",
  //   name: "Hakodate - 2400m Dirt",
  // },

  // Niigata
  {
    id: "niigata-1000-turf",
    track: "Niigata",
    distance: 1000,
    surface: "Turf",
    name: "Niigata - 1000m Turf",
  },
  {
    id: "niigata-1200-turf-inner",
    track: "Niigata",
    distance: 1200,
    surface: "Turf",
    variant: "Inner",
    name: "Niigata - 1200m Turf (Inner)",
  },
  {
    id: "niigata-1400-turf-inner",
    track: "Niigata",
    distance: 1400,
    surface: "Turf",
    variant: "Inner",
    name: "Niigata - 1400m Turf (Inner)",
  },
  {
    id: "niigata-1600-turf-outer",
    track: "Niigata",
    distance: 1600,
    surface: "Turf",
    variant: "Outer",
    name: "Niigata - 1600m Turf (Outer)",
  },
  {
    id: "niigata-1800-turf-outer",
    track: "Niigata",
    distance: 1800,
    surface: "Turf",
    variant: "Outer",
    name: "Niigata - 1800m Turf (Outer)",
  },
  {
    id: "niigata-2000-turf-inner",
    track: "Niigata",
    distance: 2000,
    surface: "Turf",
    variant: "Inner",
    name: "Niigata - 2000m Turf (Inner)",
  },
  {
    id: "niigata-2000-turf-outer",
    track: "Niigata",
    distance: 2000,
    surface: "Turf",
    variant: "Outer",
    name: "Niigata - 2000m Turf (Outer)",
  },
  {
    id: "niigata-2200-turf-inner",
    track: "Niigata",
    distance: 2200,
    surface: "Turf",
    variant: "Inner",
    name: "Niigata - 2200m Turf (Inner)",
  },
  {
    id: "niigata-2400-turf-inner",
    track: "Niigata",
    distance: 2400,
    surface: "Turf",
    variant: "Inner",
    name: "Niigata - 2400m Turf (Inner)",
  },
  {
    id: "niigata-1200-dirt",
    track: "Niigata",
    distance: 1200,
    surface: "Dirt",
    name: "Niigata - 1200m Dirt",
  },
  {
    id: "niigata-1800-dirt",
    track: "Niigata",
    distance: 1800,
    surface: "Dirt",
    name: "Niigata - 1800m Dirt",
  },
  // {
  //   id: "niigata-2500-dirt",
  //   track: "Niigata",
  //   distance: 2500,
  //   surface: "Dirt",
  //   name: "Niigata - 2500m Dirt",
  // },

  // Fukushima
  {
    id: "fukushima-1200-turf",
    track: "Fukushima",
    distance: 1200,
    surface: "Turf",
    name: "Fukushima - 1200m Turf",
  },
  {
    id: "fukushima-1800-turf",
    track: "Fukushima",
    distance: 1800,
    surface: "Turf",
    name: "Fukushima - 1800m Turf",
  },
  {
    id: "fukushima-2000-turf",
    track: "Fukushima",
    distance: 2000,
    surface: "Turf",
    name: "Fukushima - 2000m Turf",
  },
  {
    id: "fukushima-2600-turf",
    track: "Fukushima",
    distance: 2600,
    surface: "Turf",
    name: "Fukushima - 2600m Turf",
  },
  {
    id: "fukushima-1150-dirt",
    track: "Fukushima",
    distance: 1150,
    surface: "Dirt",
    name: "Fukushima - 1150m Dirt",
  },
  {
    id: "fukushima-1700-dirt",
    track: "Fukushima",
    distance: 1700,
    surface: "Dirt",
    name: "Fukushima - 1700m Dirt",
  },
  // {
  //   id: "fukushima-2400-dirt",
  //   track: "Fukushima",
  //   distance: 2400,
  //   surface: "Dirt",
  //   name: "Fukushima - 2400m Dirt",
  // },

  // Nakayama
  {
    id: "nakayama-1200-turf-outer",
    track: "Nakayama",
    distance: 1200,
    surface: "Turf",
    variant: "Outer",
    name: "Nakayama - 1200m Turf (Outer)",
  },
  {
    id: "nakayama-1600-turf-outer",
    track: "Nakayama",
    distance: 1600,
    surface: "Turf",
    variant: "Outer",
    name: "Nakayama - 1600m Turf (Outer)",
  },
  {
    id: "nakayama-1800-turf-inner",
    track: "Nakayama",
    distance: 1800,
    surface: "Turf",
    variant: "Inner",
    name: "Nakayama - 1800m Turf (Inner)",
  },
  {
    id: "nakayama-2000-turf-inner",
    track: "Nakayama",
    distance: 2000,
    surface: "Turf",
    variant: "Inner",
    name: "Nakayama - 2000m Turf (Inner)",
  },
  {
    id: "nakayama-2200-turf-outer",
    track: "Nakayama",
    distance: 2200,
    surface: "Turf",
    variant: "Outer",
    name: "Nakayama - 2200m Turf (Outer)",
  },
  {
    id: "nakayama-2500-turf-inner",
    track: "Nakayama",
    distance: 2500,
    surface: "Turf",
    variant: "Inner",
    name: "Nakayama - 2500m Turf (Inner)",
  },
  {
    id: "nakayama-3600-turf-inner",
    track: "Nakayama",
    distance: 3600,
    surface: "Turf",
    variant: "Inner",
    name: "Nakayama - 3600m Turf (Inner)",
  },
  {
    id: "nakayama-1200-dirt",
    track: "Nakayama",
    distance: 1200,
    surface: "Dirt",
    name: "Nakayama - 1200m Dirt",
  },
  {
    id: "nakayama-1800-dirt",
    track: "Nakayama",
    distance: 1800,
    surface: "Dirt",
    name: "Nakayama - 1800m Dirt",
  },
  // {
  //   id: "nakayama-2400-dirt",
  //   track: "Nakayama",
  //   distance: 2400,
  //   surface: "Dirt",
  //   name: "Nakayama - 2400m Dirt",
  // },
  // {
  //   id: "nakayama-2500-dirt",
  //   track: "Nakayama",
  //   distance: 2500,
  //   surface: "Dirt",
  //   name: "Nakayama - 2500m Dirt",
  // },

  // Tokyo
  {
    id: "tokyo-1400-turf",
    track: "Tokyo",
    distance: 1400,
    surface: "Turf",
    name: "Tokyo - 1400m Turf",
  },
  {
    id: "tokyo-1600-turf",
    track: "Tokyo",
    distance: 1600,
    surface: "Turf",
    name: "Tokyo - 1600m Turf",
  },
  {
    id: "tokyo-1800-turf",
    track: "Tokyo",
    distance: 1800,
    surface: "Turf",
    name: "Tokyo - 1800m Turf",
  },
  {
    id: "tokyo-2000-turf",
    track: "Tokyo",
    distance: 2000,
    surface: "Turf",
    name: "Tokyo - 2000m Turf",
  },
  {
    id: "tokyo-2300-turf",
    track: "Tokyo",
    distance: 2300,
    surface: "Turf",
    name: "Tokyo - 2300m Turf",
  },
  {
    id: "tokyo-2400-turf",
    track: "Tokyo",
    distance: 2400,
    surface: "Turf",
    name: "Tokyo - 2400m Turf",
  },
  {
    id: "tokyo-2500-turf",
    track: "Tokyo",
    distance: 2500,
    surface: "Turf",
    name: "Tokyo - 2500m Turf",
  },
  {
    id: "tokyo-3400-turf",
    track: "Tokyo",
    distance: 3400,
    surface: "Turf",
    name: "Tokyo - 3400m Turf",
  },
  {
    id: "tokyo-1300-dirt",
    track: "Tokyo",
    distance: 1300,
    surface: "Dirt",
    name: "Tokyo - 1300m Dirt",
  },
  {
    id: "tokyo-1400-dirt",
    track: "Tokyo",
    distance: 1400,
    surface: "Dirt",
    name: "Tokyo - 1400m Dirt",
  },
  {
    id: "tokyo-1600-dirt",
    track: "Tokyo",
    distance: 1600,
    surface: "Dirt",
    name: "Tokyo - 1600m Dirt",
  },
  {
    id: "tokyo-2100-dirt",
    track: "Tokyo",
    distance: 2100,
    surface: "Dirt",
    name: "Tokyo - 2100m Dirt",
  },
  // {
  //   id: "tokyo-2400-dirt",
  //   track: "Tokyo",
  //   distance: 2400,
  //   surface: "Dirt",
  //   name: "Tokyo - 2400m Dirt",
  // },

  // Chukyo
  {
    id: "chukyo-1200-turf",
    track: "Chukyo",
    distance: 1200,
    surface: "Turf",
    name: "Chukyo - 1200m Turf",
  },
  {
    id: "chukyo-1400-turf",
    track: "Chukyo",
    distance: 1400,
    surface: "Turf",
    name: "Chukyo - 1400m Turf",
  },
  {
    id: "chukyo-1600-turf",
    track: "Chukyo",
    distance: 1600,
    surface: "Turf",
    name: "Chukyo - 1600m Turf",
  },
  {
    id: "chukyo-2000-turf",
    track: "Chukyo",
    distance: 2000,
    surface: "Turf",
    name: "Chukyo - 2000m Turf",
  },
  {
    id: "chukyo-2200-turf",
    track: "Chukyo",
    distance: 2200,
    surface: "Turf",
    name: "Chukyo - 2200m Turf",
  },
  // {
  //   id: "chukyo-1200-dirt",
  //   track: "Chukyo",
  //   distance: 1200,
  //   surface: "Dirt",
  //   name: "Chukyo - 1200m Dirt",
  // },
  {
    id: "chukyo-1400-dirt",
    track: "Chukyo",
    distance: 1400,
    surface: "Dirt",
    name: "Chukyo - 1400m Dirt",
  },
  {
    id: "chukyo-1800-dirt",
    track: "Chukyo",
    distance: 1800,
    surface: "Dirt",
    name: "Chukyo - 1800m Dirt",
  },
  // {
  //   id: "chukyo-1900-dirt",
  //   track: "Chukyo",
  //   distance: 1900,
  //   surface: "Dirt",
  //   name: "Chukyo - 1900m Dirt",
  // },

  // Kyoto
  {
    id: "kyoto-1200-turf-inner",
    track: "Kyoto",
    distance: 1200,
    surface: "Turf",
    variant: "Inner",
    name: "Kyoto - 1200m Turf (Inner)",
  },
  {
    id: "kyoto-1400-turf-inner",
    track: "Kyoto",
    distance: 1400,
    surface: "Turf",
    variant: "Inner",
    name: "Kyoto - 1400m Turf (Inner)",
  },
  {
    id: "kyoto-1400-turf-outer",
    track: "Kyoto",
    distance: 1400,
    surface: "Turf",
    variant: "Outer",
    name: "Kyoto - 1400m Turf (Outer)",
  },
  {
    id: "kyoto-1600-turf-inner",
    track: "Kyoto",
    distance: 1600,
    surface: "Turf",
    variant: "Inner",
    name: "Kyoto - 1600m Turf (Inner)",
  },
  {
    id: "kyoto-1600-turf-outer",
    track: "Kyoto",
    distance: 1600,
    surface: "Turf",
    variant: "Outer",
    name: "Kyoto - 1600m Turf (Outer)",
  },
  {
    id: "kyoto-1800-turf-outer",
    track: "Kyoto",
    distance: 1800,
    surface: "Turf",
    variant: "Outer",
    name: "Kyoto - 1800m Turf (Outer)",
  },
  {
    id: "kyoto-2000-turf-inner",
    track: "Kyoto",
    distance: 2000,
    surface: "Turf",
    variant: "Inner",
    name: "Kyoto - 2000m Turf (Inner)",
  },
  {
    id: "kyoto-2200-turf-outer",
    track: "Kyoto",
    distance: 2200,
    surface: "Turf",
    variant: "Outer",
    name: "Kyoto - 2200m Turf (Outer)",
  },
  {
    id: "kyoto-2400-turf-outer",
    track: "Kyoto",
    distance: 2400,
    surface: "Turf",
    variant: "Outer",
    name: "Kyoto - 2400m Turf (Outer)",
  },
  {
    id: "kyoto-3000-turf-outer",
    track: "Kyoto",
    distance: 3000,
    surface: "Turf",
    variant: "Outer",
    name: "Kyoto - 3000m Turf (Outer)",
  },
  {
    id: "kyoto-3200-turf-outer",
    track: "Kyoto",
    distance: 3200,
    surface: "Turf",
    variant: "Outer",
    name: "Kyoto - 3200m Turf (Outer)",
  },
  {
    id: "kyoto-1200-dirt",
    track: "Kyoto",
    distance: 1200,
    surface: "Dirt",
    name: "Kyoto - 1200m Dirt",
  },
  {
    id: "kyoto-1400-dirt",
    track: "Kyoto",
    distance: 1400,
    surface: "Dirt",
    name: "Kyoto - 1400m Dirt",
  },
  {
    id: "kyoto-1800-dirt",
    track: "Kyoto",
    distance: 1800,
    surface: "Dirt",
    name: "Kyoto - 1800m Dirt",
  },
  {
    id: "kyoto-1900-dirt",
    track: "Kyoto",
    distance: 1900,
    surface: "Dirt",
    name: "Kyoto - 1900m Dirt",
  },

  // Hanshin
  {
    id: "hanshin-1200-turf-inner",
    track: "Hanshin",
    distance: 1200,
    surface: "Turf",
    variant: "Inner",
    name: "Hanshin - 1200m Turf (Inner)",
  },
  {
    id: "hanshin-1400-turf-inner",
    track: "Hanshin",
    distance: 1400,
    surface: "Turf",
    variant: "Inner",
    name: "Hanshin - 1400m Turf (Inner)",
  },
  {
    id: "hanshin-1600-turf-outer",
    track: "Hanshin",
    distance: 1600,
    surface: "Turf",
    variant: "Outer",
    name: "Hanshin - 1600m Turf (Outer)",
  },
  {
    id: "hanshin-1800-turf-outer",
    track: "Hanshin",
    distance: 1800,
    surface: "Turf",
    variant: "Outer",
    name: "Hanshin - 1800m Turf (Outer)",
  },
  {
    id: "hanshin-2000-turf-inner",
    track: "Hanshin",
    distance: 2000,
    surface: "Turf",
    variant: "Inner",
    name: "Hanshin - 2000m Turf (Inner)",
  },
  {
    id: "hanshin-2200-turf-inner",
    track: "Hanshin",
    distance: 2200,
    surface: "Turf",
    variant: "Inner",
    name: "Hanshin - 2200m Turf (Inner)",
  },
  {
    id: "hanshin-2400-turf-outer",
    track: "Hanshin",
    distance: 2400,
    surface: "Turf",
    variant: "Outer",
    name: "Hanshin - 2400m Turf (Outer)",
  },
  {
    id: "hanshin-2600-turf-outer",
    track: "Hanshin",
    distance: 2600,
    surface: "Turf",
    variant: "Outer",
    name: "Hanshin - 2600m Turf (Outer)",
  },
  {
    id: "hanshin-3000-turf-inner",
    track: "Hanshin",
    distance: 3000,
    surface: "Turf",
    variant: "Inner",
    name: "Hanshin - 3000m Turf (Inner)",
  },
  {
    id: "hanshin-3200-turf-outer-to-inner",
    track: "Hanshin",
    distance: 3200,
    surface: "Turf",
    variant: "Outer to Inner",
    name: "Hanshin - 3200m Turf (Outer to Inner)",
  },
  // {
  //   id: "hanshin-1200-dirt",
  //   track: "Hanshin",
  //   distance: 1200,
  //   surface: "Dirt",
  //   name: "Hanshin - 1200m Dirt",
  // },
  {
    id: "hanshin-1400-dirt",
    track: "Hanshin",
    distance: 1400,
    surface: "Dirt",
    name: "Hanshin - 1400m Dirt",
  },
  {
    id: "hanshin-1800-dirt",
    track: "Hanshin",
    distance: 1800,
    surface: "Dirt",
    name: "Hanshin - 1800m Dirt",
  },
  {
    id: "hanshin-2000-dirt",
    track: "Hanshin",
    distance: 2000,
    surface: "Dirt",
    name: "Hanshin - 2000m Dirt",
  },

  // Kokura
  {
    id: "kokura-1200-turf",
    track: "Kokura",
    distance: 1200,
    surface: "Turf",
    name: "Kokura - 1200m Turf",
  },
  {
    id: "kokura-1800-turf",
    track: "Kokura",
    distance: 1800,
    surface: "Turf",
    name: "Kokura - 1800m Turf",
  },
  {
    id: "kokura-2000-turf",
    track: "Kokura",
    distance: 2000,
    surface: "Turf",
    name: "Kokura - 2000m Turf",
  },
  {
    id: "kokura-2600-turf",
    track: "Kokura",
    distance: 2600,
    surface: "Turf",
    name: "Kokura - 2600m Turf",
  },
  // {
  //   id: "kokura-1000-dirt",
  //   track: "Kokura",
  //   distance: 1000,
  //   surface: "Dirt",
  //   name: "Kokura - 1000m Dirt",
  // },
  {
    id: "kokura-1700-dirt",
    track: "Kokura",
    distance: 1700,
    surface: "Dirt",
    name: "Kokura - 1700m Dirt",
  },
  // {
  //   id: "kokura-2400-dirt",
  //   track: "Kokura",
  //   distance: 2400,
  //   surface: "Dirt",
  //   name: "Kokura - 2400m Dirt",
  // },

  // Ooi
  {
    id: "ooi-1200-dirt",
    track: "Ooi",
    distance: 1200,
    surface: "Dirt",
    name: "Ooi - 1200m Dirt",
  },
  {
    id: "ooi-1800-dirt",
    track: "Ooi",
    distance: 1800,
    surface: "Dirt",
    name: "Ooi - 1800m Dirt",
  },
  {
    id: "ooi-2000-dirt",
    track: "Ooi",
    distance: 2000,
    surface: "Dirt",
    name: "Ooi - 2000m Dirt",
  },

  // Kawasaki not in game yet
  // {
  //   id: "kawasaki-1400-dirt",
  //   track: "Kawasaki",
  //   distance: 1400,
  //   surface: "Dirt",
  //   name: "Kawasaki - 1400m Dirt",
  // },
  // {
  //   id: "kawasaki-1600-dirt",
  //   track: "Kawasaki",
  //   distance: 1600,
  //   surface: "Dirt",
  //   name: "Kawasaki - 1600m Dirt",
  // },
  // {
  //   id: "kawasaki-2100-dirt",
  //   track: "Kawasaki",
  //   distance: 2100,
  //   surface: "Dirt",
  //   name: "Kawasaki - 2100m Dirt",
  // },

  // Funabashi not in game yet
  // {
  //   id: "funabashi-1000-dirt",
  //   track: "Funabashi",
  //   distance: 1000,
  //   surface: "Dirt",
  //   name: "Funabashi - 1000m Dirt",
  // },
  // {
  //   id: "funabashi-1600-dirt",
  //   track: "Funabashi",
  //   distance: 1600,
  //   surface: "Dirt",
  //   name: "Funabashi - 1600m Dirt",
  // },
  // {
  //   id: "funabashi-1800-dirt",
  //   track: "Funabashi",
  //   distance: 1800,
  //   surface: "Dirt",
  //   name: "Funabashi - 1800m Dirt",
  // },
  // {
  //   id: "funabashi-2400-dirt",
  //   track: "Funabashi",
  //   distance: 2400,
  //   surface: "Dirt",
  //   name: "Funabashi - 2400m Dirt",
  // },

  // Morioka commented out cause not in game yet
  // {
  //   id: "morioka-1200-dirt",
  //   track: "Morioka",
  //   distance: 1200,
  //   surface: "Dirt",
  //   name: "Morioka - 1200m Dirt",
  // },
  // {
  //   id: "morioka-1600-dirt",
  //   track: "Morioka",
  //   distance: 1600,
  //   surface: "Dirt",
  //   name: "Morioka - 1600m Dirt",
  // },
  // {
  //   id: "morioka-1800-dirt",
  //   track: "Morioka",
  //   distance: 1800,
  //   surface: "Dirt",
  //   name: "Morioka - 1800m Dirt",
  // },
  // {
  //   id: "morioka-2000-dirt",
  //   track: "Morioka",
  //   distance: 2000,
  //   surface: "Dirt",
  //   name: "Morioka - 2000m Dirt",
  // },
];
