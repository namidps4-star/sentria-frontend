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

## Two sizes of file

The four small files above exist to exercise every code path: 4 to 8
rows, and between them all thirteen alert keys. They are a test
fixture, not a shop.

The four `-full` files are what a shop's inventory export actually looks
like.

| File | Activity | Products | Flagged | Alerts |
|---|---|---|---|---|
| `retail-supermarche-full.csv` | `supermarche-hypermarche` | 600 | 34 (5.7%) | 45 |
| `retail-epicerie-full.csv` | `epicerie-proximite` | 240 | 12 (5.0%) | 15 |
| `retail-chaine-full.csv` | `chaine-magasins` | 420 | 25 (6.0%) | 34 |
| `retail-grossiste-full.csv` | `grossiste-distributeur` | 180 | 12 (6.7%) | 16 |

The sizes are what those businesses carry. A mid-size supermarket runs
3,000 to 15,000 SKUs, so 600 is one department's worth rather than the
whole shop. A corner shop really does carry a few hundred lines. A
wholesaler carries the fewest and moves the most.

**The 5 to 7% flagged rate is the point.** In a working shop almost
everything is fine, and a board that lights up every row is a board
nobody reads. Getting there took two corrections: healthy stock has to
clear `daily x supplier_lead_days` or reorder risk fires on a
well-stocked product, and the two sales weeks have to be drawn together
or a 15% drop appears by coincidence. Before those fixes 21% of rows
were flagged, most of them wrongly.

### These files carry only what a shop can honestly export

No `shrinkage_rate`, `foot_traffic`, `staff_count` or
`pos_downtime_minutes`. Nobody can supply those per product, and on a
600-line file the two shop-level ones would fire once per row. Dropping
all four costs 4 of the 13 alerts and keeps 9, including every alert
with money in it. The small files still cover those four.

Columns, by activity:

- **Supermarket**: sku, product_name, category, stock_qty, min_stock,
  the three sales figures, supplier_lead_days, unit_cost, currency,
  expiry_date, last_sale_date
- **Convenience**: the same without expiry_date
- **Chain and wholesaler**: no money columns at all, because neither
  activity has a layer that reads them

Generated with a fixed seed, so regenerating gives the same file.

## The sector has to be `retail`, and the app now sends that

`check_equipment()` dispatches on `sector == "retail"`. Anything it does
not recognise falls through to `check_industry()`, which has nothing to
say about a shop, so the upload lands and produces zero alerts.

The app's own sector id is `commerce`, so for a while every retail upload
from the UI took the wrong branch and every one of these files looked
broken. It cut the other way too: all thirteen retail checks stamp their
alerts `"retail"`, and the dashboard filters on `commerce`, so even a
correct upload would have drawn an empty list.

`lib/sector.ts` translates at the crossing points now: `commerce` goes
out as `retail`, and `retail` comes back in as `commerce`. Uploading
through the UI works, and so does uploading by hand:

```
POST /upload?sector=retail&business_type=supermarche-hypermarche&lang=en
```

`scripts/smoke-sector-mapping.mjs` holds that shut. Ablate the one line
in `lib/sector.ts` that maps the two names and five of its seven
assertions fail.

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

`category` and `store` are carried for readability. Nothing reads them.

**`store_id` is deliberately absent.** The entity on an alert is
`row.get("store_id", row.get("product_name", row.get("sku")))`, so a
column called `store_id` wins over the product name and every alert in
the file comes out labelled with the shop: "MAG-COTONOU-01 - Stock-out
imminent: 4 units left", with no way to tell which product ran out. The
shop is in a `store` column here instead, which nothing reads, and the
one row that genuinely IS a shop-level thing carries the shop in its
own name ("Caisse 4 - MAG-COTONOU-03").

There is no second entity to put a shop in. One row produces alerts
about one named thing.

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

## Fields per activity

Derived by ablation, not by reading: for each activity, each field was
removed from a row that fired everything, and the alerts that
disappeared were recorded.

Totals: supermarket 12 alert keys, convenience store 10, chain stores 9,
wholesaler 9. Thirteen distinct keys across all four.

### The floor, for all four

| Column | Enables |
|---|---|
| `product_name` or `sku` | The name on the alert. Without it every alert says "Unknown". |
| `stock_qty` | Everything. Stock-out, overstock, reorder, and both money layers hang off it. |
| `min_stock` | `stock.critical_low`, `stock.low` |

Three columns, and a shop gets the stock-out pair. That is the honest
minimum.

### Supermarket / hypermarket, `supermarche-hypermarche`

| Column | Enables | Have it? |
|---|---|---|
| `stock_qty` | everything below | inventory export |
| `min_stock` | `stock.critical_low`, `stock.low` | set once, per product |
| `unit_cost` | `expiry.expired_value`, `expiry.warning_value` | inventory export |
| `expiry_date` | both expiry alerts, and `slow_mover.expiry_risk` | delivery note, per batch |
| `last_sale_date` | `slow_mover.expiry_risk` | sales log |
| `sales_last_30_days` | `stock.reorder_risk`, `stock.overstock` | sales log |
| `sales_last_7_days` + `sales_previous_7_days` | `sales.drop` | sales log |
| `shrinkage_rate` | `shrinkage.critical`, `shrinkage.warning` | stock count |
| `pos_downtime_minutes` | `pos.downtime` | POS admin log, shop-level |
| `foot_traffic` + `staff_count` | `staffing.understaffed` | door counter and rota, shop-level |

Minimum worth uploading: `product_name, stock_qty, min_stock,
unit_cost, expiry_date`. Five columns and the money alerts work.

### Convenience store, `epicerie-proximite`

Same as above, except `expiry_date` buys nothing and `last_sale_date`
does something different.

| Column | Enables |
|---|---|
| `unit_cost` | `deadstock.cash_locked` |
| `last_sale_date` | `deadstock.cash_locked` |
| `expiry_date` | nothing. This activity has no expiry layer. |

Minimum: `product_name, stock_qty, min_stock, unit_cost,
last_sale_date`.

### Chain stores, `chaine-magasins`, and wholesaler, `grossiste-distributeur`

Identical field requirements. General checks only, so **`unit_cost`,
`currency`, `expiry_date` and `last_sale_date` do nothing at all** on
these two. There is no money layer to spend them on.

| Column | Enables |
|---|---|
| `stock_qty`, `min_stock` | `stock.critical_low`, `stock.low` |
| `sales_last_30_days` | `stock.reorder_risk`, `stock.overstock` |
| `target_days_of_inventory` | tunes `stock.overstock` |
| `shrinkage_rate` | `shrinkage.critical`, `shrinkage.warning` |
| `pos_downtime_minutes` | `pos.downtime` |
| `foot_traffic` + `staff_count` | `staffing.understaffed` |
| `sales_last_7_days` + `sales_previous_7_days` | `sales.drop` |

Minimum: `product_name, stock_qty, min_stock`, and
`sales_last_30_days` if reorder risk matters, which for a wholesaler it
usually does.

### Thresholds, which are not requirements

These are read by every activity but all carry a default, so leaving
them out never silences an alert. It only moves the line.

| Column | Default |
|---|---|
| `supplier_lead_days` | `7` |
| `target_days_of_inventory` | `30` |
| `max_shrinkage_rate` | `2.0` |
| `max_pos_downtime_minutes` | `15` |
| `max_customers_per_staff` | `30` |
| `currency` | `€` |

They belong in Settings, asked once, not repeated on every product row.

## What fires, and why

### `retail-supermarche.csv`

| Product | Alert |
|---|---|
| Yaourt nature 1kg | Expired, 31 200 F CFA lost |
| Lait UHT 1L | Expires in 18 days, 150 000 F CFA at risk |
| Sauce tomate bio 400g | Idle 87 days, expires in 86, 126 000 F CFA recoverable |
| Riz parfumé 5kg | Stock-out imminent, and will run out before delivery |
| Whisky import 70cl | Critical shrinkage 7.4% |
| Caisse 4 - MAG-COTONOU-03 | Checkout down 64 min, and 400 customers per staff member |
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

## Shop-level columns repeat on every row, and so do their alerts

`foot_traffic`, `staff_count` and `pos_downtime_minutes` describe the
shop, not the product, but they are read off the same per-product row.
Put a real checkout outage on a 400-line inventory file and it fires
400 times:

```
Riz 5kg    -> Checkout down for 64 min : sales are blocked
Lait 1L    -> Checkout down for 64 min : sales are blocked
Savon      -> Checkout down for 64 min : sales are blocked
```

These files avoid that by carrying the shop-level numbers on one
dedicated row and leaving the thresholds high enough elsewhere that
nothing trips. That is a workaround for test data, not a fix. A real
shop needs those four signals somewhere other than the product file.

## The dates are fixed, and they will age

`expiry_date` and `last_sale_date` are absolute, and the checks compare
them against today. These were written for **2026-09-20**. Months from
now the expiry rows stop reading the way they do here: "expires in 18
days" becomes another expired row, and the slow-mover window closes.
Shift the dates forward, or regenerate, before using this for a demo
far from that date.
