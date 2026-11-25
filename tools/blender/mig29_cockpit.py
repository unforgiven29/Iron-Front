"""
MiG-29 cockpit shell generator (Blender, scripted; run headless with the `bpy` package).

    python3 tools/blender/mig29_cockpit.py

Writes:
  game/src/platforms/aircraft/mig29/cockpit/mig29-cockpit.glb   the shell model
  game/src/platforms/aircraft/mig29/cockpit/shell.json          its placement for CockpitLayout.shellModel

The model is built in the pilot's body frame (FRD metres from the design eye point) and converted
to Blender axes (X = right, Y = forward, Z = up), so the glTF export (+Y up) lands in the view's
camera frame with no extra rotation.

References (arrangement only; nothing is copied into the repository): IrasD, "MiG-29 cockpit 1..4",
c. 1995, Wikimedia Commons, CC BY-SA 4.0 — a Soviet-standard 9.12 cockpit (the 9.13 cockpit is the
same, per the project owner). The tub sides are curved lofted surfaces tiled with sub-panels. Panel geometry and
instrument positions come from panel.json (shared with the TypeScript layout so bezels and live
gauges coincide). Dimensions not measurable from the photographs are ESTIMATED.

Named nodes (animated / clickable by the layout): stick, throttle, gear_lever, emerg_gear,
flap_lever, airbrake_sw, sw_bat, sw_dcgen, sw_acgen, sw_pto. Each node's origin is its pivot.
"""
import json
import math
import os
import random

import bpy  # noqa: I001 — must load before bmesh/mathutils
import bmesh
from mathutils import Euler, Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "game", "src", "platforms", "aircraft", "mig29", "cockpit")
PANEL = json.load(open(os.path.join(OUT_DIR, "panel.json"), encoding="utf-8"))
bpy.ops.wm.read_factory_settings(use_empty=True)  # clean scene before any datablock is created

# ---------------------------------------------------------------- frames

def B(p):
    """Body FRD (x fwd, y right, z down) → Blender (X right, Y fwd, Z up)."""
    return Vector((p[1], p[0], -p[2]))


T = PANEL["tiltRad"]
FX, FZ = PANEL["faceX"], PANEL["faceZ"]
DV = (math.sin(T), 0.0, math.cos(T))       # panel "down" direction (FRD)
N = (-math.cos(T), 0.0, math.sin(T))       # panel normal toward the pilot (FRD)
K = PANEL["pxToM"]
OX, OY = PANEL["originPx"]


def P(u, v, w=0.0):
    """Point on the main panel: u right, v down along the face, w toward the pilot (m). FRD."""
    return (FX + DV[0] * v + N[0] * w, u, FZ + DV[2] * v + N[2] * w)


def px(x, y):
    return ((x - OX) * K, (y - OY) * K)


# ---------------------------------------------------------------- materials

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


MATS = {}


def mat(name, hexcol, rough=0.6, metal=0.0, alpha=1.0, emit=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb(hexcol), 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*srgb(emit), 1.0)
        bsdf.inputs["Emission Strength"].default_value = 0.6
    MATS[name] = m
    return m


# Colours sampled by eye from the reference photographs.
PAINT = mat("panel_paint", "#8a99a3", 0.75)          # blue-grey cockpit paint
PAINT_DK = mat("panel_paint_dark", "#76848e", 0.75)
BEZEL = mat("bezel", "#25282b", 0.55)
BLACK = mat("black", "#111213", 0.5)
RUBBER = mat("rubber", "#0c0c0d", 0.9)
SCREW = mat("screw", "#b9bec2", 0.35, 0.8)
METAL = mat("metal", "#9da3a8", 0.3, 0.9)
COAMING = mat("coaming", "#2a2d30", 0.85)
SCREEN = mat("screen", "#0a0d0c", 0.15)
RED = mat("red", "#b3261e", 0.45)
ORANGE = mat("orange", "#d8641e", 0.45)
YELLOW = mat("yellow", "#d9a520", 0.5)
AMBER_LAMP = mat("lamp_amber", "#c48a28", 0.25, emit="#3a2400")
GREEN_LAMP = mat("lamp_green", "#3c7a4a", 0.25)
WHITE = mat("white", "#e8e8e8", 0.5)
LEATHER = mat("leather", "#4a3626", 0.8)
GLASS = mat("glass", "#9fd8b8", 0.05, alpha=0.15)
FLOOR = mat("floor", "#4b555c", 0.9)

# ---------------------------------------------------------------- mesh helpers

COLL = bpy.data.collections.new("cockpit")


def reset():
    bpy.context.scene.collection.children.link(COLL)


def obj_from_bm(name, bm, material, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    if parent is not None:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def hexa(name, corners_frd, material, parent=None, bevel=0.0):
    """Six-sided solid from 8 FRD corners: 0-3 front face (ccw seen from the front), 4-7 back face."""
    bm = bmesh.new()
    v = [bm.verts.new(B(c)) for c in corners_frd]
    for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(name, bm, material, parent)
    if bevel > 0:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = 2
        m.limit_method = "ANGLE"
    return o


def panel_box(name, u0, u1, v0, v1, w_front, w_back, material, parent=None, bevel=0.0):
    c = [P(u0, v0, w_front), P(u1, v0, w_front), P(u1, v1, w_front), P(u0, v1, w_front),
         P(u0, v0, w_back), P(u1, v0, w_back), P(u1, v1, w_back), P(u0, v1, w_back)]
    return hexa(name, c, material, parent, bevel)


def box(name, center_frd, size_frd, material, rot_frd=(0, 0, 0), parent=None, bevel=0.0):
    """Axis box in FRD (size = x len, y width, z height), rotated (rad) about FRD x, y, z."""
    sx, sy, sz = (s / 2 for s in size_frd)
    corners = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
               (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    R = Euler(rot_frd, "XYZ").to_matrix()
    cs = [tuple(Vector(center_frd) + R @ Vector(c)) for c in corners]
    # reorder into front/back faces expected by hexa (front = z−, i.e. top in FRD)
    return hexa(name, [cs[0], cs[1], cs[2], cs[3], cs[4], cs[5], cs[6], cs[7]], material, parent, bevel)


def cyl(name, a_frd, b_frd, r, material, parent=None, segs=20, r2=None):
    """Cylinder (or cone with r2) from FRD point a to b."""
    a, b = B(a_frd), B(b_frd)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=d.length)
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    return obj_from_bm(name, bm, material, parent)


def disc_on_panel(name, u, v, w0, w1, r, material, parent=None, segs=32, r_in=None):
    """Cylinder (or ring with r_in) whose axis is the panel normal."""
    bm = bmesh.new()
    if r_in is None:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=abs(w1 - w0))
    else:
        outer = bmesh.ops.create_circle(bm, segments=segs, radius=r)["verts"]
        inner = bmesh.ops.create_circle(bm, segments=segs, radius=r_in)["verts"]
        for i in range(segs):
            bm.faces.new([outer[i], outer[(i + 1) % segs], inner[(i + 1) % segs], inner[i]])
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=abs(w1 - w0))
    n = B(N) - B((0, 0, 0))
    rot = n.to_track_quat("Z", "Y").to_matrix().to_4x4()
    centre = B(P(u, v, (w0 + w1) / 2 if r_in is None else w1))
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centre) @ rot, verts=bm.verts)
    return obj_from_bm(name, bm, material, parent)


def node(name, pivot_frd):
    """Empty-origin node: children are built in world space and parented with their offset kept."""
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.02
    COLL.objects.link(o)
    o.location = B(pivot_frd)
    bpy.context.view_layer.update()
    return o


# ---------------------------------------------------------------- parts

V_TOP = px(0, PANEL["panelPx"]["top"])[1]
V_BOT = px(0, PANEL["panelPx"]["bottom"])[1]
U_L = px(PANEL["panelPx"]["left"], 0)[0] - 0.02
U_R = px(PANEL["panelPx"]["right"], 0)[0] + 0.02
FACE_W = -0.010      # panel surface 10 mm behind the instrument faces


def main_panel():
    panel_box("panel_main", U_L, U_R, V_TOP, V_BOT, FACE_W, FACE_W - 0.05, PAINT, bevel=0.004)
    # Sub-panel seams: the real panel is several bolted plates (photographs).
    for u in (-0.215, 0.045, 0.255):
        panel_box(f"seam_{u}", u - 0.002, u + 0.002, V_TOP + 0.01, V_BOT - 0.01, FACE_W + 0.001, FACE_W, PAINT_DK)
    # Instrument bezels: square mounting plate, black ring, four screws.
    for ins in PANEL["instruments"]:
        u, v = px(ins["x"], ins["y"])
        if "d" in ins:
            d = ins["d"] * K
            s = d * 0.62
            panel_box(f"plate_{ins['id']}", u - s, u + s, v - s, v + s, FACE_W + 0.006, FACE_W, BEZEL, bevel=0.002)
            disc_on_panel(f"ring_{ins['id']}", u, v, FACE_W + 0.006, 0.006, d / 2 + 0.004, BLACK, r_in=d / 2 - 0.001)
            for su in (-1, 1):
                for sv in (-1, 1):
                    disc_on_panel(f"screw_{ins['id']}_{su}{sv}", u + su * s * 0.8, v + sv * s * 0.8, FACE_W + 0.006, FACE_W + 0.009, 0.0028, SCREW, segs=10)
        else:
            w, h = ins["w"] * K, ins["h"] * K
            panel_box(f"plate_{ins['id']}", u - w * 0.58, u + w * 0.58, v - h * 0.62, v + h * 0.62, FACE_W + 0.006, FACE_W, BEZEL, bevel=0.002)
            panel_box(f"frame_{ins['id']}", u - w * 0.52, u + w * 0.52, v - h * 0.54, v - h * 0.5, 0.004, FACE_W + 0.006, BLACK)
            panel_box(f"frameb_{ins['id']}", u - w * 0.52, u + w * 0.52, v + h * 0.5, v + h * 0.54, 0.004, FACE_W + 0.006, BLACK)
    # Radar head-down display: housing, recessed dark screen, bezel buttons.
    hd = PANEL["hdd"]
    u, v = px(hd["x"], hd["y"])
    w, h = hd["w"] * K, hd["h"] * K
    panel_box("hdd_housing", u - w / 2, u + w / 2, v - h / 2, v + h / 2, 0.012, FACE_W, BEZEL, bevel=0.003)
    panel_box("hdd_screen", u - w * 0.38, u + w * 0.38, v - h * 0.36, v + h * 0.36, 0.013, 0.008, SCREEN)
    for i in range(5):
        for side in (-1, 1):
            disc_on_panel(f"hdd_btn_{i}_{side}", u + side * w * 0.44, v - h * 0.3 + i * h * 0.15, 0.012, 0.018, 0.005, BLACK, segs=12)
    # Small switches/knobs actually visible on the photographs between instruments.
    rnd = random.Random(29)
    for (x, y) in ((205, 200), (300, 270), (380, 270), (590, 255), (620, 200), (180, 285)):
        uu, vv = px(x, y)
        disc_on_panel(f"knob_{x}_{y}", uu, vv, FACE_W, FACE_W + 0.018, 0.009, BLACK, segs=16)
        disc_on_panel(f"knobcap_{x}_{y}", uu, vv, FACE_W + 0.018, FACE_W + 0.021, 0.006, SCREW, segs=12)
    for (x0, y0, nx, ny) in ((175, 110, 3, 1), (395, 95, 4, 1), (600, 165, 1, 3), (380, 290, 5, 1), (95, 290, 4, 1)):
        for i in range(nx):
            for j in range(ny):
                uu, vv = px(x0 + i * 16, y0 + j * 16)
                kind = rnd.random()
                if kind < 0.45:
                    disc_on_panel(f"tg_{x0}_{i}_{j}", uu, vv, FACE_W, FACE_W + 0.005, 0.005, SCREW, segs=10)
                    a = Vector(P(uu, vv, FACE_W + 0.005))
                    cyl(f"tgb_{x0}_{i}_{j}", tuple(a), tuple(a + Vector((N[0], 0, N[2])) * 0.016 + Vector((0, 0, -0.004))), 0.0022, METAL, segs=8)
                elif kind < 0.75:
                    panel_box(f"lp_{x0}_{i}_{j}", uu - 0.006, uu + 0.006, vv - 0.005, vv + 0.005, FACE_W + 0.004, FACE_W, GREEN_LAMP if kind < 0.6 else AMBER_LAMP)
                else:
                    disc_on_panel(f"kb_{x0}_{i}_{j}", uu, vv, FACE_W, FACE_W + 0.012, 0.007, BLACK, segs=14)
                panel_box(f"pl_{x0}_{i}_{j}", uu - 0.007, uu + 0.007, vv + 0.009, vv + 0.0115, FACE_W + 0.0005, FACE_W, WHITE)
    del rnd


def wing_panel(side):
    """Angled outboard panel sections (left: nav/control panel; right: warning-lamp column)."""
    s = -1 if side == "l" else 1
    u_in = U_L if s < 0 else U_R
    yaw = math.radians(38)
    width = 0.11
    def Q(t, v, w=FACE_W):  # t: distance outward along the wing; the wing is hinged at the main panel edge and turned toward the pilot
        b = P(u_in, v, w)
        return (b[0] + t * math.sin(yaw) * N[0], b[1] + s * t * math.cos(yaw), b[2] + t * math.sin(yaw) * N[2])
    c = [Q(0, V_TOP), Q(width, V_TOP), Q(width, V_BOT + 0.05), Q(0, V_BOT + 0.05)]
    back = [Q(0, V_TOP, FACE_W - 0.04), Q(width, V_TOP, FACE_W - 0.04), Q(width, V_BOT + 0.05, FACE_W - 0.04), Q(0, V_BOT + 0.05, FACE_W - 0.04)]
    hexa(f"panel_wing_{side}", c + back, PAINT, bevel=0.004)
    if s < 0:
        # Navigation/system control panel: dark plate with knobs and toggles.
        for i, (t0, t1, v0, v1) in enumerate(((0.012, 0.098, V_TOP + 0.02, V_TOP + 0.12), (0.012, 0.098, V_TOP + 0.135, V_TOP + 0.25))):
            pts = [Q(t0, v0, FACE_W + 0.004), Q(t1, v0, FACE_W + 0.004), Q(t1, v1, FACE_W + 0.004), Q(t0, v1, FACE_W + 0.004)]
            pts += [Q(t0, v0, FACE_W), Q(t1, v0, FACE_W), Q(t1, v1, FACE_W), Q(t0, v1, FACE_W)]
            hexa(f"navpanel_{i}", pts, BLACK, bevel=0.001)
            for j in range(3):
                for k in range(2):
                    a = Vector(Q(t0 + 0.02 + k * 0.045, v0 + 0.022 + j * 0.03, FACE_W + 0.004))
                    b = a + Vector((N[0], 0, N[2])) * 0.016
                    cyl(f"navknob_{i}_{j}_{k}", tuple(a), tuple(b), 0.007, BLACK if (j + k) % 2 else METAL, segs=12)
    else:
        # Warning lamp column ("табло"): 2 × 9 rectangular lamp lenses.
        for row in range(9):
            for col in range(2):
                t0 = 0.018 + col * 0.044
                v0 = V_TOP + 0.03 + row * 0.03
                pts = [Q(t0, v0, FACE_W + 0.008), Q(t0 + 0.036, v0, FACE_W + 0.008), Q(t0 + 0.036, v0 + 0.022, FACE_W + 0.008), Q(t0, v0 + 0.022, FACE_W + 0.008)]
                pts += [Q(t0, v0, FACE_W), Q(t0 + 0.036, v0, FACE_W), Q(t0 + 0.036, v0 + 0.022, FACE_W), Q(t0, v0 + 0.022, FACE_W)]
                hexa(f"lamp_{row}_{col}", pts, AMBER_LAMP if (row + col) % 3 else BEZEL, bevel=0.001)


def glareshield_and_hud():
    top = P(0, V_TOP, FACE_W)
    lip_x, lip_z = top[0] - 0.06, top[2] - 0.035
    # Coaming: arched shell from the lip forward, built as a grid then solidified.
    bm = bmesh.new()
    ny, nx = 17, 6
    half = (U_R - U_L) / 2 + 0.03
    grid = []
    for i in range(nx):
        t = i / (nx - 1)
        x = lip_x + 0.42 * t
        zc = lip_z - 0.035 * math.sin(t * math.pi / 2)
        row = []
        for j in range(ny):
            y = -half + 2 * half * j / (ny - 1)
            arch = 0.045 * (1 - (y / half) ** 2)
            w_taper = 1 - 0.25 * t
            row.append(bm.verts.new(B((x, y * w_taper, zc - arch))))
        grid.append(row)
    for i in range(nx - 1):
        for j in range(ny - 1):
            bm.faces.new([grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]])
    # Front lip curtain down to the panel top.
    curtain = [bm.verts.new(B((lip_x, -half + 2 * half * j / (ny - 1), lip_z + 0.05))) for j in range(ny)]
    for j in range(ny - 1):
        bm.faces.new([grid[0][j + 1], grid[0][j], curtain[j], curtain[j + 1]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm("glareshield", bm, COAMING)
    sol = o.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.012
    # ИЛС HUD: body, lens window, combiner frame and glass.
    hx, hz = lip_x + 0.06, lip_z - 0.08
    box("hud_body", (hx + 0.08, 0, hz + 0.03), (0.17, 0.17, 0.09), BEZEL, bevel=0.006)
    box("hud_top", (hx + 0.07, 0, hz - 0.018), (0.12, 0.15, 0.012), BLACK, bevel=0.003)
    box("hud_lens", (hx + 0.02, 0, hz - 0.026), (0.07, 0.11, 0.006), SCREEN)
    for s in (-1, 1):
        cyl(f"hud_post_{s}", (hx + 0.0, s * 0.072, hz - 0.02), (hx - 0.045, s * 0.072, hz - 0.16), 0.006, BLACK, segs=10)
    box("hud_frame_top", (hx - 0.045, 0, hz - 0.165), (0.012, 0.156, 0.012), BLACK)
    box("hud_glass", (hx - 0.022, 0, hz - 0.095), (0.004, 0.14, 0.13), GLASS, rot_frd=(0, math.radians(-22), 0))


def canopy_frame_and_tub():
    # Windscreen arch (frame) and canopy sills.
    bm = bmesh.new()
    n = 24
    pts = []
    for i in range(n + 1):
        t = i / n
        a = math.pi * t
        y = -0.48 * math.cos(a)
        z = 0.30 - 0.78 * math.sin(a)
        x = 1.02 - 0.42 * math.sin(a)
        pts.append((x, y, z))
    o = None
    for i in range(n):
        o = cyl(f"arch_{i}", pts[i], pts[i + 1], 0.022, COAMING, segs=8)
    for s, name in ((-1, "l"), (1, "r")):
        box(f"sill_{name}", (0.25, s * 0.49, 0.30), (1.5, 0.06, 0.05), PAINT_DK, bevel=0.006)
    del o


CONSOLE_TOP = 0.57  # reference height for parts that still sit on a flat datum (ESTIMATED)


def side_profile(side, a, b):
    """Curved side panel ("downlook panel") of the cockpit tub, FRD. a: aft (0) → front (1);
    b: canopy sill (0) → inboard edge at the foot well (1). Quadratic profile from the sill,
    straight down, then curving inboard; toward the front it sweeps up and outboard into the
    angled main-panel sections (shape from the reference photographs; dimensions ESTIMATED)."""
    x = -0.45 + 1.31 * a
    k = max(0.0, min(1.0, (a - 0.55) / 0.45)) ** 2
    p0 = (0.485, 0.30)
    p1 = (0.485, 0.62 - 0.17 * k)
    p2 = (0.23 + 0.13 * k, 0.77 - 0.16 * k)
    y = (1 - b) ** 2 * p0[0] + 2 * (1 - b) * b * p1[0] + b * b * p2[0]
    z = (1 - b) ** 2 * p0[1] + 2 * (1 - b) * b * p1[1] + b * b * p2[1]
    return (x, side * y, z)


def loft(name, f, nu, nv, material, thickness=0.012, parent=None):
    bm = bmesh.new()
    g = [[bm.verts.new(B(f(i / (nu - 1), j / (nv - 1)))) for j in range(nv)] for i in range(nu)]
    for i in range(nu - 1):
        for j in range(nv - 1):
            bm.faces.new([g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(name, bm, material, parent)
    if thickness:
        m = o.modifiers.new("solid", "SOLIDIFY")
        m.thickness = thickness
    sm = o.modifiers.new("smooth", "WEIGHTED_NORMAL") if False else None
    return o


def surface_frame(f, a, b, side):
    e = 1e-3
    p = Vector(f(a, b))
    da = Vector(f(min(1, a + e), b)) - Vector(f(max(0, a - e), b))
    db = Vector(f(a, min(1, b + e))) - Vector(f(a, max(0, b - e)))
    n = da.cross(db).normalized()
    if n.dot(Vector((0.0, -side, -1.0))) < 0:  # face the cockpit centre line and up
        n = -n
    return p, da.normalized(), db.normalized(), n


def on_surface_plate(name, f, side, a0, a1, b0, b1, material, lift=0.004):
    g = lambda u, v: tuple(Vector(f(a0 + (a1 - a0) * u, b0 + (b1 - b0) * v)) + surface_frame(f, a0 + (a1 - a0) * u, b0 + (b1 - b0) * v, side)[3] * lift)
    return loft(name, g, 4, 4, material, thickness=0.004)


def on_surface_item(name, f, side, a, b, kind, parent=None, base_lift=0.008):
    p, ta, tb, n = surface_frame(f, a, b, side)
    p = p + n * base_lift
    if kind == "knob":
        cyl(name, tuple(p), tuple(p + n * 0.018), 0.009, BLACK, parent, segs=14)
        cyl(name + "_c", tuple(p + n * 0.018), tuple(p + n * 0.021), 0.004, WHITE, parent, segs=8)
    elif kind == "toggle":
        cyl(name, tuple(p), tuple(p + n * 0.005), 0.006, METAL, parent, segs=10)
        cyl(name + "_b", tuple(p + n * 0.005), tuple(p + n * 0.022 + ta * 0.006), 0.0025, METAL, parent, segs=8)
    elif kind == "guard":
        c = p + n * 0.007
        cs = [c - ta * 0.011 - tb * 0.008, c + ta * 0.011 - tb * 0.008, c + ta * 0.011 + tb * 0.008, c - ta * 0.011 + tb * 0.008]
        hexa(name, [tuple(x + n * 0.007) for x in cs] + [tuple(x - n * 0.007) for x in cs], RED, parent, bevel=0.002)
    elif kind == "lamp":
        c = p + n * 0.002
        cs = [c - ta * 0.008 - tb * 0.008, c + ta * 0.008 - tb * 0.008, c + ta * 0.008 + tb * 0.008, c - ta * 0.008 + tb * 0.008]
        hexa(name, [tuple(x + n * 0.004) for x in cs] + [tuple(x - n * 0.002) for x in cs], AMBER_LAMP, parent)
    return p, n


def side_f(side):
    return lambda a, b: side_profile(side, a, b)


# Sub-panel plan per side: (a0, a1, b0, b1) on the side surface; regions kept clear for the throttle etc.
SIDE_PANELS = {
    -1: [(0.04, 0.30, 0.42, 0.98), (0.30, 0.38, 0.30, 0.55), (0.62, 0.80, 0.40, 0.98), (0.80, 0.97, 0.30, 0.95), (0.38, 0.60, 0.80, 0.98)],
    1: [(0.04, 0.24, 0.40, 0.98), (0.24, 0.46, 0.40, 0.98), (0.46, 0.62, 0.55, 0.98), (0.62, 0.80, 0.35, 0.98), (0.80, 0.97, 0.30, 0.95)],
}


RESERVED = {-1: [(0.34, 0.58, 0.50, 0.75), (0.80, 0.94, 0.30, 0.54), (0.30, 0.37, 0.38, 0.52), (0.58, 0.66, 0.48, 0.62)], 1: [(0.48, 0.64, 0.30, 0.54)]}


def side_tiles(side, rnd):
    """Tile the side surface with sub-panels of varying size (as on the photographs), leaving the
    reserved areas (throttle, gear, flap, airbrake, electrical plate) clear."""
    tiles = []
    a = 0.02
    while a < 0.97:
        w = min(0.97 - a, rnd.uniform(0.06, 0.13))
        b = 0.16
        while b < 0.99:
            h = min(0.99 - b, rnd.uniform(0.18, 0.4))
            t = (a, a + w, b, b + h)
            clash = any(not (t[1] <= r[0] or t[0] >= r[1] or t[3] <= r[2] or t[2] >= r[3]) for r in RESERVED[side])
            if not clash:
                tiles.append(t)
            b += h
        a += w
    return tiles


def consoles():
    rnd = random.Random(1995)
    for side, name in ((-1, "l"), (1, "r")):
        f = side_f(side)
        loft(f"side_{name}", f, 28, 14, PAINT, thickness=0)
        for k, (a0, a1, b0, b1) in enumerate(side_tiles(side, rnd)):
            on_surface_plate(f"sp_{name}_{k}", f, side, a0 + 0.004, a1 - 0.004, b0 + 0.008, b1 - 0.008, BLACK if rnd.random() < 0.35 else PAINT_DK)
            na = max(1, int((a1 - a0) / 0.04)); nb = max(1, int((b1 - b0) / 0.12))
            for i in range(na):
                for j in range(nb):
                    a = a0 + (i + 0.5) * (a1 - a0) / na
                    b = b0 + (j + 0.5) * (b1 - b0) / nb
                    r_ = rnd.random()
                    kind = "knob" if r_ < 0.35 else "toggle" if r_ < 0.7 else "guard" if r_ < 0.8 else "lamp"
                    on_surface_item(f"it_{name}_{k}_{i}_{j}", f, side, a, b, kind, base_lift=0.01)
    # Orange lamp row along the right canopy sill (photograph 3).
    f = side_f(1)
    for i in range(10):
        on_surface_item(f"sill_lamp_{i}", f, 1, 0.42 + i * 0.05, 0.12, "lamp", base_lift=0.004)


def lower_pedestal_and_floor():
    bot = P(0, V_BOT, FACE_W)
    hexa("pedestal", [
        (bot[0], -0.11, bot[2]), (bot[0], 0.11, bot[2]), (bot[0] - 0.06, 0.11, 0.95), (bot[0] - 0.06, -0.11, 0.95),
        (bot[0] + 0.1, -0.11, bot[2]), (bot[0] + 0.1, 0.11, bot[2]), (bot[0] + 0.04, 0.11, 0.95), (bot[0] + 0.04, -0.11, 0.95)], PAINT_DK, bevel=0.004)
    for i in range(3):
        z = bot[2] + 0.05 + i * 0.11
        box(f"ped_plate_{i}", (bot[0] - 0.012 - i * 0.02, 0, z + 0.04), (0.01, 0.19, 0.09), BLACK, bevel=0.002)
        for k in range(4):
            cyl(f"ped_knob_{i}_{k}", (bot[0] - 0.017 - i * 0.02, -0.065 + k * 0.043, z + 0.04), (bot[0] - 0.035 - i * 0.02, -0.065 + k * 0.043, z + 0.04), 0.007, METAL if k % 2 else BLACK, segs=12)
    box("floor", (0.35, 0, 1.0), (1.6, 0.6, 0.02), FLOOR)
    # Foot wells: ribbed/perforated floor plates sloping up to the rudder pedals (photograph 3).
    for sd in (-1, 1):
        y = sd * 0.175
        hexa(f"footwell_{sd}", [
            (0.35, y - 0.06, 0.985), (0.35, y + 0.06, 0.985), (0.85, y + 0.06, 0.86), (0.85, y - 0.06, 0.86),
            (0.35, y - 0.06, 1.0), (0.35, y + 0.06, 1.0), (0.85, y + 0.06, 0.875), (0.85, y - 0.06, 0.875)], FLOOR)
        for k in range(10):
            t = (k + 0.5) / 10
            x = 0.35 + 0.5 * t
            z = 0.985 - 0.125 * t - 0.006
            for c in (-1, 1):
                box(f"rib_{sd}_{k}_{c}", (x, y + c * 0.025, z), (0.012, 0.035, 0.008), BLACK, rot_frd=(0, math.atan2(0.125, 0.5), 0))
        box(f"pedal_{sd}", (0.88, y, 0.83), (0.035, 0.1, 0.17), BLACK, rot_frd=(0, math.radians(-25), 0), bevel=0.006)


def seat():
    box("seat_pan", (-0.02, 0, 0.80), (0.42, 0.44, 0.1), LEATHER, bevel=0.03)
    box("seat_front", (0.18, 0, 0.84), (0.05, 0.42, 0.14), LEATHER, bevel=0.015)
    box("seat_placard", (0.207, 0, 0.82), (0.004, 0.09, 0.06), YELLOW)
    # Two ejection handles side by side (red loops, photograph 3).
    for sd in (-1, 1):
        pts = []
        for i in range(13):
            a = math.pi * i / 12
            pts.append((0.21 + 0.015 * math.sin(a), sd * 0.055 - 0.045 * math.cos(a), 0.775 - 0.06 * math.sin(a)))
        for i in range(12):
            cyl(f"eject_{sd}_{i}", pts[i], pts[i + 1], 0.008, RED, segs=10)


# ---------------------------------------------------------------- animated nodes

def stick():
    piv = (0.47, 0.0, 0.97)
    n = node("stick", piv)
    cyl("stick_boot", (0.47, 0, 0.97), (0.47, 0, 0.84), 0.06, RUBBER, n, segs=18, r2=0.025)
    cyl("stick_shaft", (0.47, 0, 0.84), (0.46, 0, 0.58), 0.014, BLACK, n, segs=14)
    cyl("stick_grip", (0.46, 0, 0.58), (0.44, 0, 0.44), 0.022, RUBBER, n, segs=16)
    for i in range(7):  # grip ribbing
        z = 0.565 - i * 0.018
        cyl(f"stick_rib_{i}", (0.459 - i * 0.002, 0, z), (0.459 - i * 0.002, 0, z - 0.006), 0.0235, BLACK, n, segs=16)
    box("stick_head", (0.445, 0, 0.42), (0.06, 0.09, 0.05), BLACK, parent=n, bevel=0.012)
    cyl("stick_btn_red", (0.43, -0.03, 0.40), (0.425, -0.03, 0.39), 0.009, RED, n, segs=12)
    cyl("stick_btn_white", (0.44, 0.0, 0.396), (0.44, 0.0, 0.388), 0.009, WHITE, n, segs=12)
    cyl("stick_btn_grey", (0.43, 0.03, 0.40), (0.425, 0.03, 0.39), 0.009, METAL, n, segs=12)
    box("stick_trigger", (0.475, 0, 0.47), (0.02, 0.012, 0.04), BLACK, parent=n)


def throttle():
    """Throttle quadrant on the left side panel (photograph 3: lower left)."""
    fl = side_f(-1)
    p, ta, tb, n = surface_frame(fl, 0.45, 0.62, -1)
    on_surface_plate("throttle_quadrant", fl, -1, 0.36, 0.56, 0.52, 0.72, BLACK, lift=0.006)
    nd = node("throttle", tuple(p))
    for k in (-1, 1):
        a = p + n * 0.01 + tb * 0.012 * k
        cyl(f"thr_arm_{k}", tuple(a), tuple(a + n * 0.10 - ta * 0.02), 0.008, METAL, nd, segs=10)
    g = p + n * 0.13 - ta * 0.025
    cyl("thr_grip", tuple(g - tb * 0.04), tuple(g + tb * 0.05), 0.033, BLACK, nd, segs=20)
    cyl("thr_grip_cap", tuple(g + tb * 0.05), tuple(g + tb * 0.065), 0.028, RUBBER, nd, segs=20)
    cyl("thr_btn", tuple(g + n * 0.03), tuple(g + n * 0.038), 0.008, RED, nd, segs=10)


def levers():
    fl, fr = side_f(-1), side_f(1)
    # Gear lever: left side panel, forward (red knob); rotates fore/aft about its slot.
    p, ta, tb, n = surface_frame(fl, 0.86, 0.42, -1)
    on_surface_plate("gear_panel", fl, -1, 0.82, 0.92, 0.32, 0.52, BLACK, lift=0.006)
    nd = node("gear_lever", tuple(p + n * 0.01))
    cyl("gear_arm", tuple(p + n * 0.01), tuple(p + n * 0.06 - ta * 0.02), 0.0055, METAL, nd, segs=10)
    cyl("gear_knob", tuple(p + n * 0.06 - ta * 0.02), tuple(p + n * 0.075 - ta * 0.025), 0.015, RED, nd, segs=16)
    # Flap control: left side panel, ahead of the throttle.
    p, ta, tb, n = surface_frame(fl, 0.62, 0.55, -1)
    nd = node("flap_lever", tuple(p + n * 0.01))
    cyl("flap_arm", tuple(p + n * 0.01), tuple(p + n * 0.045), 0.005, METAL, nd, segs=10)
    cyl("flap_knob", tuple(p + n * 0.045), tuple(p + n * 0.058), 0.011, WHITE, nd, segs=12)
    # Airbrake switch: left side panel behind the throttle.
    p, ta, tb, n = surface_frame(fl, 0.33, 0.45, -1)
    nd = node("airbrake_sw", tuple(p + n * 0.012))
    cyl("ab_base", tuple(p + n * 0.006), tuple(p + n * 0.012), 0.007, METAL)
    cyl("ab_bat", tuple(p + n * 0.012), tuple(p + n * 0.032 + ta * 0.008), 0.003, GREEN_LAMP, nd, segs=8)
    # Emergency gear T-handle under the panel (yellow).
    nd = node("emerg_gear", (0.76, -0.30, 0.60))
    cyl("emerg_stem", (0.80, -0.30, 0.60), (0.76, -0.30, 0.60), 0.006, METAL, nd, segs=10)
    box("emerg_handle", (0.755, -0.30, 0.60), (0.018, 0.08, 0.02), YELLOW, parent=nd, bevel=0.004)
    # Electrical power switches: right side panel, a labelled plate.
    on_surface_plate("elec_plate", fr, 1, 0.50, 0.62, 0.32, 0.52, PAINT_DK, lift=0.006)
    for i, nm in enumerate(("sw_bat", "sw_dcgen", "sw_acgen", "sw_pto")):
        p, ta, tb, n = surface_frame(fr, 0.515 + i * 0.03, 0.40, 1)
        nd = node(nm, tuple(p + n * 0.013))
        cyl(f"{nm}_base", tuple(p + n * 0.008), tuple(p + n * 0.013), 0.006, METAL)
        cyl(f"{nm}_bat", tuple(p + n * 0.013), tuple(p + n * 0.032 + ta * 0.008), 0.0025, METAL, nd, segs=8)
        q = p + tb * 0.035 + n * 0.0105
        hexa(f"{nm}_label", [tuple(q + d) for d in (-ta * 0.008 - tb * 0.005, ta * 0.008 - tb * 0.005, ta * 0.008 + tb * 0.005, -ta * 0.008 + tb * 0.005)] +
             [tuple(q + d - n * 0.002) for d in (-ta * 0.008 - tb * 0.005, ta * 0.008 - tb * 0.005, ta * 0.008 + tb * 0.005, -ta * 0.008 + tb * 0.005)], WHITE)


# ---------------------------------------------------------------- build and export

def build():
    reset()
    main_panel()
    wing_panel("l")
    wing_panel("r")
    glareshield_and_hud()
    canopy_frame_and_tub()
    consoles()
    lower_pedestal_and_floor()
    seat()
    stick()
    throttle()
    levers()


def export():
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "mig29-cockpit.glb")
    for o in COLL.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True, use_selection=True)
    # Placement for the view: bounding box in body FRD (view scales by its longest horizontal side).
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in COLL.objects:
        if o.type != "MESH":
            continue
        ev = o.evaluated_get(dg)
        for v in ev.to_mesh().vertices:
            w = ev.matrix_world @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
        ev.to_mesh_clear()
    c = (lo + hi) / 2
    centre_frd = (c.y, c.x, -c.z)
    length = max(hi.x - lo.x, hi.y - lo.y)  # Blender X = body y, Y = body x
    json.dump({"centreM": [round(x, 5) for x in centre_frd], "lengthM": round(length, 5)}, open(os.path.join(OUT_DIR, "shell.json"), "w"), indent=2)
    print("exported", path, "centre", centre_frd, "length", length)


if __name__ == "__main__":
    build()
    export()
