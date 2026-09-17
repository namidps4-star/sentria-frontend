# Jeux de données de test

Ces CSV sont faits pour remplir les vues logistique avec de vraies
alertes, produites par le vrai pipeline. Chaque colonne correspond à ce
que `check_logistics()` et `check_logistics_transport()` lisent
réellement dans `pipeline/alerts.py`.

## Comment importer

Sur le dashboard : bouton **Importer CSV**. Choisissez le secteur
**Logistique**, puis l'activité qui correspond au fichier. L'activité
compte : elle décide de la chaîne affichée et de l'étape sur laquelle
chaque signal se rattache.

| Fichiers | Activité à sélectionner |
|---|---|
| `logistics-port-*.csv` | Port & conteneurs |
| `logistics-froid-*.csv` | Chaîne du froid |
| `logistics-transport.csv` | Transport & distribution |

## Important : l'ordre des fichiers numérotés

Les fichiers `1`, `2`, `3` forment une séquence. Importez-les **dans
l'ordre, en laissant passer du temps entre chaque** (une heure suffit,
une journée est plus réaliste).

La raison : la vue **Anticipation** mesure l'avance réelle de SentrIA,
c'est-à-dire l'écart entre une alerte préventive et le moment où un
seuil est effectivement franchi. Cet écart n'existe que si les deux
événements sont séparés dans le temps. Si vous importez les trois
fichiers d'affilée, l'avance mesurée sera de quelques secondes.

1. **`-1-seuils.csv`** : des seuils sont franchis. Remplit Blocages,
   Temps d'attente et Coûts, et constitue l'historique par équipement.
2. **`-2-preventif.csv`** : plus aucun seuil n'est franchi, mais le score
   composite dépasse 55 grâce à cet historique. C'est la seule condition
   qui déclenche `logistics.risk.elevated`, l'alerte préventive.
3. **`-3-confirmation.csv`** : les mêmes équipements franchissent leurs
   seuils. Chaque franchissement confirme la prédiction de l'étape 2, et
   l'écart entre les deux imports devient l'avance mesurée.

**`-4-arrivee-douane.csv`** peut être importé à n'importe quel moment,
il ne dépend pas de la séquence. Il remplit les deux étapes du début de
chaîne : *Arrivée* (accostage) et *Douane*. Un seul fichier contient les
deux formes de ligne, une par navire et une par dossier douanier, et
c'est la ligne elle-même qui décide des contrôles appliqués.

`logistics-transport.csv` est un fichier unique : le schéma camion n'a
ni temps d'attente ni température, donc il n'y a pas de séquence à
jouer.

## Ce que chaque jeu produit

Vérifié en exécutant le vrai pipeline sur ces fichiers.

| Jeu | Alertes | CRITICAL / WARNING | Équipements | Préventives |
|---|---|---|---|---|
| port (1 à 3) | 36 | 16 / 20 | 10 | 4, confirmées 24 h après |
| port + arrivée/douane (1 à 4) | 54 | 26 / 28 | 19 | 4, confirmées 24 h après |
| froid | 37 | 18 / 19 | 6 | 3, confirmées 24 h après |
| transport | 12 | 6 / 6 | 6 | aucune |

Chaque jeu contient volontairement des équipements sains, pour que les
vues ne soient pas uniformément rouges.

## Ce qui reste vide, et pourquoi

Avec le jeu **transport**, seule la vue Blocages se remplit. Les trois
autres affichent leur état vide, et c'est correct : le schéma camion
(`truck_id`, `mileage_km`, `engine_temp`, `oil_level`, `tire_age_months`)
ne contient aucun temps d'attente, aucune température et aucun
dépassement chiffrable. Les kilomètres depuis l'entretien ne sont pas
chiffrés en euros, parce que le taux configurable est un taux par jour.

Si vous n'importez pas `-4-arrivee-douane.csv`, les étapes *Arrivée* et
*Douane* resteront à « Aucun signal » : ce sont les seules lignes qui les
alimentent.

## Seuils utilisés

`check_logistics()`, colonnes `equipment_id`, `daily_cycles`,
`max_cycles`, `hydraulic_pressure`, `min_hydraulic_pressure`,
`fuel_level`, `avg_wait_hours`, `last_service_date`, `temperature`,
`max_temperature` :

| Signal | WARNING | CRITICAL |
|---|---|---|
| Cycles | `> max × 0,9` | `>= max` |
| Pression hydraulique | | `< min` |
| Carburant | `< 25 %` | |
| Temps d'attente | `> 4 h` | `> 8 h` |
| Entretien | `> 30 jours` | |
| Température | `> max − 2` | `> max` |
| Score composite | `>= 55` et aucun seuil franchi | |

`check_logistics_transport()`, colonnes `truck_id`, `mileage_km`,
`last_service_km`, `service_limit_km`, `engine_temp`,
`max_engine_temp`, `oil_level`, `fuel_level`, `tire_age_months` :

| Signal | WARNING | CRITICAL |
|---|---|---|
| Entretien | `km > limite` | `km > limite × 1,5` |
| Moteur | | `temp > max` |
| Huile | | `< 0,3` |
| Carburant | `< 20 %` | |
| Pneus | `> 24 mois` | |

`check_logistics_port()`, lignes navire, colonnes `vessel_id`,
`eta_initial`, `eta`, `berth_window_start`, `berth_window_end`,
`containers_aboard`, `discharge_rate_per_hour` :

| Signal | WARNING | CRITICAL |
|---|---|---|
| Créneau de quai | ETA à moins de 2 h de la fermeture | ETA après la fermeture |
| Décalage d'ETA | `>= 4 h` | `>= 12 h` |
| Volume à décharger | dépasse le créneau | dépasse de `>= 6 h` |

Lignes douane, colonnes `declaration_id`, `container_id`,
`hours_in_customs`, `docs_missing`, `inspection_flag`,
`free_time_hours_left`, `median_clearance_hours` :

| Signal | WARNING | CRITICAL |
|---|---|---|
| Franchise | | sortie projetée au-delà de la franchise restante |
| Documents | `1` ou `2` manquants | `>= 3` |
| Temps en douane | `> médiane × 1,5` | `> médiane × 2` |
| Contrôle | | contrôle ouvert et franchise `< 24 h` |

La sortie projetée se calcule comme suit : ce qu'il reste par rapport à
votre médiane, plus 6 h par document manquant, plus 24 h si un contrôle
est ouvert. Ces deux pénalités sont des hypothèses, écrites en haut de
`pipeline/port_flow.py` pour que vous puissiez les ajuster par site.
`median_clearance_hours` est votre propre médiane sur des dossiers
comparables : c'est elle qui rend le signal spécifique à votre
exploitation plutôt qu'à une moyenne de marché.

## Avant le premier import

Si ce n'est pas encore fait, lancez ce SQL sur Supabase. Sans cette
colonne, les alertes sont enregistrées sans activité et le dashboard ne
peut pas séparer les départements :

```sql
alter table alerts add column if not exists business_type text;
create index if not exists alerts_business_type_idx on alerts (sector, business_type);
```
