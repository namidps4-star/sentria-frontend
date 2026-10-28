"""The type of each column the backend's upload checks name, as the backend
reads it. The backend declares no types (pipeline/upload_check.py only lists
names), so this table is the one place they are written down.

Each entry is (type, basis):
  basis "read"  the backend reads this column with that type on a line named in
                the comment, checked when the table was written;
  basis "name"  typed from its name only. Not verified against the reader.
Types:
  text, number, date  as their names say.
  yesno    yes/no words read by alerts.py (the alerts reader's word list).
  flag     yes/no words read by port_flow.py _flag (a different list).
  boolean  a real true/false value only: the backend reads "is False", so any
           text value is read as not set, silently.
A test fails when a spec column is missing here.
"""

TYPES = {
    # --- read by the backend (alerts.py / port_flow.py) ---
    "stock_qty": ("number", "read"),              # alerts.py _num
    "min_stock": ("number", "read"),              # alerts.py _num
    "sales_last_30_days": ("number", "read"),     # alerts.py _num
    "unit_cost": ("number", "read"),              # alerts.py _num
    "expiry_date": ("date", "read"),              # alerts.py _parse_date
    "order_date": ("date", "read"),               # alerts.py _parse_date
    "bought_on_credit": ("yesno", "read"),        # alerts.py yes words
    "inspection_flag": ("flag", "read"),          # port_flow.py _flag
    "medicine_name": ("text", "read"),            # alerts.py _text
    "product_name": ("text", "read"),             # alerts.py _text
    "member_id": ("text", "read"),                # alerts.py _text
    "equipment_id": ("text", "read"),             # alerts.py _text
    "container_id": ("text", "read"),             # alerts.py _text
    "site_id": ("text", "read"),                  # alerts.py _text
    "store_id": ("text", "read"),                 # alerts.py _text
    "client_name": ("text", "read"),              # alerts.py _text
    "production_rate": ("number", "read"),        # alerts.py _num
    "target_rate": ("number", "read"),            # alerts.py _num
    "food_temp": ("number", "read"),              # alerts.py _num
    "max_food_temp": ("number", "read"),          # alerts.py _num
    "days_in_storage": ("number", "read"),        # alerts.py _num
    "max_storage_temp": ("number", "read"),       # alerts.py _num
    "qty": ("number", "read"),                    # alerts.py quantity names
    "fuel_level_pct": ("number", "read"),         # alerts.py _num
    "load_pct": ("number", "read"),               # alerts.py _num
    "rated_kw": ("number", "read"),               # alerts.py _num
    "amount": ("number", "read"),                 # alerts.py _num
    "outstanding_balance": ("number", "read"),    # alerts.py _num
    "containers_aboard": ("number", "read"),      # port_flow.py _num
    "hours_in_customs": ("number", "read"),       # port_flow.py _num
    "docs_missing": ("number", "read"),           # port_flow.py _num
    "free_time_hours_left": ("number", "read"),   # port_flow.py _num
    # --- typed from the name only (not verified against the reader) ---
    "category": ("text", "name"),
    "batch_number": ("text", "name"),
    "fridge_temp": ("number", "name"),
    "reagent_name": ("text", "name"),
    "item_name": ("text", "name"),
    "pharmacy_id": ("text", "name"),
    "pharmacy_name": ("text", "name"),
    "qty_shipped_last_period": ("number", "name"),
    "qty_reordered_this_period": ("number", "name"),
    "days_since_last_shipment": ("number", "name"),
    "Product ID": ("text", "name"),
    "Torque [Nm]": ("number", "name"),
    "Tool wear [min]": ("number", "name"),
    "Rotational speed [rpm]": ("number", "name"),
    "last_maintenance_date": ("date", "name"),
    "hygiene_control_passed": ("boolean", "read"),  # alerts.py: row.get(...) is False
    "storage_temp": ("number", "name"),
    "spare_capacity_kg": ("number", "name"),
    "truck_id": ("text", "name"),
    "mileage_km": ("number", "name"),
    "last_service_km": ("number", "name"),
    "engine_temp": ("number", "name"),
    "fuel_level": ("number", "name"),
    "daily_cycles": ("number", "name"),
    "hydraulic_pressure": ("number", "name"),
    "max_cycles": ("number", "name"),
    "avg_wait_hours": ("number", "name"),
    "vessel_id": ("text", "name"),
    "eta_initial": ("date", "name"),
    "eta": ("date", "name"),
    "berth_window_start": ("date", "name"),
    "berth_window_end": ("date", "name"),
    "declaration_id": ("text", "name"),
    "coolant_temp": ("number", "name"),
    "output_kw": ("number", "name"),
    "generator_id": ("text", "name"),
    "last_sale_date": ("date", "name"),
    # --- added for the other sectors' specs (typed from the name) ---
    "Process temperature [K]": ("number", "name"),
    "actual_arrival": ("date", "name"),
    "scheduled_arrival": ("date", "name"),
    "actual_pickup": ("date", "read"),            # alerts.py _parse_date(actual)
    "scheduled_pickup": ("date", "read"),         # alerts.py _parse_date(scheduled)
    "cargo_temp": ("number", "name"),
    "client_id": ("text", "name"),
    "cost_per_km": ("number", "name"),
    "days_rented_this_month": ("number", "name"),
    "days_used_this_month": ("number", "name"),
    "defect_rate": ("number", "name"),
    "eta_drift_hours": ("number", "name"),
    "foot_traffic": ("number", "name"),
    "last_service_date": ("date", "name"),
    "min_cook_temp": ("number", "name"),
    "oil_level": ("number", "name"),
    "oil_pressure": ("number", "name"),
    "order_amount": ("number", "name"),
    "pos_downtime_minutes": ("number", "name"),
    "pressure": ("number", "name"),
    "qty_shipped": ("number", "name"),
    "rpm": ("number", "name"),
    "runtime_hours": ("number", "name"),
    "sales_last_7_days": ("number", "name"),
    "shrinkage_rate": ("number", "name"),
    "sku": ("text", "name"),
    "temperature": ("number", "name"),
    "tire_age_months": ("number", "name"),
}

# Words that read as "yes" are taken from the backend source by export_schemas.py.
# A value that is neither a yes word nor a no word is read as empty by the backend
# (it is never refused), so the checker reports it.
NO_WORDS = ("0", "0.0", "false", "no", "n", "non")
