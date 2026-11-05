#!/usr/bin/env sh
# ==============================================================================
# [S4-DBA-06] Portable Database Backup, Restore, PITR & Disaster Recovery Script
#
# Supports both native PostgreSQL client utilities (pg_dump / pg_restore) and
# the portable Node.js pg snapshot & verification engine (scripts/db-backup-restore.js).
#
# Usage:
#   ./scripts/backup-restore.sh backup [output_file]
#   ./scripts/backup-restore.sh restore <backup_file>
#   ./scripts/backup-restore.sh verify [backup_file]
#   ./scripts/backup-restore.sh dr-drill
#   ./scripts/backup-restore.sh pitr-backup [output_file]
#   ./scripts/backup-restore.sh pitr-restore <backup_file> [target_time]
# ==============================================================================

set -eu

ACTION="${1:-dr-drill}"
TARGET_FILE="${2:-backups/erp-backup-latest.json}"
TARGET_TIME="${3:-}"

case "$ACTION" in
  backup)
    if command -v pg_dump >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ] && echo "$TARGET_FILE" | grep -Eq '\.(dump|sql)$'; then
      mkdir -p "$(dirname "$TARGET_FILE")"
      pg_dump --no-owner --no-privileges --format=custom --file="$TARGET_FILE" "$DATABASE_URL"
      echo "pg_dump completed: $TARGET_FILE"
    else
      node scripts/db-backup-restore.js backup --file "$TARGET_FILE"
    fi
    ;;
  pitr-backup)
    node scripts/db-backup-restore.js pitr-backup --file "$TARGET_FILE"
    ;;
  restore)
    if command -v pg_restore >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ] && echo "$TARGET_FILE" | grep -Eq '\.dump$'; then
      pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$TARGET_FILE"
      node scripts/db-backup-restore.js verify
    else
      node scripts/db-backup-restore.js restore --file "$TARGET_FILE"
    fi
    ;;
  pitr-restore)
    if [ -n "$TARGET_TIME" ]; then
      node scripts/db-backup-restore.js pitr-restore --file "$TARGET_FILE" --target-time "$TARGET_TIME"
    else
      node scripts/db-backup-restore.js pitr-restore --file "$TARGET_FILE"
    fi
    ;;
  verify)
    node scripts/db-backup-restore.js verify --file "$TARGET_FILE"
    ;;
  dr-drill)
    node scripts/db-backup-restore.js dr-drill
    ;;
  *)
    echo "Usage: $0 {backup|pitr-backup|restore|pitr-restore|verify|dr-drill} [file] [target_time]" >&2
    exit 1
    ;;
esac
