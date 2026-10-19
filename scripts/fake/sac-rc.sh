# rc of the fake select-agent-config's shell (decision 0037): no ~/.bashrc.
# The fake claude keeps its transcripts under XDG_RUNTIME_DIR, so inside
# the snapshot they land in the snapshot's own tree, where the host reads
# them only through the binds.
export XDG_RUNTIME_DIR="$HOME/.claude/run"
mkdir -p "$XDG_RUNTIME_DIR"
PS1="[$SELECT_AGENT_CONFIG] \$ "
