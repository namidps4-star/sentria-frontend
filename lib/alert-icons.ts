/* Which 3D icon an alert row wears, for every sector.
 *
 * The family is the second part of the key ("health.stock.low" is stock).
 * A key the app does not know falls back to the words of the message, then to
 * the sector's own icon, and last to a plain warning sign: a row always has
 * an icon, and a wrong guess never says more than "something is off here". */

export type AlertIconName =
  | "pill" | "cold" | "temperature" | "expiry" | "health" | "hospital"
  | "pressure" | "fuel" | "oil" | "engine" | "service" | "maintenance"
  | "failure" | "hygiene" | "cycles" | "wait" | "risk" | "truck" | "ship"
  | "customs" | "battery" | "power" | "cart" | "money" | "shrinkage"
  | "crop" | "water" | "factory" | "car" | "package" | "warning"

const FAMILY: Record<string, AlertIconName> = {
  // health
  stock: "pill",
  reorder: "pill",
  critical_supply: "pill",
  cold_chain: "cold",
  temperature: "temperature",
  temp: "temperature",
  food_temp: "temperature",
  expiry: "expiry",
  // industry
  failure: "failure",
  hygiene: "hygiene",
  maintenance: "maintenance",
  vibration: "engine",
  // logistics and ports
  cycles: "cycles",
  wait: "wait",
  risk: "risk",
  pressure: "pressure",
  fuel: "fuel",
  arrival: "ship",
  customs: "customs",
  // transport
  engine: "engine",
  oil: "oil",
  service: "service",
  tires: "car",
  // energy, retail, agriculture
  battery: "battery",
  power: "power",
  grid: "power",
  shrinkage: "shrinkage",
  sales: "cart",
  price: "money",
  irrigation: "water",
  moisture: "water",
  humidity: "water",
  harvest: "crop",
}

const WORDS: [RegExp, AlertIconName][] = [
  [/froid|cold|frigo|fridge|freez|cong[eé]l/i, "cold"],
  [/temp[eé]rature|surchauff|overheat|thermo/i, "temperature"],
  [/p[eé]rim|expir|shelf life/i, "expiry"],
  [/stock|rupture|r[eé]appro|reorder/i, "pill"],
  [/carburant|fuel/i, "fuel"],
  [/huile|oil/i, "oil"],
  [/pression|pressure/i, "pressure"],
  [/batterie|battery/i, "battery"],
  [/attente|wait|dwell|retard|delay/i, "wait"],
  [/douane|customs/i, "customs"],
  [/entretien|maintenance|service/i, "maintenance"],
  [/panne|failure|d[eé]faut/i, "failure"],
]

const SECTOR: Record<string, AlertIconName> = {
  health: "health",
  industry: "factory",
  logistics: "truck",
  transportation: "car",
  energy: "power",
  commerce: "cart",
  retail: "cart",
  agriculture: "crop",
}

export function alertIconName(alert: {
  alert_key?: string | null
  sector?: string | null
  message?: string | null
  equipment?: string | null
}): AlertIconName {
  const parts = (alert.alert_key ?? "").split(".")
  const family = FAMILY[parts[1] ?? ""] ?? FAMILY[parts[0] ?? ""]
  if (family) return family

  const text = `${alert.message ?? ""} ${alert.equipment ?? ""}`
  for (const [pattern, name] of WORDS) if (pattern.test(text)) return name

  return SECTOR[alert.sector ?? parts[0] ?? ""] ?? "warning"
}
