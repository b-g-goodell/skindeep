# Command hook of claude-skins (decisions 0009, 0030). Claude Code runs
# it for each hooked event with the event's JSON on stdin. It posts the
# JSON to the window whose tab started this process tree, found by
# ancestry: the nearest ancestor pid with a link in ROOT/pids. A session
# no window started, such as one sent to the background that outlived
# its window, finds none. It prints nothing and exits 0 in every case,
# so a hook never has an effect on the session.
# argv: ROOT, the app's runtime root.

import os
import socket
import sys

MAX_BODY = 64 * 1024
TIMEOUT_S = 0.5
MAX_DEPTH = 64


def parent(pid):
    try:
        with open('/proc/%d/stat' % pid, 'rb') as f:
            s = f.read()
        return int(s[s.rindex(b')') + 2:].split()[1])
    except Exception:
        return 0


# The pid whose link names the window's socket, else None.
def window(root):
    pid = os.getppid()
    for _ in range(MAX_DEPTH):
        if pid <= 1:
            return None
        if os.path.exists(os.path.join(root, 'pids', str(pid))):
            return pid
        pid = parent(pid)
    return None


# A socket's path holds 107 bytes and ROOT may be longer: the link is
# reached through a descriptor of ROOT/pids (decision 0016), which must
# be this uid's with no group or other bits, or nothing is sent.
def post(root, pid, body):
    d = os.open(os.path.join(root, 'pids'), os.O_RDONLY | os.O_DIRECTORY)
    st = os.fstat(d)
    if st.st_uid != os.getuid() or st.st_mode & 0o077:
        os.close(d)
        return
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(TIMEOUT_S)
    try:
        s.connect('/proc/self/fd/%d/%d' % (d, pid))
        head = ('POST /hook HTTP/1.1\r\nHost: skins\r\n'
                'Content-Type: application/json\r\n'
                'Content-Length: %d\r\nConnection: close\r\n\r\n' % len(body))
        s.sendall(head.encode('ascii') + body)
        s.recv(64)
    finally:
        s.close()
        os.close(d)


def main():
    body = sys.stdin.buffer.read()
    if len(sys.argv) < 2 or not body or len(body) > MAX_BODY:
        return
    pid = window(sys.argv[1])
    if pid:
        post(sys.argv[1], pid, body)


try:
    main()
except Exception:
    pass
sys.exit(0)
