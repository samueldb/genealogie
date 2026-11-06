# Service de sauvegarde

Ce serveur Express reçoit les arbres modifiés sur `POST /api/family-data` et crée un commit dans le dépôt GitHub. Le site GitHub Pages et ce service, hébergé notamment sur Render, sont déployés séparément.

## Configuration

Copier `backend/.env.example` vers `backend/.env`, puis renseigner les variables :

| Variable | Rôle |
| --- | --- |
| `GITHUB_TOKEN` | Jeton GitHub avec le droit `contents:write` sur le dépôt. |
| `GITHUB_OWNER`, `GITHUB_REPO` | Propriétaire et nom du dépôt. |
| `GITHUB_BRANCH` | Branche modifiée, `dev` par défaut. |
| `DATA_SOURCES` | Liste autorisée `id:chemin`, relative à la racine du dépôt. |
| `DEFAULT_DATA_SOURCE` | Source utilisée si le client n’en précise pas ; première source par défaut. |
| `TARGET_DATA_FILES` | Ancienne configuration optionnelle ; préférer `DATA_SOURCES`. |
| `API_AUTH_TOKEN` | Valeur optionnelle attendue dans l’en-tête `x-api-key`. |
| `CORS_ALLOW_ORIGIN` | Origine autorisée, `*` par défaut. |
| `PORT` | Port du serveur, `8788` par défaut. |

Sans configuration explicite des sources, les chemins sont :

```text
principal:site/data/principal.json,racine:site/data/racine.json
```

Le navigateur envoie uniquement l’identifiant de source ; le serveur choisit le chemin autorisé. `GET /health` expose les sources effectivement configurées pour vérifier le déploiement.

## Exécution

Depuis la racine du dépôt :

```bash
npm ci
npm run backend
```

Les dépendances du backend sont des dépendances de production ; une installation `npm ci --omit=dev` fonctionne aussi. Le serveur charge `backend/.env`, puis le `.env` du répertoire de lancement, sans remplacer les variables déjà définies dans l’environnement.

Pour utiliser ce backend depuis le site, renseigner `window.GENEA_API_CONFIG.baseUrl` dans `site/index.html` et, si nécessaire, `apiKey`. Le serveur de développement `npm run edit` utilise ses propres sauvegardes locales.

## Migration sur Render

Le point d’entrée reste `backend/server.js` et la commande de démarrage reste `npm run backend`. Le répertoire de travail doit être la racine du dépôt.

Mettre les variables à jour avec :

```text
DATA_SOURCES=principal:site/data/principal.json,racine:site/data/racine.json
DEFAULT_DATA_SOURCE=principal
```

Le module `data-sources.js` convertit également les anciennes valeurs `index/data_db.json`, `deschampsberger/index/data_db.json` et `data_db.json` vers les nouveaux chemins, y compris dans `TARGET_DATA_FILES`. Cette compatibilité évite de recréer les anciens fichiers après déplacement.

Redéployer le backend avec cette version avant de reprendre l’édition en ligne : une ancienne instance du serveur ne connaît pas les nouveaux chemins. La branche configurée doit contenir elle aussi la nouvelle arborescence. GitHub Pages ne redéploie pas le service Render.
