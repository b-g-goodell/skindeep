#!/usr/bin/env python3
# Derive the coffee skin's sounds from CC0 recordings on freesound.org: a
# small-room murmur that loops without a seam, and the one-shots of a
# bohemian cafe. Each source is the sound's public preview, fetched by a
# plain GET into one directory under its own file name:
#
#   curl -sS -O --output-dir DIR URL      (for each URL in SOURCES)
#   python3 scripts/art/sounds.py DIR     (from the repository root)
#
# Needs python3 with numpy and scipy, and ffmpeg with libvorbis. Every
# output is 44.1 kHz mono Ogg Vorbis, peak at most -6 dBFS, faded at both
# ends so nothing clicks.
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d

OUT = 'skins/coffee/sounds/'
SR = 44100
CEILING = -6.0

# freesound id: preview URL. Authors and licenses are in ASSETS.json.
SOURCES = {
    46310: 'https://cdn.freesound.org/previews/46/46310_43834-hq.ogg',
    404952: 'https://cdn.freesound.org/previews/404/404952_3480533-hq.ogg',
    34531: 'https://cdn.freesound.org/previews/34/34531_21830-hq.ogg',
    50758: 'https://cdn.freesound.org/previews/50/50758_179538-hq.ogg',
    369549: 'https://cdn.freesound.org/previews/369/369549_3229685-hq.ogg',
    556722: 'https://cdn.freesound.org/previews/556/556722_9159316-hq.ogg',
    637926: 'https://cdn.freesound.org/previews/637/637926_612689-hq.ogg',
    789008: 'https://cdn.freesound.org/previews/789/789008_5287430-hq.ogg',
    642772: 'https://cdn.freesound.org/previews/642/642772_9813501-hq.ogg',
    348268: 'https://cdn.freesound.org/previews/348/348268_1050391-hq.ogg',
    397600: 'https://cdn.freesound.org/previews/397/397600_3302499-hq.ogg',
}

rng = np.random.default_rng(1957)
report = []


def load(sid, a=0.0, b=None):
    src = os.path.join(sys.argv[1], os.path.basename(SOURCES[sid]))
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', str(SR),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x[int(a * SR):None if b is None else int(b * SR)].copy()


def high(x, f):
    return signal.sosfiltfilt(signal.butter(2, f, btype='high', fs=SR, output='sos'), x)


def low(x, f):
    return signal.sosfiltfilt(signal.butter(2, f, btype='low', fs=SR, output='sos'), x)


def fade(x, a, b):
    # Raised-cosine fade in over a seconds and out over b seconds.
    x = x.copy()
    na, nb = int(a * SR), int(b * SR)
    if na:
        x[:na] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, na))
    if nb:
        x[-nb:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nb))
    return x


def db(v):
    return 20 * np.log10(max(v, 1e-12))


def rms(x):
    return np.sqrt(np.mean(x ** 2))


def limit(x, ceiling_db=CEILING, look=0.006):
    # Look-ahead peak limiter: the gain never lets |x| pass the ceiling,
    # and it moves over about `look` seconds so a transient is turned down
    # rather than clipped.
    c = 10 ** (ceiling_db / 20)
    n = int(look * SR)
    g = np.minimum(1.0, c / np.maximum(maximum_filter1d(np.abs(x), 2 * n + 1), 1e-12))
    g = uniform_filter1d(minimum_filter1d(g, 2 * n + 1), n + 1)
    y = np.clip(x * g, -c, c)
    return y, db(np.min(g))


def level(x, rms_db=None, peak_db=None):
    # Set the level by RMS (sustained sounds) or by peak (transients), then
    # limit to the ceiling.
    x = x - np.mean(x)
    if rms_db is not None:
        x *= 10 ** (rms_db / 20) / rms(x)
    else:
        x *= 10 ** (peak_db / 20) / np.max(np.abs(x))
    return limit(x)


def save(name, x, gr, how):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, name + '.wav')
        wavfile.write(wav, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-ar', str(SR),
                        '-c:a', 'libvorbis', '-q:a', '3', OUT + name + '.ogg'], check=True)
    report.append(f'{name:10s} {len(x) / SR:6.2f} s  rms {db(rms(x)):6.1f}  peak {db(np.max(np.abs(x))):5.1f}  '
                  f'limited {gr:5.1f} dB  {how}')


def murmur():
    # 46310: a small crowd quietly talking in a coffeehouse. 36 s from
    # 225 s, plus 4 s whose crossfade into the head makes the seam.
    L, X = 36 * SR, 4 * SR
    x = high(load(46310, 225.0, 225.0 + 40.0), 120)
    loop = x[:L].copy()
    w = np.linspace(0, np.pi / 2, X)
    loop[:X] = x[:X] * np.sin(w) + x[L:L + X] * np.cos(w)
    y, gr = level(loop, rms_db=-24)
    save('murmur', y, gr, '46310 225-265 s, high-pass 120 Hz, 4 s seam crossfade')


def guitar():
    # 404952: an acoustic guitar noodling over two chords. The last phrase,
    # from a rest at 24.95 s to the strings ringing out.
    x = high(load(404952, 24.95, 37.5), 70)
    y, gr = level(fade(x, 0.02, 1.2), rms_db=-27)
    save('guitar', y, gr, '404952 24.95-37.5 s, high-pass 70 Hz, fades 0.02/1.2 s')


def bongos():
    # 34531: someone trying the bongos. The first 6 s.
    x = high(load(34531, 0.0, 6.0), 60)
    y, gr = level(fade(x, 0.01, 1.0), rms_db=-28)
    save('bongos', y, gr, '34531 0-6 s, high-pass 60 Hz, fades 0.01/1 s')


def hits(x, thr_db=-22, gap=0.15, pre=0.004, post=0.22):
    # The snaps of a recording: each onset above thr_db below the file's
    # peak, at least gap seconds after the last one.
    t = np.max(np.abs(x)) * 10 ** (thr_db / 20)
    out, last = [], -1e9
    for i in np.flatnonzero(np.abs(x) > t):
        if i - last > gap * SR:
            a, b = i - int(pre * SR), i + int(post * SR)
            if a >= 0 and b <= len(x):
                h = x[a:b].copy()
                out.append(fade(h / np.max(np.abs(h)), pre, 0.12))
        last = i if i - last > gap * SR else last
    return out


def snaps():
    # Beatnik applause: four listeners snapping their fingers for two
    # seconds, each snap drawn from the single snaps of 50758 and 369549.
    pool = hits(high(load(50758), 300)) + hits(high(load(369549), 300))
    n = int(3.4 * SR)
    mix = np.zeros(n)
    for _ in range(4):
        t = rng.uniform(0.0, 0.35)
        period = rng.uniform(0.32, 0.46)
        gain = 10 ** (rng.uniform(-9, 0) / 20)
        end = rng.uniform(1.9, 2.6)
        while t < end:
            h = pool[rng.integers(len(pool))]
            i = int(t * SR)
            mix[i:i + len(h)] += h[:n - i] * gain * 10 ** (rng.uniform(-3, 0) / 20)
            t += period * rng.uniform(0.9, 1.1)
    # One room for all four: a short diffuse tail.
    m = int(0.35 * SR)
    ir = low(rng.normal(0, 1, m), 5000) * np.exp(-np.arange(m) / (0.07 * SR))
    ir /= np.sqrt(np.sum(ir ** 2))
    mix = mix + 0.3 * signal.fftconvolve(mix, ir)[:n]
    y, gr = level(fade(mix, 0.002, 0.4), peak_db=-3)
    save('snaps', y, gr, f'{len(pool)} snaps of 50758 and 369549, high-pass 300 Hz, four snappers, 0.35 s room')


def needle():
    # 556722: a needle dropped on a record, and the crackle of the lead-in.
    x = high(load(556722, 0.0, 6.8), 40)
    y, gr = level(fade(x, 0.005, 1.5), peak_db=-2)
    save('needle', y, gr, '556722 0-6.8 s, high-pass 40 Hz, fades 0.005/1.5 s')


def typewriter():
    # 637926: a manual typewriter across a roomy space. One line of typing.
    x = high(load(637926, 4.0, 9.5), 120)
    y, gr = level(fade(x, 0.01, 0.6), peak_db=-1)
    save('typewriter', y, gr, '637926 4-9.5 s, high-pass 120 Hz, fades 0.01/0.6 s')


def beads():
    # 789008: someone passing through a wooden bead curtain.
    x = high(load(789008, 0.0, 5.6), 80)
    y, gr = level(fade(x, 0.005, 1.0), rms_db=-28)
    save('beads', y, gr, '789008 0-5.6 s, high-pass 80 Hz, fades 0.005/1 s')


def grinder():
    # 642772: beans in a hand-cranked grinder.
    x = high(load(642772, 25.0, 30.5), 80)
    y, gr = level(fade(x, 0.25, 0.8), rms_db=-28)
    save('grinder', y, gr, '642772 25-30.5 s, high-pass 80 Hz, fades 0.25/0.8 s')


def pour():
    # 348268: coffee poured into a mug.
    x = high(load(348268, 1.0, 6.8), 80)
    y, gr = level(fade(x, 0.1, 0.8), rms_db=-31)
    save('pour', y, gr, '348268 1-6.8 s, high-pass 80 Hz, fades 0.1/0.8 s')


def mugs():
    # 397600: a ceramic cup set down on a hard surface, two of its takes.
    for name, a in (('mug-1', 4.2), ('mug-2', 7.05)):
        x = high(load(397600, a, a + 0.6), 80)
        y, gr = level(fade(x, 0.003, 0.2), peak_db=-6)
        save(name, y, gr, f'397600 {a}-{a + 0.6:.2f} s, high-pass 80 Hz, fades 0.003/0.2 s')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: python3 scripts/art/sounds.py DIR (the fetched previews)')
    os.makedirs(OUT, exist_ok=True)
    for make in (murmur, guitar, bongos, snaps, needle, typewriter, beads, grinder, pour, mugs):
        make()
    print('\n'.join(report))
