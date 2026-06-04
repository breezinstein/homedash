#!/bin/sh
set -e

# Fix ownership of the named volume mount (/app/data) so the non-root
# homedash user can write to it even when the volume was first created
# with root ownership by a previous container run.
mkdir -p /app/data/uploads /app/data/backups /app/data/icons
chown -R homedash:nodejs /app/data

# Fix ownership of the bind-mounted shared-files directory so the
# homedash user can write uploaded files there. Pre-create the public/
# and private/ subdirs (Phase 3) so the chown covers them before the app
# tries to migrate any legacy contents.
mkdir -p /shared-files /shared-files/public /shared-files/private
chown -R homedash:nodejs /shared-files

# Drop privileges to the homedash user and exec the process under
# dumb-init for correct signal forwarding and zombie reaping.
exec su-exec homedash dumb-init -- "$@"
