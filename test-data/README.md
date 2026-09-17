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

`logistics-transport.csv` est un fichier unique : le schéma camion n'a
ni temps d'attente ni température, donc il n'y a pas de séquence à
jouer.

## Ce que chaque jeu produit

Vérifié en exécutant le vrai pipeline sur ces fichiers.

| Jeu | Alertes | CRITICAL / WARNING | Équipements | Préventives |
|---|---|---|---|---|
| port | 36 | 16 / 20 | 10 | 4, confirmées 24 h après |
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

Sur la chaîne **port**, les étapes *Arrivée* et *Douane* affichent
toujours « Aucun signal ». Aucune alerte du backend ne s'y rattache :
il n'existe pas encore de signal d'accostage ni de dossier douanier dans
le pipeline. Ce n'est pas un bug d'affichage, c'est une source de
données qui n'existe pas.

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

## Avant le premier import

Si ce n'est pas encore fait, lancez ce SQL sur Supabase. Sans cette
colonne, les alertes sont enregistrées sans activité et le dashboard ne
peut pas séparer les départements :

```sql
alter table alerts add column if not exists business_type text;
create index if not exists alerts_business_type_idx on alerts (sector, business_type);
```
