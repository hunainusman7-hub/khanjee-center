#!/usr/bin/env python3
"""Refit a traced polygon outline as smooth cubic Beziers.

kj-mark.svg was produced by walking the boundary of a raster, so it is
1,270 straight segments and not one curve. Every arc in the mark — the
ring, the crescent tips, the J's bowl, the dot — is a staircase of
one-unit steps. That is what "not clean enough" is: at any size the
curves are faceted, and the pixel staircase is baked into the outline.

This refits the same geometry as curves. It is a reproduction, not a
redesign: the shapes are the client's, the deviation from them is
measured and reported, and sharp corners are detected and preserved so
the crescent tips stay points instead of being rounded away.

The fit is Schneider's algorithm (Graphics Gems, 1990) — the same
approach real tracers use. Fit one cubic through a run of points by
chord-length parameterisation, measure the worst deviation, and if it is
over tolerance split at that point and recurse.

Usage: fit_curves.py in.svg out.svg [tolerance]
"""
import math
import re
import sys
import pathlib


def sub(a, b):  return (a[0]-b[0], a[1]-b[1])
def add(a, b):  return (a[0]+b[0], a[1]+b[1])
def mul(a, s):  return (a[0]*s, a[1]*s)
def dot(a, b):  return a[0]*b[0] + a[1]*b[1]
def norm(a):
    d = math.hypot(*a)
    return (0.0, 0.0) if d == 0 else (a[0]/d, a[1]/d)


def bez(p, t):
    mt = 1-t
    return (mt**3*p[0][0] + 3*mt*mt*t*p[1][0] + 3*mt*t*t*p[2][0] + t**3*p[3][0],
            mt**3*p[0][1] + 3*mt*mt*t*p[1][1] + 3*mt*t*t*p[2][1] + t**3*p[3][1])


def chord_params(pts):
    d = [0.0]
    for i in range(1, len(pts)):
        d.append(d[-1] + math.hypot(*sub(pts[i], pts[i-1])))
    total = d[-1]
    return [x/total for x in d] if total else [0.0]*len(pts)


def fit_one(pts, u, t1, t2):
    """Least-squares fit of the two inner control points, tangents fixed."""
    n = len(pts)
    A = [[mul(t1, 3*(1-u[i])**2*u[i]), mul(t2, 3*(1-u[i])*u[i]**2)] for i in range(n)]
    c00 = c01 = c11 = x0 = x1 = 0.0
    for i in range(n):
        c00 += dot(A[i][0], A[i][0])
        c01 += dot(A[i][0], A[i][1])
        c11 += dot(A[i][1], A[i][1])
        base = bez([pts[0], pts[0], pts[-1], pts[-1]], u[i])
        tmp = sub(pts[i], base)
        x0 += dot(A[i][0], tmp)
        x1 += dot(A[i][1], tmp)
    det = c00*c11 - c01*c01
    if abs(det) < 1e-12:
        seg = math.hypot(*sub(pts[-1], pts[0])) / 3.0
        a1 = a2 = seg
    else:
        a1 = (c11*x0 - c01*x1) / det
        a2 = (c00*x1 - c01*x0) / det
    seg = math.hypot(*sub(pts[-1], pts[0]))
    if a1 < 1e-6 or a2 < 1e-6:
        a1 = a2 = seg/3.0
    # Clamp the handles. The least-squares solve is happy to return an
    # enormous a1/a2 when the run is nearly closed and the system is
    # ill-conditioned, which throws a control point hundreds of units
    # away — that was a 440-unit deviation on the ring, 43% of the
    # mark's width. A cubic handle longer than the chord it spans is
    # never the curve we want here.
    cap = max(seg, 1e-6)
    a1 = min(max(a1, cap/100), cap)
    a2 = min(max(a2, cap/100), cap)
    return [pts[0], add(pts[0], mul(t1, a1)), add(pts[-1], mul(t2, a2)), pts[-1]]


def max_error(pts, u, curve):
    worst, at = 0.0, len(pts)//2
    for i in range(1, len(pts)-1):
        d = math.hypot(*sub(bez(curve, u[i]), pts[i]))
        if d > worst:
            worst, at = d, i
    return worst, at


def fit_cubic(pts, t1, t2, tol, depth=0):
    if len(pts) == 2:
        seg = math.hypot(*sub(pts[1], pts[0])) / 3.0
        return [[pts[0], add(pts[0], mul(t1, seg)), add(pts[1], mul(t2, seg)), pts[1]]]
    u = chord_params(pts)
    curve = fit_one(pts, u, t1, t2)
    err, at = max_error(pts, u, curve)
    if err < tol or depth > 18:
        return [curve]
    centre = norm(sub(pts[at-1], pts[at+1]))
    left = fit_cubic(pts[:at+1], t1, centre, tol, depth+1)
    right = fit_cubic(pts[at:], mul(centre, -1), t2, tol, depth+1)
    return left + right


def corners(pts, angle_deg=32, span=4):
    """Points where direction turns hard. These are the crescent tips and
    the letter joints, and they must survive as corners."""
    out, n = set(), len(pts)
    # dot(a,b) is the cosine of how much the direction TURNED: 1 is dead
    # straight, 0 is a right angle. So a corner sharper than angle_deg is
    # dot < cos(angle_deg). The previous cos(180 - angle_deg) demanded an
    # almost complete reversal, which is why no corner was ever found and
    # the letterforms got smoothed into curves.
    lim = math.cos(math.radians(angle_deg))
    for i in range(n):
        a = norm(sub(pts[i], pts[(i-span) % n]))
        b = norm(sub(pts[(i+span) % n], pts[i]))
        if a == (0.0, 0.0) or b == (0.0, 0.0):
            continue
        if dot(a, b) < lim:
            out.add(i)
    # thin clusters down to one representative
    keep, last = [], -99
    for i in sorted(out):
        if i - last > span:
            keep.append(i)
        last = i
    return keep


def dedup(pts):
    out = [pts[0]]
    for p in pts[1:]:
        if math.hypot(*sub(p, out[-1])) > 1e-9:
            out.append(p)
    if len(out) > 1 and math.hypot(*sub(out[0], out[-1])) < 1e-9:
        out.pop()
    return out


def fmt(v):
    s = f"{v:.2f}".rstrip('0').rstrip('.')
    return s if s not in ('-0', '') else '0'


def line_error(run):
    """Worst distance from the run's points to the chord through its ends."""
    a, b = run[0], run[-1]
    ab = sub(b, a)
    L2 = dot(ab, ab)
    if L2 == 0:
        return max(math.hypot(*sub(p, a)) for p in run) if run else 0.0
    worst = 0.0
    for p in run[1:-1]:
        t = max(0.0, min(1.0, dot(sub(p, a), ab)/L2))
        worst = max(worst, math.hypot(*sub(p, add(a, mul(ab, t)))))
    return worst


def smooth_run(run, passes=3):
    """Average out the one-unit pixel staircase, endpoints pinned.

    The outline came from walking a raster boundary, so it zig-zags by a
    single unit the whole way round. Fitting straight through that makes
    the fit chase the zig-zag and emit hundreds of tiny curves — more
    data than the polygon it replaced. Averaging first lets a handful of
    curves describe the real arc. Endpoints stay put so the corners
    detected on the raw outline survive exactly."""
    if len(run) < 5:
        return run
    out = list(run)
    for _ in range(passes):
        nxt = [out[0]]
        for i in range(1, len(out)-1):
            a, b, c = out[i-1], out[i], out[i+1]
            nxt.append(((a[0]+2*b[0]+c[0])/4.0, (a[1]+2*b[1]+c[1])/4.0))
        nxt.append(out[-1])
        out = nxt
    return out


def smooth_closed(pts, passes=2):
    """Same averaging, but around a closed loop with no pinned ends."""
    out = list(pts)
    n = len(out)
    if n < 6:
        return out
    for _ in range(passes):
        out = [((out[(i-1) % n][0] + 2*out[i][0] + out[(i+1) % n][0])/4.0,
                (out[(i-1) % n][1] + 2*out[i][1] + out[(i+1) % n][1])/4.0)
               for i in range(n)]
    return out


def fit_subpath(pts, tol):
    raw = dedup(pts)
    n = len(raw)
    if n < 4:
        return None, 0, 0.0, 0, 0
    # Detect corners on a SMOOTHED copy. On the raw outline every pixel
    # step of a diagonal edge is a 90-degree turn, so corner detection
    # fired everywhere and the runs came out too short to classify. The
    # smoothed loop keeps the real corners — the crescent tips and the
    # letter joints — and loses the staircase.
    pts = raw
    cs = corners(smooth_closed(raw), angle_deg=38, span=9)
    if len(cs) < 2:
        cs = [0, n//2]
    runs = []
    for k in range(len(cs)):
        a, b = cs[k], cs[(k+1) % len(cs)]
        run = pts[a:b+1] if b > a else pts[a:] + pts[:b+1]
        if len(run) >= 2:
            runs.append(run)
    # Decide per run whether it is straight or curved. The K and the J are
    # straight-edged with square corners, and a cubic is the wrong model
    # for them — fitting curves through the letters rounded their corners
    # off, which was the whole of the remaining error. A run that a
    # single line describes within tolerance IS a line; emit it as one.
    segs, curves = [], []
    for run in runs:
        if line_error(run) < tol:
            segs.append(('L', [run[0], run[-1]]))
            continue
        r = smooth_run(run)
        t1 = norm(sub(r[1], r[0]))
        t2 = norm(sub(r[-2], r[-1]))
        cs = fit_cubic(r, t1, t2, tol)
        curves += cs
        segs.append(('C', cs))

    first = segs[0][1][0] if segs[0][0] == 'L' else segs[0][1][0][0]
    d = f"M{fmt(first[0])} {fmt(first[1])}"
    for kind, payload in segs:
        if kind == 'L':
            d += f"L{fmt(payload[1][0])} {fmt(payload[1][1])}"
        else:
            for c in payload:
                d += (f"C{fmt(c[1][0])} {fmt(c[1][1])} {fmt(c[2][0])} {fmt(c[2][1])}"
                      f" {fmt(c[3][0])} {fmt(c[3][1])}")
    d += "Z"
    straight = sum(1 for k, _ in segs if k == 'L')

    # how far did we move away from the client's own outline?
    worst = 0.0
    pts = raw
    m = len(pts)
    for c in curves:
        for j in range(13):
            p = bez(c, j/12)
            best = 1e18
            for k in range(m):                    # distance to the polyline
                a, b = pts[k], pts[(k+1) % m]
                ab = sub(b, a)
                L2 = dot(ab, ab)
                t = 0.0 if L2 == 0 else max(0.0, min(1.0, dot(sub(p, a), ab)/L2))
                best = min(best, math.hypot(*sub(p, add(a, mul(ab, t)))))
            worst = max(worst, best)
    return d, len(curves), worst, straight, len(segs)


MAX_DEV = 6.0   # units, on a 1021-wide mark: 0.6% of the width


def as_polygon(pts):
    d = f"M{fmt(pts[0][0])} {fmt(pts[0][1])}"
    for q in pts[1:]:
        d += f"L{fmt(q[0])} {fmt(q[1])}"
    return d + "Z"


def main(src, dst, tol=1.6):
    svg = pathlib.Path(src).read_text()
    vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
    d_all = re.search(r'\sd="([^"]+)"', svg).group(1)

    subpaths, cur = [], []
    for m in re.finditer(r'([MLZ])([^MLZ]*)', d_all):
        cmd, arg = m.group(1), m.group(2).strip()
        if cmd == 'M':
            if cur:
                subpaths.append(cur)
            xy = [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?', arg)]
            cur = [(xy[0], xy[1])]
        elif cmd == 'L':
            xy = [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?', arg)]
            for i in range(0, len(xy), 2):
                cur.append((xy[i], xy[i+1]))
        elif cmd == 'Z':
            if cur:
                subpaths.append(cur)
                cur = []
    if cur:
        subpaths.append(cur)

    print(f"  {len(subpaths)} subpaths, {sum(len(s) for s in subpaths)} points in")
    outs, curves_total, worst_all = [], 0, 0.0
    for i, sp in enumerate(subpaths):
        got = fit_subpath(sp, tol)
        d, nc, worst = got[0], got[1], got[2]
        nl, nseg = got[3], got[4]
        if not d:
            print(f"    subpath {i}: {len(sp)} pts - too small to fit, dropped")
            continue
        # Only accept a refit that stayed on the client's outline. Where it
        # did not, keep their polygon — a faceted curve is a cosmetic
        # problem, a changed logo is not.
        if worst > MAX_DEV:
            outs.append(as_polygon(dedup(sp)))
            print(f"    subpath {i}: {len(sp):4} lines -> KEPT AS-IS"
                  f"   (refit deviated {worst:.1f} units, over the {MAX_DEV} limit)")
            continue
        outs.append(d)
        curves_total += nc
        worst_all = max(worst_all, worst)
        print(f"    subpath {i}: {len(sp):4} lines -> {nl:3} straight + {nc:3} curves"
              f"   max deviation {worst:.2f} units")

    body = "".join(outs)
    out = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
           f'fill="currentColor" fill-rule="evenodd" role="img">'
           f'<title>Khan Jee</title><path d="{body}"/></svg>\n')
    pathlib.Path(dst).write_text(out)
    src_bytes = len(pathlib.Path(src).read_text())
    print(f"\n  {sum(len(s) for s in subpaths)} line segments -> {curves_total} cubic curves")
    print(f"  worst deviation from the traced outline: {worst_all:.2f} units "
          f"({worst_all/1021*100:.3f}% of the mark's width)")
    print(f"  {src_bytes} bytes -> {len(out)} bytes")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.6)
