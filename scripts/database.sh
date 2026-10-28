#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  cat >&2 <<'EOF'
Usage:
  bash scripts/database.sh backup [--rehearsal] [output-directory]
  bash scripts/database.sh restore [--rehearsal] <backup.dump> <marksman_restore_name>

Defaults to .env.deploy and the marksman-deploy Compose project.
--rehearsal uses .env.rehearsal and marksman-rehearsal instead.
Restore creates a NEW database; it never replaces an existing database.
EOF
  exit 2
}

[[ $# -ge 1 ]] || usage
database_action=$1
shift
database_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
database_env="$database_root/.env.deploy"
database_project=marksman-deploy
database_files=(-f "$database_root/compose.yaml")
if [[ ${1:-} == --rehearsal ]]; then
  shift
  database_env="$database_root/.env.rehearsal"
  database_project=marksman-rehearsal
  database_files+=(-f "$database_root/compose.rehearsal.yaml")
fi
database_compose=(docker compose --project-directory "$database_root"
  --env-file "$database_env" "${database_files[@]}" -p "$database_project")

case "$database_action" in
  backup)
    [[ $# -le 1 ]] || usage
    database_directory=${1:-"$database_root/backups"}
    [[ $database_directory != -* ]] || usage
    mkdir -p -m 700 -- "$database_directory"
    database_partial=$(mktemp "$database_directory/.marksman-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.partial")
    trap '[[ -z ${database_partial:-} ]] || rm -f -- "$database_partial"' EXIT
    "${database_compose[@]}" exec -T postgres sh -c \
      'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
      > "$database_partial"
    # Reject an empty or unreadable archive before publishing its final name.
    [[ -s $database_partial ]]
    "${database_compose[@]}" exec -T postgres pg_restore --list \
      < "$database_partial" > /dev/null
    database_filename=${database_partial##*/}
    database_backup="$database_directory/${database_filename#.}"
    database_backup=${database_backup%.partial}.dump
    mv -- "$database_partial" "$database_backup"
    database_partial=''
    printf '%s\n' "$database_backup"
    ;;
  restore)
    [[ $# -eq 2 ]] || usage
    database_backup=$1
    database_target=$2
    [[ -r $database_backup && -s $database_backup ]] || {
      printf 'Backup file must exist, be readable and be nonempty.\n' >&2
      exit 1
    }
    [[ $database_target =~ ^marksman_restore_[a-z0-9_]+$ && ${#database_target} -le 63 ]] || {
      printf 'Target must start with marksman_restore_ and use lowercase letters, digits or underscores (max 63 characters).\n' >&2
      exit 1
    }
    "${database_compose[@]}" exec -T postgres pg_restore --list \
      < "$database_backup" > /dev/null
    # createdb refuses existing names. Never use --clean or --create on restore.
    "${database_compose[@]}" exec -T postgres sh -c \
      'test "$1" != "$POSTGRES_DB" && exec createdb -U "$POSTGRES_USER" --template=template0 "$1"' \
      sh "$database_target"
    "${database_compose[@]}" exec -T postgres sh -c \
      'exec pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-acl --single-transaction --exit-on-error' \
      sh "$database_target" < "$database_backup"
    printf 'Restored into %s. The application still uses its original database.\n' "$database_target"
    ;;
  *) usage ;;
esac
