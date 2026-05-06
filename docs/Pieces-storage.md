# Stockage local des pièces

Depuis la v0.1.48, les pièces des dossiers sont uploadées **directement dans
l'app** et stockées sur le VPS Apolline (filesystem + métadonnées Postgres).

## Architecture

```
Front : drop zone → POST multipart /api/dossiers/:id/pieces/upload
                       ↓
Backend : 1. Insert ligne metadata (table `pieces`)
          2. Écrit fichier sur disque : /var/lib/apolline/pieces/<dossier_id>/<piece_id>
          3. Calcule sha256
          4. Update ligne avec sha256 + sizeBytes + filePath
          5. Audit log : action='create', entity='piece'
                       ↓
Front : recharge la liste, preview iframe via /api/pieces/:id/preview
```

## Setup VPS (1 fois)

```bash
ssh root@76.13.136.175

# 1. Crée le dossier de stockage
mkdir -p /var/lib/apolline/pieces
chown -R apolline:apolline /var/lib/apolline/pieces  # ou le user du backend
chmod 700 /var/lib/apolline/pieces

# 2. Vérifie que le user backend peut écrire
sudo -u apolline touch /var/lib/apolline/pieces/.test
sudo -u apolline rm /var/lib/apolline/pieces/.test
echo OK

# 3. Applique la migration BDD
cd /opt/apolline-backend
sudo -u postgres psql apolline -f drizzle/0005_pieces_storage.sql
```

## Configuration backend

Variables d'environnement (`.env`) optionnelles :

```env
# Dossier de stockage (par défaut /var/lib/apolline/pieces)
PIECES_STORAGE_DIR=/var/lib/apolline/pieces

# Taille max par fichier en octets (par défaut 50 Mo)
PIECE_MAX_SIZE=52428800
```

## Backup

**Important** : le backup pg_dump ne couvre QUE la BDD (les métadonnées),
**pas les fichiers eux-mêmes** sur le filesystem.

Modifie `deploy/backup.sh` pour inclure les pièces :

```bash
# Dans backup.sh, après le pg_dump existant :
PIECES_DIR=/var/lib/apolline/pieces
if [ -d "$PIECES_DIR" ]; then
  tar czf "$BACKUP_DIR/pieces-$TIMESTAMP.tar.gz" -C / "${PIECES_DIR#/}"
  echo "[$(date)] pieces backup : $(du -h $BACKUP_DIR/pieces-$TIMESTAMP.tar.gz | cut -f1)"
fi
```

Et la rotation :

```bash
find "$BACKUP_DIR" -name "pieces-*.tar.gz" -mtime +30 -delete
```

## Types MIME autorisés

Restrictif pour éviter les exécutables (anti-malware basique) :

- PDF : `application/pdf`
- Images : `image/jpeg`, `image/png`, `image/heic`, `image/webp`, `image/gif`
- Office : Word (.doc, .docx), Excel (.xls, .xlsx)
- Texte : `text/plain`, `text/csv`
- Archives : `application/zip`

Pour ajouter un type, modifier `apolline-backend/src/lib/pieces-storage.ts` →
`ALLOWED_MIME` set.

## Endpoints API

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/dossiers/:dossierId/pieces/upload` | Upload multipart (1+ fichiers) |
| `GET` | `/api/dossiers/:dossierId/pieces` | Liste des pièces du dossier |
| `GET` | `/api/pieces/:id/preview` | Stream inline (iframe) |
| `GET` | `/api/pieces/:id/download` | Stream attachment (download) |
| `PATCH` | `/api/pieces/:id` | Met à jour catégorie/libellé/statut |
| `DELETE` | `/api/pieces/:id` | Supprime fichier + ligne BDD |

Toutes ces routes nécessitent un JWT valide (header `Authorization: Bearer <token>`
ou query string `?_t=<token>` pour les iframes).

## Rétro-compatibilité OneDrive

L'ancienne intégration OneDrive (page Pieces.tsx → `/pieces`) reste fonctionnelle
pour les dossiers déjà liés à un folder OneDrive. Les nouveaux dossiers utilisent
le stockage local par défaut (TabPieces dans DossierDetail).

Pour migrer un dossier OneDrive vers le local : télécharger les fichiers depuis
OneDrive et les uploader manuellement via le drop zone du nouveau TabPieces.

## Sécurité

- **Permissions fichier** : 0600 (lecture/écriture user backend uniquement)
- **Permissions dossier** : 0700 (idem)
- **Sanity check ID** : seuls les UUIDs valides acceptés (anti path traversal)
- **MIME whitelist** : pas d'exécutables
- **Taille max** : 50 Mo par défaut
- **Audit log** : toute upload/download/delete est tracé avec qui/quand/IP
- **Rate limiting** : 200 req/min/IP global

## Suppression cascade

Quand un dossier est supprimé (DELETE /api/dossiers/:id), les pièces associées
sont supprimées de la BDD via la FK `ON DELETE CASCADE`. Les **fichiers
filesystem** ne sont PAS automatiquement supprimés (faille à corriger dans une
prochaine version).

Workaround temporaire : supprimer manuellement les pièces une par une avant
de supprimer le dossier.
