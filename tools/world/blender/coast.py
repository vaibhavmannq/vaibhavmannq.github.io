# The cove, made to look real: photographed sky, real wave geometry, a closed water volume (true refraction,
# reflection and absorption), wet sand that mirrors the sun, foam where the waves break, scanned tree, dune grass.
# Throwaway lookdev for the portfolio storyboard. Coordinates: +Y out to sea, +Z up, X across the cove.
# Run: blender -b -P coast.py -- --hour golden --w 1920 --h 1080 --samples 256 --out renders/golden.exr
import bpy, bmesh, math, os, sys, time
import numpy as np
from mathutils import Vector

T0 = time.time()
HERE = os.path.dirname(os.path.abspath(__file__))
A = os.environ.get("WORLD_SRC", os.path.join(os.path.dirname(HERE), "assets"))   # Poly Haven sources live outside git (tools/world/sources.json)
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
HOUR = arg("--hour", "golden"); W = arg("--w", 960); H_ = arg("--h", 540); SAMPLES = arg("--samples", 64)
OUT = arg("--out", os.path.join(HERE, "renders", HOUR + ".exr")); SAVE = arg("--save", ""); GRASS = arg("--grass", 1.0)
def log(*a): print(f"[{time.time() - T0:6.1f}s]", *a, flush=True)

# ---------------- shots ----------------
# hdri: file, its sun (elevation, phi) where phi = atan2(y, -x) of the equirect sun pixel; sun: azimuth wanted
# (0 = straight out to sea, + to the right); cam: x, y, height above ground; look: azimuth, pitch
# Shared world: the arch and the tree stand in the same place in every shot.
ARCH = dict(pos=(-1171.4, 1218.9), rotz=69.0, scale=1.0)
PROM_DY = 60.0                  # the cliff-top shelf with the tree (and the right headland's end) pushed back from the beach
TREE = (12.93, 80.37 + PROM_DY, 13.21)
CLIFFS = ((40.0, 71.0 + PROM_DY, -0.6, -90.0, 1.7),)
LAG = (-320.0, -380.0)          # the hidden lagoon, inland behind the beach (a crater of cliffs, a waterfall on its north side)
CAVE_HILL = (-60.0, -260.0)     # the hill with the cave, straight inland of the cove
CAVE = (-60.0, -205.0); CAVE_AZ = -10.0   # cave mouth, looking out over the cove and the sea
RIDGE_X = 600.0                 # the midnight ridge runs north-south at this x, a fog valley on its west side
SHOTS = {
 "golden": dict(hdri="evening_road_01_puresky_8k.hdr", hsun=(11.5, 35.5), sun_az=-33.0, hdri_gain=1.0, tilt=0.0,
                sun_col=(1.0, 0.62, 0.36), sun_str=4.0, disc=40.0,
                cam=(9.5, -4.0, 0.62), look=(-22.0, 2.0), lens=24, focus=9.0, fstop=8.0,
                near=((-46, 2.4, 0.45), (49, 2.2, 0.5)),
                swell=0.32, chop=1.0, tide=0.0, sky_tint=(1.06, 0.80, 0.60), bumps=(0.22, 0.35),
                cliffs=CLIFFS,
                expo=0.75, fog=(1.0, 0.7, 0.5), fog_amt=0.12),
 # from the clifftop beside the tree: the sun goes down inside the far arch, a gold road on the sea below
 "sunset": dict(hdri="industrial_sunset_02_puresky_8k.hdr", hsun=(2.26, 35.97), sun_az=-46.4, hdri_gain=1.0, tilt=1.75,
                sun_col=(1.0, 0.5, 0.3), sun_str=0.0, disc=0.0,
                cam=(24.0, 80.0 + PROM_DY, 1.5), cam_surface=True, look=(-41.0, -9.0), lens=24, focus=4.0, fstop=8.0,
                near=((-32, 2.4, 0.6), (30, 2.2, 0.7)), top_grass=900, water_rough=0.035,
                swell=0.30, chop=1.0, tide=0.0, sky_tint=(1.12, 0.80, 0.62), bumps=(0.3, 0.7),
                cliffs=CLIFFS,
                expo=0.7, fog=(0.95, 0.55, 0.40), fog_amt=0.14),
 # home again at dawn: mist on mirror-calm water, the arch half hidden, the last stars, a peach line on the horizon
 "firstlight": dict(hdri="syferfontein_0d_clear_puresky_8k.hdr", hsun=(3.5, 36.55), sun_az=-20.0, hdri_gain=1.0, tilt=4.5,
                sun_col=(1.0, 0.75, 0.6), sun_str=0.0, disc=0.0,
                cam=(-12.0, -2.5, 0.55), look=(-14.0, 1.5), lens=22, focus=6.0, fstop=8.0,
                near=((-36, 1.8, 0.4),),
                swell=0.06, chop=0.3, tide=0.0, sky_tint=(1.08, 0.86, 0.84), bumps=(0.06, 0.08), foam_k=0.2,
                cliffs=CLIFFS, mist=0.009, stars=1.0,
                expo=0.8, fog=(0.80, 0.70, 0.74), fog_amt=0.2),
 # III Dusk (About): top of the headland, grass at the lens, the coast curving away, the arch far out, ranges in pink haze
 "dusk": dict(hdri="qwantani_dusk_2_puresky_8k.hdr", hsun=(11.08, 36.80), sun_az=-62.0, hdri_gain=0.9, tilt=0.0,
                sun_col=(1.0, 0.6, 0.6), sun_str=0.0, disc=0.0,
                cam=(34.0, -12.0, 1.8), look=(-75.0, -10.0), lens=24, focus=6.0, fstop=8.0,
                near=(), clear=3.5,
                swell=0.25, chop=1.0, tide=0.0, sky_tint=(1.05, 0.9, 1.0), bumps=(0.22, 0.35), cliffs=CLIFFS,
                expo=1.1, fog=(0.62, 0.38, 0.58), fog_amt=0.28),
 # IV Blue hour: standing in the ankle-deep flats, the arch overhead framing the first dense stars
 "bluehour": dict(hdri="qwantani_dusk_2_puresky_8k.hdr", hsun=(11.08, 36.80), sun_az=-69.0, hdri_gain=0.32, tilt=7.0,
                sun_col=(0.6, 0.7, 1.0), sun_str=0.0, disc=0.0,
                cam=(-1059.3, 1175.9, 0.35), look=(-69.0, 13.0), lens=18, focus=30.0, fstop=8.0,
                near=(), swell=0.08, chop=0.4, tide=0.0, sky_tint=(0.55, 0.70, 1.20), bumps=(0.05, 0.08), foam_k=0.25,
                stars=1.6, wglow=1.6, cliffs=CLIFFS,
                expo=1.6, fog=(0.10, 0.16, 0.35), fog_amt=0.25),
 # V Night (Projects): inside the lagoon crater, a waterfall ahead, fireflies, the project lights on the water
 "night": dict(hdri="qwantani_moonrise_puresky_8k.hdr", hsun=(13.8, 36.07), sun_az=150.0, hdri_gain=0.16, tilt=0.0,
                sun_col=(0.7, 0.8, 1.0), sun_str=0.0, disc=0.0,
                cam=(-320.0, -437.0, 0.9), look=(0.0, 7.0), lens=20, focus=8.0, fstop=8.0,
                near=((-34, 2.0, 0.5), (33, 1.8, 0.5)),
                swell=0.0, chop=0.0, tide=0.0, sky_tint=(0.9, 0.95, 1.1), bumps=(0.03, 0.05), foam_k=0.0,
                wglow=1.4, waterfall=True, rim_trees=9, fireflies=160, ff_glow=12.0,
                trail=((-325.0, -420.0), (-316.0, -405.0), (-326.0, -391.0), (-315.0, -377.0), (-323.0, -362.0), (-317.0, -348.0)),
                fog_boxes=(((-320.0, -380.0, 2.0), (130.0, 130.0, 6.0), 0.012, 1.5, 1.5),), cliffs=CLIFFS,
                expo=1.3, fog=(0.10, 0.14, 0.22), fog_amt=0.15),
 # VI Deep midnight: on the ridge above a sea of fog, peaks standing out of it, the Milky Way, a low moon
 "midnight": dict(hdri="qwantani_night_puresky_8k.hdr", hsun=(53.36, 23.56), sun_az=80.0, hdri_gain=0.45, tilt=0.0,
                sun_col=(0.7, 0.8, 1.0), sun_str=0.0, disc=0.0,
                cam=(600.0, -950.0, 2.4), look=(-95.0, -15.0), lens=24, focus=8.0, fstop=8.0,
                near=(), clear=7.0,
                swell=0.2, chop=1.0, tide=0.0, sky_tint=(0.85, 0.9, 1.1), bumps=(0.22, 0.35), stars=0.6,
                moon=(-78.0, 6.5, 0.6, 30.0, 0.55),
                fog_boxes=(((350.0, -1000.0, 40.0), (520.0, 820.0, 50.0), 0.045, 57.0, 5.0, (0.85, 0.88, 1.0), 0.3, 0.004),), cliffs=CLIFFS,
                expo=1.4, fog=(0.08, 0.10, 0.18), fog_amt=0.1),
 # VII Before dawn: inside the cave, looking out over the cove and the sea as the sky starts to pale
 "beforedawn": dict(hdri="syferfontein_0d_clear_puresky_8k.hdr", hsun=(3.5, 36.55), sun_az=-10.0, hdri_gain=0.6, tilt=8.0,
                sun_col=(0.7, 0.8, 1.0), sun_str=0.0, disc=0.0,
                cam=(-60.0, -211.0, 1.5), cam_cave=True, look=(-10.0, -10.0), lens=18, focus=12.0, fstop=8.0,
                near=(), swell=0.2, chop=1.0, tide=0.0, sky_tint=(0.75, 0.82, 1.1), bumps=(0.22, 0.35), stars=0.8,
                cave=True, cliffs=CLIFFS,
                expo=0.95, fog=(0.20, 0.25, 0.40), fog_amt=0.2),
 # IX Sunrise: on the rise east of the bay, looking back over the cove, the cliff and the arch as the sun clears the sea
 "sunrise": dict(hdri="qwantani_sunrise_puresky_8k.hdr", hsun=(2.09, 36.06), sun_az=-35.0, hdri_gain=1.0, tilt=0.0,
                sun_col=(1.0, 0.75, 0.5), sun_str=0.0, disc=0.0,
                cam=(30.0, -40.0, 2.2), look=(-62.0, -13.0), lens=24, focus=8.0, fstop=8.0,
                near=(), clear=7.0,
                swell=0.25, chop=1.0, tide=0.0, sky_tint=(1.05, 0.92, 0.85), bumps=(0.22, 0.35), cliffs=CLIFFS,
                expo=0.8, fog=(1.0, 0.78, 0.6), fog_amt=0.18),
}
# Golden hour rebuild: three camera options (same light), picked by the owner before any colour work
SHOTS["golden_a"] = dict(SHOTS["golden"], cam=(7.0, 13.0, 0.75), cam_surface=True, look=(-36.0, 2.5), lens=20, focus=3.0, near=())
SHOTS["golden_b"] = dict(SHOTS["golden"], cam=(30.0, 40.0, 1.7), cam_surface=True, look=(-40.0, -11.0), lens=24, focus=8.0,
                         near=((-26, 2.6, 0.7), (27, 2.3, 0.7)))
SHOTS["golden_c"] = dict(SHOTS["golden"], cam=(-34.0, 85.0, 1.6), cam_surface=True, look=(-44.0, -3.5), lens=40, focus=30.0,
                         near=(), top_grass=900)
SKIES = {"evening_road": ("evening_road_01_puresky_8k.hdr", 11.5, 35.5), "belfast": ("belfast_sunset_puresky_8k.hdr", 3.44, 43.96),
         "kloppenheim": ("kloppenheim_06_puresky_8k.hdr", 6.84, 39.38), "onfire": ("the_sky_is_on_fire_8k.hdr", 2.06, -13.0),
         "citrus": ("citrus_orchard_road_puresky_8k.hdr", 3.61, 28.6)}
# Golden hour rebuild (owner, 9 Nov): the original camera; the sun low and visible between the arch and the hill,
# more clouds, the hill pushed back with a grove and grass on top, the arch inside its stacks
SHOTS["golden"].update(sky="kloppenheim", sun_el=3.6, sun_az=-33.0, sun_str=3.5, disc=60.0, grove=True, plateau_grass=60000, expo=0.5, swell=0.10, chop=0.35, bumps=(0.05, 0.09),   # near mirror-still water, like the old frames
   
    wet=0.42, film=0.30,
    beach=dict(pebbles=2500, kelp=0, peb_size=0.6))
# Sunset rebuild: the clifftop by the tree; the sun sets BESIDE the arch group (inside it read as a glowing egg), calm gold water,
# the meadow in front, the grove framing the left
SHOTS["sunset"].update(sky="belfast", sun_el=1.0, sun_az=-40.0, cam=(25.0, 141.0, 1.7), cam_surface=True, look=(-56.0, 0.5), sun_str=3.0, disc=60.0, near_flowers=900,
    lens=28, focus=8.0, top_grass=0, near=(), plateau_grass=40000, grove=True, lens_clear=9.0,
    swell=0.12, chop=0.4, bumps=(0.06, 0.10), expo=0.66,
    ramp=((0.0, (0.12, 0.06, 0.20)), (0.25, (0.42, 0.20, 0.42)), (0.40, (0.92, 0.42, 0.42)), (0.53, (1.0, 0.54, 0.28)), (0.68, (1.0, 0.72, 0.40)), (1.0, (1.0, 0.93, 0.76))))
# Blue hour rebuild: standing in the ankle-deep flats under the new arch; deep blue sky to a peach horizon, the first stars,
# glowing plankton drifting in the shallows (one quiet glowing accent)
SHOTS["bluehour"].update(swell=0.05, chop=0.25, bumps=(0.03, 0.05),
    ramp=((0.0, (0.03, 0.04, 0.12)), (0.30, (0.12, 0.14, 0.38)), (0.45, (0.36, 0.30, 0.62)), (0.58, (0.80, 0.52, 0.70)), (0.72, (1.0, 0.72, 0.66)), (1.0, (1.0, 0.92, 0.85))),
    sky="belfast", sun_el=-3.0, sun_az=-69.0,
    plankton=dict(n=2600, reach=40.0, size=0.02, col=(0.25, 0.85, 1.0), strength=3.5),
    cam=(-1008.0, 1156.2, 0.45), look=(-69.0, 9.0), lens=20, focus=40.0, star_mask=(3.0, 1.2), stars=5.0)
# Dusk rebuild: high on the headland (option B's vista) after the sun has gone: the cliff-top grove and the cove below, the coast
# curving away, the arch group far out, a pink and violet afterglow
SHOTS["dusk"].update(cam=(30.0, 40.0, 1.7), cam_surface=True, look=(-40.0, -5.5), lens=24, focus=8.0, near=(), clear=0.0, lens_clear=6.0,
    sky="kloppenheim", sun_el=-2.0, sun_az=-62.0, grove=True, plateau_grass=40000, swell=0.12, chop=0.4, bumps=(0.06, 0.10), expo=0.8,
    near_flowers=500, ramp=((0.0, (0.07, 0.05, 0.16)), (0.24, (0.30, 0.18, 0.42)), (0.38, (0.80, 0.38, 0.58)), (0.52, (1.0, 0.52, 0.56)), (0.66, (1.0, 0.70, 0.58)), (1.0, (1.0, 0.90, 0.82))))
# First light rebuild (target: the old dawn frame): low on the LEFT end of the beach, looking across at the cliff-top grove and its
# reflection; pink clouds mirrored in still dark water, low mist, the sun still just under the horizon
SHOTS["firstlight"].update(cam=(-60.0, -14.0, 0.55), look=(16.0, 2.0), lens=24, focus=6.0, near=((-36, 2.8, 0.3),), grove=True,
    sky="citrus", sun_el=-0.8, sun_az=-28.0, swell=0.04, chop=0.2, bumps=(0.03, 0.05), wet=0.30, film=0.35, expo=0.8, stars=0.4,
    ramp=((0.0, (0.04, 0.06, 0.10)), (0.22, (0.20, 0.20, 0.34)), (0.34, (0.70, 0.42, 0.56)), (0.46, (1.0, 0.60, 0.66)), (0.62, (1.0, 0.76, 0.74)), (1.0, (1.0, 0.94, 0.90))))
# Night rebuild: the lagoon crater; a low moon rim-lights the walls and lays a path on the water, an aurora over the falls,
# fireflies low and few, a few tufts of grass glowing at the tips (our own plant)
SHOTS["night"].update(moon=(140.0, 22.0, 0.9, 35.0, 2.5), near=(), trail=(), fireflies=90, ff_glow=10.0, glow_tips=1.2, glow_pow=9.0, glow_col=(0.35, 0.95, 0.85), stars=1.6,
    aurora=dict(bands=((-55, 10, 300, 800, 1.0), (-15, 45, 420, 900, 1.2), (10, 60, 260, 600, 0.8)), strength=3.0, dist=2600.0, rays=90.0),
    ramp=((0.0, (0.01, 0.015, 0.04)), (0.3, (0.04, 0.06, 0.16)), (0.5, (0.18, 0.18, 0.40)), (0.7, (0.50, 0.46, 0.70)), (1.0, (0.90, 0.90, 1.0))))
# Deep midnight rebuild: on the ridge (283 m) above a sea of cloud that fills every valley to the horizon, hilltops as islands,
# a low moon lighting the cloud tops, a green aurora, the Milky Way; heather and white flowers on the ridge in front
SHOTS["midnight"].update(fog_boxes=(), look=(-95.0, -7.0), lens=24, cloudsea=dict(z=165.0, amp=34.0, box=(-1600.0, 590.0, -2200.0, -420.0), step=5.0, glow=0.10, low=(0.14, 0.17, 0.30), high=(0.90, 0.93, 1.0)),
    moon=(-82.0, 7.0, 0.9, 40.0, 1.6), stars=1.2, near_flowers=400, lens_clear=4.0,
    aurora=dict(bands=((-50, 25, 700, 1100, 1.4),), strength=1.1, dist=3600.0, rays=110.0, low=(0.2, 1.0, 0.5), high=(0.45, 0.4, 1.0)),
    ramp=((0.0, (0.01, 0.015, 0.04)), (0.3, (0.04, 0.06, 0.16)), (0.5, (0.16, 0.18, 0.40)), (0.7, (0.46, 0.48, 0.72)), (1.0, (0.90, 0.92, 1.0))))
# Before dawn rebuild: inside the cave, a natural ragged mouth (material cut, not deleted faces), the cove and sea paling outside,
# glowing fungi and vines, the last stars
SHOTS["beforedawn"].update(look=(-10.0, -3.0), cave_fill=7500.0, sky="citrus", sun_el=-3.0, sun_az=-12.0, stars=1.0, star_mask=(1.4, 0.5),
    ramp=((0.0, (0.02, 0.03, 0.08)), (0.28, (0.08, 0.11, 0.26)), (0.45, (0.30, 0.30, 0.56)), (0.58, (0.72, 0.52, 0.66)), (0.72, (0.98, 0.74, 0.66)), (1.0, (1.0, 0.92, 0.86))))
# Sunrise rebuild: the one front-lit frame: the sun rises behind the camera (east), warm low light on the cliffs, the grove and the
# stacks, a pink belt of Venus over the western sea; meadow and flowers on the headland in front
SHOTS["sunrise"].update(sky="kloppenheim", sun_el=12.0, sun_az=80.0, sun_str=3.6, disc=0.0, look=(-30.0, -8.0), clear=0.0, lens_clear=6.0,
    near_flowers=700, grove=True, plateau_grass=40000, swell=0.12, chop=0.4, bumps=(0.06, 0.10), expo=0.9,
    ramp=((0.0, (0.20, 0.20, 0.40)), (0.20, (0.55, 0.45, 0.70)), (0.32, (0.95, 0.66, 0.72)), (0.45, (1.0, 0.82, 0.78)), (0.60, (0.85, 0.88, 0.98)), (1.0, (1.0, 1.0, 1.0))))
# Round 3 (owner notes, 9 Nov night)
SHOTS["night"].update(expo=2.1, moon=(140.0, 22.0, 0.9, 35.0, 5.0), stars=3.0, star_mask=(3.0, 1.2), look=(0.0, 12.0), glow_tips=1.6,
    aurora=dict(bands=((-70, 55, 650, 520, 1.0), (-40, 75, 950, 420, 1.2)), strength=3.2, dist=2300.0, rays=70.0, ray_min=0.55, sway=0.45,
                low=(0.15, 1.0, 0.45), high=(0.85, 0.35, 0.85)))
SHOTS["midnight"].update(moon=(-82.0, 7.0, 0.45, 18.0, 1.6), cloudsea=dict(z=150.0, amp=30.0, box=(-1600.0, 380.0, -2200.0, -420.0), step=5.0, glow=0.08,
    low=(0.12, 0.15, 0.28), high=(0.82, 0.86, 0.96)), stars=3.0, star_mask=(3.0, 1.2), look=(-95.0, -1.0),
    aurora=dict(bands=((-70, 40, 420, 600, 1.0), (-30, 60, 700, 450, 1.3)), strength=2.8, dist=3000.0, rays=70.0, ray_min=0.55, sway=0.45,
                low=(0.15, 1.0, 0.45), high=(0.7, 0.35, 0.95)))
SHOTS["beforedawn"].update(cave_top=19.0, pool_r=1.7, pool_rim=True, look=(-10.0, 1.0))
SHOTS["sunrise"].update(foam_k=0.35, grass_zmin=0.3, grass_dland=1.5, near_flowers=900, frame_tree=(-30.0, 9.0, 2.2, 40.0), look=(-26.0, -8.0), lens=26,
    extra_rocks=((-62.0, 4.0, 3.5, 2.2, 0.0), (-70.0, 12.0, 5.0, 3.5, 0.05), (-55.0, -2.0, 2.0, 1.0, 0.0), (-78.0, 22.0, 2.5, 1.4, 0.0),
                 (-66.0, 30.0, 6.0, 1.2, 0.0), (-48.0, 8.0, 1.6, 0.6, 0.0)))
SHOTS["sunset"].update(sky_clip=3.0, disc=4.0, look=(-47.0, 0.5), sky_rot=40.0,
    ramp=((0.0, (0.12, 0.06, 0.20)), (0.25, (0.42, 0.20, 0.42)), (0.40, (0.92, 0.42, 0.42)), (0.53, (1.0, 0.52, 0.26)), (0.68, (1.0, 0.64, 0.30)), (1.0, (1.0, 0.80, 0.52))))
SHOTS["dusk"].update(lanterns=dict(path=((-12.0, 52.0), (-150.0, 190.0)), n=44, bunch=1.5, w0=3.0, w1=16.0, r=0.32, col=(1.0, 0.50, 0.20), strength=20.0),
    sky_grad=((1.15, 0.90, 0.80), (0.52, 0.62, 1.28), 0.03, 0.50))
SHOTS["bluehour"].update(cam=(-1008.0, 1156.2, 0.62), foam_k=0.0, caps=dict(reach=500, per=14, size=(1.6, 3.2)), plankton=dict(n=2600, reach=40.0, size=0.02, col=(0.25, 0.85, 1.0), strength=3.5, fade=9.0))
SHOTS["night"].update(cliff_rocks=((-377.6, -354.3, 8.0, 29.0, 0.0), (-378.7, -360.9, 7.0, 33.0, 0.0), (-382.1, -366.8, 8.5, 27.0, 0.0), (-382.2, -373.5, 7.5, 31.0, 0.0), (-265.9, -348.8, 8.0, 31.0, 0.0), (-268.5, -342.6, 7.0, 26.0, 0.02), (-274.1, -338.7, 9.0, 33.0, -0.02), (-277.8, -333.1, 7.5, 28.0, 0.0), (-283.9, -330.2, 8.5, 24.0, 0.02), (-288.8, -325.9, 8.0, 32.0, -0.02), (-294.1, -321.8, 7.0, 29.0, 0.0), (-300.9, -321.3, 9.0, 31.0, 0.02), (-306.9, -318.3, 7.5, 26.0, -0.02), (-332.8, -319.8, 8.5, 33.0, 0.0), (-339.3, -320.6, 8.0, 28.0, 0.02), (-345.9, -321.8, 7.0, 24.0, -0.02), (-350.8, -326.6, 9.0, 32.0, 0.0), (-357.1, -329.0, 7.5, 29.0, 0.02), (-361.2, -334.3, 8.5, 31.0, -0.02), (-366.4, -338.2, 8.0, 26.0, 0.0), (-371.5, -342.6, 7.0, 33.0, 0.02), (-373.4, -349.1, 9.0, 28.0, -0.02),),
    caps=dict(reach=300, per=6, size=(1.2, 2.4)), glow_tips=0.9, glow_pow=14.0, ff_z=(0.15, 1.1),
    near=((-32, 3.5, 1.0), (30, 3.0, 0.9), (-12, 7.5, 0.7)), falls_w=(10.0, 4.0), falls_r=(64.5, 56.5), spray=((30, 16, 14), 0.4), fireflies=45)
SHOTS["midnight"].update(props=(("island_tree_03", 586.1, -958.0, 3.5, 200.0, 6.0),),
    cloudsea=dict(z=172.0, amp=30.0, box=(-1600.0, 380.0, -2200.0, -420.0), step=5.0, glow=0.08, low=(0.12, 0.15, 0.28), high=(0.82, 0.86, 0.96), feather=10.0),
    stars=5.0, aurora=dict(bands=((-60, 45, 720, 420, 1.1), (-35, 50, 1080, 360, 1.3)), strength=3.0, dist=3000.0, rays=120.0, ray_min=0.45, sway=0.35,
                low=(0.15, 1.0, 0.45), high=(0.7, 0.35, 0.95), light=True))
SHOTS["beforedawn"].update(wet_floor=True, wall_fungi=45, pool_stones=(30, 0.05, 0.18), fungi_glow=6.0, fungi_col=(0.40, 0.95, 0.75),
    vines=dict(n=30, side=13.0, bevel=0.02, leaves=60, leaf=(0.10, 0.20), ln=(0.8, 3.6)))
SHOTS["firstlight"].update(sky_rot=45.0, mist=0.004, near=((-44, 2.8, 0.25),),
    ramp=((0.0, (0.05, 0.07, 0.12)), (0.16, (0.30, 0.24, 0.36)), (0.27, (0.74, 0.46, 0.58)), (0.38, (0.98, 0.64, 0.68)), (0.52, (0.86, 0.84, 0.94)), (1.0, (0.84, 0.93, 1.0))),
    sky_grad=((1.06, 0.96, 0.96), (0.70, 0.86, 1.12), 0.06, 0.42), fog=(0.58, 0.66, 0.76), fog_amt=0.16)
AUR2 = dict(style2=True, rays=140.0, ray_min=0.15, foot=0.08, haze=0.3, core=(0.62, 1.0, 0.35), low=(0.10, 1.0, 0.50), high=(0.72, 0.30, 0.95))
NIGHT_SKY = ((0.0, (0.02, 0.035, 0.11)), (0.3, (0.06, 0.09, 0.28)), (0.5, (0.20, 0.20, 0.46)), (0.7, (0.50, 0.46, 0.72)), (1.0, (0.90, 0.90, 1.0)))
SHOTS["night"].update(ramp=NIGHT_SKY, star_dense=True, stars=6.0, star_mask=(6.0, 2.0),
    aurora=dict(AUR2, haze=0.22, bands=((-75, 50, 950, 800, 2.2), (-25, 100, 820, 760, 2.6)), strength=2.8, dist=2300.0, sway=0.45, light=True),
    falls_r=(64.5, 53.0),
    falls_streams=True, falls_pool=9.0, spray=((40, 22, 30), 0.12), spray_z=(2.0, 9.0, 7.0))
SHOTS["midnight"].update(ramp=NIGHT_SKY, star_dense=True, stars=4.0,
    aurora=dict(AUR2, bands=((-65, 45, 650, 900, 1.1), (-35, 55, 1000, 800, 1.3)), strength=3.6, dist=3000.0, sway=0.35, light=True))
SHOTS["beforedawn"].update(vines=dict(n=30, side=13.0, bevel=0.02, leaves=60, leaf=(0.10, 0.20), ln=(0.8, 3.6), anchor=True))
AUR3 = dict(rays=55.0, ray_min=0.3, foot=0.07, warp=0.16, haze=0.32, lean=2.0, core=(0.62, 1.0, 0.35), low=(0.10, 1.0, 0.50), high=(0.72, 0.30, 0.95), light=True)
SHOTS["night"].update(aurora=dict(AUR3, dist=2300.0, strength=3.0,
    sky_bands=((-58.0, 48.0, 19.0, 42.0, 14.0, 6.0, 1.0), (-42.0, 30.0, 36.0, 24.0, 10.0, 5.0, 0.5), (8.0, 62.0, 18.0, 25.0, 8.0, 3.0, 0.35))))
SHOTS["midnight"].update(aurora=dict(AUR3, dist=3000.0, strength=2.8,
    sky_bands=((-52.0, 46.0, 1.5, 15.0, 11.0, 5.0, 1.0), (-22.0, 42.0, 12.0, 5.0, 8.0, 4.0, 0.5), (-62.0, -22.0, 0.5, 4.0, 6.0, 2.5, 0.35))), star_mask=(6.0, 2.0), stars=6.0)
SHOTS["golden"].update(cliff_rocks=((22.5, 14.0, 5.0, 18.1, 0.0), (21.3, 21.0, 4.0, 14.5, -0.03), (23.3, 27.0, 5.5, 18.4, 0.02), (21.9, 34.0, 4.5, 15.1, 0.0), (23.9, 41.0, 6.0, 16.8, -0.02), (21.5, 47.0, 4.0, 12.2, 0.03), (22.9, 54.0, 5.0, 15.1, 0.0), (22.1, 61.0, 5.5, 16.5, -0.03), (23.5, 67.0, 4.5, 11.9, 0.02), (21.7, 74.0, 5.0, 12.7, 0.0), (23.1, 81.0, 4.0, 9.9, -0.02), (22.5, 88.0, 5.0, 11.4, 0.03),))
SHOTS["sunrise"].update(sky_grad=((1.18, 0.92, 0.78), (0.78, 0.86, 1.15), 0.02, 0.35), ramp=((0.0, (0.22, 0.24, 0.42)), (0.20, (0.58, 0.50, 0.72)), (0.32, (0.98, 0.68, 0.70)), (0.45, (1.0, 0.80, 0.66)), (0.60, (1.0, 0.90, 0.78)), (1.0, (1.0, 0.98, 0.94))),
    sun_str=5.0, sun_col=(1.0, 0.70, 0.42), patches=((-140.0, -106.0, -10.0, 100.0, 60000, 3.0),),
    cliff_rocks=((-103.0, -6.0, 7.0, 36.5, 0.0), (-100.2, 1.0, 5.0, 22.8, 0.03), (-104.8, 12.0, 8.5, 33.4, -0.02), (-102.0, 17.0, 6.0, 27.7, 0.0), (-99.8, 27.0, 5.5, 21.4, 0.04), (-103.8, 33.0, 9.0, 27.9, -0.03), (-101.4, 44.0, 6.5, 23.3, 0.0), (-99.5, 50.0, 4.5, 13.8, 0.03), (-104.2, 61.0, 8.0, 20.8, -0.02), (-100.8, 69.0, 6.0, 16.4, 0.0), (-102.2, 80.0, 5.0, 10.7, 0.04), (-101.5, 88.0, 6.5, 7.9, -0.03),))
SHOTS["sunrise"].update(props=(("searsia_burchellii", 27.0, -7.0, 1.7, 40.0, 0.0), ("searsia_burchellii", 26.0, -2.5, 1.4, 160.0, 0.0), ("searsia_burchellii", 27.8, -11.5, 1.2, 280.0, 0.0)))
SHOTS["sunrise"].update(frame_tree=None, lgrove=True, sun_el=14.0, sun_az=50.0, swell=0.05, chop=0.2, bumps=(0.03, 0.05),
    extra_rocks=((-62.0, 4.0, 3.5, 2.2, 0.0), (-70.0, 12.0, 5.0, 3.5, 0.05), (-55.0, -2.0, 2.0, 1.0, 0.0),
                 (-68.0, 31.0, 3.8, 2.8, 0.04), (-80.0, 41.0, 2.6, 3.6, -0.05), (-74.0, 24.0, 2.0, 1.9, 0.0),
                 (-99.0, 34.0, 3.0, 2.5, 0.0), (-97.0, 47.0, 4.5, 4.0, 0.03), (-98.0, 72.0, 3.6, 5.5, -0.04), (-96.0, 97.0, 5.0, 3.0, 0.0)))
S = SHOTS[HOUR]
if arg("--sky", ""): S["sky"] = arg("--sky", "")
if S.get("sky"):
    _f, _el, _phi = SKIES[S["sky"]]; S["hdri"] = _f; S["hsun"] = (_el, _phi)
    S["tilt"] = _el - arg("--sun_el", float(S.get("sun_el", _el)))
STYLE = arg("--style", "real")
LITE = bool(arg("--lite", 0))   # light previews for this PC: coarser terrain/sea meshes, a thinner short meadow
WUWA = STYLE == "wuwa"
HYBRID = STYLE == "hybrid"     # realistic water, plants and rock under the Wuthering Waves sky colouring, made warmer
# the stylised look: same place and light, Wuthering Waves colour (cyan shallows, crisp foam, lilac plants, pink sky)
STY = dict(dry=(0.30, 0.29, 0.33), wet=(0.12, 0.12, 0.15), absorb=(0.10, 0.90, 0.95), absorb_d=0.45, scat=(0.25, 0.95, 1.0), scat_d=0.12,
           g_base=(0.16, 0.12, 0.30), g_mid=(0.50, 0.42, 0.85), g_tip=(0.80, 0.70, 1.0), g_var=(0.62, 0.50, 0.95), g_glow=0.55,
           foam_lo=0.30, foam_hi=0.55, sun_col=(1.0, 0.66, 0.55), disc=(1.0, 0.86, 0.7)) if WUWA else (
      dict(dry=(0.42, 0.37, 0.33), wet=(0.20, 0.18, 0.17), absorb=(0.30, 0.82, 0.78), absorb_d=0.35, scat=(0.35, 0.75, 0.72), scat_d=0.012,
           g_base=(0.30, 0.27, 0.13), g_mid=(0.30, 0.27, 0.13), g_tip=(0.55, 0.45, 0.24), g_var=(0.22, 0.26, 0.12), g_glow=0.0,
           foam_lo=0.45, foam_hi=0.85, sun_col=None, disc=(1.0, 0.78, 0.5)))

# ---------------- numpy noise ----------------
def frac(x): return x - np.floor(x)
def hsh(ix, iy): return frac(np.sin(ix * 127.1 + iy * 311.7) * 43758.5453)
def vnoise(x, y):
    xi, yi = np.floor(x), np.floor(y); xf, yf = x - xi, y - yi
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a, b, c, d = hsh(xi, yi), hsh(xi + 1, yi), hsh(xi, yi + 1), hsh(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
def fbm(x, y, o=5):
    s, a = 0.0, 0.5
    for _ in range(o):
        s = s + a * vnoise(x, y); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; a *= 0.5
    return s
def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# ---------------- the land ----------------
def shore_y(x): return np.where(x > 0, 0.0035, -0.0025) * x * x + 1.4 * np.sin(x * 0.05 + 0.6)   # curves out to the right headland, back inland to the left
def _ground_core(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    d = shore_y(x) - y                                   # + on land, - in the sea (metres from the waterline, roughly)
    land = np.maximum(d, 0); w = np.maximum(-d, 0)
    h = np.where(d > 0, 2.5 * np.tanh(0.02 * land) + sm(10, 34, land) * (1.5 + 2.0 * fbm(x * 0.03, y * 0.03)),
                 -0.042 * w - 0.07 * np.maximum(w - 14, 0) - 0.06 * np.maximum(w - 45, 0))
    h = np.maximum(h, -22)
    # right headland: rises steeply beside the beach, runs out to sea, ends in a cliff
    rmask = sm(15, 30, x) * sm(150 + PROM_DY, 95 + PROM_DY, y)
    hr = rmask * (21 + 12 * fbm(x * 0.018 + 3, y * 0.018) + 5.0 * (fbm(x * 0.09, y * 0.09) - 0.5))
    ridges = 1.0 - np.abs(2 * fbm(x * 0.07 + 5, y * 0.07 + 2, 4) - 1)          # eroded gullies and spurs
    hr = hr + rmask * sm(2, 8, hr) * (3.0 * ridges - 1.5 + 1.2 * (fbm(x * 0.35, y * 0.35, 3) - 0.5))
    band = sm(12, 17, x) * sm(36, 24, x) * sm(150 + PROM_DY, 95 + PROM_DY, y) * sm(1.0, 6.0, hr)   # the face above the beach
    rid2 = 1.0 - np.abs(2 * fbm(x * 0.10 + 9, y * 0.05 + 4, 4) - 1)
    hr = hr + band * (3.5 * rid2 - 1.2 + 1.4 * (fbm(x * 0.45 + 2, y * 0.45, 3) - 0.5) + 0.9 * np.round(2.0 * fbm(x * 0.2, y * 0.08 + 7, 3)))
    # left headland, far across the cove
    le = -101.0 + 9.0 * (fbm(y * 0.03 + 2.0, x * 0.0 + 1.3, 4) - 0.5) + 2.5 * (fbm(y * 0.2 + 5.0, 0.7, 3) - 0.5)   # wandering cliff edge
    lmask = sm(le + 1.5, le - 7.0, x) * sm(220, 140, y)
    hl = lmask * (np.clip(37.0 - 0.24 * y, 9.0, 40.0) + 8 * fbm(x * 0.02 + 8, y * 0.02))
    lrid = 1.0 - np.abs(2 * fbm(x * 0.12 + 3, y * 0.06 + 8, 4) - 1)                  # spurs and gullies down the face
    hl = hl + sm(le + 1.5, le - 4.0, x) * sm(le - 12.0, le - 6.0, x) * sm(220, 140, y) * (4.0 * lrid - 2.0 + 0.8 * np.round(2.0 * fbm(x * 0.15, y * 0.25 + 3, 3)))
    h = h + hr + hl
    h = h + 0.25 * (fbm(x * 0.09, y * 0.09) - 0.5) * sm(0.5, 3, h)
    return h

def _ground_world(x, y):
    x = np.asarray(x, np.float64); y = np.asarray(y, np.float64)
    h = _ground_core(x, y)
    # tidal flats around the far arch: ankle-deep water and low sand bars
    ax, ay = ARCH["pos"]; da = np.hypot(x - ax, y - ay)
    fm = sm(620, 330, da)
    flats = -0.24 + 0.22 * (fbm(x * 0.015 + 4, y * 0.015 + 9, 4) - 0.5) + 0.04 * (fbm(x * 0.12, y * 0.12, 3) - 0.5)   # ankle-deep everywhere: no bar breaks the surface
    h = h * (1 - fm) + flats * fm
    # distant ranges: inland to the south, a coastal range to the west (never in front of the sea views)
    h = h + sm(-450, -1100, y) * (70 + 150 * fbm(x * 0.0025 + 7, y * 0.0025, 5))
    h = h + sm(-600, -1300, x) * sm(-60, -300, y) * (60 + 120 * fbm(x * 0.003 + 2, y * 0.003 + 5, 5))
    # the midnight valley (lowered) and its ridge
    vm = sm(120, 220, x) * sm(560, 480, x) * sm(-600, -700, y) * sm(-1450, -1350, y)
    peaks = 95 * np.clip(fbm(x * 0.007 + 3, y * 0.007 + 1, 5) - 0.52, 0, 1) * 4.0
    h = h * (1 - vm) + (24 + 6 * fbm(x * 0.02, y * 0.02, 3) + peaks) * vm
    rm = np.exp(-((x - RIDGE_X) / 55.0) ** 2) * sm(-600, -720, y) * sm(-1450, -1330, y)
    h = h + rm * (150 * (0.85 + 0.3 * fbm(x * 0.01, y * 0.004, 4)) + 4 * (fbm(x * 0.2, y * 0.2, 3) - 0.5))
    # the lagoon: a crater of cliffs with water inside
    lx, ly = LAG; r = np.hypot(x - lx, y - ly)
    ang_ = np.arctan2(y - ly, x - lx)
    r = r - 8.0 * (fbm(np.cos(ang_) * 3.0 + 4, np.sin(ang_) * 3.0 + 2, 4) - 0.5) - 4.0 * (fbm(np.cos(ang_) * 14.0 + 9, np.sin(ang_) * 14.0 + 1, 3) - 0.5) - 2.2 * (fbm(np.cos(ang_) * 30.0 + 5, np.sin(ang_) * 30.0 + 8, 3) - 0.5) - 0.9 * np.abs(np.sin(ang_ * 17 + 9 * fbm(x * 0.05, y * 0.05, 3)))   # irregular gullies, not a palisade
    bowl = np.where(r < 56, -3.6 + 4.0 * sm(40, 56, r), 0.4)
    wall = (28 + 8 * fbm(x * 0.05 + 1, y * 0.05 + 3, 4) + 3 * (fbm(x * 0.25, y * 0.25, 3) - 0.5)) * sm(58, 72, r)
    hl = np.where(r < 58, bowl, 0.4 + wall)
    out_ = sm(92, 115, r)
    h = np.where(r < 115, hl * (1 - out_) + h * out_, h)
    # the plateau on top of the scanned cliff (fills its flat cut-off top with real ground)
    pm = sm(70 + PROM_DY, 79 + PROM_DY, y) * sm(97 + PROM_DY, 90 + PROM_DY, y) * sm(-48, -36, x) * sm(116, 104, x)
    hum = sm(72 + PROM_DY, 81 + PROM_DY, y) * sm(-40, -28, x) * (2.6 * fbm(x * 0.035 + 6, y * 0.05 + 1, 4) + 0.9 * fbm(x * 0.16, y * 0.16 + 4, 3) - 1.0)
    h = np.where(pm > 0, np.maximum(h, pm * (13.6 + 0.6 * fbm(x * 0.08 + 2, y * 0.08, 3) + np.maximum(hum, 0.0))), h)   # only under the plateau (a bare max clamped the whole sea floor to 0)
    # the cave hill
    ch = np.hypot(x - CAVE_HILL[0], y - CAVE_HILL[1])
    h = h + 46 * np.exp(-(ch / 95.0) ** 2)
    return h

CAVE_FLOOR = float(_ground_world(*CAVE)) - 3.0
def ground(x, y):
    h = _ground_world(x, y)
    rc = np.hypot(np.asarray(x, np.float64) - CAVE[0], np.asarray(y, np.float64) - CAVE[1])
    f = sm(13.0, 10.0, rc)                                   # the cave floor, cut level into the hillside
    return h * (1 - f) + np.minimum(h, CAVE_FLOOR) * f

# ---------------- render setup ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.engine = "CYCLES"; cy = scn.cycles; cy.device = "CPU"
DEVICE = arg("--device", "CPU")
if DEVICE == "GPU":
    # NVIDIA: OptiX first (RTX cards), then CUDA; AMD: HIP. Falls back to the CPU if none is found.
    cp = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            cp.compute_device_type = kind; cp.get_devices()
        except Exception: continue
        gpus = [d for d in cp.devices if d.type == kind]
        if gpus:
            for d in cp.devices: d.use = d.type == kind
            cy.device = "GPU"; log("GPU render:", kind, [d.name for d in gpus]); break
    else:
        log("no GPU found, rendering on the CPU")
cy.samples = SAMPLES; cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.012
cy.use_denoising = True
try: cy.denoiser = "OPENIMAGEDENOISE"; cy.denoising_input_passes = "RGB_ALBEDO_NORMAL"; cy.denoising_prefilter = "ACCURATE"
except Exception as e: log("denoise opt", e)
cy.max_bounces = 12; cy.glossy_bounces = 6; cy.transmission_bounces = 10; cy.diffuse_bounces = 3
cy.transparent_max_bounces = 24; cy.volume_bounces = 0
cy.caustics_reflective = True; cy.caustics_refractive = False; cy.blur_glossy = 0.15
cy.sample_clamp_indirect = 8.0
try: cy.use_light_tree = True
except Exception: pass
scn.render.resolution_x = W; scn.render.resolution_y = H_; scn.render.resolution_percentage = 100
try: scn.render.image_settings.media_type = "MULTI_LAYER_IMAGE"
except Exception as e: log("media_type", e)
scn.render.image_settings.file_format = "OPEN_EXR_MULTILAYER"; scn.render.image_settings.color_depth = "16"
scn.view_settings.view_transform = "Standard"
scn.view_layers[0].use_pass_mist = True
scn.world = bpy.data.worlds.new("world")
scn.world.mist_settings.start = 15.0; scn.world.mist_settings.depth = 2500.0; scn.world.mist_settings.falloff = "QUADRATIC"

def sock(node, *names):
    for n in names:
        if n in node.inputs: return node.inputs[n]
    raise KeyError(f"{node.name}: none of {names}")
def new_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    return m, nt, nt.nodes.new("ShaderNodeOutputMaterial")
def L(nt, a, b): nt.links.new(a, b)
def MR(nt, v, a, b, c=0.0, d=1.0, clamp=True):
    n = nt.nodes.new("ShaderNodeMapRange"); n.clamp = clamp
    n.inputs["From Min"].default_value = a; n.inputs["From Max"].default_value = b
    n.inputs["To Min"].default_value = c; n.inputs["To Max"].default_value = d; L(nt, v, n.inputs["Value"]); return n.outputs["Result"]
def M(nt, op, a, b=None):
    n = nt.nodes.new("ShaderNodeMath"); n.operation = op
    for i, v in enumerate((a, b)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: L(nt, v, n.inputs[i])
    return n.outputs[0]
def MIX(nt, fac, a, b, blend="MIX"):
    n = nt.nodes.new("ShaderNodeMix"); n.data_type = "RGBA"; n.blend_type = blend
    if isinstance(fac, (int, float)): n.inputs["Factor"].default_value = fac
    else: L(nt, fac, n.inputs["Factor"])
    for s, v in (("A", a), ("B", b)):
        if isinstance(v, tuple): n.inputs[s].default_value = (*v, 1) if len(v) == 3 else v
        else: L(nt, v, n.inputs[s])
    return n.outputs["Result"]
def tex_path(folder, kind):
    d = os.path.join(A, "textures", folder)
    for f in os.listdir(d):
        if kind in f: return os.path.join(d, f)
    raise FileNotFoundError(folder + kind)
def IMG(nt, path, vec, non_color=False):
    n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(path, check_existing=True)
    if non_color: n.image.colorspace_settings.name = "Non-Color"
    n.projection = "BOX"; n.projection_blend = 0.3; L(nt, vec, n.inputs["Vector"]); return n
def sun_dir(el, az):
    e, a = math.radians(el), math.radians(az)
    return Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))

CX, CY, CH = S["cam"]
CZ = float(ground(CX, CY)) + CH          # replaced by a ray cast onto the real surface for clifftop shots
def surface_z(x, y):
    dg = bpy.context.evaluated_depsgraph_get()
    hit, p_, *_ = scn.ray_cast(dg, Vector((x, y, 400.0)), Vector((0, 0, -1)))
    g = float(ground(x, y))     # the terrain mesh has a small hole right under the camera, so never go below the ground
    return max(p_.z, g) if hit else g
YAW = S["look"][0]

# ---------------- camera-centred polar grid (dense in view, sparse behind) ----------------
def polar_grid(r0, r1, nr, n_front, n_back, half=75.0):
    yaw = math.radians(YAW); hf = math.radians(half)
    a_front = np.linspace(-hf, hf, n_front, endpoint=False)
    a_back = np.linspace(hf, 2 * math.pi - hf, n_back, endpoint=False)
    ang = np.concatenate([a_front, a_back]) + yaw          # azimuth: 0 = +Y, + toward +X
    rad = r0 * (r1 / r0) ** (np.arange(nr) / (nr - 1))
    R, Aa = np.meshgrid(rad, ang, indexing="ij")
    X = CX + R * np.sin(Aa); Y = CY + R * np.cos(Aa)
    na = len(ang)
    i = np.arange(nr - 1)[:, None]; j = np.arange(na)[None, :]
    a = i * na + j; b = i * na + (j + 1) % na; c = (i + 1) * na + (j + 1) % na; d = (i + 1) * na + j
    faces = np.stack([a, d, c, b], -1).reshape(-1, 4)       # counter-clockwise seen from above
    return X.ravel(), Y.ravel(), faces, nr, na

def make_mesh(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts)); me.vertices.foreach_set("co", verts.astype(np.float32).ravel())
    nf = len(faces)
    me.loops.add(nf * 4); me.loops.foreach_set("vertex_index", faces.astype(np.int32).ravel())
    me.polygons.add(nf); me.polygons.foreach_set("loop_start", np.arange(0, nf * 4, 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.polygons.foreach_set("use_smooth", np.ones(nf, bool))
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob)
    return ob, me
def point_attr(me, name, arr):
    at = me.attributes.new(name, "FLOAT", "POINT"); at.data.foreach_set("value", arr.astype(np.float32))

# ---------------- terrain ----------------
def ground_material():
    m, nt, out = new_mat("ground")
    tc = nt.nodes.new("ShaderNodeTexCoord"); geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, geo.outputs["Position"], sep.inputs[0])
    nsep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, geo.outputs["Normal"], nsep.inputs[0])
    Z = sep.outputs["Z"]
    mp = nt.nodes.new("ShaderNodeMapping"); sock(mp, "Scale").default_value = (0.9, 0.9, 0.9); L(nt, tc.outputs["Object"], mp.inputs["Vector"])
    mp2 = nt.nodes.new("ShaderNodeMapping"); sock(mp2, "Scale").default_value = (0.11, 0.11, 0.11); L(nt, tc.outputs["Object"], mp2.inputs["Vector"])
    wet_d = IMG(nt, tex_path("damp_beach_sand", "diff"), mp.outputs[0]); wet_n = IMG(nt, tex_path("damp_beach_sand", "nor_gl"), mp.outputs[0], True)
    dry_d = IMG(nt, tex_path("coast_sand_03", "diff"), mp.outputs[0]); dry_n = IMG(nt, tex_path("coast_sand_03", "nor_gl"), mp.outputs[0], True)
    rk_d = IMG(nt, tex_path("seaside_rock", "diff"), mp2.outputs[0]); rk_n = IMG(nt, tex_path("seaside_rock", "nor_gl"), mp2.outputs[0], True)
    # large-scale tone variation so the beach is not one flat tile
    big = nt.nodes.new("ShaderNodeTexNoise"); sock(big, "Scale").default_value = 0.06; sock(big, "Detail").default_value = 4
    L(nt, geo.outputs["Position"], big.inputs["Vector"]); var = MR(nt, big.outputs["Fac"], 0.3, 0.7, 0.8, 1.15)
    dry = MIX(nt, 1.0, dry_d.outputs["Color"], STY["dry"], "MULTIPLY")
    wetc = MIX(nt, 1.0, wet_d.outputs["Color"], STY["wet"], "MULTIPLY")
    WL = S.get("wet", 0.16)
    wet = MR(nt, Z, WL, WL - 0.11)                    # 1 below the swash line (per shot: S["wet"])
    wet_puddle = nt.nodes.new("ShaderNodeTexNoise"); sock(wet_puddle, "Scale").default_value = 0.35; sock(wet_puddle, "Detail").default_value = 6
    L(nt, geo.outputs["Position"], wet_puddle.inputs["Vector"])
    film = M(nt, "MULTIPLY", MR(nt, Z, WL - 0.07, WL - 0.16), MR(nt, wet_puddle.outputs["Fac"], S.get("film", 0.45), S.get("film", 0.45) + 0.15))   # thin standing water patches
    col = MIX(nt, wet, dry, wetc)
    col = MIX(nt, 1.0, col, var, "MULTIPLY") if False else col
    # grass soil and rock on the headlands
    soilc = (0.035, 0.034, 0.018)
    grassy = MR(nt, Z, 1.6, 3.2)
    col = MIX(nt, grassy, col, soilc)
    steep = MR(nt, nsep.outputs["Z"], 0.82, 0.6)
    rock = MIX(nt, 1.0, rk_d.outputs["Color"], (0.42, 0.40, 0.42), "MULTIPLY")
    col = MIX(nt, steep, col, rock)
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); L(nt, col, sock(bs, "Base Color"))
    rough = MR(nt, wet, 0.0, 1.0, 0.9, 0.22)
    rough = M(nt, "MINIMUM", rough, MR(nt, film, 0.0, 1.0, 1.0, 0.02))
    rough = M(nt, "MAXIMUM", rough, M(nt, "MULTIPLY", M(nt, "MAXIMUM", grassy, steep), 0.85))
    L(nt, rough, sock(bs, "Roughness"))
    sock(bs, "Specular IOR Level", "Specular").default_value = 0.5
    # ripple marks in the swash zone (procedural, sharp at any distance)
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "Y"
    sock(wv, "Scale").default_value = 7.0; sock(wv, "Distortion").default_value = 6.0; sock(wv, "Detail").default_value = 3; sock(wv, "Detail Scale").default_value = 1.2
    mpr = nt.nodes.new("ShaderNodeMapping"); sock(mpr, "Scale").default_value = (0.25, 1.0, 1.0); L(nt, tc.outputs["Object"], mpr.inputs["Vector"]); L(nt, mpr.outputs[0], wv.inputs["Vector"])
    rip = M(nt, "MULTIPLY", wv.outputs["Fac"], M(nt, "MULTIPLY", MR(nt, Z, 0.5, 0.15), MR(nt, Z, -1.5, -0.1)))
    rip = M(nt, "MULTIPLY", rip, M(nt, "SUBTRACT", 1.0, film))
    nmix = MIX(nt, wet, dry_n.outputs["Color"], wet_n.outputs["Color"]); nmix = MIX(nt, steep, nmix, rk_n.outputs["Color"])
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.0; L(nt, nmix, nm.inputs["Color"])
    nm_flat = MIX(nt, film, nmix, (0.5, 0.5, 1.0))
    L(nt, nm_flat, nm.inputs["Color"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.35; bp.inputs["Distance"].default_value = 0.02
    L(nt, rip, bp.inputs["Height"]); L(nt, nm.outputs[0], bp.inputs["Normal"]); L(nt, bp.outputs[0], sock(bs, "Normal"))
    L(nt, bs.outputs[0], out.inputs["Surface"])
    return m

def build_terrain():
    X, Y, faces, nr, na = polar_grid(0.3, 6000.0, *((440, 640, 120) if LITE else (640, 900, 180)))
    Z = ground(X, Y)
    ob, me = make_mesh("terrain", np.stack([X, Y, Z], -1), faces)
    me.materials.append(ground_material())
    log("terrain", len(X), "verts")

# ---------------- the sea ----------------
rng = np.random.default_rng(7)
WAVES = []
for k in range(28):
    lam = 3.0 * (40.0 / 3.0) ** (k / 27)                      # 3 m .. 40 m
    ang = math.radians(180 + rng.normal(0, 18 if lam > 12 else 35))   # travelling toward the shore (-Y)
    amp = S["swell"] * (lam / 40.0) ** 1.1 * rng.uniform(0.5, 1.0) * (1.0 if lam > 12 else S["chop"])
    WAVES.append((2 * math.pi / lam, math.sin(ang), math.cos(ang), amp, rng.uniform(0, 6.283)))

def sea_surface(X, Y):
    depth = np.maximum(-ground(X, Y), 0.0)
    damp = sm(0.0, 4.0, depth)
    dx = np.zeros_like(X); dy = np.zeros_like(X); z = np.zeros_like(X)
    for (k, ux, uy, amp, ph) in WAVES:
        th = k * (ux * X + uy * Y) + ph
        q = 0.5 / (k * amp * len(WAVES) + 1e-9) if amp > 0 else 0
        q = min(q, 1.0) * 0.6
        dx += q * amp * ux * np.cos(th); dy += q * amp * uy * np.cos(th); z += amp * np.sin(th)
    # one rolling crest just before it breaks, broken up along the shore
    along = fbm(X * 0.05, 3.0 + Y * 0.0, 3)
    crest_w = 1.1
    cpos = 0.75 + 0.25 * (along - 0.5)
    dd = (depth - cpos) / crest_w
    front = np.where(dd < 0, np.exp(-(dd * 2.2) ** 2), np.exp(-dd ** 2))
    crest = 0.28 * S["swell"] / 0.22 * front * sm(0.25, 0.65, along)
    # the thin swash sheet that runs up the sand
    swash = 0.035 + 0.03 * (fbm(X * 0.08 + 11, Y * 0.01, 3) - 0.5)
    calm = sm(-60.0, -140.0, Y)                                            # inland water (the lagoon) is still
    z = (z * damp + crest) * (1 - calm) + swash * (1 - sm(0.0, 0.6, depth)) * (1 - calm) + S["tide"]
    foam_edge = np.exp(-((depth - 0.07) / 0.045) ** 2)                     # the bright lip just off the waterline
    foam_sheet = sm(1.0, 0.15, depth) * sm(0.0, 0.12, depth) * 0.55        # spent foam spreading to the shore
    foam_crest = 0.55 * front * sm(0.35, 0.7, along) * sm(-0.6, 0.2, -dd) * sm(1.6, 0.9, depth)   # white water on the breaking face (lace, never solid)
    foam = np.clip(np.maximum.reduce([foam_edge, foam_sheet, foam_crest]), 0, 1) * sm(-0.05, 0.02, depth + 0.03) * S.get("foam_k", 1.0) * (1 - calm)
    return X + dx * damp, Y + dy * damp, z, foam, depth

def water_material():
    m, nt, out = new_mat("water")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    sock(bs, "Base Color").default_value = (1, 1, 1, 1); sock(bs, "Roughness").default_value = S.get("water_rough", 0.0)
    sock(bs, "IOR").default_value = 1.333; sock(bs, "Transmission Weight", "Transmission").default_value = 1.0
    # fine capillary ripples: normals only, so reflections stay crisp but alive
    n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.noise_dimensions = "3D"; sock(n1, "Scale").default_value = 1.6; sock(n1, "Detail").default_value = 10; sock(n1, "Roughness").default_value = 0.55
    mp = nt.nodes.new("ShaderNodeMapping"); sock(mp, "Scale").default_value = (1.0, 2.6, 1.0); L(nt, tc.outputs["Object"], mp.inputs["Vector"]); L(nt, mp.outputs[0], n1.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = S["bumps"][0]; bump.inputs["Distance"].default_value = 0.03
    n3 = nt.nodes.new("ShaderNodeTexNoise"); sock(n3, "Scale").default_value = 0.22; sock(n3, "Detail").default_value = 6; sock(n3, "Roughness").default_value = 0.6
    mp3 = nt.nodes.new("ShaderNodeMapping"); sock(mp3, "Scale").default_value = (1.0, 2.2, 1.0); L(nt, tc.outputs["Object"], mp3.inputs["Vector"]); L(nt, mp3.outputs[0], n3.inputs["Vector"])
    bump2 = nt.nodes.new("ShaderNodeBump"); bump2.inputs["Strength"].default_value = S["bumps"][1]; bump2.inputs["Distance"].default_value = 0.25
    L(nt, n3.outputs["Fac"], bump2.inputs["Height"])
    L(nt, n1.outputs["Fac"], bump.inputs["Height"]); L(nt, bump2.outputs[0], bump.inputs["Normal"]); L(nt, bump.outputs[0], sock(bs, "Normal"))
    # foam: the per-vertex foam amount broken into lace and bubbles
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "foam"
    v1 = nt.nodes.new("ShaderNodeTexVoronoi"); v1.feature = "DISTANCE_TO_EDGE"; sock(v1, "Scale").default_value = 2.2; L(nt, tc.outputs["Object"], v1.inputs["Vector"])
    v2 = nt.nodes.new("ShaderNodeTexVoronoi"); v2.feature = "DISTANCE_TO_EDGE"; sock(v2, "Scale").default_value = 9.0; L(nt, tc.outputs["Object"], v2.inputs["Vector"])
    n2 = nt.nodes.new("ShaderNodeTexNoise"); sock(n2, "Scale").default_value = 0.7; sock(n2, "Detail").default_value = 8; L(nt, tc.outputs["Object"], n2.inputs["Vector"])
    lace = M(nt, "MAXIMUM", MR(nt, v1.outputs["Distance"], 0.0, 0.09, 1.0, 0.0), M(nt, "MULTIPLY", MR(nt, v2.outputs["Distance"], 0.0, 0.07, 1.0, 0.0), 0.8))
    patch = MR(nt, n2.outputs["Fac"], 0.35, 0.65)
    a = at.outputs["Fac"]
    f = M(nt, "ADD", M(nt, "MULTIPLY", M(nt, "MULTIPLY", a, lace), M(nt, "ADD", 0.6, M(nt, "MULTIPLY", patch, 0.6))), M(nt, "MULTIPLY", MR(nt, a, 0.8, 1.0), 0.7))
    f = MR(nt, f, STY["foam_lo"], STY["foam_hi"])
    fb = nt.nodes.new("ShaderNodeBsdfPrincipled"); sock(fb, "Base Color").default_value = (0.93, 0.95, 0.96, 1); sock(fb, "Roughness").default_value = 0.45
    try:
        sock(fb, "Subsurface Weight").default_value = 0.4; sock(fb, "Subsurface Radius").default_value = (0.4, 0.5, 0.55)
    except KeyError: pass
    mx = nt.nodes.new("ShaderNodeMixShader"); L(nt, f, mx.inputs[0]); L(nt, bs.outputs[0], mx.inputs[1]); L(nt, fb.outputs[0], mx.inputs[2])
    if WUWA:
        try: sock(bs, "Specular Tint").default_value = (0.55, 1.0, 1.0, 1)
        except KeyError: pass
        dat = nt.nodes.new("ShaderNodeAttribute"); dat.attribute_name = "depth"
        lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.35
        shallow = MR(nt, dat.outputs["Fac"], 6.0, 0.3)
        face = M(nt, "SUBTRACT", 1.0, lw.outputs["Fresnel"])
        glow = nt.nodes.new("ShaderNodeEmission"); glow.inputs["Color"].default_value = (0.20, 0.95, 1.0, 1)
        L(nt, M(nt, "MULTIPLY", M(nt, "MULTIPLY", shallow, face), S.get("wglow", 0.35)), glow.inputs["Strength"])
        ad = nt.nodes.new("ShaderNodeAddShader"); L(nt, mx.outputs[0], ad.inputs[0]); L(nt, glow.outputs[0], ad.inputs[1])
        L(nt, ad.outputs[0], out.inputs["Surface"])
    else:
        L(nt, mx.outputs[0], out.inputs["Surface"])
    ab = nt.nodes.new("ShaderNodeVolumeAbsorption"); ab.inputs["Color"].default_value = (*STY["absorb"], 1); ab.inputs["Density"].default_value = STY["absorb_d"]
    sc = nt.nodes.new("ShaderNodeVolumeScatter"); sc.inputs["Color"].default_value = (*STY["scat"], 1); sc.inputs["Density"].default_value = STY["scat_d"]
    av = nt.nodes.new("ShaderNodeAddShader"); L(nt, ab.outputs[0], av.inputs[0]); L(nt, sc.outputs[0], av.inputs[1])
    L(nt, av.outputs[0], out.inputs["Volume"])
    return m

def build_sea():
    X, Y, faces, nr, na = polar_grid(0.3, 6000.0, *((400, 560, 110) if LITE else (560, 800, 160)))
    Xs, Ys, Zs, foam, depth = sea_surface(X, Y)
    nv = len(X)
    # close the shell: inner and outer walls down to the floor, so the water is a real volume
    floor = -60.0
    top = np.stack([Xs, Ys, Zs], -1)
    inner_b = np.stack([X[:na], Y[:na], np.full(na, floor)], -1)
    outer_b = np.stack([X[-na:], Y[-na:], np.full(na, floor)], -1)
    verts = np.concatenate([top, inner_b, outer_b])
    ib = nv; ob_ = nv + na
    j = np.arange(na); j1 = (j + 1) % na
    outer_t = (nr - 1) * na
    walls_in = np.stack([j, j1, ib + j1, ib + j], -1)
    walls_out = np.stack([outer_t + j, ob_ + j, ob_ + j1, outer_t + j1], -1)
    bottom = np.stack([ib + j, ib + j1, ob_ + j1, ob_ + j], -1)
    allf = np.concatenate([faces, walls_in, walls_out, bottom])
    ob, me = make_mesh("sea", verts, allf)
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    fa = np.concatenate([foam, np.zeros(2 * na)])
    point_attr(me, "foam", fa)
    point_attr(me, "depth", np.concatenate([depth, np.full(2 * na, 60.0)]))
    me.materials.append(water_material())
    ob.visible_shadow = True
    log("sea", nv, "verts")

# ---------------- dune grass (instanced tufts) ----------------
def grass_material():
    m, nt, out = new_mat("dune_grass")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tc.outputs["UV"], sep.inputs[0])
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    v = sep.outputs["Y"]
    base = MIX(nt, v, (0.035, 0.04, 0.018) if not WUWA else (0.05, 0.04, 0.10), STY["g_mid"])
    tip = MIX(nt, MR(nt, v, 0.6, 1.0), base, STY["g_tip"])
    col = MIX(nt, MR(nt, oi.outputs["Random"], 0.0, 1.0, 0.0, 0.5), tip, STY["g_var"])
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); L(nt, col, sock(bs, "Base Color")); sock(bs, "Roughness").default_value = 0.45
    tl = nt.nodes.new("ShaderNodeBsdfTranslucent"); L(nt, MIX(nt, 1.0, col, (1.3, 1.15, 0.7), "MULTIPLY"), tl.inputs["Color"])
    mx = nt.nodes.new("ShaderNodeMixShader"); mx.inputs[0].default_value = 0.4
    L(nt, bs.outputs[0], mx.inputs[1]); L(nt, tl.outputs[0], mx.inputs[2])
    gg = S.get("glow_tips", STY["g_glow"])
    if gg > 0:
        em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*S.get("glow_col", (0.80, 0.72, 1.0)), 1)
        oi2 = nt.nodes.new("ShaderNodeObjectInfo")
        L(nt, M(nt, "MULTIPLY", M(nt, "MULTIPLY", M(nt, "POWER", v, S.get("glow_pow", 4.0)), gg), MR(nt, oi2.outputs["Random"], 0.7, 0.9)), em.inputs["Strength"])   # only some tufts glow
        ad = nt.nodes.new("ShaderNodeAddShader"); L(nt, mx.outputs[0], ad.inputs[0]); L(nt, em.outputs[0], ad.inputs[1]); L(nt, ad.outputs[0], out.inputs["Surface"])
    else:
        L(nt, mx.outputs[0], out.inputs["Surface"])
    return m

def tuft_mesh(name, seed, blades, h0, h1):
    r = np.random.default_rng(seed); verts, faces, uvs = [], [], []
    SEG = 6
    for _ in range(blades):
        ang = r.uniform(0, 2 * math.pi); lean = r.uniform(0.15, 0.55); hgt = r.uniform(h0, h1); wid = r.uniform(0.004, 0.008)
        ox, oy = r.normal(0, 0.05, 2); twist = r.uniform(-0.6, 0.6)
        ca, sa = math.cos(ang), math.sin(ang)
        base_i = len(verts)
        for s in range(SEG + 1):
            t = s / SEG
            bend = lean * t * t * hgt
            cx, cy, cz = ox + ca * bend, oy + sa * bend, hgt * t * (1 - 0.25 * lean * t)
            w = wid * (1 - t) ** 0.7 + 0.0005
            px, py = -sa * math.cos(twist * t) * w, ca * math.cos(twist * t) * w
            verts += [(cx - px, cy - py, cz), (cx + px, cy + py, cz)]; uvs += [(0, t), (1, t)]
        for s in range(SEG):
            a = base_i + 2 * s; faces.append((a, a + 1, a + 3, a + 2))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices: uv.data[li].uv = uvs[me.loops[li].vertex_index]
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob); ob.location = (0, 0, -2000)
    return ob

def scatter(name, proto, P, rot, scl):
    me = bpy.data.meshes.new(name); me.vertices.add(len(P)); me.vertices.foreach_set("co", P.astype(np.float32).ravel())
    ar = me.attributes.new("rot", "FLOAT_VECTOR", "POINT"); ar.data.foreach_set("vector", rot.astype(np.float32).ravel())
    point_attr(me, "scl", scl)
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob)
    ng = bpy.data.node_groups.new(name + "_gn", "GeometryNodeTree")
    ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    gi = ng.nodes.new("NodeGroupInput"); go = ng.nodes.new("NodeGroupOutput")
    oi = ng.nodes.new("GeometryNodeObjectInfo"); oi.inputs["Object"].default_value = proto; oi.inputs["As Instance"].default_value = True
    iop = ng.nodes.new("GeometryNodeInstanceOnPoints")
    ra = ng.nodes.new("GeometryNodeInputNamedAttribute"); ra.data_type = "FLOAT_VECTOR"; ra.inputs["Name"].default_value = "rot"
    sa = ng.nodes.new("GeometryNodeInputNamedAttribute"); sa.data_type = "FLOAT"; sa.inputs["Name"].default_value = "scl"
    ng.links.new(gi.outputs[0], iop.inputs["Points"]); ng.links.new(oi.outputs["Geometry"], iop.inputs["Instance"])
    ng.links.new(ra.outputs["Attribute"], iop.inputs["Rotation"]); ng.links.new(sa.outputs["Attribute"], iop.inputs["Scale"])
    ng.links.new(iop.outputs["Instances"], go.inputs[0])
    mod = ob.modifiers.new("scatter", "NODES"); mod.node_group = ng
    return ob

def plant_mats():
    """Materials for the ground cover: short grass, flower heads (pink thrift, yellow, white), shrub leaves, stalks."""
    out = {}
    def blade(name, base, mid, tip, trans=(1.25, 1.15, 0.75)):
        m, nt, o = new_mat(name)
        tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tc.outputs["UV"], sep.inputs[0])
        oi = nt.nodes.new("ShaderNodeObjectInfo"); v = sep.outputs["Y"]
        col = MIX(nt, v, base, mid); col = MIX(nt, MR(nt, v, 0.55, 1.0), col, tip)
        col = MIX(nt, MR(nt, oi.outputs["Random"], 0.0, 1.0, 0.0, 0.45), col, (mid[0] * 0.7, mid[1] * 0.8, mid[2] * 0.6))
        bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); L(nt, col, sock(bs, "Base Color")); sock(bs, "Roughness").default_value = 0.5
        tl = nt.nodes.new("ShaderNodeBsdfTranslucent"); L(nt, MIX(nt, 1.0, col, trans, "MULTIPLY"), tl.inputs["Color"])
        mx = nt.nodes.new("ShaderNodeMixShader"); mx.inputs[0].default_value = 0.4
        L(nt, bs.outputs[0], mx.inputs[1]); L(nt, tl.outputs[0], mx.inputs[2]); L(nt, mx.outputs[0], o.inputs["Surface"])
        return m
    out["short"] = blade("short_grass", (0.03, 0.04, 0.015), (0.20, 0.24, 0.08), (0.52, 0.48, 0.22))
    out["stalk"] = blade("stalk", (0.03, 0.045, 0.02), (0.10, 0.16, 0.06), (0.16, 0.22, 0.08))
    out["leaf"] = blade("shrub_leaf", (0.02, 0.03, 0.012), (0.06, 0.09, 0.03), (0.13, 0.16, 0.05), (1.1, 1.2, 0.6))
    for name, col in (("pink", (0.95, 0.32, 0.52)), ("yellow", (1.0, 0.72, 0.10)), ("white", (0.92, 0.90, 0.84))):
        m, nt, o = new_mat("flower_" + name)
        oi = nt.nodes.new("ShaderNodeObjectInfo")
        c = MIX(nt, MR(nt, oi.outputs["Random"], 0.0, 1.0, 0.0, 0.35), col, (col[0] * 0.75, col[1] * 0.7, col[2] * 0.8))
        bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); L(nt, c, sock(bs, "Base Color")); sock(bs, "Roughness").default_value = 0.55
        try:
            sock(bs, "Subsurface Weight").default_value = 0.3
        except KeyError:
            pass
        L(nt, bs.outputs[0], o.inputs["Surface"]); out[name] = m
    return out

def _strip(verts, faces, uvs, base, ang, hgt, lean, wid, seg=5, twist=0.0):
    ca, sa = math.cos(ang), math.sin(ang); i0 = len(verts)
    for s in range(seg + 1):
        t = s / seg; bend = lean * t * t * hgt
        cx, cy, cz = base[0] + ca * bend, base[1] + sa * bend, base[2] + hgt * t * (1 - 0.25 * lean * t)
        w = wid * (1 - t) ** 0.7 + 0.0005
        px, py = -sa * math.cos(twist * t) * w, ca * math.cos(twist * t) * w
        verts += [(cx - px, cy - py, cz), (cx + px, cy + py, cz)]; uvs += [(0, t), (1, t)]
    for s in range(seg):
        a = i0 + 2 * s; faces.append((a, a + 1, a + 3, a + 2))
    return (base[0] + ca * lean * hgt, base[1] + sa * lean * hgt, base[2] + hgt * (1 - 0.25 * lean))

def _mesh_obj(name, verts, faces, uvs, mats, mat_idx=None):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices: uv.data[li].uv = uvs[me.loops[li].vertex_index]
        poly.use_smooth = True
    for m in mats: me.materials.append(m)
    if mat_idx is not None:
        for poly, k in zip(me.polygons, mat_idx): poly.material_index = k
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob); ob.location = (0, 0, -2000)
    return ob

def flower_mesh(name, seed, n, h0, h1, head_r, stalk_m, head_m):
    """A clump of n flowers: thin curved stalks, a small round head on each, a few leaves at the foot."""
    r = np.random.default_rng(seed); verts, faces, uvs, idx = [], [], [], []
    for _ in range(n):
        b = (r.normal(0, 0.05), r.normal(0, 0.05), 0.0)
        top = _strip(verts, faces, uvs, b, r.uniform(0, 6.283), r.uniform(h0, h1), r.uniform(0.05, 0.3), 0.0025, 4)
        idx += [0] * 4
        hr = head_r * r.uniform(0.75, 1.25); i0 = len(verts)
        for (dx, dy, dz) in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -0.6)):
            verts.append((top[0] + dx * hr, top[1] + dy * hr, top[2] + dz * hr)); uvs.append((0.5, 1.0))
        for (a, b_, c) in ((0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)):
            faces.append((i0 + a, i0 + b_, i0 + c)); idx.append(1)
    for _ in range(max(3, n // 2)):
        _strip(verts, faces, uvs, (r.normal(0, 0.04), r.normal(0, 0.04), 0.0), r.uniform(0, 6.283), r.uniform(0.06, 0.14), 0.6, 0.006, 3)
        idx += [0] * 3
    return _mesh_obj(name, verts, faces, uvs, [stalk_m, head_m], idx)

def shrub_mesh(name, seed, leaf_m, radius=0.45, height=0.42, n=420):
    """A low rounded shrub: hundreds of small leaf cards in a squashed dome, denser on the outside."""
    r = np.random.default_rng(seed); verts, faces, uvs = [], [], []
    for _ in range(n):
        u = r.uniform(0, 6.283); v = r.uniform(0.0, 1.0) ** 0.6; rr = radius * (0.55 + 0.45 * r.random() ** 0.4)
        cx, cy, cz = rr * math.cos(u) * math.sqrt(1 - v * v), rr * math.sin(u) * math.sqrt(1 - v * v), height * v
        s = r.uniform(0.025, 0.05); a = r.uniform(0, 6.283); b = r.uniform(-1.2, 1.2)
        ex = (math.cos(a) * s, math.sin(a) * s, 0.0); ey = (-math.sin(a) * math.cos(b) * s * 0.5, math.cos(a) * math.cos(b) * s * 0.5, math.sin(b) * s * 0.5)
        i0 = len(verts)
        for (p, q) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append((cx + p * ex[0] + q * ey[0], cy + p * ex[1] + q * ey[1], cz + p * ex[2] + q * ey[2])); uvs.append(((p + 1) / 2, 0.3 + 0.7 * v))
        faces.append((i0, i0 + 1, i0 + 2, i0 + 3))
    for _ in range(14):
        _strip(verts, faces, uvs, (r.normal(0, 0.08), r.normal(0, 0.08), 0.0), r.uniform(0, 6.283), r.uniform(0.15, 0.3), 0.5, 0.008, 3)
    return _mesh_obj(name, verts, faces, uvs, [leaf_m])

def build_grass():
    gm = grass_material(); pm_ = plant_mats()
    tall = []
    for k, (n, h0, h1) in enumerate(((26, 0.35, 0.8), (40, 0.45, 1.0), (18, 0.25, 0.55))):
        p = tuft_mesh(f"tuft{k}", 100 + k, n, h0, h1); p.data.materials.append(gm); tall.append(p)
    short = []
    for k, (n, h0, h1) in enumerate(((60, 0.10, 0.28), (90, 0.14, 0.36))):
        p = tuft_mesh(f"short{k}", 200 + k, n, h0, h1); p.data.materials.append(pm_["short"]); short.append(p)
    flowers = [flower_mesh("thrift", 301, 9, 0.10, 0.22, 0.016, pm_["stalk"], pm_["pink"]),
               flower_mesh("yellowf", 302, 12, 0.14, 0.32, 0.011, pm_["stalk"], pm_["yellow"]),
               flower_mesh("whitef", 303, 10, 0.10, 0.26, 0.010, pm_["stalk"], pm_["white"])]
    shrubs = [shrub_mesh("shrub0", 401, pm_["leaf"]), shrub_mesh("shrub1", 402, pm_["leaf"], 0.6, 0.5, 600)]
    r = np.random.default_rng(3)
    N = int(1_400_000 * GRASS)
    # candidates over the land, density falling off with distance from the camera
    dist = 2.0 + 260 * r.random(N) ** 2.2
    ang = math.radians(YAW) + r.uniform(-1.4, 1.4, N)
    X = CX + dist * np.sin(ang); Y = CY + dist * np.cos(ang)
    Z = ground(X, Y)
    e = 0.5
    gx = (ground(X + e, Y) - ground(X - e, Y)) / (2 * e); gy = (ground(X, Y + e) - ground(X, Y - e)) / (2 * e)
    slope = np.hypot(gx, gy)
    d_land = shore_y(X) - Y
    keep = (np.hypot(X - CAVE[0], Y - CAVE[1]) > 15) & (Z > S.get("grass_zmin", 0.8)) & (slope < 0.95) & ((d_land > S.get("grass_dland", 7.0)) | (Z > 2.5)) & (r.random(N) < np.maximum(sm(S.get("grass_dland", 7.0), S.get("grass_dland", 7.0) + 5, d_land), sm(2.5, 4, Z)) * np.clip(1.1 - slope, 0, 1))
    clear = S.get("clear", 0.0)
    if clear > 0: keep &= np.hypot(X - CX, Y - CY) > clear
    X, Y = X[keep], Y[keep]; Z = ground(X, Y) - 0.03
    near_pts = []
    for (da, dd, rad) in S["near"]:                                   # backlit clumps near the lens
        a = math.radians(YAW + da); cx_, cy_ = CX + dd * math.sin(a), CY + dd * math.cos(a)
        rr = rad * np.sqrt(r.random(45)); aa = r.uniform(0, 2 * math.pi, 45)
        near_pts.append(np.stack([cx_ + rr * np.cos(aa), cy_ + rr * np.sin(aa)], -1))
    nt_ = S.get("top_grass", 0)
    if nt_:
        dd_ = 1.5 + 22 * r.random(nt_) ** 1.4; aa_ = math.radians(YAW) + r.uniform(-1.1, 1.1, nt_)
        tg = np.stack([CX + dd_ * np.sin(aa_), CY + dd_ * np.cos(aa_)], -1)
        tz_ = np.array([surface_z(px, py) for px, py in tg])
        near_pts.append(tg[tz_ > CZ - S["cam"][2] - 2.0])
    n_base = len(X)
    if near_pts:
        ex = np.concatenate(near_pts); exz = np.array([surface_z(px, py) for px, py in ex]) - 0.03
        X = np.concatenate([X, ex[:, 0]]); Y = np.concatenate([Y, ex[:, 1]]); Z = np.concatenate([Z, exz])
    n_near = len(X) - n_base
    for (bx0, bx1, by0, by1, bn, bz) in S.get("patches", ()):
        bn = int(bn * GRASS); qx = r.uniform(bx0, bx1, bn * 2); qy = r.uniform(by0, by1, bn * 2); qz = ground(qx, qy)
        e2 = 0.6; qs = np.hypot(ground(qx + e2, qy) - ground(qx - e2, qy), ground(qx, qy + e2) - ground(qx, qy - e2)) / (2 * e2)
        ok = (qz > bz) & (qs < 0.8)
        X = np.concatenate([X, qx[ok][:bn]]); Y = np.concatenate([Y, qy[ok][:bn]]); Z = np.concatenate([Z, qz[ok][:bn] - 0.03])
    npg = int(S.get("plateau_grass", 0) * GRASS)
    if npg:
        px_ = r.uniform(-46, 112, npg * 2); py_ = r.uniform(70 + PROM_DY, 97 + PROM_DY, npg * 2); pz_ = ground(px_, py_)
        ok = pz_ > 12.8
        X = np.concatenate([X, px_[ok][:npg]]); Y = np.concatenate([Y, py_[ok][:npg]]); Z = np.concatenate([Z, pz_[ok][:npg] - 0.03])
    # ---- what grows where: zones from noise, so the cover reads as patches with intent, not a carpet ----
    zone = fbm(X * 0.05 + 1, Y * 0.05 + 2, 4)                         # dune grass vs short meadow
    fl = fbm(X * 0.30 + 5, Y * 0.30 + 3, 3)                           # flower drifts
    shb = fbm(X * 0.11 + 9, Y * 0.11 + 1, 3)                          # shrub groups
    bare = fbm(X * 0.16 + 7, Y * 0.16 + 7, 3)                         # bare earth / sand patches
    kind = fbm(X * 0.04 + 20, Y * 0.04 + 11, 3)                       # which flower
    rnd = r.random(len(X))
    forced = np.zeros(len(X), bool); forced[n_base:n_base + n_near] = True       # the S["near"] clumps (and top_grass)
    dcam = np.hypot(X - CX, Y - CY)
    near = dcam < 6.0
    alive = (bare > 0.36) | forced
    is_shrub = alive & (shb > 0.64) & (rnd < 0.06) & ~near
    is_flower = alive & ~is_shrub & (fl > 0.58) & (rnd < 0.55)
    is_tall = alive & ~is_shrub & ~is_flower & (((zone > 0.5) & (dcam > S.get("lens_clear", 5.0))) | forced)
    is_short = alive & ~is_shrub & ~is_flower & ~is_tall
    n = len(X); P = np.stack([X, Y, Z], -1)
    rot = np.stack([r.normal(0, 0.08, n), r.normal(0, 0.08, n), r.uniform(0, 2 * math.pi, n)], -1)
    scl = r.uniform(0.75, 1.35, n)
    def put(name, protos, sel, s_mul=1.0):
        pick = r.integers(0, len(protos), n)
        for k, p in enumerate(protos):
            m = sel & (pick == k)
            if m.any(): scatter(f"{name}{k}", p, P[m], rot[m], scl[m] * s_mul)
    put("grass", tall, is_tall)
    # the short meadow is denser than the tall tufts: two extra jittered copies per point
    sp = np.nonzero(is_short)[0]
    if len(sp):
        J = np.concatenate([P[sp]] + [P[sp] + np.stack([r.normal(0, 0.18, len(sp)), r.normal(0, 0.18, len(sp)), np.zeros(len(sp))], -1) for _ in range(0 if LITE else 2)])
        J[:, 2] = ground(J[:, 0], J[:, 1]) - 0.02
        mj = len(J); rj = np.stack([r.normal(0, 0.08, mj), r.normal(0, 0.08, mj), r.uniform(0, 6.283, mj)], -1); sj = r.uniform(0.8, 1.4, mj)
        pk = r.integers(0, 2, mj)
        for k in range(2): scatter(f"short{k}_", short[k], J[pk == k], rj[pk == k], sj[pk == k])
    fk = np.where(kind < 0.45, 0, np.where(kind < 0.62, 1, 2))
    for k in range(3):
        m = is_flower & (fk == k)
        if m.any(): scatter(f"flowers{k}", flowers[k], P[m], rot[m], scl[m] * 1.1)
    put("shrubs", shrubs, is_shrub, 1.3)
    nf = S.get("near_flowers", 0)
    if nf:
        # drifts of flowers in the foreground, so the near layer has colour and shape
        d_ = 2.5 + 16 * r.random(nf * 6) ** 1.3; a_ = math.radians(YAW) + r.uniform(-0.6, 0.6, nf * 6)
        fx = CX + d_ * np.sin(a_); fy = CY + d_ * np.cos(a_)
        dr_ = fbm(fx * 0.35 + 11, fy * 0.35 + 4, 3)
        fz = ground(fx, fy)
        ok_ = (dr_ > 0.52) & (fz > 0.8)
        fx, fy = fx[ok_][:nf], fy[ok_][:nf]; mf = len(fx)
        fz = np.array([surface_z(px, py) for px, py in zip(fx, fy)]) - 0.02
        Pf = np.stack([fx, fy, fz], -1); rf = np.stack([np.zeros(mf), np.zeros(mf), r.uniform(0, 6.283, mf)], -1); sf = r.uniform(0.9, 1.5, mf)
        mixn = fbm(fx * 0.6 + 3, fy * 0.6, 3)
        kf = np.where(mixn < 0.5, 0, np.where(mixn < 0.62, 2, 1))     # mostly sea pinks, threads of white and yellow
        for k in (0, 1, 2):
            if (kf == k).any(): scatter(f"nearflowers{k}", flowers[k], Pf[kf == k], rf[kf == k], sf[kf == k])
        log("near flowers", mf)
    log("ground cover: tall", int(is_tall.sum()), "short", int(is_short.sum()) * 3, "flowers", int(is_flower.sum()), "shrubs", int(is_shrub.sum()))

# ---------------- scanned tree on the headland ----------------
TREE_OBJ = None
def build_tree():
    path = os.path.join(A, "models", "island_tree_01", "island_tree_01_1k.gltf")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    tx, ty, tz = TREE
    global TREE_OBJ
    for o in new:
        if o.parent is None:
            o.location = (tx, ty, tz); o.scale = (2.3, 2.3, 2.3); o.rotation_euler[2] = math.radians(200); TREE_OBJ = o
    log("tree", [o.name for o in new])

# ---------------- scanned sea cliffs dressing the headland face ----------------
def build_cliffs():
    path = os.path.join(A, "models", "coastal_cliff_04", "coastal_cliff_04_4k.gltf")
    src = None
    for k, (x, y, z, rot, s) in enumerate(S.get("cliffs", ())):
        if src is None:
            before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
            src = [o for o in bpy.data.objects if o not in before and o.type == "MESH"][0]
            o = src
        else:
            o = bpy.data.objects.new(f"cliff{k}", src.data); scn.collection.objects.link(o)
        o.parent = None; o.location = (x, y, z); o.rotation_euler = (0, 0, math.radians(rot)); o.scale = (s, s, s)
    log("cliffs", len(S.get("cliffs", ())))

# ---------------- the far sea arch ----------------
ROCK_MAT = None
def rock_material():
    global ROCK_MAT
    if ROCK_MAT is None: ROCK_MAT = _rock_material()
    return ROCK_MAT

def _rock_material():
    m, nt, out = new_mat("arch_rock")
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); sock(mp, "Scale").default_value = (0.09, 0.09, 0.09)
    L(nt, tc.outputs["Object"], mp.inputs["Vector"])
    d_ = IMG(nt, tex_path("seaside_rock", "diff"), mp.outputs[0]); n_ = IMG(nt, tex_path("seaside_rock", "nor_gl"), mp.outputs[0], True)
    geo = nt.nodes.new("ShaderNodeNewGeometry"); sz = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, geo.outputs["Position"], sz.inputs[0])
    wetband = MR(nt, sz.outputs["Z"], 2.5, 0.0)                         # dark, wet, weed-stained foot
    col = MIX(nt, 1.0, d_.outputs["Color"], (0.30, 0.28, 0.30), "MULTIPLY")
    # sedimentary beds: warm ochre and cool grey layers, wavering, so stacks read as eroded rock, not grey stone
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "Z"
    sock(wv, "Scale").default_value = 0.6; sock(wv, "Distortion").default_value = 3.0; sock(wv, "Detail").default_value = 3
    mpw = nt.nodes.new("ShaderNodeMapping"); sock(mpw, "Scale").default_value = (0.05, 0.05, 0.12); L(nt, geo.outputs["Position"], mpw.inputs["Vector"]); L(nt, mpw.outputs[0], wv.inputs["Vector"])
    beds = MIX(nt, MR(nt, wv.outputs["Fac"], 0.25, 0.75), (1.25, 1.05, 0.82), (0.82, 0.84, 0.9))
    col = MIX(nt, 1.0, col, beds, "MULTIPLY")
    nz_ = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, geo.outputs["Normal"], nz_.inputs[0])
    col = MIX(nt, M(nt, "MULTIPLY", MR(nt, nz_.outputs["Z"], 0.55, 0.85), 0.8), col, (0.16, 0.16, 0.07))   # lichen and turf on ledges and tops
    weed = M(nt, "MULTIPLY", MR(nt, sz.outputs["Z"], 4.5, 2.0), M(nt, "SUBTRACT", 1.0, wetband))
    col = MIX(nt, weed, col, (0.07, 0.075, 0.03))                                                      # a weed-stained band above the wet foot
    col = MIX(nt, wetband, col, (0.035, 0.04, 0.03))
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); L(nt, col, sock(bs, "Base Color"))
    L(nt, MR(nt, wetband, 0.0, 1.0, 0.8, 0.25), sock(bs, "Roughness"))
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.4; L(nt, n_.outputs["Color"], nm.inputs["Color"])
    nz = nt.nodes.new("ShaderNodeTexNoise"); sock(nz, "Scale").default_value = 0.6; sock(nz, "Detail").default_value = 12
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.5; L(nt, nz.outputs["Fac"], bp.inputs["Height"]); L(nt, nm.outputs[0], bp.inputs["Normal"])
    L(nt, bp.outputs[0], sock(bs, "Normal")); L(nt, bs.outputs[0], out.inputs["Surface"])
    return m

def build_arch():
    """The sea arch, swept along a flat-topped curve: two legs of different weight, a thinner slab-like top that is
    deeper (along the hole axis) than it is tall, flared feet, rock beds and blocky jointing. Not a torus."""
    from mathutils import noise as mnoise
    c = Vector((*ARCH["pos"], 0.0)); k_ = ARCH["scale"]
    rz = math.radians(ARCH["rotz"])
    u = Vector((math.cos(rz), math.sin(rz), 0.0))          # along the spine (the arch's span)
    n = Vector((-math.sin(rz), math.cos(rz), 0.0))         # the hole axis
    span, H = 40.0 * k_, 66.0 * k_
    RINGS, SEG = 96, 56
    def path(t):                                           # t 0..1 from leg A foot over the top to leg B foot
        th = math.pi * (1 - t)
        cs, sn = math.cos(th), math.sin(th)
        x = span * math.copysign(abs(cs) ** 0.75, cs)
        z = -6.0 + (H + 6.0) * abs(sn) ** 0.55                # steep legs, a broad flattish top
        return x, z
    verts = []
    for i in range(RINGS + 1):
        t = i / RINGS
        x0, z0 = path(max(0.0, t - 0.002)); x1, z1 = path(min(1.0, t + 0.002))
        tx, tz = x1 - x0, z1 - z0; l = math.hypot(tx, tz) or 1.0; tx, tz = tx / l, tz / l
        nx, nz = -tz, tx                                   # in-plane normal
        x, z = path(t)
        leg = 1 - abs(math.sin(math.pi * t))               # 1 at the feet, 0 at the top
        side = 1.0 if t < 0.5 else 0.78                    # leg A heavier than leg B
        a = (9.5 + 9.0 * leg ** 1.6 * side) * k_           # thickness in the arch plane
        b = (17.0 + 6.0 * leg * side) * k_                 # depth along the hole axis: a slab, not a tube
        foot = max(0.0, (6.0 - (z + 6.0)) / 6.0) if z < 0 else 0.0
        a *= 1 + 0.6 * foot; b *= 1 + 0.4 * foot           # flared feet
        for j in range(SEG):
            ph = 2 * math.pi * j / SEG; cp, sp_ = math.cos(ph), math.sin(ph)
            q = Vector((cp * 1.5, sp_ * 1.5, t * 9.0))
            k = 1 + 0.16 * mnoise.noise(q) + 0.07 * mnoise.noise(q * 2.7) + 0.10 * math.cos(3 * ph + 1.3) * leg
            k += 0.06 * (1.0 if ((z / 3.2 + 0.5 * mnoise.noise(q * 0.6)) % 1.0) < 0.35 else 0.0)   # rock beds as ledges
            px = x + nx * a * cp * k; pz = z + nz * a * cp * k; py = b * sp_ * k
            w = c + u * px + n * py; verts.append((w.x, w.y, pz))
    faces = [(i * SEG + j, i * SEG + (j + 1) % SEG, (i + 1) * SEG + (j + 1) % SEG, (i + 1) * SEG + j) for i in range(RINGS) for j in range(SEG)]
    me = bpy.data.meshes.new("arch"); me.from_pydata(verts, [], faces); me.update()
    for p_ in me.polygons: p_.use_smooth = True
    o = bpy.data.objects.new("arch", me); scn.collection.objects.link(o)
    ss = o.modifiers.new("s", "SUBSURF"); ss.levels = 0; ss.render_levels = 1
    for nm_, (sc, st) in enumerate(((20.0, 4.5), (9.0, 2.6), (2.2, 0.7))):
        tx_ = bpy.data.textures.new(f"archn{nm_}", "CLOUDS"); tx_.noise_scale = sc; tx_.noise_depth = 4
        dm = o.modifiers.new(f"d{nm_}", "DISPLACE"); dm.texture = tx_; dm.strength = st; dm.texture_coords = "GLOBAL"; dm.mid_level = 0.5
    tv = bpy.data.textures.new("archvor", "VORONOI"); tv.noise_scale = 6.0; tv.distance_metric = "MINKOVSKY_FOUR"
    dv = o.modifiers.new("dv", "DISPLACE"); dv.texture = tv; dv.strength = 2.4; dv.texture_coords = "GLOBAL"; dv.mid_level = 0.6
    me.materials.append(rock_material())

# ---------------- the eroded coastline: sea stacks, reefs, the tide-pool shelf ----------------
# The arch is the last standing piece of an old headland: its spine runs on as stacks and stumps, with reefs around them.
def _rock_list():
    ax, ay = ARCH["pos"]; sp = math.radians(ARCH["rotz"] - 69.0 + 21.0)       # the arch's spine direction
    u = (math.sin(sp), math.cos(sp)); p = (u[1], -u[0])
    rr = np.random.default_rng(21); out = []
    # uneven spacing on purpose: a big parent block, a tight pair, a gap, a leaning stack, stumps; not a row of pawns
    for s, o, r, h, lean in ((-115, 14, 24, 62, 0.02), (-168, -30, 11, 38, -0.05), (-190, -8, 7, 30, 0.03), (-300, 30, 9, 21, 0.09),
                             (-360, 0, 9, 6, 0.0), (95, -14, 16, 47, -0.03), (150, 4, 7, 19, 0.12), (270, 10, 12, 9, 0.0), (-25, -80, 10, 13, 0.0)):
        out.append((ax + u[0] * s + p[0] * o, ay + u[1] * s + p[1] * o, r, h, lean))
    for _ in range(16):                                                       # low reef rocks and stumps around them
        s = rr.uniform(-420, 330); o = rr.normal(0, 55)
        out.append((ax + u[0] * s + p[0] * o, ay + u[1] * s + p[1] * o, rr.uniform(2.5, 7), rr.uniform(0.8, 4.5), 0.0))
    # a mid-sea group between the cove and the arch, so the open water has a stepping stone
    out += [(-210, 520, 9, 28, 0.05), (-245, 560, 6, 17, -0.06), (-180, 578, 4, 9, 0.0), (-268, 505, 3, 4, 0.0), (-150, 540, 2.5, 2, 0.0)]
    # reefs off the cliff-top tip, where the swell breaks
    out += [(15.5, 133.5, 5.0, 13.0, 0.0), (21.0, 136.0, 4.0, 12.0, 0.02)]      # the cliff face continues in rock at the plateau's east end
    out += [(-47.0, 139.0, 5.5, 11.5, 0.02), (-53.0, 147.0, 4.0, 7.0, -0.04), (-58.5, 134.0, 3.2, 3.5, 0.0), (-50.0, 129.0, 2.2, 1.6, 0.0), (-62.0, 143.0, 2.0, 1.0, 0.0)]
    out += [(x, y + PROM_DY, r, h, l) for (x, y, r, h, l) in ((-72, 122, 9, 0.5, 0.0), (-90, 150, 8, 0.9, 0.0), (-60, 140, 5, 0.3, 0.0), (-108, 178, 11, 2.5, 0.0), (-124, 160, 6, 0.6, 0.0))]
    return out
ROCKS = _rock_list()

def rock_column(name, x, y, r, h, lean, seed):
    from mathutils import noise as mnoise
    base = min(float(ground(x, y)), 0.0) - 3.0
    rings, seg = 30, 64; verts = []
    for i in range(rings + 1):
        t = i / rings; z = base + (h - base) * t
        # sheer sides, a slight taper, a flat (sometimes tilted) top cut by a short rounded lip
        prof = (1.10 - (0.25 + 0.12 * min(1.0, max(0.0, (h - 20.0) / 30.0))) * max(0.0, z / max(h, 1.0))) * max(0.0, 1 - max(0.0, (t - 0.94) / 0.06) ** 2) ** 0.5
        prof *= 1.0 - 0.16 * math.exp(-((z - 1.2) / 2.4) ** 2)                                   # wave-cut notch
        ledge = r * 0.22 + 0.4
        for j in range(seg):
            a = 2 * math.pi * j / seg; ca, sa = math.cos(a), math.sin(a)
            q = Vector((ca * 1.3, sa * 1.3, z / max(r, 1.0) * 0.5 + seed * 7.1))
            lobes = 0.16 * math.cos(3 * a + seed) + 0.10 * math.cos(5 * a + 2.3 * seed) + 0.06 * math.cos(2 * a + 4.1 * seed)
            step_ = 0.07 * (1.0 if ((z / ledge + 0.6 * mnoise.noise(q * 0.7)) % 1.0) < 0.35 else 0.0)   # rock beds stand out as ledges
            neck = (0.20 + 0.08 * min(1.0, max(0.0, (h - 20.0) / 30.0))) * mnoise.noise(Vector((seed * 3.3, 0.0, z / max(r, 1.0) * 0.45)))          # waist and bulge up the height
            flute = 0.07 * mnoise.noise(Vector((ca * 4.0, sa * 4.0, z * 0.08 + seed)))              # vertical gullies
            k = 1 + lobes + neck + flute + 0.16 * mnoise.noise(q) + 0.06 * mnoise.noise(q * 3.1) + 0.6 * step_
            rad = r * prof * k
            w_top = max(0.0, (t - 0.82) / 0.18)
            tilt = (ca * math.cos(seed * 1.7) + sa * math.sin(seed * 1.7)) * 0.22 * r                # a sloping, broken top, never flat
            zz = z + w_top * (tilt + 0.25 * r * mnoise.noise(Vector((ca * 2.2, sa * 2.2, seed * 5.0))))
            if h > 8.0 and mnoise.noise(Vector((ca * 1.3, sa * 1.3, seed * 3.1))) > 0.2: zz -= w_top * 0.22 * r   # a broken step in the top
            verts.append((x + ca * rad + lean * h * t * t, y + sa * rad, zz))
    top = len(verts); verts.append((x + lean * h, y, h + 0.03 * r))
    faces = []
    for i in range(rings):
        for j in range(seg):
            a = i * seg + j; b = i * seg + (j + 1) % seg; faces.append((a, b, b + seg, a + seg))
    for j in range(seg): faces.append((rings * seg + j, rings * seg + (j + 1) % seg, top))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p_ in me.polygons: p_.use_smooth = True
    o = bpy.data.objects.new(name, me); scn.collection.objects.link(o)
    ss = o.modifiers.new("s", "SUBSURF"); ss.levels = 0; ss.render_levels = 1
    for nm_, (sc, st) in enumerate(((max(r, 2.0) * 0.45, max(r, 2.0) * 0.10), (max(r, 2.0) * 0.1, max(r, 2.0) * 0.025))):
        tx = bpy.data.textures.new(f"{name}n{nm_}", "CLOUDS"); tx.noise_scale = sc; tx.noise_depth = 3
        dm = o.modifiers.new(f"d{nm_}", "DISPLACE"); dm.texture = tx; dm.strength = st; dm.texture_coords = "GLOBAL"; dm.mid_level = 0.5
    # blocky jointing: a cell pattern pushes faces in and out in slabs, so the outline breaks into blocks and notches
    tv = bpy.data.textures.new(f"{name}vor", "VORONOI"); tv.noise_scale = max(r, 1.0) * 0.35; tv.distance_metric = "MINKOVSKY_FOUR"
    dv = o.modifiers.new("dv", "DISPLACE"); dv.texture = tv; dv.strength = max(r, 1.0) * 0.12; dv.texture_coords = "GLOBAL"; dv.mid_level = 0.6
    me.materials.append(rock_material())
    return o

def build_rocks():
    for k, (x, y, r, h, lean) in enumerate(S.get("extra_rocks", ())):
        rock_column(f"xrock{k}", x, y, r, h, lean, 500 + k)
    for k, (x, y, r, h, lean) in enumerate(S.get("cliff_rocks", ())):
        rock_column(f"crock{k}", x, y, r, h, lean, 700 + k)
    for k, (x, y, r, h, lean) in enumerate(ROCKS):
        rock_column(f"stack{k}", x, y, r, h, lean, k)
    log("rocks", len(ROCKS))

# the wave-cut shelf at the foot of the right headland: dark wet rock with still pools that mirror the sky
SHELF = (8.0, 45.0, 9.0, 13.0)       # centre x, y, half-size x, y
def shelf_material():
    # the wave-cut shelf is wet all day: darker, glossier, greener than the stacks
    m = rock_material().copy(); m.name = "shelf_rock"; nt = m.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    src = sock(bs, "Base Color").links[0].from_socket
    dark = MIX(nt, 1.0, src, (0.34, 0.38, 0.34), "MULTIPLY"); L(nt, dark, sock(bs, "Base Color"))
    for l_ in list(sock(bs, "Roughness").links): nt.links.remove(l_)
    sock(bs, "Roughness").default_value = 0.35
    return m

def build_shelf():
    from mathutils import noise as mnoise
    cx, cy, hx, hy = SHELF; step = 0.12
    xs = np.arange(cx - hx, cx + hx, step); ys = np.arange(cy - hy, cy + hy, step)
    X, Y = np.meshgrid(xs, ys)
    # irregular outline: an ellipse eaten by noise, joined to the headland on its right
    e = np.hypot((X - cx) / hx, (Y - cy) / hy) + 0.35 * (fbm(X * 0.15 + 3, Y * 0.15 + 1, 4) - 0.5) - 0.35 * sm(cx + 2, cx + hx, X)
    mask = sm(0.95, 0.75, e)
    strata = 0.06 * np.sin((X * 0.35 + Y * 0.94) * 2.2 + 3 * fbm(X * 0.2, Y * 0.2, 3))
    ridges = 1.0 - np.abs(2 * fbm(X * 0.3 + 5, Y * 0.3 + 1, 4) - 1)
    top = 0.55 + 0.45 * (fbm(X * 0.22 + 7, Y * 0.22 + 2, 5) - 0.5) + 0.25 * ridges + strata + 0.06 * (fbm(X * 2.0, Y * 2.0, 3) - 0.5)
    pools = sm(0.36, 0.31, fbm(X * 0.11 + 13, Y * 0.11 + 5, 4))                 # a few small basins worn into the top (not one sheet of water)
    top = top - 0.45 * pools
    Z = np.maximum(ground(X, Y), mask * top + (1 - mask) * (-2.5))
    ny, nx = Z.shape
    verts = np.stack([X, Y, Z], -1).reshape(-1, 3)
    i = np.arange(ny - 1)[:, None] * nx; j = np.arange(nx - 1)[None, :]
    a = (i + j).ravel(); faces = np.stack([a, a + 1, a + nx + 1, a + nx], -1)
    keep = (mask[:-1, :-1] > 0.02).ravel(); faces = faces[keep]
    ob, me = make_mesh("shelf", verts, faces); me.materials.append(shelf_material())
    # pool water: flat, still, only inside the basins
    lvl = 0.42
    inside = ((Z[:-1, :-1] < lvl) & (mask[:-1, :-1] > 0.9) & (pools[:-1, :-1] > 0.3)).ravel()
    # loose boulders on the shelf
    rb = np.random.default_rng(5)
    for k in range(14):
        bx, by = cx + rb.uniform(-0.7, 0.5) * hx, cy + rb.uniform(-0.7, 0.8) * hy
        ix, iy = int((bx - xs[0]) / step), int((by - ys[0]) / step)
        if mask[iy, ix] < 0.9 or pools[iy, ix] > 0.2 or math.hypot(bx - CX, by - CY) < 9.0: continue   # never right in front of the lens
        rock_column(f"boulder{k}", bx, by, rb.uniform(0.4, 1.3), float(Z[iy, ix]) + rb.uniform(0.3, 1.1), 0.0, 100 + k)
    pf = np.stack([a, a + 1, a + nx + 1, a + nx], -1)[inside]
    pv = verts.copy(); pv[:, 2] = lvl
    po, pme = make_mesh("pools", pv, pf)
    m, nt, out = new_mat("pool_water"); pb = nt.nodes.new("ShaderNodeBsdfPrincipled")
    sock(pb, "Base Color").default_value = (0.02, 0.03, 0.03, 1); sock(pb, "Roughness").default_value = 0.0
    sock(pb, "IOR").default_value = 1.333; sock(pb, "Transmission Weight", "Transmission").default_value = 0.6
    L(nt, pb.outputs[0], out.inputs["Surface"]); pme.materials.append(m)
    # fallen blocks on the shelf: break its flat outline, so from a low camera it reads as a rocky foreshore, not a slab
    rb = np.random.default_rng(57); nb = 0
    for k in range(14):
        bx = cx + rb.uniform(-hx * 0.9, hx * 0.9); by = cy + rb.uniform(-hy * 0.85, hy * 0.85)
        ix = int((bx - xs[0]) / step); iy = int((by - ys[0]) / step)
        if not (0 <= ix < nx and 0 <= iy < ny) or mask[iy, ix] < 0.9 or math.hypot(bx - CX, by - CY) < 9.0: continue
        bo = pebble_proto(f"shelfrock{k}", 60 + k, rb.uniform(0.5, 0.8)); sb = rb.uniform(0.5, 1.5)
        bo.location = (bx, by, float(Z[iy, ix]) - 0.15); bo.scale = (sb * rb.uniform(1.0, 1.8), sb, sb); bo.rotation_euler = (rb.uniform(-0.3, 0.3), rb.uniform(-0.3, 0.3), rb.uniform(0, 6.283)); nb += 1
    log("shelf", len(faces), "faces,", int(inside.sum()), "pool cells,", nb, "blocks")

# ---------------- the beach near layer: pebbles, kelp, driftwood ----------------
def pebble_proto(name, seed, flat):
    from mathutils import noise as mnoise
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        q = v.co * 1.3 + Vector((seed * 3.1, 0, 0))
        v.co = Vector((v.co.x * (1 + 0.25 * mnoise.noise(q)), v.co.y * (1 + 0.2 * mnoise.noise(q * 1.7)), v.co.z * flat))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p_ in me.polygons: p_.use_smooth = True
    me.materials.append(rock_material())
    o = bpy.data.objects.new(name, me); scn.collection.objects.link(o); o.location = (0, 0, -2000)
    return o

def kelp_proto(name, seed):
    r = np.random.default_rng(seed); verts, faces, uvs = [], [], []
    for _ in range(5):                                              # flat ribbons lying on the sand
        ang = r.uniform(0, 6.283); L_ = r.uniform(0.4, 1.1); w = r.uniform(0.02, 0.05); i0 = len(verts)
        x, y = r.normal(0, 0.1), r.normal(0, 0.1)
        for s in range(9):
            t = s / 8; a = ang + 0.8 * math.sin(t * 4 + seed)
            x += math.cos(a) * L_ / 8; y += math.sin(a) * L_ / 8
            verts += [(x - math.sin(a) * w, y + math.cos(a) * w, 0.01), (x + math.sin(a) * w, y - math.cos(a) * w, 0.01)]; uvs += [(0, t), (1, t)]
        for s in range(8):
            a0 = i0 + 2 * s; faces.append((a0, a0 + 1, a0 + 3, a0 + 2))
    m, nt, o = new_mat("kelp"); bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    sock(bs, "Base Color").default_value = (0.025, 0.022, 0.008, 1); sock(bs, "Roughness").default_value = 0.6
    L(nt, bs.outputs[0], o.inputs["Surface"])
    return _mesh_obj(name, verts, faces, uvs, [m])

def driftwood(name, x, y, length, radius, yaw, seed):
    from mathutils import noise as mnoise
    rings, seg = 24, 16; verts = []; z0 = float(ground(x, y)) + radius * 0.15
    ca, sa = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    for i in range(rings + 1):
        t = i / rings; s_ = (t - 0.5) * length
        bend = 0.12 * length * math.sin(t * 3.0 + seed) + 0.05 * length * mnoise.noise(Vector((t * 3, seed * 2, 1)))
        rr = radius * (1.0 - 0.45 * t) * (1 + 0.35 * mnoise.noise(Vector((t * 6, seed, 0))) + 0.25 * max(0.0, 1 - abs(t - 0.15) * 12))   # knots, a root flare
        cx, cy = x + ca * s_ - sa * bend, y + sa * s_ + ca * bend
        for j in range(seg):
            a = 2 * math.pi * j / seg; k = 1 + 0.08 * math.sin(a * 5 + t * 20)
            verts.append((cx - sa * math.cos(a) * rr * k, cy + ca * math.cos(a) * rr * k, z0 + math.sin(a) * rr * k))
    faces = [(i * seg + j, i * seg + (j + 1) % seg, (i + 1) * seg + (j + 1) % seg, (i + 1) * seg + j) for i in range(rings) for j in range(seg)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p_ in me.polygons: p_.use_smooth = True
    m, nt, o = new_mat(name + "_wood"); tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; sock(wv, "Scale").default_value = 3.0; sock(wv, "Distortion").default_value = 8.0
    L(nt, tc.outputs["Object"], wv.inputs["Vector"])
    col = MIX(nt, MR(nt, wv.outputs["Fac"], 0.2, 0.8), (0.30, 0.27, 0.23), (0.55, 0.50, 0.44))   # sun-bleached grey wood with grain
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); L(nt, col, sock(bs, "Base Color")); sock(bs, "Roughness").default_value = 0.8
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.4; L(nt, wv.outputs["Fac"], bp.inputs["Height"]); L(nt, bp.outputs[0], sock(bs, "Normal"))
    L(nt, bs.outputs[0], o.inputs["Surface"]); me.materials.append(m)
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob)

def build_beach():
    cfg = S.get("beach")
    if not cfg: return
    r = np.random.default_rng(17)
    pebs = [pebble_proto(f"peb{k}", k, f) for k, f in enumerate((0.35, 0.25, 0.45))]
    kelp = [kelp_proto(f"kelp{k}", 50 + k) for k in range(2)]
    n = cfg.get("pebbles", 6000)
    d = 1.5 + 28 * r.random(n * 3) ** 1.6; a = math.radians(YAW) + r.uniform(-0.9, 0.9, n * 3)
    X = CX + d * np.sin(a); Y = CY + d * np.cos(a); Z = ground(X, Y)
    drift = fbm(X * 0.4 + 3, Y * 0.4 + 9, 3)                         # pebbles gather in drifts along the tide line
    tide = np.exp(-((Z - 0.12) / 0.12) ** 2) + 0.35 * np.exp(-((Z - 0.5) / 0.25) ** 2)
    ok = (Z > -0.05) & (Z < 1.4) & (r.random(len(X)) < sm(0.45, 0.7, drift) * np.clip(tide, 0, 1))
    X, Y, Z = X[ok][:n], Y[ok][:n], Z[ok][:n]
    m = len(X); P = np.stack([X, Y, Z - 0.01], -1)
    rot = np.stack([r.normal(0, 0.2, m), r.normal(0, 0.2, m), r.uniform(0, 6.283, m)], -1)
    scl = (0.025 + 0.11 * r.random(m) ** 3) * cfg.get("peb_size", 1.0)
    pk = r.integers(0, 3, m)
    for k in range(3): scatter(f"pebbles{k}", pebs[k], P[pk == k], rot[pk == k], scl[pk == k])
    # kelp washed up along the high-water line
    nk = cfg.get("kelp", 140)
    d = 2.0 + 25 * r.random(nk * 4) ** 1.3; a = math.radians(YAW) + r.uniform(-0.9, 0.9, nk * 4)
    X = CX + d * np.sin(a); Y = CY + d * np.cos(a); Z = ground(X, Y)
    ok = np.abs(Z - 0.35) < 0.15
    X, Y, Z = X[ok][:nk], Y[ok][:nk], Z[ok][:nk]; mk = len(X)
    Pk = np.stack([X, Y, Z], -1); rk = np.stack([np.zeros(mk), np.zeros(mk), r.uniform(0, 6.283, mk)], -1); sk = r.uniform(0.7, 1.3, mk)
    pk = r.integers(0, 2, mk)
    for k in range(2):
        if (pk == k).any(): scatter(f"kelps{k}", kelp[k], Pk[pk == k], rk[pk == k], sk[pk == k])
    for k, (da, dd, ln, rad, yw) in enumerate(cfg.get("logs", ())):
        aa = math.radians(YAW + da); driftwood(f"log{k}", CX + dd * math.sin(aa), CY + dd * math.cos(aa), ln, rad, yw, k)
    log("beach: pebbles", m, "kelp", mk, "logs", len(cfg.get("logs", ())))

# ---------------- sky, sun, camera ----------------
def build_sky():
    w = scn.world; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground")
    hp = os.path.join(A, "hdri", S["hdri"])
    if arg("--sky4k", 0) or not os.path.exists(hp):                          # low-memory previews on this PC: the 4K copy of the same sky
        h4 = hp.replace("_8k.", "_4k.")
        if os.path.exists(h4): hp = h4
    env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(hp); log("sky", os.path.basename(hp))
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping")
    el_h, phi_h = S["hsun"]
    rotz = -phi_h - (90.0 - S["sun_az"]) + S.get("sky_rot", 0.0)   # Blender equirect: u = 0.5 - atan2(y, x) / 2pi; sky_rot turns the clouds without moving the sun lamp
    sock(mp, "Rotation").default_value = (0, 0, math.radians(rotz))
    # optional tilt: lowers the photographed sun by S["tilt"] degrees along its own azimuth (into the arch / under the horizon)
    from mathutils import Matrix
    dh = sun_dir(0, S["sun_az"]); axis = dh.cross(Vector((0, 0, 1))).normalized()
    Rt = Matrix.Rotation(math.radians(S["tilt"]), 3, axis)
    if (Rt @ dh).z < 0: Rt = Matrix.Rotation(-math.radians(S["tilt"]), 3, axis)
    mt = nt.nodes.new("ShaderNodeMapping"); sock(mt, "Rotation").default_value = Rt.to_euler("XYZ")
    nt.links.new(tc.outputs["Generated"], mt.inputs["Vector"]); nt.links.new(mt.outputs[0], mp.inputs["Vector"]); nt.links.new(mp.outputs[0], env.inputs["Vector"])
    el_h = el_h - S["tilt"]
    tint = nt.nodes.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"; tint.inputs["Factor"].default_value = 1.0
    sky_src = env.outputs["Color"]
    if WUWA or HYBRID:
        # keep the real cloud shapes, repaint them in a pink / lilac / peach palette (brightness kept, hue remapped)
        bw = nt.nodes.new("ShaderNodeRGBToBW"); nt.links.new(env.outputs["Color"], bw.inputs[0])
        fac = nt.nodes.new("ShaderNodeMath"); fac.operation = "DIVIDE"; nt.links.new(bw.outputs[0], fac.inputs[0])
        add = nt.nodes.new("ShaderNodeMath"); add.operation = "ADD"; nt.links.new(bw.outputs[0], add.inputs[0]); add.inputs[1].default_value = 1.6
        nt.links.new(add.outputs[0], fac.inputs[1])
        ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
        stops = ((0.0, (0.10, 0.10, 0.34)), (0.30, (0.36, 0.34, 0.80)), (0.45, (0.80, 0.50, 0.85)), (0.58, (1.0, 0.56, 0.62)), (0.72, (1.0, 0.74, 0.58)), (1.0, (1.0, 0.95, 0.86)))
        if HYBRID:   # the old Golden hour palette: indigo cloud shadows, mauve, rose-peach, gold, a warm-white sun
            stops = S.get("ramp") or ((0.0, (0.13, 0.09, 0.24)), (0.26, (0.46, 0.29, 0.50)), (0.40, (0.95, 0.55, 0.48)), (0.53, (1.0, 0.66, 0.38)), (0.68, (1.0, 0.80, 0.50)), (1.0, (1.0, 0.95, 0.82)))
        cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
        cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
        for pos, c in stops[1:-1]:
            e = cr.elements.new(pos); e.color = (*c, 1)
        nt.links.new(fac.outputs[0], ramp.inputs["Fac"])
        gsrc = bw.outputs[0]
        if S.get("sky_clip"):   # cap the photo's brightness near the sun, so its glow stays gold instead of clipping to a white blob
            mn_ = nt.nodes.new("ShaderNodeMath"); mn_.operation = "MINIMUM"; nt.links.new(bw.outputs[0], mn_.inputs[0]); mn_.inputs[1].default_value = S["sky_clip"]; gsrc = mn_.outputs[0]
        gain = nt.nodes.new("ShaderNodeMath"); gain.operation = "MULTIPLY_ADD"; nt.links.new(gsrc, gain.inputs[0]); gain.inputs[1].default_value = 0.55; gain.inputs[2].default_value = 0.25
        mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs["Factor"].default_value = 1.0
        nt.links.new(ramp.outputs["Color"], mul.inputs["A"]); cc = nt.nodes.new("ShaderNodeCombineColor")
        for i in range(3): nt.links.new(gain.outputs[0], cc.inputs[i])
        nt.links.new(cc.outputs[0], mul.inputs["B"]); sky_src = mul.outputs["Result"]
    nt.links.new(sky_src, tint.inputs["A"]); tint.inputs["B"].default_value = (*((1, 1, 1) if (WUWA or HYBRID) else S.get("sky_tint", (1, 1, 1))), 1)
    sky_out = tint.outputs["Result"]
    if S.get("sky_grad"):
        lo, hi_, z0, z1 = S["sky_grad"]
        nz = nt.nodes.new("ShaderNodeVectorMath"); nz.operation = "NORMALIZE"; nt.links.new(tc.outputs["Generated"], nz.inputs[0])
        sz_ = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(nz.outputs[0], sz_.inputs[0])
        mr_ = nt.nodes.new("ShaderNodeMapRange"); mr_.inputs["From Min"].default_value = z0; mr_.inputs["From Max"].default_value = z1; nt.links.new(sz_.outputs["Z"], mr_.inputs["Value"])
        gm_ = nt.nodes.new("ShaderNodeMix"); gm_.data_type = "RGBA"; nt.links.new(mr_.outputs[0], gm_.inputs["Factor"])
        gm_.inputs["A"].default_value = (*lo, 1); gm_.inputs["B"].default_value = (*hi_, 1)
        gx_ = nt.nodes.new("ShaderNodeMix"); gx_.data_type = "RGBA"; gx_.blend_type = "MULTIPLY"; gx_.inputs["Factor"].default_value = 1.0
        nt.links.new(sky_out, gx_.inputs["A"]); nt.links.new(gm_.outputs["Result"], gx_.inputs["B"]); sky_out = gx_.outputs["Result"]
    if S.get("stars", 0) > 0:
        # the last stars: tiny sharp points high in the sky, fading where the sky is bright
        nrm = nt.nodes.new("ShaderNodeVectorMath"); nrm.operation = "NORMALIZE"; nt.links.new(tc.outputs["Generated"], nrm.inputs[0])
        sz = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(nrm.outputs[0], sz.inputs[0])
        hi = nt.nodes.new("ShaderNodeMapRange"); hi.inputs["From Min"].default_value = 0.25; hi.inputs["From Max"].default_value = 0.7; nt.links.new(sz.outputs["Z"], hi.inputs["Value"])
        bwk = nt.nodes.new("ShaderNodeRGBToBW"); nt.links.new(sky_out, bwk.inputs[0])
        dark = nt.nodes.new("ShaderNodeMapRange"); dark.inputs["From Min"].default_value = S.get("star_mask", (0.6, 0.15))[0]; dark.inputs["From Max"].default_value = S.get("star_mask", (0.6, 0.15))[1]; nt.links.new(bwk.outputs[0], dark.inputs["Value"])
        acc = None
        for sc_, th, gain_ in ((700.0, 0.05, 1.0), (1500.0, 0.06, 0.6)) + (((3000.0, 0.07, 0.4), (5200.0, 0.08, 0.25)) if S.get("star_dense") else ()):
            vo = nt.nodes.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = sc_; nt.links.new(nrm.outputs[0], vo.inputs["Vector"])
            pt = nt.nodes.new("ShaderNodeMapRange"); pt.inputs["From Min"].default_value = th; pt.inputs["From Max"].default_value = 0.0; nt.links.new(vo.outputs["Distance"], pt.inputs["Value"])
            sep3 = nt.nodes.new("ShaderNodeSeparateColor"); nt.links.new(vo.outputs["Color"], sep3.inputs[0])
            pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; nt.links.new(sep3.outputs[0], pw.inputs[0]); pw.inputs[1].default_value = 6.0
            m1 = nt.nodes.new("ShaderNodeMath"); m1.operation = "MULTIPLY"; nt.links.new(pt.outputs[0], m1.inputs[0]); nt.links.new(pw.outputs[0], m1.inputs[1])
            m2 = nt.nodes.new("ShaderNodeMath"); m2.operation = "MULTIPLY"; nt.links.new(m1.outputs[0], m2.inputs[0]); m2.inputs[1].default_value = gain_ * 40.0 * S["stars"]
            if acc is None: acc = m2.outputs[0]
            else:
                ad_ = nt.nodes.new("ShaderNodeMath"); ad_.operation = "ADD"; nt.links.new(acc, ad_.inputs[0]); nt.links.new(m2.outputs[0], ad_.inputs[1]); acc = ad_.outputs[0]
        m3 = nt.nodes.new("ShaderNodeMath"); m3.operation = "MULTIPLY"; nt.links.new(acc, m3.inputs[0]); nt.links.new(hi.outputs[0], m3.inputs[1])
        m4 = nt.nodes.new("ShaderNodeMath"); m4.operation = "MULTIPLY"; nt.links.new(m3.outputs[0], m4.inputs[0]); nt.links.new(dark.outputs[0], m4.inputs[1])
        st = nt.nodes.new("ShaderNodeMix"); st.data_type = "RGBA"; st.blend_type = "ADD"; st.clamp_factor = False
        nt.links.new(m4.outputs[0], st.inputs["Factor"])
        nt.links.new(sky_out, st.inputs["A"]); st.inputs["B"].default_value = (0.85, 0.9, 1.0, 1); sky_out = st.outputs["Result"]
    nt.links.new(sky_out, bg.inputs["Color"]); bg.inputs["Strength"].default_value = S["hdri_gain"]
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    d = sun_dir(el_h, S["sun_az"])
    if S["sun_str"] <= 0: return
    ld = bpy.data.lights.new("sun", "SUN"); ld.energy = S["sun_str"]; ld.color = STY["sun_col"] or S["sun_col"]; ld.angle = math.radians(0.55)
    k = bpy.data.objects.new("sun", ld); scn.collection.objects.link(k); k.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    if S["disc"] > 0:
        dist = 5000.0
        bpy.ops.mesh.primitive_uv_sphere_add(radius=dist * math.tan(math.radians(0.27)), location=Vector((CX, CY, CZ)) + d * dist, segments=32, ring_count=16)
        s = bpy.context.active_object
        m, nt2, o2 = new_mat("sun_disc"); em = nt2.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*STY["disc"], 1); em.inputs["Strength"].default_value = S["disc"]
        L(nt2, em.outputs[0], o2.inputs["Surface"]); s.data.materials.append(m)
        s.visible_shadow = False; s.visible_diffuse = False; s.visible_glossy = False; s.visible_transmission = False

def build_mist():
    k = S.get("mist", 0.0)
    if k <= 0: return
    m, nt, out = new_mat("mist")
    geo = nt.nodes.new("ShaderNodeNewGeometry"); sw = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, geo.outputs["Position"], sw.inputs[0])
    hfall = M(nt, "EXPONENT", M(nt, "MULTIPLY", sw.outputs["Z"], -0.45))           # thick on the water, thin by 6 m up
    nz = nt.nodes.new("ShaderNodeTexNoise"); sock(nz, "Scale").default_value = 0.012; sock(nz, "Detail").default_value = 4
    mpn = nt.nodes.new("ShaderNodeMapping"); sock(mpn, "Scale").default_value = (1.0, 0.6, 4.0); L(nt, geo.outputs["Position"], mpn.inputs["Vector"]); L(nt, mpn.outputs[0], nz.inputs["Vector"])
    patch = MR(nt, nz.outputs["Fac"], 0.35, 0.7, 0.15, 1.0)
    near = MR(nt, sw.outputs["Y"], CY + 4, CY + 40)                                   # clear right in front of the lens
    dens = M(nt, "MULTIPLY", M(nt, "MULTIPLY", M(nt, "MULTIPLY", hfall, patch), near), k)
    pv = nt.nodes.new("ShaderNodeVolumePrincipled"); pv.inputs["Color"].default_value = (0.92, 0.9, 0.95, 1); pv.inputs["Anisotropy"].default_value = 0.6
    L(nt, dens, pv.inputs["Density"]); L(nt, pv.outputs[0], out.inputs["Volume"])
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.active_object; o.name = "mist"
    o.scale = (1600, 2000, 16); o.location = (CX, CY + 1000 + 3, 7.0); o.data.materials.append(m)
    cy.volume_step_rate = 2.0; cy.volume_max_steps = 256
    log("mist", k)

def emis_mat(name, col, strength):
    m, nt, out = new_mat(name); em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*col, 1); em.inputs["Strength"].default_value = strength
    L(nt, em.outputs[0], out.inputs["Surface"]); return m

def no_shadow(o):
    o.visible_shadow = False

def build_fogbox(c, size, dens, ztop, soft, col=(0.9, 0.9, 0.95), aniso=0.5, noise=0.01, round_=False):
    m, nt, out = new_mat("fog")
    geo = nt.nodes.new("ShaderNodeNewGeometry"); sw = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, geo.outputs["Position"], sw.inputs[0])
    top = MR(nt, sw.outputs["Z"], ztop + soft, ztop - soft)
    nz = nt.nodes.new("ShaderNodeTexNoise"); sock(nz, "Scale").default_value = noise; sock(nz, "Detail").default_value = 5
    mpn = nt.nodes.new("ShaderNodeMapping"); sock(mpn, "Scale").default_value = (1.0, 1.0, 3.0); L(nt, geo.outputs["Position"], mpn.inputs["Vector"]); L(nt, mpn.outputs[0], nz.inputs["Vector"])
    patch = MR(nt, nz.outputs["Fac"], 0.3, 0.7, 0.25, 1.0)
    pv = nt.nodes.new("ShaderNodeVolumePrincipled"); pv.inputs["Color"].default_value = (*col, 1); pv.inputs["Anisotropy"].default_value = aniso
    dn_ = M(nt, "MULTIPLY", M(nt, "MULTIPLY", top, patch), dens)
    L(nt, dn_, pv.inputs["Density"]); L(nt, pv.outputs[0], out.inputs["Volume"])
    if round_: bpy.ops.mesh.primitive_ico_sphere_add(radius=0.5, subdivisions=4)     # an ellipsoid: the edge thins out by itself
    else: bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object; o.name = "fogbox"
    o.scale = size; o.location = c; o.data.materials.append(m)
    cy.volume_step_rate = 2.0; cy.volume_max_steps = 256

def build_moon(az, el, size_deg, strength, lamp):
    d = sun_dir(el, az); dist = 9000.0
    m, nt, out = new_mat("moon")
    tc = nt.nodes.new("ShaderNodeTexCoord"); nz = nt.nodes.new("ShaderNodeTexNoise"); sock(nz, "Scale").default_value = 3.0; sock(nz, "Detail").default_value = 6
    L(nt, tc.outputs["Object"], nz.inputs["Vector"])
    em = nt.nodes.new("ShaderNodeEmission"); L(nt, MIX(nt, MR(nt, nz.outputs["Fac"], 0.42, 0.62), (0.62, 0.62, 0.66), (1.0, 0.98, 0.94)), em.inputs["Color"])
    em.inputs["Strength"].default_value = strength; L(nt, em.outputs[0], out.inputs["Surface"])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=dist * math.tan(math.radians(size_deg / 2)), location=Vector((CX, CY, CZ)) + d * dist, segments=48, ring_count=24)
    o = bpy.context.active_object; o.data.materials.append(m); o.visible_shadow = False; o.visible_diffuse = False
    if lamp > 0:
        ld = bpy.data.lights.new("moonlight", "SUN"); ld.energy = lamp; ld.color = (0.72, 0.8, 1.0); ld.angle = math.radians(max(0.5, size_deg))
        k = bpy.data.objects.new("moonlight", ld); scn.collection.objects.link(k); k.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        k.visible_glossy = False

def build_waterfall():
    lx, ly = LAG
    fr = S.get("falls_r")                       # (lip radius, pool radius): pours off a lip in front of the face
    y0, y1 = (ly + fr[0], ly + fr[1]) if fr else (ly + 73.0, ly + 55.0)
    z0 = float(ground(lx, ly + 73.0)) - 0.5
    verts, faces, uvs = [], [], []
    NV, NU = 40, 10
    for i in range(NV + 1):
        tt = i / NV
        if fr: y = y0 + (y1 - y0) * math.sqrt(tt); z = z0 * (1 - tt) + 0.05      # thrown forward off the lip, then a straight drop
        else: y = y0 + (y1 - y0) * tt; z = z0 * (1 - tt) ** 1.15 + 0.05
        w = S.get("falls_w", (3.2, 2.6))[0] + S.get("falls_w", (3.2, 2.6))[1] * tt
        for j in range(NU + 1):
            u = j / NU; verts.append((lx - w + 2 * w * u, y, z)); uvs.append((u, 1 - tt))
    for i in range(NV):
        for j in range(NU):
            a = i * (NU + 1) + j; faces.append((a, a + 1, a + NU + 2, a + NU + 1))
    me = bpy.data.meshes.new("falls"); me.from_pydata(verts, [], faces); me.update()
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices: uv.data[li].uv = uvs[me.loops[li].vertex_index]
    o = bpy.data.objects.new("falls", me); scn.collection.objects.link(o)
    m, nt, out = new_mat("falls")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tc.outputs["UV"], sep.inputs[0])
    mp = nt.nodes.new("ShaderNodeMapping"); sock(mp, "Scale").default_value = (5.0, 0.35, 1.0); L(nt, tc.outputs["UV"], mp.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise"); sock(nz, "Scale").default_value = 3.0; sock(nz, "Detail").default_value = 8; L(nt, mp.outputs[0], nz.inputs["Vector"])
    streak = MR(nt, nz.outputs["Fac"], 0.3, 0.68, 0.12, 0.95)      # mostly water with darker gaps, not mostly gaps
    if S.get("falls_streams"):     # two or three thick streams with thin veils between, not one even sheet
        ms_ = nt.nodes.new("ShaderNodeMapping"); sock(ms_, "Scale").default_value = (2.2, 0.0, 0.0); L(nt, tc.outputs["UV"], ms_.inputs["Vector"])
        ns_ = nt.nodes.new("ShaderNodeTexNoise"); sock(ns_, "Scale").default_value = 1.0; sock(ns_, "Detail").default_value = 1; L(nt, ms_.outputs[0], ns_.inputs["Vector"])
        streak = M(nt, "MULTIPLY", streak, MR(nt, ns_.outputs["Fac"], 0.38, 0.6, 0.3, 1.0))
    edge = M(nt, "MULTIPLY", MR(nt, sep.outputs["X"], 0.0, 0.18), MR(nt, sep.outputs["X"], 1.0, 0.82))
    a = M(nt, "MULTIPLY", streak, edge)
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); sock(bs, "Base Color").default_value = (0.72, 0.77, 0.82, 1); sock(bs, "Roughness").default_value = 0.35
    try: sock(bs, "Subsurface Weight").default_value = 0.3
    except KeyError: pass
    if WUWA:
        sock(bs, "Emission Color").default_value = (0.5, 0.95, 1.0, 1); sock(bs, "Emission Strength").default_value = 0.6
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mx = nt.nodes.new("ShaderNodeMixShader")
    L(nt, a, mx.inputs[0]); L(nt, tr.outputs[0], mx.inputs[1]); L(nt, bs.outputs[0], mx.inputs[2]); L(nt, mx.outputs[0], out.inputs["Surface"])
    me.materials.append(m); o.visible_shadow = False
    sp_ = S.get("spray", ((22, 10, 8), 0.12)); sz_ = S.get("spray_z", (3.0, 2.0, 2.5))
    build_fogbox((lx, y1 + 1.0, sz_[0]), sp_[0], sp_[1], sz_[1], sz_[2], col=(0.95, 0.97, 1.0), noise=0.3, round_=bool(S.get("falls_pool")))
    if S.get("falls_pool"):
        # churning white water where the falls land: a foam sheet on the pool, fading out in streaks, and boulders the water breaks on
        bpy.ops.mesh.primitive_circle_add(vertices=96, radius=S["falls_pool"], fill_type="NGON", location=(lx, y1 - 1.5, 0.04))
        fo_ = bpy.context.active_object; fo_.scale = (1.5, 1.0, 1.0)
        fm2, fnt2, fout2 = new_mat("falls_foam"); ftc2 = fnt2.nodes.new("ShaderNodeTexCoord")
        fn2 = fnt2.nodes.new("ShaderNodeTexNoise"); sock(fn2, "Scale").default_value = 0.9; sock(fn2, "Detail").default_value = 8; sock(fn2, "Roughness").default_value = 0.7
        L(fnt2, ftc2.outputs["Object"], fn2.inputs["Vector"])
        vl = fnt2.nodes.new("ShaderNodeVectorMath"); vl.operation = "LENGTH"; L(fnt2, ftc2.outputs["Object"], vl.inputs[0])
        rad_ = MR(fnt2, vl.outputs["Value"], S["falls_pool"] * 0.25, S["falls_pool"] * 0.95, 1.0, 0.0)
        fa_ = M(fnt2, "MULTIPLY", MR(fnt2, fn2.outputs["Fac"], 0.42, 0.62), rad_)
        fa_ = M(fnt2, "MAXIMUM", fa_, MR(fnt2, vl.outputs["Value"], S["falls_pool"] * 0.3, S["falls_pool"] * 0.1))
        fb2 = fnt2.nodes.new("ShaderNodeBsdfPrincipled"); sock(fb2, "Base Color").default_value = (0.8, 0.84, 0.88, 1); sock(fb2, "Roughness").default_value = 0.5
        ft2 = fnt2.nodes.new("ShaderNodeBsdfTransparent"); fx2 = fnt2.nodes.new("ShaderNodeMixShader")
        L(fnt2, fa_, fx2.inputs[0]); L(fnt2, ft2.outputs[0], fx2.inputs[1]); L(fnt2, fb2.outputs[0], fx2.inputs[2]); L(fnt2, fx2.outputs[0], fout2.inputs["Surface"])
        fo_.data.materials.append(fm2); fo_.visible_shadow = False
        rb_ = np.random.default_rng(83)
        for k in range(7):
            bx = lx + rb_.uniform(-13, 13); by = y1 + rb_.uniform(-4.0, 2.0)
            if abs(bx - lx) < 3.0: bx += math.copysign(3.5, bx - lx)
            bo = pebble_proto(f"fallsrock{k}", 40 + k, rb_.uniform(0.45, 0.7)); s3 = rb_.uniform(1.0, 2.4)
            bo.location = (bx, by, -0.35); bo.scale = (s3 * rb_.uniform(1.0, 1.5), s3, s3); bo.rotation_euler[2] = rb_.uniform(0, 6.283)
    log("waterfall", z0)

MODEL_COLS = {}
def model_collection(mid):
    """Import a Poly Haven glTF once into a hidden collection; place copies with collection instances (handles any hierarchy)."""
    if mid in MODEL_COLS: return MODEL_COLS[mid]
    d = os.path.join(A, "models", mid); f = [x for x in os.listdir(d) if x.endswith(".gltf")][0]
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=os.path.join(d, f))
    new = [o for o in bpy.data.objects if o not in before]
    col = bpy.data.collections.new("m_" + mid)
    for o in new:
        for c in list(o.users_collection): c.objects.unlink(o)
        col.objects.link(o)
    MODEL_COLS[mid] = col; log("model", mid, len(new), "objects")
    return col

def place_model(mid, x, y, z, s, rz, tilt=(0.0, 0.0)):
    e = bpy.data.objects.new(f"{mid}_inst", None); e.instance_type = "COLLECTION"; e.instance_collection = model_collection(mid)
    e.location = (x, y, z); e.scale = (s, s, s); e.rotation_euler = (math.radians(tilt[0]), math.radians(tilt[1]), math.radians(rz))
    scn.collection.objects.link(e); return e

def build_frame_tree():
    ft = S.get("frame_tree")
    if not ft or TREE_OBJ is None: return
    da, dd, s, rz = ft; a = math.radians(YAW + da); x, y = CX + dd * math.sin(a), CY + dd * math.cos(a)
    c = TREE_OBJ.copy(); scn.collection.objects.link(c); c.location = (x, y, surface_z(x, y) - 0.3); c.scale = (s, s, s); c.rotation_euler[2] = math.radians(rz)
    log("frame tree at", round(x, 1), round(y, 1))

def build_grove():
    # a small wind-bent grove around the old tree: a few trees of different sizes, low bushes between them
    if TREE_OBJ is None: return
    tx, ty, _ = TREE
    # clusters, not a row: the old tree with two companions behind it, a pair at the far end, one leaning loner, scrub between
    spots = ((-6, 7, 2.1, 40, 4), (8.7, 16.2, 1.7, 120, -6), (-14, 15, 1.3, 250, 7),          # around the old tree
             (-40, 4, 1.9, 300, -5), (-46, 12, 1.4, 80, 9),                               # the pair near the far end
             (30, 9, 1.6, 20, -4),
             (-55, -5, 1.7, 60, -8), (-60, -8, 1.2, 330, 6), (-34, -3, 1.5, 15, 3), (-64, -2, 0.7, 200, 0), (-58, -9, 0.6, 100, 0),
             (-22, 2, 0.6, 10, 0), (-50, -3, 0.55, 140, 0), (16, -2, 0.6, 260, 0), (-3, -4, 0.5, 330, 0), (24, 14, 0.55, 90, 0))
    rr_ = np.random.default_rng(8)
    kinds = ("island_tree_02", None, "island_tree_03")
    for k, (dx, dy, s, rz, lean) in enumerate(spots):
        x, y = tx + dx, ty + dy
        if s < 1.0:                                                   # scrub: a real shrub model
            place_model("searsia_burchellii", x, y, surface_z(x, y) - 0.1, s * 3.2, rz); continue
        kd = kinds[k % 3]
        if kd:
            place_model(kd, x, y, surface_z(x, y) - 0.25, s * rr_.uniform(1.8, 2.6), rz, (lean, rr_.uniform(-4, 4))); continue
        c = TREE_OBJ.copy(); scn.collection.objects.link(c)
        sq = rr_.uniform(0.85, 1.2)                                                       # wider or narrower crowns
        s = s * 1.25; c.location = (x, y, surface_z(x, y) - 0.25); c.scale = (s * sq, s / sq, s * (0.75 if s < 1 else rr_.uniform(0.7, 1.35)))
        c.rotation_euler = (math.radians(lean), math.radians(rr_.uniform(-4, 4)), math.radians(rz))
    rr2 = np.random.default_rng(44); nr_ = 0
    for x in np.arange(-40.0, 24.0, 4.5):
        if rr2.random() < 0.3: continue
        y = 137.0 + rr2.uniform(-1.0, 2.5); x = x + rr2.uniform(-1.5, 1.5)
        z = surface_z(x, y)
        if z < 12.0 or math.hypot(x - CX, y - CY) < 10.0: continue     # never right in front of a lens on the rim
        place_model("searsia_burchellii", x, y, z - 0.15, rr2.uniform(1.4, 2.6), rr2.uniform(0, 360)); nr_ += 1
    log("grove", len(spots), "rim scrub", nr_)

def build_lgrove():
    # wind-bent trees and scrub on the left headland's top, set back from its cliff edge
    if TREE_OBJ is None: return
    spots = ((-109, 50, 2.4, 300, 10, "island_tree_02"), (-108, 66, 2.0, 140, 12, "tree"), (-110, 75, 1.5, 80, 6, "island_tree_03"), (-106, 58, 0.7, 10, 0, "searsia_burchellii"),
             (-114, 58, 1.6, 30, 8, "island_tree_02"), (-119, 66, 1.2, 200, 6, "island_tree_03"), (-125, 52, 0.7, 0, 0, "searsia_burchellii"),
             (-113, 88, 1.9, 110, 9, "tree"), (-118, 96, 1.3, 260, 4, "island_tree_02"), (-112, 80, 0.6, 50, 0, "searsia_burchellii"),
             (-117, 114, 1.5, 300, 5, "island_tree_03"), (-113, 106, 0.55, 140, 0, "searsia_burchellii"), (-126, 80, 0.8, 20, 0, "searsia_burchellii"),
             (-112, 40, 0.6, 90, 0, "searsia_burchellii"), (-118, 34, 1.4, 70, 7, "island_tree_02"), (-123, 22, 1.1, 160, 3, "tree"))
    rr_ = np.random.default_rng(31); n = 0
    for x, y, s, rz, lean, kd in spots:
        z = surface_z(x, y)
        if z < 4.0: continue
        n += 1
        if kd == "searsia_burchellii": place_model(kd, x, y, z - 0.1, s * 3.2, rz); continue
        if kd == "tree":
            c = TREE_OBJ.copy(); scn.collection.objects.link(c); c.location = (x, y, z - 0.25); c.scale = (s * 1.25,) * 3
            c.rotation_euler = (math.radians(lean), 0.0, math.radians(rz)); continue
        place_model(kd, x, y, z - 0.25, s * rr_.uniform(1.8, 2.4), rz, (lean, rr_.uniform(-4, 4)))
    log("left grove", n)

def build_caps():
    cfg = S.get("caps")
    if not cfg: return
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); r = np.random.default_rng(71); n = 0
    tops = [(x, y, rr, h) for (x, y, rr, h, l) in ROCKS if h >= 12 and math.hypot(x - CX, y - CY) < cfg.get("reach", 600)]
    tops += [(x, y, rr, h) for (x, y, rr, h, l) in S.get("cliff_rocks", ()) if h >= 12]
    ax, ay = ARCH["pos"]; tops.append((ax, ay, 26.0, 60.0))
    for (x, y, rr, h) in tops:
        for _ in range(cfg.get("per", 14)):
            a = r.uniform(0, 2 * math.pi); d = rr * 0.75 * math.sqrt(r.random())
            px, py = x + d * math.cos(a), y + d * math.sin(a)
            hit, p_, nrm, *_ = scn.ray_cast(dg, Vector((px, py, 400.0)), Vector((0, 0, -1)))
            if not hit or p_.z < h * 0.6 or abs(nrm.z) < 0.6: continue          # the arch's faces point inward: use |n|
            if S.get("waterfall") and abs(px - LAG[0]) < 16.0 and py > LAG[1] + 40.0: continue   # never in the falls
            place_model("searsia_burchellii", px, py, p_.z - 0.3, r.uniform(*cfg.get("size", (1.6, 3.2))), r.uniform(0, 360)); n += 1
    log("caps", n)

def build_props():
    for kd, x, y, s_, rz, lean in S.get("props", ()):
        place_model(kd, x, y, surface_z(x, y) - 0.2, s_, rz, (lean, 0.0))
    if S.get("props"): log("props", len(S["props"]))

def build_rim_trees(n):
    if TREE_OBJ is None: return
    lx, ly = LAG; r_ = np.random.default_rng(12)
    for k in range(n):
        a = math.radians(-120 + 240 * k / max(1, n - 1) + r_.uniform(-10, 10)) + math.pi * 0      # around the north half
        rr = r_.uniform(74, 90); x = lx + rr * math.sin(a); y = ly + rr * math.cos(a)
        c = TREE_OBJ.copy(); scn.collection.objects.link(c)
        c.location = (x, y, float(ground(x, y)) - 0.3); s = r_.uniform(1.8, 2.8); c.scale = (s, s, s); c.rotation_euler[2] = r_.uniform(0, 6.28)

def build_trail(points):
    col = (0.62, 0.95, 1.0) if WUWA else (1.0, 0.80, 0.55)
    for k, (x, y) in enumerate(points):
        main = k == 0
        z = 0.45 + 0.1 * k
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16 if main else 0.08, location=(x, y, z), segments=24, ring_count=12)
        o = bpy.context.active_object; o.data.materials.append(emis_mat(f"trail{k}", col, 40.0 if main else 6.0)); no_shadow(o)
        if main:
            pl = bpy.data.lights.new("trail", "POINT"); pl.energy = 60.0; pl.color = col; pl.shadow_soft_size = 0.15
            po = bpy.data.objects.new("trail", pl); po.location = (x, y, z); scn.collection.objects.link(po)

def build_fireflies(n):
    col = (0.85, 1.0, 0.55) if WUWA else (1.0, 0.85, 0.40)
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.014, subdivisions=1, location=(0, 0, -2000))
    proto = bpy.context.active_object; proto.data.materials.append(emis_mat("firefly", col, S.get("ff_glow", 14.0))); no_shadow(proto)
    r_ = np.random.default_rng(31)
    dd = 2.0 + 45 * r_.random(n) ** 1.5; aa = math.radians(YAW) + r_.uniform(-0.75, 0.75, n)
    X = CX + dd * np.sin(aa); Y = CY + dd * np.cos(aa)
    Z = np.maximum(ground(X, Y), 0.05) + r_.uniform(*S.get("ff_z", (0.25, 3.0)), n)
    P = np.stack([X, Y, Z], -1); rot = np.zeros((n, 3)); scl = r_.uniform(0.35, 0.8, n)
    scatter("fireflies", proto, P, rot, scl)

def build_cave():
    cx, cyy = CAVE; fz = CAVE_FLOOR
    c = Vector((cx, cyy, fz + 4.5)); ax_, ay_, az_ = 12.0, 10.0, 7.5
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=256, v_segments=128, radius=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * ax_, v.co.y * ay_, v.co.z * az_))
    from mathutils import noise as mnoise
    opn = []
    for v in bm.verts:
        d = v.co
        a = math.degrees(math.atan2(d.x, d.y)); el = math.degrees(math.atan2(d.z, math.hypot(d.x, d.y)))
        da = abs((a - CAVE_AZ + 180) % 360 - 180)
        rag = 1.0 + 0.22 * mnoise.noise(d.normalized() * 3.0)
        top_ = S.get("cave_top", 34.0) * rag
        lim = 38 * rag * max(0.0, 1 - max(0.0, el) / top_) ** 0.5
        opn.append(min((lim - da) / 20.0, (el + 30.0) / 20.0, (top_ - el) / 12.0))      # > 0 inside the mouth, smooth across faces
    me = bpy.data.meshes.new("cave"); bm.to_mesh(me); bm.free()
    at_ = me.attributes.new("open", "FLOAT", "POINT"); at_.data.foreach_set("value", np.array(opn, np.float32))
    for p_ in me.polygons: p_.use_smooth = True
    o = bpy.data.objects.new("cave", me); scn.collection.objects.link(o); o.location = c
    tx_ = bpy.data.textures.new("caven", "CLOUDS"); tx_.noise_scale = 2.2
    dm = o.modifiers.new("d", "DISPLACE"); dm.texture = tx_; dm.strength = -1.6; dm.texture_coords = "LOCAL"
    tx2 = bpy.data.textures.new("caven2", "CLOUDS"); tx2.noise_scale = 0.5
    dm2 = o.modifiers.new("d2", "DISPLACE"); dm2.texture = tx2; dm2.strength = -0.35; dm2.texture_coords = "LOCAL"
    m, nt, out = new_mat("cave_rock")
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); sock(mp, "Scale").default_value = (0.25, 0.25, 0.25)
    L(nt, tc.outputs["Object"], mp.inputs["Vector"])
    d_ = IMG(nt, tex_path("seaside_rock", "diff"), mp.outputs[0]); n_ = IMG(nt, tex_path("seaside_rock", "nor_gl"), mp.outputs[0], True)
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); L(nt, MIX(nt, 1.0, d_.outputs["Color"], (0.32, 0.30, 0.34), "MULTIPLY"), sock(bs, "Base Color"))
    sock(bs, "Roughness").default_value = 0.55
    nm = nt.nodes.new("ShaderNodeNormalMap"); L(nt, n_.outputs["Color"], nm.inputs["Color"]); L(nt, nm.outputs[0], sock(bs, "Normal"))
    oa = nt.nodes.new("ShaderNodeAttribute"); oa.attribute_name = "open"
    rg = nt.nodes.new("ShaderNodeTexNoise"); sock(rg, "Scale").default_value = 0.9; sock(rg, "Detail").default_value = 8; sock(rg, "Roughness").default_value = 0.65
    L(nt, tc.outputs["Object"], rg.inputs["Vector"])
    field = M(nt, "ADD", oa.outputs["Fac"], M(nt, "MULTIPLY", M(nt, "SUBTRACT", rg.outputs["Fac"], 0.5), 0.55))
    hole = MR(nt, field, -0.01, 0.01)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mxh = nt.nodes.new("ShaderNodeMixShader")
    L(nt, hole, mxh.inputs[0]); L(nt, bs.outputs[0], mxh.inputs[1]); L(nt, tr.outputs[0], mxh.inputs[2])
    L(nt, mxh.outputs[0], out.inputs["Surface"]); me.materials.append(m)
    # a still pool on the floor that mirrors the opening
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=S.get("pool_r", 2.6), fill_type="NGON", location=(cx + 1.5 * math.sin(math.radians(CAVE_AZ)), cyy + 1.5 * math.cos(math.radians(CAVE_AZ)), fz + 0.03))
    pool = bpy.context.active_object; pool.scale = (1.3, 0.8, 1)
    from mathutils import noise as mnoise
    for v in pool.data.vertices:                                    # a ragged, natural outline, not an ellipse
        a_ = math.atan2(v.co.y, v.co.x); k_ = 1 + 0.28 * mnoise.noise(Vector((math.cos(a_) * 1.7, math.sin(a_) * 1.7, 3.0))) + 0.08 * math.sin(a_ * 7)
        v.co.x *= k_; v.co.y *= k_
    # dawn light spilling in through the mouth: a soft, cool fill so the walls and floor read
    fl = bpy.data.lights.new("cave_fill", "AREA"); fl.shape = "RECTANGLE"; fl.size = 14.0; fl.size_y = 9.0
    fl.energy = S.get("cave_fill", 2500.0); fl.color = (0.62, 0.66, 0.95)
    fo = bpy.data.objects.new("cave_fill", fl); scn.collection.objects.link(fo)
    mouth = Vector((cx + 9.5 * math.sin(math.radians(CAVE_AZ)), cyy + 9.5 * math.cos(math.radians(CAVE_AZ)), fz + 5.0))
    fo.location = mouth; fo.rotation_euler = (Vector((cx, cyy, fz + 1.0)) - mouth).to_track_quat("-Z", "Y").to_euler(); fo.visible_glossy = False
    pm, pnt, pout = new_mat("pool"); pb = pnt.nodes.new("ShaderNodeBsdfPrincipled"); sock(pb, "Base Color").default_value = (0.01, 0.012, 0.015, 1)
    sock(pb, "Roughness").default_value = 0.01; L(pnt, pb.outputs[0], pout.inputs["Surface"]); pool.data.materials.append(pm)
    if S.get("pool_rim"):
        # a dark wet rim and stones around it, so the pool sits in the floor instead of floating on it
        rim = pool.copy(); rim.data = pool.data.copy(); scn.collection.objects.link(rim)
        rim.scale = (pool.scale[0] * 1.45, pool.scale[1] * 1.6, 1); rim.location.z -= 0.012
        rm_, rnt, rout = new_mat("pool_rim"); rb = rnt.nodes.new("ShaderNodeBsdfPrincipled"); sock(rb, "Base Color").default_value = (0.02, 0.02, 0.022, 1)
        sock(rb, "Roughness").default_value = 0.18; L(rnt, rb.outputs[0], rout.inputs["Surface"]); rim.data.materials.clear(); rim.data.materials.append(rm_)
        rs_ = np.random.default_rng(9)
        for k in range(S.get("pool_stones", (16, 0.12, 0.45))[0]):
            a_ = rs_.uniform(0, 6.283); rr_ = S.get("pool_r", 2.6) * rs_.uniform(1.15, 1.7)
            bx, by = pool.location.x + rr_ * 1.3 * math.cos(a_), pool.location.y + rr_ * 0.9 * math.sin(a_)
            pb_ = pebble_proto(f"poolrock{k}", k, rs_.uniform(0.35, 0.6)); s_ = rs_.uniform(*S.get("pool_stones", (16, 0.12, 0.45))[1:])
            pb_.location = (bx, by, fz + 0.02); pb_.scale = (s_ * rs_.uniform(1.0, 1.6), s_, s_); pb_.rotation_euler[2] = rs_.uniform(0, 6.283)
    # glowing plants along the walls (faint fungi in the realistic look, bright blue in the WuWa look)
    r_ = np.random.default_rng(44)
    glow = 7.0 if WUWA else S.get("fungi_glow", 0.35)
    gcol = (0.35, 0.75, 1.0) if WUWA else S.get("fungi_col", (0.55, 0.9, 0.7))
    bulb = emis_mat("bulb", gcol, glow)
    stalk, snt, sout = new_mat("stalk"); sb = snt.nodes.new("ShaderNodeBsdfPrincipled"); sock(sb, "Base Color").default_value = (0.05, 0.06, 0.07, 1)
    L(snt, sb.outputs[0], sout.inputs["Surface"])
    for k in range(70):
        a = math.radians(CAVE_AZ + 180 + r_.uniform(-140, 140)); rr = r_.uniform(5.5, 9.5)
        x = cx + rr * math.sin(a); y = cyy + rr * math.cos(a)
        for j in range(r_.integers(2, 6)):
            hx = x + r_.normal(0, 0.18); hy = y + r_.normal(0, 0.18); hh = r_.uniform(0.06, 0.32)
            bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=hh, location=(hx, hy, fz + hh / 2)); s_ = bpy.context.active_object; s_.data.materials.append(stalk)
            bpy.ops.mesh.primitive_uv_sphere_add(radius=r_.uniform(0.018, 0.045), segments=12, ring_count=6, location=(hx, hy, fz + hh)); b_ = bpy.context.active_object
            b_.scale = (1, 1, 0.6); b_.data.materials.append(bulb); no_shadow(b_)
    nw_ = S.get("wall_fungi", 0)
    if nw_:
        # clusters on the walls themselves (found by casting from the cave's centre to the displaced rock), lighting their patch of rock
        bpy.context.view_layer.update(); dg_ = bpy.context.evaluated_depsgraph_get(); placed = 0
        for k in range(nw_ * 3):
            if placed >= nw_: break
            a = math.radians(CAVE_AZ + math.copysign(r_.uniform(45, 150), r_.uniform(-1, 1))); el = math.radians(r_.uniform(-25, 30))
            dv = Vector((math.sin(a) * math.cos(el), math.cos(a) * math.cos(el), math.sin(el)))
            hit, hp, hn, *_ = scn.ray_cast(dg_, c, dv)
            if not hit or hp.z < fz + 0.3: continue
            placed += 1
            for j in range(r_.integers(3, 8)):
                q = hp + Vector((r_.normal(0, 0.15), r_.normal(0, 0.15), r_.normal(0, 0.12))) - dv * 0.06
                bpy.ops.mesh.primitive_uv_sphere_add(radius=r_.uniform(0.02, 0.05), segments=12, ring_count=6, location=q); b_ = bpy.context.active_object
                b_.data.materials.append(bulb); no_shadow(b_)
        log("wall fungi", placed)
    # vines hanging from the lip of the opening
    vcol = (0.40, 0.28, 0.78) if WUWA else (0.035, 0.06, 0.025)
    vm, vnt, vout = new_mat("vine"); vb = vnt.nodes.new("ShaderNodeBsdfPrincipled"); sock(vb, "Base Color").default_value = (*vcol, 1); sock(vb, "Roughness").default_value = 0.6
    if WUWA: sock(vb, "Emission Color").default_value = (0.55, 0.4, 1.0, 1); sock(vb, "Emission Strength").default_value = 0.25
    L(vnt, vb.outputs[0], vout.inputs["Surface"])
    vcfg = S.get("vines", dict(n=46, side=0.0, bevel=0.012, leaves=10, leaf=(0.06, 0.12), ln=(1.0, 4.5)))
    from mathutils import noise as mnoise
    # one leaf mesh (a pointed oval with a slight fold), instanced for every leaf
    lv = [(0.0, -0.5, 0.0)] + [(0.28 * math.sin(math.pi * t) * (1.0 - 0.3 * t), -0.5 + t, 0.06 * math.sin(math.pi * t)) for t in (0.2, 0.4, 0.6, 0.8)] + [(0.0, 0.5, 0.0)] + \
         [(-0.28 * math.sin(math.pi * t) * (1.0 - 0.3 * t), -0.5 + t, 0.06 * math.sin(math.pi * t)) for t in (0.8, 0.6, 0.4, 0.2)]
    leaf_me = bpy.data.meshes.new("leaf"); leaf_me.from_pydata(lv, [], [tuple(range(len(lv)))]); leaf_me.update(); leaf_me.materials.append(vm)
    for k in range(vcfg["n"]):
        da = r_.uniform(-30, 30)
        if vcfg["side"] > 0: da = math.copysign(r_.uniform(vcfg["side"], 31.0), r_.uniform(-1, 1))     # hang at the sides, keep the view open
        a = math.radians(CAVE_AZ + da)
        el = math.radians((S.get("cave_top", 34.0) - 4.0) * max(0.0, 1 - (abs(da) / 34) ** 2) ** 0.5)
        top = c + Vector((ax_ * math.sin(a) * math.cos(el), ay_ * math.cos(a) * math.cos(el), az_ * math.sin(el))) * 0.93
        if vcfg.get("anchor"):
            # walk up from the opening until the shell is solid rock (the same 'open' field the material cuts with, plus margin
            # for its noise), then cast onto the displaced wall: the vine starts on rock, just inside it
            hitp = None
            for el_d in range(-5, 80, 1):
                e_ = math.radians(el_d)
                dv = Vector((ax_ * math.sin(a) * math.cos(e_), ay_ * math.cos(a) * math.cos(e_), az_ * math.sin(e_)))
                dn = dv.normalized(); a_d = math.degrees(math.atan2(dn.x, dn.y)); eld = math.degrees(math.atan2(dn.z, math.hypot(dn.x, dn.y)))
                ra_ = 1.0 + 0.22 * mnoise.noise(dn * 3.0)
                tp_ = S.get("cave_top", 34.0) * ra_; lm_ = 38 * ra_ * max(0.0, 1 - max(0.0, eld) / tp_) ** 0.5
                op_ = min((lm_ - abs((a_d - CAVE_AZ + 180) % 360 - 180)) / 20.0, (eld + 30.0) / 20.0, (tp_ - eld) / 12.0)
                if el_d > 0 and op_ < -0.4:
                    bpy.context.view_layer.update(); dg_v = bpy.context.evaluated_depsgraph_get()
                    hit_, hp_, hn_, *_ = scn.ray_cast(dg_v, c, dn)
                    if hit_: hitp = hp_ - dn * 0.15
                    break
            if hitp is None: continue
            top = hitp
        ln = r_.uniform(*vcfg["ln"]); n = 12
        cu = bpy.data.curves.new("vine", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = vcfg["bevel"]
        sp = cu.splines.new("POLY"); sp.points.add(n - 1)
        sw_ = r_.uniform(-0.3, 0.3)
        for i in range(n):
            tt = i / (n - 1); sp.points[i].co = (top.x + sw_ * tt * tt, top.y + 0.2 * math.sin(tt * 3 + k), top.z - ln * tt, 1)
        vo = bpy.data.objects.new("vine", cu); scn.collection.objects.link(vo); vo.data.materials.append(vm)
        for i in range(vcfg["leaves"]):
            tt = r_.random() ** 0.7; p_ = (top.x + sw_ * tt * tt + r_.normal(0, 0.09), top.y + 0.2 * math.sin(tt * 3 + k) + r_.normal(0, 0.09), top.z - ln * tt)
            lf = bpy.data.objects.new("leaf", leaf_me); scn.collection.objects.link(lf); lf.location = p_
            ls_ = r_.uniform(*vcfg["leaf"]) * 1.6; lf.scale = (ls_, ls_, ls_)
            lf.rotation_euler = (r_.uniform(1.0, 2.2), r_.uniform(-0.6, 0.6), r_.uniform(0, 6.283))     # hanging, tips down, turned at random
    if S.get("wet_floor"):
        R_ = 10.5; st_ = 0.12
        xs_ = np.arange(-R_, R_, st_); X_, Y_ = np.meshgrid(xs_, xs_); X_ = X_ + cx; Y_ = Y_ + cyy
        Zr = fz + 0.03 + 0.18 * fbm(X_ * 0.6 + 3, Y_ * 0.6 + 1, 4) + 0.05 * fbm(X_ * 3.0, Y_ * 3.0, 3)
        ny_, nx_ = Z_shape = Zr.shape; vv = np.stack([X_, Y_, Zr], -1).reshape(-1, 3)
        ii = np.arange(ny_ - 1)[:, None] * nx_; jj = np.arange(nx_ - 1)[None, :]; aa_ = (ii + jj).ravel()
        ff = np.stack([aa_, aa_ + 1, aa_ + nx_ + 1, aa_ + nx_], -1)
        inside = (np.hypot(X_[:-1, :-1] - cx, Y_[:-1, :-1] - cyy) < 9.6).ravel()
        fob, fme = make_mesh("cave_floor", vv, ff[inside])
        for p_ in fme.polygons: p_.use_smooth = True
        fm_, fnt, fout = new_mat("cave_floor")
        ftc = fnt.nodes.new("ShaderNodeTexCoord"); fmp = fnt.nodes.new("ShaderNodeMapping"); sock(fmp, "Scale").default_value = (0.35, 0.35, 0.35); L(fnt, ftc.outputs["Object"], fmp.inputs["Vector"])
        fd = IMG(fnt, tex_path("seaside_rock", "diff"), fmp.outputs[0]); fn_ = IMG(fnt, tex_path("seaside_rock", "nor_gl"), fmp.outputs[0], True)
        fb = fnt.nodes.new("ShaderNodeBsdfPrincipled"); L(fnt, MIX(fnt, 1.0, fd.outputs["Color"], (0.30, 0.29, 0.31), "MULTIPLY"), sock(fb, "Base Color"))
        pz = fnt.nodes.new("ShaderNodeTexNoise"); sock(pz, "Scale").default_value = 0.45; sock(pz, "Detail").default_value = 5; L(fnt, ftc.outputs["Object"], pz.inputs["Vector"])
        wet_ = MR(fnt, pz.outputs["Fac"], 0.47, 0.56)                                     # 1 = standing water
        L(fnt, MR(fnt, wet_, 0.0, 1.0, 0.45, 0.03), sock(fb, "Roughness"))
        fnm = fnt.nodes.new("ShaderNodeNormalMap"); L(fnt, MIX(fnt, wet_, fn_.outputs["Color"], (0.5, 0.5, 1.0)), fnm.inputs["Color"]); L(fnt, fnm.outputs[0], sock(fb, "Normal"))
        L(fnt, fb.outputs[0], fout.inputs["Surface"]); fme.materials.append(fm_)
        log("wet floor", len(fme.polygons))
    log("cave floor", fz)

def build_plankton():
    """Glowing plankton in the shallows: tiny cyan points clustered in drifts where the water is ankle-deep."""
    cfg = S.get("plankton")
    if not cfg: return
    r = np.random.default_rng(23)
    n = cfg.get("n", 4000)
    d = 2.0 + cfg.get("reach", 90.0) * r.random(n * 12) ** 1.5; a = math.radians(YAW) + r.uniform(-0.9, 0.9, n * 12)
    X = CX + d * np.sin(a); Y = CY + d * np.cos(a); depth = -ground(X, Y)
    drift = fbm(X * 0.08 + 2, Y * 0.08 + 6, 4); streak = fbm(X * 0.5 + 1, Y * 0.12 + 3, 3)
    fade = np.clip(1.5 - np.hypot(X - CX, Y - CY) / cfg.get("fade", 1e9), 0.0, 1.0)
    ok = (depth > 0.02) & (depth < 0.7) & (r.random(len(X)) < sm(0.5, 0.68, drift) * sm(0.35, 0.6, streak) * fade)
    X, Y = X[ok][:n], Y[ok][:n]; m = len(X)
    P = np.stack([X, Y, np.full(m, S.get("tide", 0.0) + 0.012)], -1)
    bpy.ops.mesh.primitive_ico_sphere_add(radius=cfg.get("size", 0.012), subdivisions=1, location=(0, 0, -2000))
    proto = bpy.context.active_object; proto.data.materials.append(emis_mat("plankton", cfg.get("col", (0.25, 0.85, 1.0)), cfg.get("strength", 6.0)))
    no_shadow(proto)
    dd = np.hypot(X - CX, Y - CY)
    scatter("plankton", proto, P, np.zeros((m, 3)), r.uniform(0.5, 1.2, m) * np.clip(dd / 18.0, 0.25, 1.6))   # same apparent size near and far
    log("plankton", m)

def build_lanterns():
    """Dusk: floating paper lanterns drifting out of the cove toward the arch (warm points and their reflections)."""
    cfg = S.get("lanterns")
    if not cfg: return
    r = np.random.default_rng(61)
    (x0, y0), (x1, y1) = cfg["path"]; n = cfg.get("n", 36)
    t = r.random(n) ** cfg.get("bunch", 1.4)
    dx, dy = x1 - x0, y1 - y0; ln = math.hypot(dx, dy); ux, uy = dx / ln, dy / ln
    side = r.normal(0, 1, n) * (cfg.get("w0", 3.0) + cfg.get("w1", 14.0) * t)
    X = x0 + dx * t - uy * side; Y = y0 + dy * t + ux * side
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=cfg.get("r", 0.28), depth=cfg.get("h", 0.40), location=(0, 0, -2000))
    proto = bpy.context.active_object
    proto.data.materials.append(emis_mat("lantern", cfg.get("col", (1.0, 0.55, 0.25)), cfg.get("strength", 18.0))); no_shadow(proto)
    P_ = np.stack([X, Y, np.full(n, cfg.get("z", 0.2))], -1)
    scatter("lanterns", proto, P_, np.stack([r.normal(0, 0.06, n), r.normal(0, 0.06, n), r.uniform(0, 6.283, n)], -1), r.uniform(0.8, 1.2, n))
    log("lanterns", n)

def aurora_mat(name, cfg, strength, seed):
    """A natural-looking aurora curtain: a wobbling bright lower edge (warped inside the strip, not the strip's border),
    soft rays of very different lengths dissolving upward, brightness that gathers in knots and fades in gaps,
    yellow-green at the edge, green above, violet at the top."""
    m, nt, out = new_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tc.outputs["UV"], sep.inputs[0])
    u, v = sep.outputs["X"], sep.outputs["Y"]
    def noise1d(scale_u, scale_v, off, detail=2, rough=0.5):
        mp_ = nt.nodes.new("ShaderNodeMapping"); sock(mp_, "Scale").default_value = (scale_u, scale_v, 1.0); sock(mp_, "Location").default_value = (off, off * 0.7, 0.0)
        L(nt, tc.outputs["UV"], mp_.inputs["Vector"])
        n_ = nt.nodes.new("ShaderNodeTexNoise"); sock(n_, "Scale").default_value = 1.0; sock(n_, "Detail").default_value = detail; sock(n_, "Roughness").default_value = rough
        L(nt, mp_.outputs[0], n_.inputs["Vector"]); return n_.outputs["Fac"]
    L_ = cfg.get("len", 1.0)                                   # the strip's length in "curtain units" (keeps rays the same size on long and short bands)
    warp = M(nt, "MULTIPLY", MR(nt, noise1d(5.0 * L_, 0.0, seed, 2, 0.45), 0.3, 0.7), cfg.get("warp", 0.16))
    vw = M(nt, "SUBTRACT", v, warp)                            # the lower edge wobbles up and down inside the strip
    foot = MR(nt, vw, 0.0, cfg.get("foot", 0.07))
    rays = MR(nt, noise1d(cfg.get("rays", 60.0) * L_, 0.8, seed + 3.1, 2, 0.45), 0.3, 0.78, cfg.get("ray_min", 0.3), 1.0)
    rl = MR(nt, noise1d(cfg.get("rays", 60.0) * 0.3 * L_, 0.0, seed + 7.7, 2, 0.5), 0.3, 0.7, 0.25, 1.0)   # each ray's own length
    fade = M(nt, "POWER", MR(nt, M(nt, "SUBTRACT", 1.0, M(nt, "DIVIDE", vw, rl)), 0.0, 1.0), 1.7)
    knots = M(nt, "POWER", MR(nt, noise1d(4.0 * L_, 0.0, seed + 2.3, 3, 0.6), 0.32, 0.72, 0.0, 1.0), 1.4)   # bright knots, faint gaps
    edge = M(nt, "MULTIPLY", MR(nt, u, 0.0, 0.08), MR(nt, u, 1.0, 0.92))
    curtain = M(nt, "MULTIPLY", M(nt, "MULTIPLY", rays, fade), foot)
    haze = M(nt, "MULTIPLY", foot, M(nt, "POWER", MR(nt, vw, 1.0, 0.0), 1.3))
    a = M(nt, "MULTIPLY", M(nt, "ADD", curtain, M(nt, "MULTIPLY", haze, cfg.get("haze", 0.3))), M(nt, "MULTIPLY", knots, edge))
    c1 = MIX(nt, MR(nt, vw, 0.0, 0.2), cfg.get("core", (0.62, 1.0, 0.35)), cfg.get("low", (0.10, 1.0, 0.50)))
    col = MIX(nt, MR(nt, vw, 0.4, 0.95), c1, cfg.get("high", (0.72, 0.30, 0.95)))
    em = nt.nodes.new("ShaderNodeEmission"); L(nt, col, em.inputs["Color"]); L(nt, M(nt, "MULTIPLY", a, strength), em.inputs["Strength"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    ad = nt.nodes.new("ShaderNodeAddShader"); L(nt, tr.outputs[0], ad.inputs[0]); L(nt, em.outputs[0], ad.inputs[1]); L(nt, ad.outputs[0], out.inputs["Surface"])
    return m

def build_aurora_sky(cfg):
    """Curtains laid out on a dome around the viewer in sky angles: (az0, az1, el0, height, fold, brightness) per band, az relative to
    the view. The base line folds and drifts in elevation, the height changes along the band, and a big fold can swing back on itself."""
    from mathutils import noise as mnoise
    R = cfg.get("dist", 2500.0)
    for b, (az0, az1, el0, el1, hel, amp, k) in enumerate(cfg["sky_bands"]):
        NU, NV = 260, 10
        span = abs(az1 - az0) / 60.0
        m = aurora_mat(f"aurora{b}", dict(cfg, len=span), cfg.get("strength", 3.0) * k, 11.0 * b + 3.0)
        verts, faces, uvs = [], [], []
        for i in range(NU + 1):
            t = i / NU; q = Vector((t * 2.6 + b * 5.3, b * 1.7, 0.4))
            az = az0 + (az1 - az0) * t + amp * 1.6 * mnoise.noise(q)                                   # folds sideways (can swing back)
            el = el0 + (el1 - el0) * t + amp * mnoise.noise(q * 1.3 + Vector((3.1, 0, 0))) + 0.4 * amp * math.sin(t * math.pi * 1.4 + b)   # sweeps diagonally
            h = hel * (0.6 + 0.8 * (0.5 + 0.5 * mnoise.noise(q * 2.1 + Vector((0, 4.2, 0)))))
            for j in range(NV + 1):
                sv = j / NV; e_ = math.radians(el + h * sv); a_ = math.radians(YAW + az + cfg.get("lean", 2.0) * sv)
                verts.append((CX + R * math.sin(a_) * math.cos(e_), CY + R * math.cos(a_) * math.cos(e_), CZ + R * math.sin(e_))); uvs.append((t, sv))
        for i in range(NU):
            for j in range(NV):
                a0 = i * (NV + 1) + j; faces.append((a0, a0 + NV + 1, a0 + NV + 2, a0 + 1))
        o = _mesh_obj(f"aurora{b}", verts, faces, uvs, [m]); o.location = (0, 0, 0)
        o.visible_shadow = False; o.visible_diffuse = bool(cfg.get("light", False))
    log("aurora (sky bands)", len(cfg["sky_bands"]))

def build_aurora():
    """Aurora curtains: a few tall, wavy ribbons far off in the sky, glowing green at the foot and violet at the top,
    streaked vertically and see-through, so they read as light, not as a wall."""
    cfg = S.get("aurora")
    if not cfg: return
    if cfg.get("sky_bands"): return build_aurora_sky(cfg)
    from mathutils import noise as mnoise
    m, nt, out = new_mat("aurora")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, tc.outputs["UV"], sep.inputs[0])
    u, v = sep.outputs["X"], sep.outputs["Y"]
    # rays: noise stretched tall (fine across, smooth upward); patches: slow brightness changes along the curtain
    mr = nt.nodes.new("ShaderNodeMapping"); sock(mr, "Scale").default_value = (cfg.get("rays", 90.0), 1.2, 1.0); L(nt, tc.outputs["UV"], mr.inputs["Vector"])
    nr = nt.nodes.new("ShaderNodeTexNoise"); sock(nr, "Scale").default_value = 1.0; sock(nr, "Detail").default_value = 3; sock(nr, "Roughness").default_value = 0.6
    L(nt, mr.outputs[0], nr.inputs["Vector"])
    mp_ = nt.nodes.new("ShaderNodeMapping"); sock(mp_, "Scale").default_value = (5.0, 0.8, 1.0); L(nt, tc.outputs["UV"], mp_.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise"); sock(nz, "Scale").default_value = 1.0; sock(nz, "Detail").default_value = 2; L(nt, mp_.outputs[0], nz.inputs["Vector"])
    rays = MR(nt, nr.outputs["Fac"], 0.35, 0.75, cfg.get("ray_min", 0.1), 1.0)
    patch = MR(nt, nz.outputs["Fac"], 0.35, 0.72, 0.15, 1.0)                       # folds: bright and dim stretches along the curtain
    edge = M(nt, "MULTIPLY", MR(nt, u, 0.0, 0.12), MR(nt, u, 1.0, 0.88))
    foot = MR(nt, v, 0.0, cfg.get("foot", 0.05))                                   # crisp bright lower edge
    if cfg.get("style2"):
        # every ray has its own length: a noise that only varies along the curtain sets where it fades out
        ml = nt.nodes.new("ShaderNodeMapping"); sock(ml, "Scale").default_value = (cfg.get("rays", 90.0) * 0.35, 0.0, 0.0); L(nt, tc.outputs["UV"], ml.inputs["Vector"])
        nl = nt.nodes.new("ShaderNodeTexNoise"); sock(nl, "Scale").default_value = 1.0; sock(nl, "Detail").default_value = 2; L(nt, ml.outputs[0], nl.inputs["Vector"])
        rl = MR(nt, nl.outputs["Fac"], 0.3, 0.7, 0.3, 1.0)
        fade = M(nt, "POWER", MR(nt, M(nt, "SUBTRACT", 1.0, M(nt, "DIVIDE", v, rl)), 0.0, 1.0), 1.5)
        curtain = M(nt, "MULTIPLY", M(nt, "MULTIPLY", M(nt, "MULTIPLY", rays, fade), foot), M(nt, "MULTIPLY", patch, edge))
        haze = M(nt, "MULTIPLY", M(nt, "MULTIPLY", foot, M(nt, "POWER", MR(nt, v, 1.0, 0.0), 1.2)), M(nt, "MULTIPLY", patch, edge))
        a = M(nt, "ADD", curtain, M(nt, "MULTIPLY", haze, cfg.get("haze", 0.35)))
        c1 = MIX(nt, MR(nt, v, 0.02, 0.22), cfg.get("core", (0.62, 1.0, 0.35)), cfg.get("low", (0.12, 1.0, 0.5)))   # yellow-green edge -> green
        col = MIX(nt, MR(nt, v, 0.42, 0.95), c1, cfg.get("high", (0.7, 0.32, 0.95)))                             # -> violet tops
    else:
        foot = M(nt, "MULTIPLY", MR(nt, v, 0.0, 0.12), M(nt, "POWER", MR(nt, v, 1.0, 0.0), 1.8))
        a = M(nt, "MULTIPLY", M(nt, "MULTIPLY", M(nt, "MULTIPLY", rays, patch), foot), edge)
        col = MIX(nt, MR(nt, v, 0.45, 0.95), cfg.get("low", (0.25, 1.0, 0.55)), cfg.get("high", (0.65, 0.35, 1.0)))
    em = nt.nodes.new("ShaderNodeEmission"); L(nt, col, em.inputs["Color"]); L(nt, M(nt, "MULTIPLY", a, cfg.get("strength", 3.0)), em.inputs["Strength"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    ad = nt.nodes.new("ShaderNodeAddShader"); L(nt, tr.outputs[0], ad.inputs[0]); L(nt, em.outputs[0], ad.inputs[1]); L(nt, ad.outputs[0], out.inputs["Surface"])
    R = cfg.get("dist", 2500.0)
    for b, (az0, az1, z0, h, wob) in enumerate(cfg.get("bands", ((-40, 35, 250, 700, 1.0),))):
        verts, faces, uvs = [], [], []; NU, NV = 120, 6
        for i in range(NU + 1):
            t = i / NU; az = math.radians(YAW + az0 + (az1 - az0) * t)
            rr = R * (1 + cfg.get("sway", 0.0) * math.sin(t * math.pi * 1.6 + b * 1.9) + 0.12 * wob * mnoise.noise(Vector((t * 3, b * 7.0, 0))))   # S-curves in depth
            x, y = CX + rr * math.sin(az), CY + rr * math.cos(az)
            zz = z0 * (1 + 0.18 * math.sin(t * math.pi * 1.2 + b)) + 80 * wob * mnoise.noise(Vector((t * 4, b * 3.0, 1)))
            for j in range(NV + 1):
                s = j / NV; verts.append((x, y, zz + h * s)); uvs.append((t, s))
        for i in range(NU):
            for j in range(NV):
                a0 = i * (NV + 1) + j; faces.append((a0, a0 + NV + 1, a0 + NV + 2, a0 + 1))
        o = _mesh_obj(f"aurora{b}", verts, faces, uvs, [m]); o.location = (0, 0, 0)
        o.visible_shadow = False; o.visible_diffuse = bool(cfg.get("light", False))
    log("aurora", len(cfg.get("bands", ())))

def build_cloudsea():
    """A sea of cloud filling the valleys: a billowing surface at a set height; hilltops above it stand out as islands.
    Soft, bright tops (translucent + a little glow from the moon side), darker hollows between the billows."""
    cfg = S.get("cloudsea")
    if not cfg: return
    z0, x0, x1, y0, y1, step = cfg["z"], *cfg["box"], cfg.get("step", 4.0)
    xs = np.arange(x0, x1, step); ys = np.arange(y0, y1, step); X, Y = np.meshgrid(xs, ys)
    b1 = fbm(X * 0.006 + 3, Y * 0.006 + 7, 4); b2 = fbm(X * 0.03 + 1, Y * 0.03 + 5, 4); b3 = fbm(X * 0.12, Y * 0.12, 3)
    amp = cfg.get("amp", 14.0)
    Z = z0 + amp * (b1 - 0.5) + amp * 0.45 * (1 - np.abs(2 * b2 - 1)) + 1.5 * (b3 - 0.5)        # rolling swells with billowed crests
    ny, nx = Z.shape; verts = np.stack([X, Y, Z], -1).reshape(-1, 3)
    i = np.arange(ny - 1)[:, None] * nx; j = np.arange(nx - 1)[None, :]
    a = (i + j).ravel(); faces = np.stack([a, a + 1, a + nx + 1, a + nx], -1)
    keep = (Z[:-1, :-1] > ground(X[:-1, :-1], Y[:-1, :-1]) - 2.0).ravel()      # no cloud buried inside hills
    ob, me = make_mesh("cloudsea", verts, faces[keep])
    fe = cfg.get("feather", 0.0)
    if fe > 0: point_attr(me, "thick", np.clip((Z - ground(X, Y)) / fe, 0.0, 1.0).ravel())
    m, nt, out = new_mat("cloudsea")
    geo = nt.nodes.new("ShaderNodeNewGeometry"); sz = nt.nodes.new("ShaderNodeSeparateXYZ"); L(nt, geo.outputs["Position"], sz.inputs[0])
    hgt = MR(nt, sz.outputs["Z"], z0 - cfg.get("amp", 14.0) * 0.5, z0 + cfg.get("amp", 14.0) * 0.7)                                     # tops bright, hollows shaded
    col = MIX(nt, hgt, cfg.get("low", (0.30, 0.34, 0.50)), cfg.get("high", (0.86, 0.90, 1.0)))
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); L(nt, col, sock(bs, "Base Color")); sock(bs, "Roughness").default_value = 1.0
    try:
        sock(bs, "Subsurface Weight").default_value = 1.0; sock(bs, "Subsurface Radius").default_value = (3.0, 3.0, 3.5); sock(bs, "Subsurface Scale").default_value = 4.0
    except KeyError:
        pass
    tl = nt.nodes.new("ShaderNodeBsdfTranslucent"); L(nt, col, tl.inputs["Color"])
    mx = nt.nodes.new("ShaderNodeMixShader"); mx.inputs[0].default_value = 0.35; L(nt, bs.outputs[0], mx.inputs[1]); L(nt, tl.outputs[0], mx.inputs[2])
    em = nt.nodes.new("ShaderNodeEmission"); L(nt, col, em.inputs["Color"]); L(nt, M(nt, "MULTIPLY", hgt, cfg.get("glow", 0.05)), em.inputs["Strength"])
    ad = nt.nodes.new("ShaderNodeAddShader"); L(nt, mx.outputs[0], ad.inputs[0]); L(nt, em.outputs[0], ad.inputs[1])
    if fe > 0:      # thin out over the last few metres above the ground: hills sink softly into the cloud instead of a cut line
        at_ = nt.nodes.new("ShaderNodeAttribute"); at_.attribute_name = "thick"
        tr_ = nt.nodes.new("ShaderNodeBsdfTransparent"); mf_ = nt.nodes.new("ShaderNodeMixShader")
        L(nt, M(nt, "POWER", at_.outputs["Fac"], 0.7), mf_.inputs[0]); L(nt, tr_.outputs[0], mf_.inputs[1]); L(nt, ad.outputs[0], mf_.inputs[2]); L(nt, mf_.outputs[0], out.inputs["Surface"])
    else:
        L(nt, ad.outputs[0], out.inputs["Surface"])
    me.materials.append(m); log("cloud sea", int(keep.sum()), "faces")

def build_extras():
    if S.get("waterfall"): build_waterfall()
    if S.get("rim_trees"): build_rim_trees(S["rim_trees"])
    if S.get("trail"): build_trail(S["trail"])
    if S.get("fireflies"): build_fireflies(S["fireflies"])
    for fb in S.get("fog_boxes", ()): build_fogbox(*fb)
    if S.get("moon"): build_moon(*S["moon"])
    if S.get("cave"): build_cave()
    build_plankton()
    build_lanterns()
    build_aurora()
    build_cloudsea()

def build_camera():
    cd = bpy.data.cameras.new("cam"); cd.lens = S["lens"]; cd.clip_start = 0.05; cd.clip_end = 20000
    cd.dof.use_dof = True; cd.dof.focus_distance = S["focus"]; cd.dof.aperture_fstop = S["fstop"]
    cam = bpy.data.objects.new("cam", cd); scn.collection.objects.link(cam); scn.camera = cam
    cam.location = (CX, CY, CZ)
    yaw, pitch = S["look"]
    cam.rotation_euler = sun_dir(pitch, yaw).to_track_quat("-Z", "Y").to_euler()

build_terrain()
build_sea()
build_cliffs()
build_rocks()
build_shelf()
if S.get("cam_surface"):
    CZ = surface_z(CX, CY) + CH; log("camera on surface at", CZ)
if S.get("cam_cave"):
    CZ = CAVE_FLOOR + CH
if GRASS > 0: build_grass()
build_beach()
build_tree()
if S.get("grove"): build_grove()
if S.get("lgrove"): build_lgrove()
build_frame_tree()
build_arch()
build_caps()
build_props()
build_sky()
build_mist()
build_extras()
build_camera()
log("scene built")
if SAVE: bpy.ops.wm.save_as_mainfile(filepath=SAVE)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
scn.render.filepath = OUT
bpy.ops.render.render(write_still=True)
log("RENDERED", OUT)
if arg("--grade", 1):
    sys.path.insert(0, HERE)
    import grade
    grade.grade(OUT, OUT[:-4] if OUT.lower().endswith(".exr") else OUT, S["expo"], S["fog"], S["fog_amt"])
    log("GRADED", OUT)
