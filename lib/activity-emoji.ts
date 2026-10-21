/** One emoji per department, shown in the import list and the site menu. A
 *  department with none gets the box. */
const ACTIVITY_EMOJI: Record<string, string> = {
  "usine-production": "🏭",
  "atelier-soustraitance": "🔧",
  "usine-agroalimentaire": "🥫",
  pharmacie: "💊",
  "grossiste-pharma": "📦",
  "clinique-hopital": "🏥",
  laboratoire: "🧪",
  veterinaire: "🐾",
  "exploitation-agricole": "🌾",
  "cooperative-agricole": "🧺",
  "silo-stockage": "🌽",
  "transporteur-routier": "🚚",
  "flotte-entreprise": "🚗",
  "location-vehicules": "🔑",
  "port-conteneurs": "⚓",
  "entrepot-manutention": "🏗️",
  "transport-distribution": "🚛",
  "preparation-expedition": "📮",
  "chaine-froid": "❄️",
  "plusieurs-activites": "🧩",
  "centrale-production": "⚡",
  "generateurs-secours": "🔋",
  "distribution-energetique": "🔌",
  "grossiste-distributeur": "🏬",
  "supermarche-hypermarche": "🛒",
  "chaine-magasins": "🏪",
  "epicerie-proximite": "🍞",
}

export function activityEmoji(id: string): string {
  return ACTIVITY_EMOJI[id] ?? "📦"
}
