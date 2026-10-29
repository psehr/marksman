#!/usr/bin/env bash
set -euo pipefail
umask 077

# Run as the checkout owner; only Docker and the backup require sudo.
[[ $# -eq 0 ]] || { echo 'Usage: bash scripts/deploy.sh' >&2; exit 2; }
[[ $EUID -ne 0 ]] || { echo 'Run as your regular deployment user, without sudo.' >&2; exit 1; }
deploy_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd -- "$deploy_root"
[[ -f .env.deploy ]] || { echo 'Missing .env.deploy.' >&2; exit 1; }
[[ $(git branch --show-current) == main ]] || { echo 'Deployment requires the main branch.' >&2; exit 1; }
[[ $(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}') == origin/main ]] || {
  echo 'Deployment requires main to track origin/main.' >&2; exit 1;
}
[[ -z $(git status --porcelain) ]] || { echo 'Commit or remove checkout changes before deploying.' >&2; exit 1; }

# Prevent overlapping deploys from this checkout.
exec 9>"$(git rev-parse --git-path marksman-deploy.lock)"
flock -n 9 || { echo 'Another deployment is already running.' >&2; exit 1; }
deploy_compose=(sudo docker compose --project-directory "$deploy_root" --env-file "$deploy_root/.env.deploy" -f "$deploy_root/compose.yaml" -p marksman-deploy)
deploy_previous=$(git rev-parse --short HEAD)
trap 'echo "Deployment failed. Previous checkout: $deploy_previous. Inspect service status/logs before retrying; no automatic code or database rollback was performed." >&2' ERR

sudo -v
"${deploy_compose[@]}" config --quiet
printf 'Backing up production before deployment…\n'
sudo bash "$deploy_root/scripts/database.sh" backup
printf 'Updating checkout…\n'
git pull --ff-only origin main
# Reject local-only commits as well as divergence, including reruns after failure.
[[ $(git rev-parse HEAD) == $(git rev-parse origin/main) ]] || {
  echo 'Checkout contains local-only commits; refusing to deploy.' >&2; exit 1;
}
"${deploy_compose[@]}" config --quiet
printf 'Building and starting services…\n'
"${deploy_compose[@]}" up -d --build --wait
"${deploy_compose[@]}" ps
printf 'Deployed commit: %s\n' "$(git rev-parse --short HEAD)"
printf 'Check public HTTPS, login and the changed behavior. Copy the backup off-server.\n'
