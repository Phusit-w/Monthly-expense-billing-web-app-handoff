#!/bin/sh
# Runs inside the `backup` service (docker-compose.yml) — dumps the
# database once a day and deletes anything older than
# BACKUP_RETENTION_DAYS. This is a plain infinite loop with `sleep`, not a
# cron daemon: the whole point of a separate always-running container is
# that `sleep 86400` between runs costs nothing, and it keeps this in the
# same simple "one shell script, no extra package" style as
# docker-entrypoint.sh rather than pulling in cron just for one job.
set -e

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

echo "backup: starting, dumping every 24h, keeping ${RETENTION_DAYS} days"

while true; do
  timestamp=$(date +%Y%m%d-%H%M%S)
  dest="/backups/backup-${timestamp}.sql"
  echo "backup: dumping database to ${dest}"
  # -h db: reaches the `db` service by its compose service name, same as
  # DATABASE_URL does for the app itself.
  if pg_dump -h db -U expense_billing expense_billing > "${dest}"; then
    echo "backup: done ($(du -h "${dest}" | cut -f1))"
  else
    echo "backup: pg_dump failed, removing partial file" >&2
    rm -f "${dest}"
  fi

  # `-delete` isn't reliably available on BusyBox find (this image's base is
  # Alpine, not GNU coreutils/findutils) — piping matched names through a
  # plain `rm -f` loop instead only depends on `-name`/`-mtime`, which both
  # BusyBox and GNU find support identically.
  find /backups -name 'backup-*.sql' -mtime "+${RETENTION_DAYS}" | while read -r old; do
    echo "backup: removing old backup ${old}"
    rm -f "${old}"
  done

  sleep 86400
done
