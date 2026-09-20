# Retail test data

Four CSVs, one per retail activity. Every row was run through the real
`check_equipment()` before being written, so each one fires exactly what
this file says it fires. Between them they cover all thirteen
`retail.*` alert keys, plus a healthy row in three of the four files so
the "OK" state is visible too.

| File | Activity (`business_type`) | Rows | Alerts |
|---|---|---|---|
| `retail-supermarche.csv` | `supermarche-hypermarche` | 8 | 9 |
| `retail-epicerie.csv` | `epicerie-proximite` | 6 | 8 |
| `retail-chaine.csv` | `chaine-magasins` | 6 | 11 |
| `retail-grossiste.csv` | `grossiste-distributeur` | 4 | 8 |

## Before you upload: the sector has to be `retail`

`check_equipment()` dispatches on `sector == "retail"`. Anything it does
not recognise falls through to `check_industry()`, which has nothing to
say about a shop, so the upload lands and produces zero alerts.

The app's own sector id for this is `commerce`, and nothing maps it to
`retail`, so uploading through the UI currently takes the wrong branch.
Until that is fixed, upload with the sector spelled `retail`:

```
POST /upload?sector=retail&business_type=supermarche-hypermarche&lang=en
```

## What each activity's checks read

All four run `check_general_retail()`. Two of them add a layer on top.

### Every retail row

| Column | Default if absent | What it drives |
|---|---|---|
| `store_id` / `product_name` / `sku` | `"Unknown"` | The entity name on the alert. First one present wins. |
| `stock_qty` | — | Stock-out and overstock |
| `min_stock` | `0` | Stock-out thresholds |
| `sales_last_30_days` | — | The daily pace behind reorder and overstock |
| `supplier_lead_days` | `7` | Reorder risk |
| `target_days_of_inventory` | `30` | Overstock |
| `shrinkage_rate` | — | Shrinkage |
| `max_shrinkage_rate` | `2.0` | Shrinkage thresholds |
| `pos_downtime_minutes` | — | Checkout downtime |
| `max_pos_downtime_minutes` | `15` | Downtime threshold |
| `foot_traffic` | — | Staffing |
| `staff_count` | — | Staffing |
| `max_customers_per_staff` | `30` | Staffing threshold |
| `sales_last_7_days` | — | Week-on-week drop |
| `sales_previous_7_days` | — | Week-on-week drop |

`category` is carried in these files for readability. Nothing reads it.

### Supermarket adds the expiry-in-money layer

| Column | Default | What it drives |
|---|---|---|
| `unit_cost` (or `purchase_price`) | — | The money in every expiry alert |
| `currency` | `€` | The symbol on that amount |
| `expiry_date` | — | Expired, and expiring inside 30 days |
| `last_sale_date` | — | Slow mover heading for expiry |

The expiry alerts only fire with a real purchase price behind them.
Without one there is no honest amount to name, so nothing is said.

### Convenience store adds cash locked in dead stock

| Column | Default | What it drives |
|---|---|---|
| `unit_cost` (or `purchase_price`) | — | The cash amount |
| `currency` | `€` | The symbol |
| `last_sale_date` | — | How long the money has been sitting |

`retail.stock.overstock` already fires in units. This one names the
cash instead, which is the number that changes a cash-constrained
owner's next order.

### Chain stores and wholesaler

General retail checks only. No expiry, no cash-locked. The files carry
no money columns, on purpose: they show what the default path does with
the minimum a shop can supply.

## What fires, and why

### `retail-supermarche.csv`

| Product | Alert |
|---|---|
| Yaourt nature 1kg | Expired, 31 200 F CFA lost |
| Lait UHT 1L | Expires in 18 days, 150 000 F CFA at risk |
| Sauce tomate bio 400g | Idle 87 days, expires in 86, 126 000 F CFA recoverable |
| Riz parfumé 5kg | Stock-out imminent, and will run out before delivery |
| Whisky import 70cl | Critical shrinkage 7.4% |
| Caisse 4 | Checkout down 64 min, and 400 customers per staff member |
| Boisson gazeuse 1.5L | Sales down 47.1% week on week |
| Savon de Marseille | OK |

### `retail-epicerie.csv`

| Product | Alert |
|---|---|
| Huile moteur 5L | 234 000 F CFA tied up, no sales for 141 days |
| Piles LR20 x4 | 108 000 F CFA tied up, no sales for 155 days |
| Pain de mie | Stock-out imminent, and will run out before delivery |
| Cigarettes paquet | Rising shrinkage 2.9% |
| Bassine plastique 30L | 750 days of cover, sales down 50%, 345 000 F CFA tied up |
| Sachet d'eau 50cl | OK |

### `retail-chaine.csv`

| Product | Alert |
|---|---|
| T-shirt coton L | Stock-out imminent, and will run out before delivery |
| Jean slim 32 | 130 days of cover, sales down 20% |
| Sneakers 42 | Reorder risk, shrinkage 5.2%, checkout down 38 min, 245 per staff |
| Veste légère M | 245 customers per staff, sales down 54.2% |
| Ceinture cuir 90cm | Low stock, the warning tier below a stock-out |
| Casquette unisexe | OK |

### `retail-grossiste.csv`

| Product | Alert |
|---|---|
| Carton savon x48 | Stock-out imminent, and will run out before delivery |
| Palette riz 25kg | 87 days of cover |
| Carton huile 12x1L | Reorder risk, shrinkage 4.6%, 70 customers per staff |
| Carton lait poudre | Reorder risk, sales down 48.3% |

## The dates are fixed, and they will age

`expiry_date` and `last_sale_date` are absolute, and the checks compare
them against today. These were written for **2026-09-20**. Months from
now the expiry rows stop reading the way they do here: "expires in 18
days" becomes another expired row, and the slow-mover window closes.
Shift the dates forward, or regenerate, before using this for a demo
far from that date.
