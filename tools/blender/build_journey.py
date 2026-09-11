"""Author fifteen distinct, material-batched discovery environments in Blender.

Coordinates below are game-space x, height, depth; exports are Y-up GLBs.
The central navigation area stays flat and clear. Scenic architecture is outside it.
"""
import bpy
import math
import json
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "models"
SOURCE = ROOT / "assets" / "blender"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def mat(name, color, metal=0, rough=.8, glow=0):
    m = bpy.data.materials.new("Journey " + name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if glow:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = glow
    return m

stone = mat("Limestone", (.52, .57, .61))
dark = mat("Graphite", (.045, .07, .1), .3, .5)
white = mat("Ivory", (.8, .83, .8), .15, .5)
metal = mat("Steel", (.2, .34, .4), .65, .4)
wood = mat("Wood", (.32, .17, .09))
red = mat("Barn", (.65, .18, .13))
green = mat("Leaves", (.13, .35, .12))
gold = mat("Wheat", (.65, .53, .18))
cyan = mat("Cyan lamps", (.05, .68, .8), .1, .35, 1)
amber = mat("Amber lamps", (.98, .55, .12), .1, .4, 1)
pink = mat("Coral", (.76, .16, .36))
violet = mat("Violet life", (.3, .15, .7), 0, .6, .5)
water = mat("Water", (.035, .27, .42), .15, .3)
cloud = mat("Cloud", (.76, .84, .92))
nightcloud = mat("Storm cloud", (.24, .29, .44))
moon = mat("Regolith", (.49, .49, .52))

def co(x, y, z): return (x, -z, y)
def finish(obj, name, material):
    obj.name = name
    obj.data.materials.append(material)
    obj.parent = active_root
    return obj
def box(name, x, y, z, sx, sy, sz, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=co(x, y, z))
    obj = bpy.context.object
    obj.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Crafted edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, material)
def ball(name, x, y, z, sx, sy, sz, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, location=co(x, y, z))
    obj = bpy.context.object
    obj.scale = (sx, sz, sy)
    for face in obj.data.polygons: face.use_smooth = True
    return finish(obj, name, material)
def cyl(name, x, y, z, radius, height, material, top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius, radius2=radius if top is None else top, depth=height, location=co(x, y, z))
    return finish(bpy.context.object, name, material)
def beam(name, a, b, radius, material):
    av, bv = Vector(co(*a)), Vector(co(*b))
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=(bv-av).length, location=(av+bv)/2)
    obj = bpy.context.object
    obj.rotation_euler = (bv-av).to_track_quat("Z", "Y").to_euler()
    return finish(obj, name, material)
def ring(name, x, y, z, radius, thickness, material, vertical=False):
    bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=8, location=co(x,y,z), major_radius=radius, minor_radius=thickness)
    obj = bpy.context.object
    if vertical: obj.rotation_euler.x = math.pi/2
    return finish(obj, name, material)
def ground(material, height=.4): box("Navigable ground", 0, height-.4, 0, 65, .8, 65, material)

def sample(glass=False):
    for i in range(5 if glass else 3):
        a=i*2.399
        x,z=math.cos(a)*.5,math.sin(a)*.5
        if glass:
            cyl("Impact glass crystal",x,.6+i*.13,z,.22,1+i*.2,cyan,0)
        else:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.65,location=co(x,.35,z))
            obj=bpy.context.object
            obj.scale=(1,.8,.65+i*.2)
            finish(obj,"Fractured basalt",dark)
def roof(x, y, z, width, depth, height, material):
    verts = [co(x+dx,y+dy,z+dz) for dx,dy,dz in [(-width/2,0,-depth/2),(width/2,0,-depth/2),(0,height,-depth/2),(-width/2,0,depth/2),(width/2,0,depth/2),(0,height,depth/2)]]
    mesh = bpy.data.meshes.new("Pitched roof")
    mesh.from_pydata(verts, [], [(0,1,2),(3,5,4),(0,2,5,3),(2,1,4,5),(0,3,4,1)])
    obj = bpy.data.objects.new("Pitched roof", mesh); bpy.context.collection.objects.link(obj)
    return finish(obj, "Pitched roof", material)
def tree(x,z,scale=1):
    cyl("Tree trunk",x,1.7*scale,z,.24*scale,3*scale,wood)
    ball("Tree canopy",x,3.7*scale,z,1.8*scale,2*scale,1.5*scale,green)
def windows(x,z,width,height):
    for ix in range(max(1,int(width/1.4))):
        for iy in range(max(1,int((height-1)/1.5))):
            box("Window recess",x-width/2+.8+ix*1.4,1.6+iy*1.5,z,.7,.85,.08,cyan if iy%2 else amber)
def city(home=False):
    ground(mat("Festival paving" if home else "City paving",(.22,.28,.39) if home else (.4,.46,.49)))
    box("Main avenue",0,.42,0,7,.025,60,dark)
    box("Cross street",0,.43,1,52,.025,4,dark)
    for x in [-19,-12,12,20]:
        h=5+(abs(x)%4)*1.5
        box("City block",x,h/2+.4,-23,6,h,6,white if x<0 else stone,.15)
        box("Roof cornice",x,h+.5,-23,6.5,.3,6.5,metal,.08)
        windows(x,-19.95,6,h)
    for x in [-22,22]:
        for z in [-6,8]:
            box("Side kiosk",x,2,z,4,3,5,red if home else metal,.15)
            roof(x,3.5,z,4.5,5.6,1,white)
    for z in [5,9]:
        for x in [-2,-1,0,1,2]: box("Crosswalk",x,.47,z,.5,.035,1.2,white)
    for x in [-17,17]:
        for z in [-12,0,12]:
            cyl("Street lamp",x,2.3,z,.1,3.8,metal)
            ball("Lamp globe",x,4.3,z,.35,.35,.35,amber)
    if home:
        box("Museum facade",0,3,-21,13,5.2,7,white,.14)
        roof(0,5.6,-21,15,8,2,stone)
        for x in [-5,-2.5,2.5,5]: cyl("Museum column",x,2.9,-16.8,.24,4.6,white)
        box("Museum doors",0,2,-17.4,3,3.4,.2,cyan)
        for x in range(-15,16,3):
            beam("Festival cable",(x,5,-13),(x+3,5,-13),.025,metal)
            roof(x+1.5,4.25,-13,1.4,.06,.75,pink if x%2 else amber)
        for x in [-12,-7,7,12]:
            cyl("Exhibit plinth",x,1,-10,1,.9,stone)
            ball("Discovery globe",x,2,-10,.7,.7,.7,cyan if x<0 else violet)
    else:
        box("Repair shop",0,2.6,-22,9,4.4,6,metal,.18)
        box("Workshop shutter",0,2,-18.9,4,2.8,.12,dark)
        box("Atlas workshop sign",0,4.3,-18.8,6,.6,.14,cyan)
def countryside():
    ground(mat("Meadow",(.31,.46,.2)))
    box("Farm lane",0,.43,0,4,.03,52,wood)
    for x in [-23,23]:
        ball("Rolling hill",x,1,-30,15,7,12,green)
        for z in range(-10,18,3):
            for dx in [-2,0,2]:
                box("Crop row",x+dx,.75,z,.22,.65,2.6,gold)
            cyl("Fence post",x*.78,1,z,.1,1.2,wood)
        beam("Fence rail",(x*.78,1,-12),(x*.78,1,18),.09,wood)
    box("Barn",-12,2.8,-22,9,4.8,7,red,.1)
    roof(-12,5.2,-22,10,8,2.3,wood)
    box("Barn door",-12,2,-18.4,3,3,.1,white)
    cyl("Windmill tower",13,4,-22,1.3,7.2,white,.8)
    ball("Windmill hub",13,6.8,-20.9,.4,.4,.4,metal)
    for angle in [0,math.pi/2,math.pi,3*math.pi/2]:
        beam("Windmill blade",(13,6.8,-20.8),(13+math.cos(angle)*4,6.8+math.sin(angle)*4,-20.8),.2,white)
    for x,z in [(-23,-17),(22,-15),(-24,12)]: tree(x,z)
def coast():
    box("Sea",0,-.2,-20,160,.3,140,water)
    box("Shore",0,0,14,65,.8,62,mat("Golden sand",(.68,.5,.26)))
    for i in range(10):
        ball("Coast cliff",-25-i%3,1+i%2,-19+i*4,4,3,3,stone)
    cyl("Coastal mast",15,4,-22,.55,7,white,.4)
    ring("Mast deck",15,6.7,-22,1,.15,red)
    for x,z in [(22,-7),(24,5),(20,17)]:
        cyl("Umbrella pole",x,1.8,z,.08,2.8,wood)
        cyl("Parasol",x,3.2,z,2,.7,pink if z<0 else amber,0)
        box("Beach chair",x,1,z+1,1,.15,2,white)
def coral(x,z,material):
    for i in range(5):
        dx=math.sin(i*2)*1.4; dz=math.cos(i*2)*1.4; h=1.5+i*.45
        beam("Coral branch",(x,.4,z),(x+dx,h,z+dz),.13,material)
        ball("Coral crown",x+dx,h,z+dz,.55,.38,.55,material)
        beam("Coral twig",(x+dx*.6,h*.6,z+dz*.6),(x+dx+1,h+.3,z+dz),.08,material)
def reef():
    ground(mat("Reef sand",(.36,.55,.45)))
    for i in range(12):
        angle=math.pi+i*math.pi/11
        x,z=math.cos(angle)*24,math.sin(angle)*24
        ball("Coral shelf",x,.8,z,3.7,.8,2.5,stone)
        coral(x,z,pink if i%2 else violet)
    for x in [-22,22]:
        for z in [0,8,15]:
            for i in range(3): beam("Kelp",(x+i*.4,.4,z),(x+math.sin(z+i),4+i*.4,z+.4),.11,green)
def wreck():
    ground(mat("Wreck silt",(.2,.34,.3)))
    # Open ribbed hull is a silhouette behind the scan area, not an invisible collider.
    for x in range(-16,17,4):
        for side in [-1,1]:
            beam("Hull rib",(x,.5,-24),(x,2,-24+side*3),.18,wood)
            beam("Hull rib",(x,2,-24+side*3),(x,5.7,-24+side*5),.18,wood)
    for side in [-1,1]:
        for h in [1.5,2.5,3.5]: box("Hull strake",0,h,-24+side*(h*.7+1.5),34,.35,.25,wood)
    beam("Broken mast",(-8,1,-22),(-3,10,-24),.25,wood)
    for x,z in [(-21,-8),(22,-4),(-23,12)]:
        box("Research crate",x,1,z,2,1.4,2,metal,.08); coral(x+1,z+1,green)
    ring("Lost anchor",17,1,-18,1.5,.2,metal,True)
def abyss():
    ground(mat("Abyss basalt",(.07,.09,.15)))
    for i in range(9):
        x=-24+i*6; z=-23-(i%2)*4; h=3+i%3
        cyl("Basalt chimney",x,h/2,z,2,h,dark,1)
        ring("Vent mouth",x,h,z,.9,.18,amber)
        for j in range(3): ball("Vent glow",x+math.sin(j)*.6,h+1+j,z,.25,.45,.25,cyan)
    for x in [-22,22]:
        for z in [0,9,16]: cyl("Luminous mineral",x,1.3,z,.55,2.4,violet,0)
def dish(x,z):
    cyl("Antenna base",x,2,z,.3,3,metal)
    ring("Receiver dish rim",x,4,z,2,.15,white)
    for i in range(12):
        a=i*math.tau/12
        beam("Dish rib",(x,3,z),(x+2*math.cos(a),4,z+2*math.sin(a)),.07,white)
    beam("Receiver spike",(x,3,z),(x,5,z),.06,cyan)
def platform():
    ground(water, -.2)
    box("Research deck",0,0,0,37,.8,37,metal,.1)
    for i in range(-16,17,4):
        box("Deck seams",i,.42,0,.05,.03,36,dark)
        box("Deck seams",0,.42,i,36,.03,.05,dark)
    for x in [-19,19]:
        for z in [-16,-6,6,16]: cyl("Float tank",x,-.2,z,1.2,1.4,amber)
    box("Weather lab",-11,2.2,-24,10,4,6,white,.2)
    windows(-11,-20.9,10,4)
    dish(10,-23)
def atolls():
    ground(water,.35)
    sand=mat("Atoll sand",(.71,.61,.34))
    for x,z,s in [(-27,-12,7),(23,-25,9),(29,13,5),(-25,20,4)]:
        ball("Atoll island",x,.4,z,s,.8,s*.7,sand)
        ball("Atoll grove",x,1.2,z,s*.7,.7,s*.5,green)
        tree(x,z,1.1)
    for x,z in [(-16,-18),(16,17)]:
        cyl("Sea buoy",x,.75,z,.45,1.2,amber); ball("Buoy lamp",x,1.55,z,.18,.18,.18,cyan)
def sky(storm=False):
    material=nightcloud if storm else cloud
    for i in range(14 if storm else 18):
        a=i*(2.71 if storm else 2.399); r=(22+i%4*4) if storm else (8+i%5*5)
        x,z=math.cos(a)*r,math.sin(a)*r
        y=-9-i%3 if storm else -6-i%3*2
        ball("Cloud bank",x,y,z,5+i%3,2.2,3.5,material)
        for side in [-1,1]:
            ball("Cloud billow",x+side*2,y+1,z+side,2.7,2.4,2.6,material)
    if storm:
        for x,z in [(-24,-12),(22,-20)]:
            for a,b in [((x,10,z),(x-2,6,z)),((x-2,6,z),(x+1,6,z)),((x+1,6,z),(x-2,1,z))]: beam("Distant lightning",a,b,.12,amber)
    else:
        ring("Transfer portal",0,5,-28,6,.22,white,True)
        for x in [-8,8]: beam("Portal beacon",(x,-3,-28),(x,8,-28),.1,cyan)
def orbit():
    ring("Orbital docking ring",0,5,-27,11,.7,metal,True)
    ring("Docking ring light",0,5,-26.2,10.7,.08,cyan,True)
    for x in [-18,18]:
        box("Solar array",x,4,-19,9,.2,12,dark)
        for i in range(6): box("Solar cell stripe",x,4.14,-24+i*2,8.6,.035,.07,cyan)
        beam("Array spar",(x,4,-19),(x*.5,4,-27),.25,metal)
    cyl("Station spine",0,7,-29,2,14,white)
def lunar(kind):
    ground(moon)
    for i in range(14):
        a=i*2.399; r=23+i%3*4
        x,z=math.cos(a)*r,math.sin(a)*r
        ring("Impact rim",x,.48,z,1.7+i%3,.22,stone)
        ball("Lunar boulder",x+2,.8,z,1,.7,.8,dark)
    if kind == "moonplain":
        cyl("Landing capsule",-15,2.5,-23,2.4,4,white,1.4)
        for x in [-18,-12]: beam("Lander leg",(x,0,-20),(-15,2,-23),.16,metal)
        beam("Survey flag",(14,.4,-21),(14,4,-21),.06,metal)
        box("Flag",15,3.5,-21,2,1,.04,cyan)
    elif kind == "crater":
        for i in range(4): ring("Excavation terrace",0,1+i*.8,-27,7+i*1.5,.7,stone)
        for x in [-20,20]:
            box("Excavation hut",x,1.6,-13,4,2.4,5,white,.15)
            beam("Crane mast",(x,0,-20),(x,7,-20),.18,metal)
            beam("Crane boom",(x,7,-20),(x*.55,7,-20),.15,metal)
    else:
        cyl("Observatory base",10,2.5,-23,5,4.2,white)
        ball("Observatory dome",10,4.5,-23,5,4,5,white)
        box("Dome shutter",10,6.2,-18.6,1.1,3.8,.22,dark)
        dish(-13,-23)
        box("Receiver walkway",0,.43,-12,24,.04,2,metal)

BUILDERS = {"city":lambda:city(),"country":countryside,"beach":coast,"reef":reef,"wreck":wreck,"abyss":abyss,"platform":platform,"atolls":atolls,"stormsky":lambda:sky(True),"highsky":lambda:sky(),"orbit":orbit,"moonplain":lambda:lunar("moonplain"),"crater":lambda:lunar("crater"),"observatory":lambda:lunar("observatory"),"home":lambda:city(True),"glass":lambda:sample(True),"basalt":lambda:sample()}
report=[]
for key,builder in BUILDERS.items():
    active_root=bpy.data.objects.new("Journey_"+key,None)
    bpy.context.collection.objects.link(active_root)
    builder()
    # One mesh per material avoids hundreds of draw calls for windows, ribs and crops.
    buckets={}
    for obj in list(active_root.children): buckets.setdefault(obj.data.materials[0],[]).append(obj)
    for material,objects in buckets.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        bpy.context.object.name="Scenery_"+material.name
    bpy.ops.object.select_all(action="DESELECT")
    active_root.select_set(True)
    children=list(active_root.children)
    for obj in children: obj.select_set(True)
    bpy.context.view_layer.objects.active=active_root
    path=OUT/("journey_"+key+".glb")
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,export_apply=True,export_yup=True)
    for obj in children: obj.data.calc_loop_triangles()
    report.append({"name":"journey_"+key,"file":path.name,"bytes":path.stat().st_size,"sha256":hashlib.sha256(path.read_bytes()).hexdigest()[:16],"triangles":sum(len(o.data.loop_triangles) for o in children),"meshes":len(children)})
    # Separate source collections make editing one setting in Blender straightforward.
    collection=bpy.data.collections.new("ENV_"+key)
    bpy.context.scene.collection.children.link(collection)
    for obj in [active_root]+children:
        for old in list(obj.users_collection): old.objects.unlink(obj)
        collection.objects.link(obj)
    collection.hide_viewport=True

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"discovery_environments.blend"))
(OUT/"journey-manifest.json").write_text(json.dumps({"generator":"Blender / build_journey.py","source":"assets/blender/discovery_environments.blend","assets":report},indent=2),encoding="utf8")
print(json.dumps(report,indent=2))
