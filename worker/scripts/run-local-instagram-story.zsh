#!/bin/zsh
set -eu
repo_root="${0:A:h:h:h}"
set -a
source "$repo_root/.env.local"
set +a
export PYTHONPATH="$repo_root/worker"
exec "$repo_root/.venv-story/bin/python" -m hook_worker.instagram_story_local run
