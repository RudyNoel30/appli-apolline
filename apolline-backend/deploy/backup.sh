#!/bin/bash
# Backup quotidien Apolline — pg_dump + rotation 30 jours
# Exécuter via cron : 0 2 * * * /opt/apolline-backend/deploy/backup.sh

set -euo pipefail

BACKUP_DIR=/var/backups/apolline
DB_NAME=apolline
DB_USER=apolline
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/apolline_${TS}.sql.gz"

# Dump compressé
PGPASSWORD="${PGPASSWORD:-}" pg_dump -h 127.0.0.1 -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

# Rotation : supprime les backups plus vieux que RETENTION_DAYS
find "$BACKUP_DIR" -name "apolline_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Optionnel : sync vers OneDrive via rclone (à configurer une fois : `rclone config`)
if command -v rclone &>/dev/null && rclone listremotes | grep -q '^onedrive-apolline:'; then
    rclone copy "$FILE" onedrive-apolline:Backups/apolline/ --quiet
fi

echo "[backup] OK : $FILE ($(du -h "$FILE" | cut -f1))"
