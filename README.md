# Généalogie

Application familiale de consultation et d’édition d’arbres généalogiques : recherche de personnes, portraits, lieux de vie et chronologies. Le site est statique ; la sauvegarde en ligne passe par un service Express qui crée des commits dans ce dépôt.

## Organisation

- `site/` : **tout le contenu publié**, avec la page d’entrée, les scripts, les styles, les images et les données.
- `backend/` : API de sauvegarde vers GitHub et configuration des sources.
- `scripts/` : serveur local, vérification du site et import manuel depuis Carto.
- `docs/sources/` : documents généalogiques originaux, portraits et exports Carto.
- `docs/rapports/` : résultats de comparaison et d’analyse.
- `docs/maquettes/` : essais d’interface conservés comme références historiques, hors du site publié.
- `tests/` : contrôles de la structure publiée et du routage des sauvegardes.

## Démarrer localement

Node.js 20 ou supérieur est nécessaire (la CI utilise Node.js 22).

```bash
npm ci
npm run edit
```

Ouvrir `http://localhost:3000/`. Le serveur expose uniquement `site/`. Il adapte la configuration dans la page servie pour enregistrer les modifications **dans les fichiers locaux**, sans appeler le service Render. La configuration en ligne de `site/index.html` n’est pas modifiée par cette adaptation.

`PORT=8080 npm run edit` permet de changer de port. Les bibliothèques d’affichage, les fonds de carte et les portraits externes nécessitent une connexion internet.

```bash
npm run check
npm test
```

Ces commandes vérifient les ressources locales, les relations entre personnes, la cohérence des chemins de données et les sauvegardes dans des fichiers temporaires. Il n’y a plus de compilation Rollup : la bibliothèque `family-chart@0.9.0` est chargée depuis un CDN.

## Données

| Source | Fichier dans le dépôt | URL dans le site |
| --- | --- | --- |
| `principal` | `site/data/principal.json` | `data/principal.json` |
| `racine` | `site/data/racine.json` | `data/racine.json` |

Les deux sources restent séparées même lorsque leur contenu est identique. Le sélecteur est configuré dans `site/index.html` et ses valeurs par défaut dans `site/scripts/app.js`. Les chemins de sauvegarde sont définis dans `backend/data-sources.js`.

Les portraits intégrés directement dans le JSON restent intégrés. Les portraits originaux non référencés par le site sont conservés dans `docs/sources/portraits/`. Les avatars par défaut du site se trouvent dans `site/assets/images/`.

## Déploiement GitHub Pages

- `.github/workflows/deploy.yml` : un push sur `master` publie le contenu de `site/` à la racine de la branche `gh-pages` et conserve le sous-dossier `preview-site/` existant.
- `.github/workflows/deploy-dev.yml` : un push sur `dev` remplace uniquement `gh-pages/preview-site/`, en supprimant aussi ses anciens fichiers inutilisés.
- Les deux workflows installent les dépendances avec `npm ci`, exécutent les contrôles et les tests, puis publient. Ils partagent un groupe de concurrence pour éviter des écritures simultanées sur `gh-pages`.
- Les chemins de ressources sont relatifs pour fonctionner à la racine comme dans un sous-dossier. `docs/`, `backend/` et les outils locaux ne sont jamais copiés dans le site.

Aucune modification du réglage GitHub Pages n’est nécessaire si la publication utilise déjà la branche `gh-pages`. Le service Render reste déployé séparément ; voir [sa configuration](backend/README.md).

## Migration de l’ancienne organisation

Les anciens `index/data_db.json` et `data_db.json` deviennent respectivement `site/data/principal.json` et `site/data/racine.json`. Le backend convertit les anciens chemins configurés vers ces nouveaux emplacements pour éviter de recréer les fichiers historiques. Mettre néanmoins les variables Render à jour avec les valeurs documentées dans `backend/.env.example`, et redéployer le backend avec cette réorganisation avant de reprendre l’édition en ligne.

Les démonstrations de la bibliothèque, le squelette React, les anciens utilitaires et les tests Cypress visant des exemples disparus ont été retirés. Les versions précédentes restent consultables dans l’historique Git.

## Import Carto manuel

`scripts/import-carto.py` conserve la logique de l’ancien import. Il utilise uniquement Python 3 et demande `CARTO_API_TOKEN` dans l’environnement. Il écrit par défaut dans `docs/sources/carto/import.json`, sans remplacer les arbres utilisés par le site.

```bash
python3 scripts/import-carto.py --help
python3 scripts/import-carto.py
```

Vérifier les données importées avant toute copie dans `site/data/`.

## Crédits

Le projet utilise [family-chart de Donat Sorić](https://github.com/donatso/family-chart), D3 et MapLibre. La licence MIT d’origine est conservée dans `LICENSE.txt`.
