/* The columns each department's file carries (the "sample" the app shows).
 *
 * It mirrors SAMPLE in the backend's pipeline/upload_check.py: every department
 * lists the names its checks read, and the /upload check requires them. Used by
 * the onboarding, and by the empty file a person can download to fill in. */

export const CSV_COLUMNS: Record<string, string[]> = {
  "pharmacie": [
    "medicine_name", "stock_qty", "min_stock",
    "sales_last_30_days", "unit_cost", "expiry_date",
  ],
  "laboratoire": [
    "reagent_name", "stock_qty", "unit_cost", "expiry_date",
  ],
  "veterinaire": [
    "medicine_name", "category", "batch_number", "stock_qty",
    "min_stock", "sales_last_30_days", "unit_cost", "expiry_date",
    "fridge_temp", "bought_on_credit",
  ],
  "clinique-hopital": [
    "item_name", "category", "stock_qty", "min_stock",
    "unit_cost", "fridge_temp", "expiry_date",
  ],
  "grossiste-pharma": [
    "pharmacy_id", "pharmacy_name", "product_name",
    "qty_shipped_last_period", "qty_reordered_this_period",
    "days_since_last_shipment", "unit_cost",
  ],
  "health": ["medicine_name", "stock_qty", "min_stock"],
  "industry": [
    "Product ID", "Torque [Nm]", "Tool wear [min]",
    "Rotational speed [rpm]",
  ],
  "usine-agroalimentaire": [
    "Product ID", "food_temp", "max_food_temp", "hygiene_control_passed",
    "production_rate", "target_rate",
  ],
  "usine-production": [
    "Product ID", "Torque [Nm]", "Tool wear [min]", "Rotational speed [rpm]",
    "production_rate", "target_rate", "last_maintenance_date",
  ],
  "atelier-soustraitance": [
    "Product ID", "Torque [Nm]", "Tool wear [min]", "Rotational speed [rpm]",
    "last_maintenance_date",
  ],
  // Names check_logistics reads (and the /upload check requires):
  // equipment_id and daily_cycles.
  "logistics": ["equipment_id", "daily_cycles", "hydraulic_pressure", "fuel_level"],
  // A port file can also carry vessel rows (arrival, berth window) and
  // customs rows (clearance against free time): port_flow.py.
  "entrepot-manutention": [
    "equipment_id", "daily_cycles", "max_cycles", "hydraulic_pressure",
    "fuel_level", "last_service_date",
  ],
  "preparation-expedition": [
    "equipment_id", "daily_cycles", "max_cycles", "avg_wait_hours",
    "last_service_date",
  ],
  "chaine-froid": [
    "equipment_id", "temperature", "max_temperature", "fuel_level",
    "last_service_date",
  ],
  // Trucks: the upload sends ops_type=transport, so the vehicle checks run.
  "transport-distribution": [
    "truck_id", "mileage_km", "last_service_km", "engine_temp",
    "fuel_level", "oil_level", "tire_age_months",
  ],
  "port-conteneurs": [
    "equipment_id", "daily_cycles", "avg_wait_hours",
    "vessel_id", "eta", "berth_window_end", "containers_aboard",
    "declaration_id", "hours_in_customs", "docs_missing",
    "free_time_hours_left",
  ],
  // Names the backend reads (check_agriculture): days_in_storage, not
  // days_stored. product_name drives the silo spoilage profiles (A-PROF).
  "agriculture": ["product_name", "days_in_storage", "storage_temp"],
  "exploitation-agricole": [
    "product_name", "storage_temp", "days_in_storage", "scheduled_pickup",
    "actual_pickup", "qty", "unit_cost",
  ],
  "silo-stockage": [
    "product_name", "days_in_storage", "storage_temp", "max_storage_temp",
  ],
  // One row per member lot; the capacity column drives A-COOP pairing
  // (spare_capacity_kg, available_transport_capacity or transport_capacity).
  "cooperative-agricole": [
    "member_id", "product_name", "days_in_storage", "spare_capacity_kg",
    "qty", "unit_cost",
  ],
  // Names check_transportation reads: truck_id, mileage_km and
  // last_service_km (not vehicle_id / km_since_service).
  "transportation": [
    "truck_id", "mileage_km", "last_service_km", "engine_temp", "fuel_level",
  ],
  // Cold chain reads the cargo's own temperature against its category
  // (surgelés, viande, vaccins...), never the engine's.
  "flotte-entreprise": [
    "truck_id", "mileage_km", "last_service_km", "fuel_level",
    "harsh_braking_count", "speeding_minutes", "idle_minutes",
    "days_used_this_month", "days_available_this_month",
    "cost_per_km", "budget_cost_per_km",
  ],
  "location-vehicules": [
    "truck_id", "mileage_km", "last_service_km", "damage_reported",
    "turnaround_days_since_return", "days_rented_this_month",
    "days_available_this_month", "contract_end_date",
  ],
  "transporteur-routier": [
    "truck_id", "mileage_km", "last_service_km", "engine_temp", "fuel_level",
    "cargo_category", "cargo_temp", "scheduled_arrival", "actual_arrival",
  ],
  // Names check_energy reads: fuel_level_pct, not fuel_level.
  "energy": ["generator_id", "fuel_level_pct", "coolant_temp"],
  "centrale-production": [
    "generator_id", "output_kw", "rated_kw", "fuel_level_pct", "coolant_temp",
  ],
  "generateurs-secours": [
    "generator_id", "fuel_level_pct", "coolant_temp", "load_pct",
    "runtime_hours", "last_service_hours",
  ],
  "distribution-energetique": [
    "site_id", "generator_id", "fuel_level_pct", "load_pct", "rated_kw",
  ],
  "supermarche-hypermarche": [
    "product_name", "stock_qty", "min_stock",
    "unit_cost", "expiry_date", "last_sale_date",
    "sales_last_30_days",
  ],
  "epicerie-proximite": [
    "product_name", "stock_qty", "min_stock",
    "unit_cost", "last_sale_date", "sales_last_30_days",
  ],
  "chaine-magasins": [
    "store_id", "product_name", "stock_qty", "min_stock",
    "sales_last_30_days", "unit_cost",
  ],
  "grossiste-distributeur": [
    "client_name", "order_date", "amount", "outstanding_balance",
  ],
  "commerce": ["product_name", "stock_qty", "min_stock", "unit_cost"],
}

/** The columns for a department, else for its sector, else none. */
export function columnsForUpload(department: string | null | undefined, sector: string | null | undefined): string[] {
  return (department && CSV_COLUMNS[department]) || (sector && CSV_COLUMNS[sector]) || []
}

/** A CSV with the header row and nothing else, ready to fill in. */
export function emptyCsv(columns: string[]): string {
  const cell = (value: string) => (/[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

  return `${columns.map(cell).join(",")}\n`
}
