# Passation SentrIA

> Note de passation rédigée le 2026-09-17. Trois dépôts concernés, deux
> déjà en production, un en attente de merge.

---

## 1. L'objectif

Rendre SentrIA réellement utilisable sur trois fronts qui avançaient en
parallèle.

**a. Couvrir les quatre métiers de la santé, pas seulement la pharmacie.**
L'onboarding proposait Pharmacie, Grossiste-répartiteur, Clinique/Hôpital
et Laboratoire. Le backend n'implémentait que les contrôles d'une officine
et appliquait les mêmes aux trois autres.

**b. Réparer Ask AI**, qui ne répondait plus du tout.

**c. Rendre le tableau de bord honnête.** Il devait refléter l'activité
réellement choisie à l'onboarding et les données réellement importées, au
lieu d'afficher des panneaux figés avec des chiffres inventés.

**d. Rendre la landing page premium, vivante et intuitive.**

---

## 2. La problématique qu'on essaye de résoudre

Le fil conducteur de toute la session : **l'interface affirmait des choses
que les données ne soutenaient pas.**

Quatre formes du même problème, par ordre de gravité.

### Les alertes n'étaient pas séparées par métier

`save_alert()` n'enregistrait que `sector`. Une pharmacie, un grossiste,
un hôpital et un laboratoire écrivaient tous `sector: "health"` et
tombaient dans le même panier. Un laboratoire voyait donc les alertes
d'une pharmacie.

C'est la cause racine que j'ai d'abord manquée : mon premier correctif
n'avait renommé que les libellés des cartes, ce qui était cosmétique. Les
lignes elles-mêmes restaient indistinguables.

### Zéro n'était pas distingué de « aucune donnée »

Quatre cartes à `0` et une courbe plate se lisent comme « tout va bien ».
C'est une affirmation très différente de « rien n'a été importé ». Sans
données, le tableau de bord rassurait à tort.

### Les graphiques mentaient

Chaque carte KPI portait un tableau `spark` codé en dur, 32 au total,
dessiné comme s'il s'agissait de sept jours d'historique. Et le graphique
de répartition comptait les alertes en cherchant des mots français dans le
message (`rupture`, `bas`, `froid`, `expir`).

Mesuré sur les quatre jeux d'essai : un laboratoire et un grossiste
n'utilisent aucun de ces mots, leur graphique était donc toujours vide. Et
en anglais, trois des quatre colonnes tombaient à zéro même pour une
pharmacie, puisque les mots recherchés n'existent que dans les traductions
françaises. Le graphique comparait des traductions.

### Un échec ressemblait à un succès

Côté Ask AI, toute erreur renvoyait HTTP 200 avec la même phrase, et le
`catch` du frontend ne journalisait rien. Trois causes très différentes
étaient indiscernables. Côté import CSV, un échec s'affichait **en vert**,
comme une réussite.

---

## 3. Les fichiers importants sur lesquels il bosse

### Backend — `namidps4-star/Sentria`, branche `main` (déployée sur Render)

| Fichier | Rôle |
|---|---|
| `pipeline/alerts.py` | Cœur du système. ~2000 lignes. Contient le routeur `check_health()`, les quatre contrôles métier, et `save_alert()` |
| `pipeline/lab_panels.py` | **Nouveau.** `TEST_PANELS` : quels réactifs chaque analyse consomme. C'est ici qu'on configure un nouveau laboratoire |
| `pipeline/critical_supplies.py` | **Nouveau.** Catégories sans alternative en pharmacie (oxygène, sang, perfusion, antivenin, urgence, vaccin), avec synonymes FR/EN |
| `pipeline/i18n.py` | Messages fr + en. 8 nouvelles clés |
| `pipeline/action_map.py` | Action recommandée par clé d'alerte |
| `api/main.py` | FastAPI. CORS, `/health`, `/ask`, `/upload`, `/alerts` |
| `pipeline/demo_laboratory.py`<br>`pipeline/demo_hospital.py`<br>`pipeline/demo_wholesaler.py` | **Nouveaux.** Démos avec assertions. À relancer après toute modification |

### Frontend — `namidps4-star/sentria-frontend`, branche `feature/onboarding-view`

| Fichier | Rôle |
|---|---|
| `components/sentria/dashboard-view.tsx` | ~2400 lignes. Le fichier le plus modifié : `SECTOR_META`, `dailySeries()`, `alertBreakdown()`, `activityOf()`, filtrage par activité, états vides |
| `components/sentria/onboarding-modal.tsx` | Badges de maturité, `CSV_COLUMNS`, panneau d'import CSV |
| `components/sentria/ask-view.tsx` | Chat. Indicateur de rédaction, région live, gestion d'erreurs |
| `lib/api.ts` | **Nouveau.** `API_BASE`, source unique de l'URL backend |
| `components/sentria/recommendations-panel.tsx` | Catégories `diagnostics` / `critical_supply` / `distribution` |
| `.claude/skills/` | 41 compétences installées (~13 Mo) |

### Landing page — `namidps4-star/sentria-landing-page`, branche `feature/premium-redesign`

| Fichier | Rôle |
|---|---|
| `index.html` | Fichier unique, 4569 lignes. CSS et JS ajoutés en fin de bloc pour ne pas toucher au parallaxe du hero ni au sélecteur de langue existants |

---

## 4. Ce qu'il a essayé et qui a raté

Les erreurs réelles, pas une liste de succès.

### Le correctif cosmétique du tableau de bord

J'ai d'abord renommé les libellés des cartes KPI par activité et annoncé
que les métiers étaient séparés. **C'était faux.** Les alertes partageaient
toujours `sector: "health"`. L'utilisateur l'a vu immédiatement : « je vois
encore des trucs de pharmacie avec clinique, lab ». Il a fallu remonter
jusqu'à `save_alert()`.

**Leçon :** renommer un affichage ne sépare pas des données.

### Le diagnostic CORS abandonné à tort

J'avais identifié que la liste blanche CORS bloquait leur origine. Puis je
me suis rétracté en raisonnant que « si le tableau de bord marche, CORS va
bien ». Le test a montré que leur origine réelle
(`sentria-dashboard-git-...`) était bel et bien bloquée : HTTP 400
`Disallowed CORS origin`, exactement 22 octets.

**Leçon :** j'ai déduit au lieu de demander l'URL. Une question aurait
tranché en une minute.

### L'URL cherchée dans un seul fichier

J'ai lu `ask-view.tsx`, trouvé une URL Railway morte, et construit une
théorie autour. Je n'ai pas cherché l'URL dans les autres vues. Elle était
déclarée **deux fois**, et seule la copie du tableau de bord avait été mise
à jour lors du passage à Render. Un `grep` global l'aurait montré tout de
suite.

### La garde de panneau trop permissive

Pour les laboratoires, j'avais inclus un panel dès qu'**un** de ses
réactifs apparaissait. Comme la solution de calibration est partagée entre
plusieurs analyses, importer un seul réactif faisait remonter des analyses
que le labo ne pratique pas, en CRITIQUE à « 0 test possible ». Corrigé en
exigeant que **tous** les réactifs du panel soient présents.

Trouvé seulement en passant de vrais CSV dans le pipeline, pas en relisant
le code.

### Une assertion de démo écrite à l'envers

J'avais affirmé que 15 analyses restantes déclenchaient un CRITIQUE. Le
seuil est à 10. Le code avait raison, mon test avait tort.

### La régression du lien d'évitement

En ajoutant le lien « Skip to content » sur la landing page, je l'ai fait
pointer vers `#main` alors que `<main>` n'avait pas d'`id`. J'ai introduit
un lien mort en corrigeant des liens morts. Rattrapé par la vérification
des ancres.

### Une fausse alerte visuelle

Sur la capture de la landing page, le titre semblait coupé à gauche. Après
mesure dans le navigateur, la boîte était correcte (130 → 630, aucun
débordement) : c'était un artefact d'affichage de l'image, pas un bug. J'ai
failli « corriger » une mise en page qui n'avait rien.

### Limite structurelle de la session

**Je n'ai jamais pu atteindre le site en ligne.** Le proxy du bac à sable
bloque Render et Vercel (403 sur CONNECT). Tout ce que j'affirme sur le
backend et le frontend a été vérifié en exécutant le code localement, pas
contre le déploiement réel.

Deux bugs sur trois ont été trouvés par l'utilisateur en regardant son
écran, pas par moi. La landing page est la seule surface que j'ai pu
vérifier dans un vrai navigateur, parce que c'est un fichier statique.

---

## 5. Ce qu'il compte faire ensuite

### Bloquant, côté utilisateur

**1. Exécuter la migration SQL.** Sans elle, la séparation par métier
reste approximative.

```sql
alter table alerts add column if not exists business_type text;
create index if not exists alerts_business_type_idx
  on alerts (sector, business_type);
```

Rien ne casse si elle n'est pas faite : `save_alert()` retombe sur un
enregistrement sans étiquette plutôt que de perdre l'alerte, ce chemin est
testé. Mais un hôpital réutilise la clé partagée `health.stock.low` pour
ses articles non critiques, et ces lignes-là continueront d'apparaître sous
Pharmacie tant que la colonne n'existe pas.

**2. Confirmer que Ask AI répond.** `/health` renvoie déjà
`model: gemini-3.5-flash-lite`, clés Gemini et Supabase prêtes. Il reste à
envoyer un message dans le chat. En cas d'échec, la console nomme
désormais la cause.

**3. Valider les quatre CSV d'essai.** Les fichiers sont fournis. Deux
points à regarder : le labo doit désigner **Réactif A** comme réactif
limitant (16 unités) et non la solution de calibration (9 unités, mais 0.5
par test) ; et l'oxygène doit sortir en CRITIQUE alors que les compresses,
au même ratio de 60 % du minimum, restent un simple avertissement.

**4. Décider du merge frontend.** 14 commits sur
`feature/onboarding-view`. Ce dépôt n'a **aucune branche `main`** : tout le
travail vit sur cette seule branche, sans version stable de repli.

### Travail restant identifié

| Sujet | Détail |
|---|---|
| Alertes déjà périmées | Les clés `lab.reagent.expiring` et `hospital.critical_supply.expiring` ne couvrent que `0 <= jours < 30`. Un réactif ou une poche de sang **déjà** périmés ne déclenchent rien. Quatrième clé à ajouter |
| 15 clés `industry.*` sans traduction | Antérieur à cette session. Elles sont déclenchées par `alerts.py` mais absentes de `i18n.py` et `action_map.py`, donc affichées en texte brut |
| Anciennes alertes non étiquetées | Impossible à rétro-remplir : rien dans ces lignes n'indique le métier d'origine. Elles disparaîtront d'elles-mêmes à mesure que des données étiquetées arrivent. Les supprimer est sans risque |
| Vues non auditées | `logistics-*`, `industry-*`, `sites-view`, `settings-view`, `report-view` n'ont pas été passées au crible accessibilité |
| Point de notification figé | Dans `topbar.tsx`, la pastille « non lues » est toujours affichée. Je l'ai étiquetée en conséquence, mais le libellé devra devenir conditionnel quand il y aura de vraies notifications |
| `Procfile.txt` | Render ne le lit pas : il attend `Procfile` ou un `render.yaml`, et utilise en pratique la commande du tableau de bord. La commande qu'il contient est correcte, à vérifier côté Render |
| API sans authentification | CORS ne protège que les navigateurs. N'importe quel appel serveur peut consommer le quota Gemini via `/ask`. À traiter avant une mise en production réelle |

### Sur la landing page

La branche `feature/premium-redesign` est poussée et vérifiée dans un vrai
navigateur. Restent deux pistes que je n'ai pas prises, faute de mandat
clair :

- Les sections alternent `section-light` / `section-dark`. C'est un rythme
  éditorial défendable, mais l'audit signale les ruptures de fond comme un
  motif à surveiller. À trancher avec un regard humain.
- Aucune image de fond nulle part. Plusieurs sections sont du texte sur
  fond uni. L'audit recommande des fonds photographiques discrets pour
  donner de la présence.

---

## Conventions à garder

- **Jamais de tirets cadratins** dans les réponses. Demande explicite.
- **Résumés en format « ADHD friendly »** : titres scannables, listes
  courtes, gras sur l'essentiel, tableaux plutôt que paragraphes, mauvaises
  nouvelles marquées.
- **Messages de commit en anglais normal**, jamais compressés.
- **Relancer `pipeline/demo_supplier.py` après toute modification du
  backend.** Sa sortie doit rester identique au caractère près : c'est le
  garde-fou qui prouve que le comportement pharmacie n'a pas bougé.
