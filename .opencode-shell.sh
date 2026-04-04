#!/bin/zsh
# Shell wrapper for OpenCode — loads provider env vars
source ~/repos/diricode/.env.providers 2>/dev/null
exec /bin/zsh "$@"
