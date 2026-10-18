#!/bin/zsh
set -eu

repo_root="${0:A:h:h:h}"
env_file="$repo_root/.env.development.local"
if [[ ! -f "$env_file" ]]; then
  print -u2 "Missing .env.development.local. Follow docs/local-publishing-test.md first."
  exit 1
fi

set -a
source "$env_file"
set +a

export SOCIAL_PUBLISH_MODE="${SOCIAL_PUBLISH_MODE:-mock}"
export CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-http://127.0.0.1:3000}"
export HOOK_WORKER_TOKEN="${HOOK_WORKER_TOKEN:-local-publishing-worker}"
export ENABLE_HOOK_WORKER=false
export ENABLE_VIZARD_WORKER=false
export ENABLE_INSTAGRAM_STORY_WORKER=false
export ENABLE_PUBLISH_WORKER=true
export ENABLE_YIXIAOER_ACCOUNT_SYNC=false
export ENABLE_SCHEDULE_NOTIFICATIONS=false
export PYTHONPATH="$repo_root/worker"

if [[ "${1:-}" == "--once" ]]; then
  export WORKER_ONESHOT=true
  export WORKER_MODE=cron
fi

python_bin="$repo_root/.venv-story/bin/python"
if [[ ! -x "$python_bin" ]]; then
  print -u2 "Missing .venv-story. Create it with: python3 -m venv .venv-story && .venv-story/bin/pip install -r worker/requirements.txt"
  exit 1
fi

exec "$python_bin" -m hook_worker.main
