#!/usr/bin/env python3
"""Build a GNU ar archive (IPK-compatible) from a list of files."""
import os, sys

def make_ar(output, members):
    with open(output, 'wb') as f:
        f.write(b'!<arch>\n')
        for name, path in members:
            data = open(path, 'rb').read()
            size = len(data)
            hdr = '%-16s%-12d%-6d%-6d%-8s%-10d\x60\x0a' % (
                name, int(os.path.getmtime(path)), 0, 0, '100644', size)
            f.write(hdr.encode('ascii'))
            f.write(data)
            if size % 2:
                f.write(b'\n')

if __name__ == '__main__':
    out = sys.argv[1]
    members = [(os.path.basename(p), p) for p in sys.argv[2:]]
    make_ar(out, members)
    print('Built:', out)
