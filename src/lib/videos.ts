import type { PartnerVideo } from "./types";

export const PARTNER_VIDEOS: PartnerVideo[] = [
  {
    id: "casa-nopal",
    partner: "Casa Nopal",
    title: "Tacos de temporada en CDMX",
    description: "Campaña de socio: receta y origen del nopal.",
    durationSec: 15,
    rewardCents: 450,
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    poster:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg",
  },
  {
    id: "taller-luna",
    partner: "Taller Luna",
    title: "Joyería hecha en Taxco",
    description: "Proceso artesanal de un taller socio.",
    durationSec: 15,
    rewardCents: 600,
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    poster:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg",
  },
  {
    id: "salsa-brava",
    partner: "Salsa Brava",
    title: "El fuego de una receta familiar",
    description: "Marca socia de salsas en Jalisco.",
    durationSec: 15,
    rewardCents: 350,
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    poster:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg",
  },
  {
    id: "ruta-yucatan",
    partner: "Ruta Yucatán",
    title: "Cenotes al amanecer",
    description: "Turismo socio · destino sureste.",
    durationSec: 15,
    rewardCents: 800,
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    poster:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg",
  },
];

export function getVideo(id: string) {
  return PARTNER_VIDEOS.find((v) => v.id === id);
}
