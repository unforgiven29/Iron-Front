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
c. 1995, Wikimedia Commons, CC BY-SA 4.0 — a Soviet-standard 9.12-type cockpit. Panel geometry and
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
        # Side wall below the sill down to the console.
        box(f"wall_{name}", (0.25, s * 0.48, 0.45), (1.5, 0.02, 0.3), PAINT)
    del o


CONSOLE_TOP = 0.57  # side consoles at elbow height (ESTIMATED from the photographs)
FWD_TOP = 0.49      # raised forward console step


def consoles():
    for s, name in ((-1, "l"), (1, "r")):
        box(f"console_{name}", (0.05, s * 0.39, CONSOLE_TOP + 0.2), (1.0, 0.16, 0.4), PAINT, bevel=0.006)
        # Raised forward section: sloped face up from the console to a step that meets the panel wing
        # (photographs 3 and 4 show the forward consoles stepping up toward the instrument panel).
        y0, y1 = s * 0.385, s * 0.47
        hexa(f"console_fwd_{name}", [
            (0.55, y0, CONSOLE_TOP), (0.55, y1, CONSOLE_TOP), (0.66, y1, FWD_TOP), (0.66, y0, FWD_TOP),
            (0.55, y0, CONSOLE_TOP + 0.3), (0.55, y1, CONSOLE_TOP + 0.3), (0.66, y1, CONSOLE_TOP + 0.3), (0.66, y0, CONSOLE_TOP + 0.3)], PAINT_DK, bevel=0.004)
        box(f"console_step_{name}", (0.77, s * 0.4275, FWD_TOP + 0.2), (0.22, 0.085, 0.4), PAINT, bevel=0.006)
        # Side-wall frames above the console (stringers) and a breaker panel.
        for k, x in enumerate((-0.25, 0.15, 0.55)):
            box(f"frame_{name}_{k}", (x, s * 0.47, 0.42), (0.025, 0.02, 0.26), PAINT_DK, bevel=0.003)
        box(f"cb_panel_{name}", (0.0, s * 0.466, 0.44), (0.3, 0.01, 0.1), BLACK, bevel=0.002)
        for i in range(10):
            for j in range(2):
                cyl(f"cb_{name}_{i}_{j}", (-0.13 + i * 0.028, s * 0.462, 0.42 + j * 0.04), (-0.13 + i * 0.028, s * 0.452, 0.42 + j * 0.04), 0.006, BLACK if (i + j) % 4 else WHITE, segs=10)
    rnd = random.Random(1995)
    # Console sub-panels with knobs, toggles, guarded switches and lamps (photographs 1-4).
    def subpanel(name, x0, x1, side, items, top=CONSOLE_TOP, inboard=0.315, rows=3):
        CT = top
        y0, y1 = (side * inboard, side * 0.465) if side > 0 else (side * 0.465, side * inboard)
        box(name, ((x0 + x1) / 2, (y0 + y1) / 2, CT - 0.004), (x1 - x0 - 0.006, abs(y1 - y0) - 0.006, 0.008), BLACK if items == "radio" else PAINT_DK, bevel=0.002)
        for i in range(int((x1 - x0) / 0.045)):
            for j in range(rows):
                x = x0 + 0.025 + i * 0.045
                y = (min(y0, y1) + 0.03 + j * 0.05)
                kind = rnd.random()
                if kind < 0.35:
                    cyl(f"{name}_k{i}{j}", (x, y, CT - 0.008), (x, y, CT - 0.028), 0.009, BLACK, segs=14)
                    cyl(f"{name}_kp{i}{j}", (x, y, CT - 0.028), (x, y, CT - 0.031), 0.004, WHITE, segs=8)
                elif kind < 0.7:
                    cyl(f"{name}_tb{i}{j}", (x, y, CT - 0.008), (x, y, CT - 0.013), 0.007, METAL, segs=10)
                    cyl(f"{name}_tt{i}{j}", (x, y, CT - 0.013), (x - 0.008, y, CT - 0.03), 0.0025, METAL, segs=8)
                elif kind < 0.82:
                    box(f"{name}_g{i}{j}", (x, y, CT - 0.016), (0.022, 0.016, 0.014), RED, bevel=0.002)
                else:
                    box(f"{name}_l{i}{j}", (x, y, CT - 0.01), (0.016, 0.016, 0.006), AMBER_LAMP)
    subpanel("lp_a", -0.35, -0.12, -1, "sys")
    subpanel("lp_b", 0.35, 0.53, -1, "radio")
    subpanel("lp_c", 0.67, 0.87, -1, "sys", FWD_TOP, 0.39, 1)
    subpanel("rp_a", -0.35, -0.08, 1, "sys")
    subpanel("rp_c", 0.67, 0.87, 1, "radio", FWD_TOP, 0.39, 1)


def lower_pedestal_and_floor():
    bot = P(0, V_BOT, FACE_W)
    hexa("pedestal", [
        (bot[0], -0.13, bot[2]), (bot[0], 0.13, bot[2]), (bot[0] - 0.06, 0.13, 0.95), (bot[0] - 0.06, -0.13, 0.95),
        (bot[0] + 0.1, -0.13, bot[2]), (bot[0] + 0.1, 0.13, bot[2]), (bot[0] + 0.04, 0.13, 0.95), (bot[0] + 0.04, -0.13, 0.95)], PAINT_DK, bevel=0.004)
    for i in range(3):
        z = bot[2] + 0.05 + i * 0.11
        box(f"ped_plate_{i}", (bot[0] - 0.012 - i * 0.02, 0, z + 0.04), (0.01, 0.22, 0.09), BLACK, bevel=0.002)
        for k in range(4):
            cyl(f"ped_knob_{i}_{k}", (bot[0] - 0.017 - i * 0.02, -0.075 + k * 0.05, z + 0.04), (bot[0] - 0.035 - i * 0.02, -0.075 + k * 0.05, z + 0.04), 0.008, METAL if k % 2 else BLACK, segs=12)
    box("floor", (0.45, 0, 1.0), (1.4, 0.8, 0.02), FLOOR)
    for s in (-1, 1):
        box(f"pedal_{s}", (0.98, s * 0.2, 0.86), (0.04, 0.12, 0.2), BLACK, rot_frd=(0, math.radians(-25), 0), bevel=0.006)


def seat():
    box("seat_pan", (0.02, 0, 0.78), (0.42, 0.46, 0.1), LEATHER, bevel=0.03)
    box("seat_front", (0.22, 0, 0.83), (0.06, 0.44, 0.16), LEATHER, bevel=0.015)
    # Ejection handle loop (orange-red, between the knees: photographs 1 and 3).
    pts = []
    for i in range(13):
        a = math.pi * i / 12
        pts.append((0.24 + 0.02 * math.sin(a), -0.055 * math.cos(a), 0.80 - 0.05 * math.sin(a)))
    for i in range(12):
        cyl(f"eject_{i}", pts[i], pts[i + 1], 0.008, ORANGE, segs=10)


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
    base = (0.2, -0.375, CONSOLE_TOP)
    box("throttle_quadrant", (0.2, -0.375, CONSOLE_TOP - 0.02), (0.3, 0.11, 0.04), BLACK, bevel=0.004)
    box("throttle_slot", (0.2, -0.375, CONSOLE_TOP - 0.041), (0.26, 0.05, 0.003), RUBBER)
    n = node("throttle", base)
    for s in (-1, 1):
        cyl(f"thr_arm_{s}", (0.18, -0.375 + s * 0.012, CONSOLE_TOP - 0.04), (0.16, -0.375 + s * 0.012, CONSOLE_TOP - 0.13), 0.008, METAL, n, segs=10)
    box("thr_grip", (0.15, -0.375, CONSOLE_TOP - 0.16), (0.1, 0.06, 0.07), BLACK, parent=n, bevel=0.015)
    cyl("thr_btn", (0.12, -0.35, CONSOLE_TOP - 0.19), (0.115, -0.35, CONSOLE_TOP - 0.197), 0.007, RED, n, segs=10)


def levers():
    # Gear lever on the left panel wing (red knob), pivot at its slot.
    gx, gy, gz = 0.78, -0.455, 0.45
    box("gear_panel", (gx, gy + 0.01, gz + 0.0), (0.12, 0.012, 0.09), BLACK, bevel=0.002)
    n = node("gear_lever", (gx, gy, gz))
    cyl("gear_arm", (gx, gy, gz), (gx - 0.045, gy + 0.004, gz - 0.035), 0.0055, METAL, n, segs=10)
    cyl("gear_knob", (gx - 0.045, gy + 0.004, gz - 0.035), (gx - 0.06, gy + 0.004, gz - 0.045), 0.015, RED, n, segs=16)
    # Emergency gear T-handle under the panel (yellow/black).
    n = node("emerg_gear", (0.76, -0.30, 0.60))
    cyl("emerg_stem", (0.80, -0.30, 0.60), (0.76, -0.30, 0.60), 0.006, METAL, n, segs=10)
    box("emerg_handle", (0.755, -0.30, 0.60), (0.018, 0.08, 0.02), YELLOW, parent=n, bevel=0.004)
    # Flap lever (left console, ahead of the throttle).
    n = node("flap_lever", (0.42, -0.42, CONSOLE_TOP))
    box("flap_gate", (0.42, -0.42, CONSOLE_TOP - 0.004), (0.08, 0.04, 0.008), BLACK)
    cyl("flap_arm", (0.42, -0.42, CONSOLE_TOP), (0.42, -0.42, CONSOLE_TOP - 0.05), 0.005, METAL, n, segs=10)
    box("flap_knob", (0.42, -0.42, CONSOLE_TOP - 0.055), (0.03, 0.02, 0.014), WHITE, parent=n, bevel=0.004)
    # Airbrake switch (left console, behind the throttle).
    n = node("airbrake_sw", (0.0, -0.40, CONSOLE_TOP - 0.008))
    cyl("ab_base", (0.0, -0.40, CONSOLE_TOP - 0.008), (0.0, -0.40, CONSOLE_TOP - 0.013), 0.008, METAL)
    cyl("ab_bat", (0.0, -0.40, CONSOLE_TOP - 0.013), (-0.01, -0.40, CONSOLE_TOP - 0.035), 0.003, GREEN_LAMP, n, segs=8)
    # Electrical power switches (right console, forward plate).
    box("elec_plate", (0.27, 0.385, CONSOLE_TOP - 0.004), (0.2, 0.15, 0.008), PAINT_DK, bevel=0.002)
    for i, nm in enumerate(("sw_bat", "sw_dcgen", "sw_acgen", "sw_pto")):
        x = 0.20 + i * 0.045
        n = node(nm, (x, 0.385, CONSOLE_TOP - 0.013))
        cyl(f"{nm}_base", (x, 0.385, CONSOLE_TOP - 0.008), (x, 0.385, CONSOLE_TOP - 0.013), 0.006, METAL)
        cyl(f"{nm}_bat", (x, 0.385, CONSOLE_TOP - 0.013), (x + 0.008, 0.385, CONSOLE_TOP - 0.03), 0.0025, METAL, n, segs=8)
        box(f"{nm}_label", (x, 0.415, CONSOLE_TOP - 0.009), (0.018, 0.012, 0.002), WHITE)


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
