# Exec a command with only fds 0, 1 and 2 open, as a shell in a plain
# terminal would. node-pty's child otherwise inherits Electron's fds.
# argv: exec-clean.py ERRFILE PATH ARGV0 [ARGS...]
# An exec that fails exits as bash does: 127 when the file or the
# interpreter it names is missing, else 126. The reason goes to stderr,
# and to ERRFILE unless it is empty.
import errno
import os
import sys

os.closerange(3, 1 << 20)
try:
    os.execv(sys.argv[2], sys.argv[3:])
except OSError as e:
    missing = e.errno == errno.ENOENT
    if missing and os.path.exists(sys.argv[2]):
        reason = 'required file not found'
    else:
        reason = e.strerror or str(e)
    sys.stderr.write('%s: %s\n' % (sys.argv[3], reason))
    if sys.argv[1]:
        try:
            with open(sys.argv[1], 'w') as f:
                f.write(reason)
        except OSError:
            pass
    sys.exit(127 if missing else 126)
