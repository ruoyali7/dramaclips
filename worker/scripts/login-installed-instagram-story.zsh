#!/bin/zsh
set -eu
agent_root="${0:A:h}"
set -a
source "$agent_root/config.env"
set +a
export PYTHONPATH="$agent_root"
exec "$agent_root/venv/bin/python" -m hook_worker.instagram_story_local login
