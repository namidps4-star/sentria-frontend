# Passation SentrIA

> Rédigée le 2026-09-17. Trois dépôts, tous poussés, rien en attente
> localement.
>
> | Dépôt | Branche | HEAD | État |
> |---|---|---|---|
> | `namidps4-star/Sentria` | `main` | `e7f58ac` | déployé sur Render |
> | `namidps4-star/sentria-landing-page` | `main` | `a3d8a8a` | mergé |
> | `namidps4-star/sentria-frontend` | `feature/onboarding-view` | `880d08d` | **jamais mergé, aucune branche `main` n'existe** |

---

## 1. L'objectif

Rendre SentrIA utilisable sur quatre fronts menés en parallèle.

**a. Couvrir les quatre métiers de la santé.** L'onboarding proposait
Pharmacie, Grossiste-répartiteur, Clinique/Hôpital et Laboratoire. Le
backend n'implémentait que les contrôles d'une officine et appliquait les
mêmes aux trois autres.

**b. Réparer Ask AI**, qui ne répondait plus du tout.

**c. Rendre le tableau de bord honnête.** Qu'il reflète l'activité choisie
à l'onboarding et les données réellement importées, au lieu de panneaux
figés remplis de chiffres inventés.

**d. Rendre la landing page premium, vivante et intuitive.**

Puis, sur demande : audit accessibilité, alignement de la palette, et
installation de plusieurs packs de compétences de design.

---

## 2. La problématique qu'on essaye de résoudre

Un seul fil conducteur : **l'interface affirmait des choses que les
données ne soutenaient pas.** Cinq formes, par ordre de gravité.

### Les alertes n'étaient pas séparées par métier

`save_alert()` n'enregistrait que `sector`. Pharmacie, grossiste, hôpital
et laboratoire écrivaient tous `sector: "health"` et tombaient dans le
même panier. Un laboratoire voyait les alertes d'une pharmacie.

C'est la cause racine que j'ai d'abord manquée : mon premier correctif
n'avait renommé que les libellés des cartes. Cosmétique. Les lignes
restaient indistinguables.

### Zéro ne se distinguait pas de « aucune donnée »

Quatre cartes à `0` et une courbe plate se lisent « tout va bien ». C'est
une affirmation très différente de « rien n'a été importé ». Sans données,
le tableau de bord rassurait à tort.

### Les graphiques mentaient, dans les deux langues

Chaque carte KPI portait un tableau `spark` codé en dur, 32 au total,
dessiné comme sept jours d'historique. Et le graphique de répartition
comptait les alertes en cherchant des mots **français** dans le message
(`rupture`, `bas`, `froid`, `expir`).

Mesuré : un laboratoire et un grossiste n'emploient aucun de ces mots,
leur graphique était donc toujours vide. Et en anglais, trois colonnes sur
quatre tombaient à zéro même pour une pharmacie, puisque ces mots
n'existent que dans les traductions françaises. Le graphique comparait des
traductions.

### Un échec ressemblait à un succès

Côté Ask AI, toute erreur renvoyait HTTP 200 avec la même phrase et le
`catch` du frontend ne journalisait rien : trois causes indiscernables.
Côté import CSV, un échec s'affichait **en vert**.

### Le thème sombre n'avait jamais reçu la marque

La palette claire avait été personnalisée au vert lime et au crème. La
sombre était restée en neutres shadcn d'origine. Mesuré au navigateur :
`--ring` sombre était un gris moyen et `--chart-1` à `--chart-5` avaient
tous une chroma nulle. Conséquence : **tous les anneaux de focus étaient
quasi invisibles sur fond sombre**, et les graphiques rendaient en
monochrome. Aucun token ne portait le lime, ce qui explique pourquoi trois
appels avaient écrit `#a3e635` à la main.

---

## 3. Les fichiers importants sur lesquels il bosse

### Backend : `namidps4-star/Sentria`, branche `main`

| Fichier | Rôle |
|---|---|
| `pipeline/alerts.py` | Cœur du système, ~2000 lignes. Routeur `check_health()`, les quatre contrôles métier, `save_alert()`, le `ContextVar` qui étiquette les alertes |
| `pipeline/lab_panels.py` | **Nouveau.** `TEST_PANELS` : quels réactifs chaque analyse consomme. C'est ici qu'on configure un nouveau laboratoire |
| `pipeline/critical_supplies.py` | **Nouveau.** Catégories sans alternative en pharmacie (oxygène, sang, perfusion, antivenin, urgence, vaccin), synonymes FR/EN |
| `pipeline/i18n.py` | Messages fr + en. 25 clés ajoutées cette session |
| `pipeline/action_map.py` | Action recommandée par clé. 25 entrées ajoutées |
| `api/main.py` | FastAPI. CORS, `/health`, `/ask`, `/upload`, `/alerts` |
| `pipeline/demo_supplier.py` | **Le garde-fou.** Sa sortie doit rester identique au caractère près après toute modification |
| `pipeline/demo_laboratory.py`<br>`pipeline/demo_hospital.py`<br>`pipeline/demo_wholesaler.py` | **Nouveaux.** Démos avec assertions |

### Frontend : `namidps4-star/sentria-frontend`, branche `feature/onboarding-view`

| Fichier | Rôle |
|---|---|
| `app/globals.css` | Tokens de thème. Contient désormais `--brand`, la règle globale de focus en `:where()`, et le bloc `prefers-reduced-motion` |
| `components/sentria/dashboard-view.tsx` | ~2400 lignes, le plus modifié. `SECTOR_META`, `dailySeries()`, `alertBreakdown()`, `activityOf()`, filtrage par activité, états vides |
| `components/sentria/onboarding-modal.tsx` | Badges de maturité, `CSV_COLUMNS`, panneau d'import CSV |
| `components/sentria/ask-view.tsx` | Chat. Indicateur de rédaction, région live, gestion d'erreurs |
| `components/sentria/app-shell.tsx` | Récupère le compte d'alertes critiques pour la cloche |
| `components/sentria/topbar.tsx` | Pastille de notification pilotée par `unreadCount` |
| `lib/api.ts` | **Nouveau.** `API_BASE`, source unique de l'URL backend |
| `.claude/skills/` | 41 compétences installées, ~13 Mo |

### Landing page : `namidps4-star/sentria-landing-page`, branche `main`

| Fichier | Rôle |
|---|---|
| `index.html` | Fichier unique, 4569 lignes. CSS et JS ajoutés **en fin de bloc** pour ne pas toucher au parallaxe du hero ni au sélecteur de langue existants |

---

## 4. Ce qu'il a essayé et qui a raté

Les erreurs réelles. C'est la section la plus utile du document.

### Le correctif cosmétique du tableau de bord

J'ai renommé les libellés des cartes par activité et annoncé que les
métiers étaient séparés. **C'était faux.** Les alertes partageaient
toujours `sector: "health"`. L'utilisateur l'a vu immédiatement : « je vois
encore des trucs de pharmacie avec clinique, lab ». Il a fallu remonter
jusqu'à `save_alert()`.

**Leçon :** renommer un affichage ne sépare pas des données.

### Le diagnostic CORS abandonné à tort

J'avais correctement identifié que la liste blanche CORS bloquait leur
origine. Puis je me suis rétracté, en raisonnant que « si le tableau de
bord marche, CORS va bien ». Le test a montré que leur origine réelle
(`sentria-dashboard-git-...`) était bel et bien bloquée : HTTP 400
`Disallowed CORS origin`, exactement 22 octets.

**Leçon :** j'ai déduit au lieu de demander l'URL. Une question aurait
tranché en une minute.

### L'URL cherchée dans un seul fichier

J'ai lu `ask-view.tsx`, trouvé une URL Railway morte, et bâti une théorie
autour. Sans chercher ailleurs. Elle était déclarée **deux fois**, et seule
la copie du tableau de bord avait été mise à jour au passage à Render. Un
`grep` global l'aurait montré tout de suite.

### Un bug inventé, mis à l'ordre du jour

J'ai proposé de « corriger l'avertissement d'hydratation » en citant une
erreur **React #418 que je n'avais jamais observée**. L'utilisateur l'a
choisie dans une liste de tâches. Vérification faite : les quatre
initialiseurs `useState` qui lisent `localStorage` ont tous leur garde
`typeof window`, et un test navigateur avec `localStorage` pré-rempli
différemment du rendu serveur produit **zéro** erreur d'hydratation.

**Leçon :** ne jamais proposer un correctif pour un bug non mesuré.

### Un défaut introduit par mon propre correctif

J'ai construit la règle globale de focus sur `--ring`. Or `--ring` était
un gris en thème sombre. Tous les anneaux que je venais d'ajouter étaient
donc quasi invisibles sur fond sombre. Trouvé seulement en mesurant la
palette au tour suivant.

### La garde de panneau trop permissive

Pour les laboratoires, j'incluais un panel dès qu'**un** de ses réactifs
apparaissait. La solution de calibration étant partagée, importer un seul
réactif faisait remonter des analyses que le labo ne pratique pas, en
CRITIQUE à « 0 test possible ». Corrigé en exigeant que **tous** les
réactifs du panel soient présents. Trouvé en passant de vrais CSV, pas en
relisant le code.

### Deux outils de mesure qui ont produit de faux résultats

Mon script de détection des boutons sans libellé a signalé **cinq faux
positifs** : tous avaient du texte via une expression JSX (`{t.cancel}`,
`{tab}`) que ma regex supprimait, et l'un était déjà un `role="switch"`
correct. J'ai lu les cinq au lieu de corriger en masse.

Mon premier script de contraste lisait des valeurs `lab()` en les traitant
comme du RGB : tous les ratios étaient faux. Refait via lecture de pixels
sur canvas.

### Une assertion de démo écrite à l'envers

J'ai affirmé que 15 analyses restantes déclenchaient un CRITIQUE. Le seuil
est à 10. Le code avait raison, mon test avait tort.

### La régression du lien d'évitement

En ajoutant « Skip to content » sur la landing page, je l'ai fait pointer
vers `#main` alors que `<main>` n'avait pas d'`id`. J'ai introduit un lien
mort en corrigeant des liens morts. Rattrapé par la vérification des
ancres.

### Une fausse alerte visuelle

Sur une capture de la landing page, le titre semblait coupé à gauche.
Mesure au navigateur : boîte correcte, 130 à 630, aucun débordement.
Artefact d'affichage de l'image. J'ai failli « corriger » une mise en page
intacte.

### Limite structurelle de la session

**Je n'ai jamais pu atteindre le site en ligne.** Le proxy du bac à sable
bloque Render et Vercel (403 sur CONNECT).

Ce qui a vraiment changé les choses, tardivement : **installer les
dépendances** du frontend (`pnpm install`). À partir de là, `tsc` avec leur
propre `tsconfig.json`, `next build`, le serveur de dev et les tests
clavier au navigateur ont tous été possibles. Les deux derniers tours sont
mesurés, pas raisonnés.

**À faire tôt la prochaine fois.** Deux bugs sur trois ont d'abord été
trouvés par l'utilisateur en regardant son écran.

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
ses articles non critiques, et ces lignes continueront d'apparaître sous
Pharmacie tant que la colonne n'existe pas.

**2. Confirmer que Ask AI répond.** `/health` renvoie déjà
`model: gemini-3.5-flash-lite`, clés Gemini et Supabase prêtes. Il reste à
envoyer un message. En cas d'échec, la console nomme la cause.

**3. Valider les quatre CSV d'essai.** Deux points : le labo doit désigner
**Réactif A** comme réactif limitant (16 unités) et non la solution de
calibration (9 unités mais 0,5 par test) ; et l'oxygène doit sortir en
CRITIQUE alors que les compresses, au même ratio de 60 % du minimum,
restent un simple avertissement.

**4. Décider du merge frontend.** 18 commits sur
`feature/onboarding-view`, et **ce dépôt n'a aucune branche `main`**. Tout
le travail vit sur cette seule branche, sans version stable de repli.

### Travail restant identifié

| Sujet | Détail |
|---|---|
| 48 hexadécimaux bruts dans `pricing-view.tsx` | Laissés **à la demande explicite**. Cette vue porte une palette claire délibérée ; la convertir change son apparence. Décision visuelle, pas correction d'accessibilité |
| Pas de token `--warning` | La pastille WARNING utilise `bg-amber-500/15 text-amber-600`, palette Tailwind brute. L'ambre rend correctement sur fond clair comme sombre, donc rien n'est cassé, mais un token serait plus propre |
| Contraste 1,24 du lime sur fond clair | Faible. Non corrigé sciemment : le tableau affiche la sévérité **en texte** dans sa propre cellule, donc le sens ne dépend jamais de la couleur. Relever ce contraste changerait la marque |
| Anciennes alertes non étiquetées | Impossible à rétro-remplir : rien dans ces lignes n'indique le métier. Elles disparaîtront à mesure que des données étiquetées arrivent. Les supprimer est sans risque |
| API sans authentification | CORS ne protège que les navigateurs. N'importe quel appel serveur peut consommer le quota Gemini via `/ask`. À traiter avant une vraie mise en production |
| `Procfile.txt` | Render ne le lit pas : il attend `Procfile` ou un `render.yaml`, et utilise la commande de son tableau de bord. Le contenu est correct, à vérifier côté Render |
| Pastille de notification | Pilotée par un vrai `unreadCount`, mais alimentée par un `fetch` dédié dans `app-shell`. Si l'état des alertes est un jour remonté, brancher dessus plutôt que refetcher |

### Sur la landing page

Mergée et vérifiée dans un vrai navigateur : 50 éléments `reveal`, 3
visibles en haut puis 31 au milieu puis 50 en bas, spotlight suivant le
curseur, aucune erreur JS. Le logo « S » est remplacé par la balise beacon
fournie, en SVG inline, favicon assorti.

Deux pistes non prises, faute de mandat clair :

- Les sections alternent `section-light` / `section-dark`. Rythme
  éditorial défendable, mais l'audit signale les ruptures de fond comme un
  motif à surveiller. À trancher à l'œil.
- Aucune image de fond. Plusieurs sections sont du texte sur fond uni.
  L'audit recommande des fonds photographiques discrets pour donner de la
  présence. C'est ce qui manque au « cinématique ».

---

## Conventions à garder

- **Jamais de tirets cadratins** dans les réponses. Demande explicite.
- **Résumés en format « ADHD friendly »** : titres scannables, listes
  courtes, gras sur l'essentiel, tableaux plutôt que paragraphes, mauvaises
  nouvelles marquées.
- **Messages de commit en anglais normal**, jamais compressés.
- **Relancer `pipeline/demo_supplier.py` après toute modification du
  backend.** Sortie identique au caractère près : c'est la preuve que le
  comportement pharmacie n'a pas bougé.
- **Installer les dépendances du frontend en début de session**
  (`pnpm install`). C'est ce qui permet `tsc`, `next build` et les tests
  navigateur, donc de vérifier au lieu de supposer.
