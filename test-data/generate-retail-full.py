# -*- coding: utf-8 -*-
"""Realistically sized retail inventories, one per department.

Only the columns a shop can honestly export. shrinkage_rate,
foot_traffic, staff_count and pos_downtime_minutes are deliberately
absent: nobody can supply them per product, and on a file this size the
shop-level ones would fire once per row.
"""
import csv, os, random, sys
from datetime import date, timedelta

sys.path.insert(0, "/home/user/sentria")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "dummy")
import pipeline.alerts as A

KEYS = []
A.send_sms = lambda *a, **k: None
A.save_alert = lambda eq, msg, sev, sec, rs=None, alert_key=None: KEYS.append(alert_key)

OUT = "/home/user/sentria-frontend/test-data"
TODAY = date(2026, 9, 20)
random.seed(20260920)

def d(days):
    return (TODAY + timedelta(days=days)).isoformat()

# ---------------------------------------------------------------
# Product vocabulary, per department
# ---------------------------------------------------------------
SUPER = {
  "Frais": ["Yaourt nature", "Lait UHT", "Beurre doux", "Fromage râpé", "Crème fraîche",
            "Œufs x12", "Jambon blanc", "Pâte feuilletée", "Yaourt à boire", "Fromage blanc"],
  "Boulangerie": ["Pain de mie", "Baguette", "Croissant", "Pain complet", "Brioche"],
  "Épicerie": ["Riz parfumé", "Huile d'arachide", "Pâtes", "Sucre en poudre", "Sel fin",
               "Farine de blé", "Sauce tomate", "Concentré tomate", "Haricots secs", "Semoule"],
  "Liquides": ["Eau minérale", "Boisson gazeuse", "Jus d'orange", "Bière locale", "Sirop menthe"],
  "Hygiène": ["Savon de Marseille", "Dentifrice", "Papier toilette", "Shampooing", "Gel douche"],
  "Entretien": ["Eau de javel", "Liquide vaisselle", "Lessive poudre", "Éponge x3"],
  "Surgelés": ["Poisson pané", "Légumes mélangés", "Frites surgelées", "Glace vanille"],
}
EPICERIE = {
  "Frais": ["Pain de mie", "Lait concentré", "Œufs x6", "Yaourt"],
  "Liquides": ["Sachet d'eau 50cl", "Boisson gazeuse", "Jus local", "Bière locale"],
  "Épicerie": ["Riz 1kg", "Huile 1L", "Sucre 500g", "Sardines boîte", "Lait en poudre",
               "Spaghetti", "Bouillon cube", "Tomate concentrée"],
  "Tabac": ["Cigarettes paquet", "Briquet"],
  "Divers": ["Piles LR20", "Huile moteur", "Ampoule LED", "Recharge téléphone", "Carte SIM"],
  "Maison": ["Bassine plastique", "Balai", "Seau 20L", "Assiette plastique"],
  "Hygiène": ["Savon", "Dentifrice", "Serviette hygiénique", "Papier toilette"],
}
CHAINE = {
  "Textile": ["T-shirt coton", "Jean slim", "Chemise lin", "Veste légère", "Robe été",
              "Pull maille", "Short chino", "Pantalon toile"],
  "Chaussures": ["Sneakers", "Sandales cuir", "Mocassins", "Bottines"],
  "Accessoires": ["Casquette", "Ceinture cuir", "Sac bandoulière", "Écharpe", "Portefeuille"],
  "Enfant": ["T-shirt enfant", "Short enfant", "Robe fillette", "Basket enfant"],
}
GROS = {
  "Épicerie": ["Carton riz 25kg", "Carton huile 12x1L", "Palette sucre", "Carton pâtes x24",
               "Carton sardines x48", "Sac farine 50kg"],
  "Hygiène": ["Carton savon x48", "Carton dentifrice x36", "Carton papier x24"],
  "Liquides": ["Palette eau 12x1.5L", "Carton jus x12", "Palette bière x24"],
  "Frais": ["Carton lait poudre", "Carton beurre x20"],
}
# One global size list gave "Sucre en poudre 40", "Casquette 44" and
# "Sneakers x6". A size only makes sense for the kind of thing it is.
SIZE_GROUPS = {
    "weight":   [" 250g", " 500g", " 1kg", " 5kg", " 25kg"],
    "liquid":   [" 33cl", " 50cl", " 75cl", " 1L", " 1.5L", " 5L"],
    "pack":     [" x6", " x12", " x24"],
    "clothing": [" S", " M", " L", " XL", " XXL"],
    "shoes":    [" 38", " 40", " 42", " 44"],
    "none":     [""],
}
CATEGORY_SIZES = {
    "Frais":       ["weight", "pack", "none"],
    "Boulangerie": ["pack", "none"],
    "Épicerie":    ["weight", "pack"],
    "Liquides":    ["liquid", "pack"],
    "Hygiène":     ["pack", "none"],
    "Entretien":   ["liquid", "weight"],
    "Surgelés":    ["weight"],
    "Tabac":       ["none"],
    "Divers":      ["none", "pack"],
    "Maison":      ["none"],
    "Textile":     ["clothing"],
    "Chaussures":  ["shoes"],
    "Accessoires": ["none"],
    "Enfant":      ["clothing"],
}

def size_for(cat, name):
    # A name that already carries its own size ("Riz 1kg", "Seau 20L",
    # "Carton riz 25kg") must not be given a second one.
    if any(ch.isdigit() for ch in name):
        return ""
    group = random.choice(CATEGORY_SIZES.get(cat, ["none"]))
    return random.choice(SIZE_GROUPS[group])
BRANDS = ["Bonjour", "Sahel", "Atlantique", "Dogbo", "Ouémé", "Zou", "Mono",
          "Kara", "Volta", "Lomé", "Niger", "Bénin"]

def catalogue(vocab, n, seed_prefix):
    """n distinct products from a vocabulary, with sizes and brands."""
    out, seen = [], set()
    cats = list(vocab)
    while len(out) < n:
        cat = random.choice(cats)
        base = random.choice(vocab[cat])
        name = f"{base}{size_for(cat, base)}"
        if random.random() < 0.55:
            name = f"{name} {random.choice(BRANDS)}"
        if name in seen:
            continue
        seen.add(name)
        out.append((f"{seed_prefix}-{len(out)+1:04d}", name, cat))
    return out

# ---------------------------------------------------------------
# One row. `trouble` decides whether this product has a problem.
# ---------------------------------------------------------------
def make_row(sku, name, cat, *, money, expiry, trouble, pace):
    """pace: typical units sold per day for this department."""
    daily = max(0.2, random.lognormvariate(pace, 0.9))
    sales30 = round(daily * 30)
    min_stock = max(2, round(daily * random.uniform(4, 12)))
    lead = random.choice([3, 5, 7, 10, 14, 21])

    # Healthy by default, and healthy has to mean healthy against every
    # check, not just the obvious one. Stock has to clear daily*lead or
    # reorder_risk fires on a well-stocked product, and the two weeks
    # have to be drawn together or a 15% drop appears by coincidence.
    stock = round(max(min_stock * random.uniform(2.0, 4.5),
                      daily * lead * random.uniform(1.6, 2.4)))
    s_prev = round(daily * 7 * random.uniform(0.92, 1.10))
    s7 = round(s_prev * random.uniform(0.94, 1.12))
    exp_days = random.randint(120, 900)
    idle = random.randint(0, 3)

    kind = None
    if trouble:
        kind = random.choice(
            ["stockout", "low", "reorder", "overstock", "drop"]
            + (["expired", "expiring", "slow"] if expiry else [])
            + (["cash"] if money and not expiry else [])
        )
        if kind == "stockout":
            stock = max(0, round(min_stock * random.uniform(0.1, 0.85)))
        elif kind == "low":
            stock = round(min_stock * random.uniform(1.02, 1.45))
        elif kind == "reorder":
            # Above the minimum, so it looks fine, but the sales pace
            # will empty it before the supplier arrives.
            stock = max(min_stock + 1, round(daily * lead * random.uniform(0.45, 0.85)))
            min_stock = max(1, round(stock * random.uniform(0.3, 0.7)))
        elif kind == "overstock":
            stock = round(daily * random.uniform(70, 200))
        elif kind == "drop":
            s_prev = round(daily * 7 * random.uniform(1.6, 3.0))
            s7 = round(s_prev * random.uniform(0.25, 0.6))
        elif kind == "expired":
            exp_days = -random.randint(1, 25)
        elif kind == "expiring":
            exp_days = random.randint(2, 28)
        elif kind == "slow":
            idle = random.randint(65, 150); sales30 = 0; s7 = s_prev = 0
            exp_days = random.randint(20, 110)
        elif kind == "cash":
            idle = random.randint(95, 300); sales30 = 0; s7 = s_prev = 0

    row = {
        "sku": sku, "product_name": name, "category": cat,
        "stock_qty": stock, "min_stock": min_stock,
        "sales_last_30_days": sales30,
        "sales_last_7_days": s7, "sales_previous_7_days": s_prev,
        "supplier_lead_days": lead,
    }
    if money:
        row["unit_cost"] = random.choice([25, 50, 100, 150, 250, 350, 500, 650, 800,
                                          1100, 1500, 2300, 3500, 4200, 6500, 12000])
        row["currency"] = "F CFA"
    if expiry:
        row["expiry_date"] = d(exp_days)
    if money or expiry:
        row["last_sale_date"] = d(-idle)
    return row

DEPARTMENTS = [
    # name, vocab, rows, business_type, money, expiry, pace, trouble rate
    ("retail-supermarche-full.csv", SUPER,    600, "supermarche-hypermarche", True,  True,  1.6, 0.06),
    ("retail-epicerie-full.csv",    EPICERIE, 240, "epicerie-proximite",      True,  False, 0.9, 0.07),
    ("retail-chaine-full.csv",      CHAINE,   420, "chaine-magasins",         False, False, 0.4, 0.06),
    ("retail-grossiste-full.csv",   GROS,     180, "grossiste-distributeur",  False, False, 1.2, 0.08),
]

print()
for fname, vocab, n, bt, money, expiry, pace, rate in DEPARTMENTS:
    prefix = fname.split("-")[1][:3].upper()
    products = catalogue(vocab, n, prefix)
    rows = [make_row(sku, name, cat, money=money, expiry=expiry,
                     trouble=(random.random() < rate), pace=pace)
            for sku, name, cat in products]

    cols = list(rows[0].keys())
    for r in rows:
        for k in r:
            if k not in cols:
                cols.append(k)

    with open(os.path.join(OUT, fname), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})

    tally, flagged = {}, 0
    for r in rows:
        KEYS.clear()
        A.check_equipment({k: v for k, v in r.items() if v != ""},
                          sector="retail", lang="en", business_type=bt)
        hit = [k for k in KEYS if k]
        if hit:
            flagged += 1
        for k in hit:
            tally[k] = tally.get(k, 0) + 1

    total = sum(tally.values())
    print(f"=== {fname}   {bt}")
    print(f"    {len(rows)} products, {len(cols)} columns")
    print(f"    {flagged} products flagged ({flagged/len(rows)*100:.1f}%), {total} alerts")
    for k, c in sorted(tally.items(), key=lambda x: -x[1]):
        print(f"       {c:4}  {k}")
    print()
