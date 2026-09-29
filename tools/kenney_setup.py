# Dựng cảnh Blender từ bộ Kenney "Animated Characters" để render_sprites.py render được.
#
#   set KENNEY_DIR=E:\Projects\kenney_animated-characters-survivors
#   set KENNEY_SKIN=zombieA
#   set KENNEY_OUT=C:\duong\dan\zombieA.blend
#   blender --background --python tools/kenney_setup.py
#
# Bộ Kenney đóng gói theo kiểu: một file mô hình chung (characterMedium.fbx) cộng mỗi hoạt
# cảnh một file FBX riêng, và các bộ da là PNG rời. Nhập một file hoạt cảnh sẽ kéo theo cả
# một armature thừa — script gỡ bỏ phần thừa đó và chỉ giữ lại action.
#
# Script tự ghi luôn file cấu hình cho render_sprites.py, vì tên action sau khi nhập có
# tiền tố kiểu "Root.001|Root|Run" chứ không phải "Run" trơn.

import bpy, os, json, glob

PACK = os.environ.get("KENNEY_DIR", "")
SKIN = os.environ.get("KENNEY_SKIN", "zombieA")
OUT = os.environ.get("KENNEY_OUT", "")
PREFIX = os.environ.get("KENNEY_PREFIX", SKIN)

if not PACK or not os.path.isdir(PACK):
    raise RuntimeError("Đặt KENNEY_DIR trỏ tới thư mục đã giải nén của bộ Kenney")
if not OUT:
    OUT = os.path.join(PACK, PREFIX + ".blend")

# Hoạt cảnh muốn lấy: tên trong game -> mẩu tên action cần tìm, và số khung lấy mẫu.
# Bộ Survivors chỉ có idle / jump / run, KHÔNG có walk và KHÔNG có death — nên "walk"
# trong game dùng tạm hoạt cảnh chạy, và không có hoạt cảnh chết thì game giữ nguyên
# cách cũ là nổ thành hạt.
WANT = {"walk": ("Run", 8), "idle": ("Idle", 4)}

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- mô hình
bpy.ops.import_scene.fbx(filepath=os.path.join(PACK, "Model", "characterMedium.fbx"))
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.data.objects if o.type == "MESH")
print("Mô hình: %s (armature %s), cao %.2f đơn vị" % (mesh.name, arm.name, mesh.dimensions.z))

# ---- bộ da: gắn PNG vào Base Color của vật liệu 'skin'
skin_png = os.path.join(PACK, "Skins", SKIN + ".png")
if not os.path.exists(skin_png):
    have = ", ".join(sorted(os.path.splitext(os.path.basename(f))[0]
                            for f in glob.glob(os.path.join(PACK, "Skins", "*.png"))))
    raise RuntimeError("Không thấy da '%s'. Có: %s" % (SKIN, have))

for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        continue
    # Trình nhập FBX đặt Alpha = 0 trên vật liệu của bộ này, và chế độ hiển thị mặc định
    # tôn trọng alpha — nên mesh render ra TRONG SUỐT HOÀN TOÀN, ảnh trắng trơn. Đây là
    # lỗi kinh điển của FBX trong Blender và là thứ chỉ chạy thật mới thấy.
    if "Alpha" in bsdf.inputs:
        for lk in list(bsdf.inputs["Alpha"].links):
            mat.node_tree.links.remove(lk)
        bsdf.inputs["Alpha"].default_value = 1.0
    try:
        mat.surface_render_method = "DITHERED"
    except AttributeError:
        pass

    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(skin_png)
    # Da của Kenney là bảng màu phẳng ô nhỏ; lọc Closest giữ được nét sắc, Linear làm nhoè
    tex.interpolation = "Closest"
    tex.location = (bsdf.location.x - 350, bsdf.location.y)
    mat.node_tree.links.new(bsdf.inputs["Base Color"], tex.outputs["Color"])
    # bớt bóng để sprite không loá, hợp với phong cách phẳng
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.85
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.15
    print("Đã gắn da: %s -> vật liệu %s" % (SKIN, mat.name))

# ---- hoạt cảnh: nhập từng file, giữ lại action, dọn sạch phần thừa
found = {}
for game_name, (needle, frames) in WANT.items():
    fbx = os.path.join(PACK, "Animations", needle.lower() + ".fbx")
    if not os.path.exists(fbx):
        print("BỎ QUA %s: không có %s" % (game_name, fbx))
        continue
    before_act = set(a.name for a in bpy.data.actions)
    before_obj = set(o.name for o in bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=fbx)

    new_acts = [a for a in bpy.data.actions if a.name not in before_act]
    # bỏ action rác kiểu "0.Targeting Pose", chỉ lấy cái có tên chứa từ khoá
    pick = next((a for a in new_acts if needle.lower() in a.name.lower()), None)
    if pick is None:
        print("BỎ QUA %s: không thấy action chứa '%s' trong %s" %
              (game_name, needle, [a.name for a in new_acts]))
    else:
        found[game_name] = (pick.name, frames)
        pick.use_fake_user = True          # giữ lại khi xoá armature thừa
        print("Hoạt cảnh %-5s <- action '%s' (khung %d-%d)" %
              (game_name, pick.name, pick.frame_range[0], pick.frame_range[1]))

    # gỡ mọi đối tượng mới nhập, chỉ giữ action
    for o in [o for o in bpy.data.objects if o.name not in before_obj]:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in new_acts:
        if pick is None or a.name != pick.name:
            bpy.data.actions.remove(a)

if not found:
    raise RuntimeError("Không lấy được hoạt cảnh nào")

if arm.animation_data is None:
    arm.animation_data_create()
arm.animation_data.action = bpy.data.actions[found[list(found)[0]][0]]

os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("Đã lưu cảnh: %s" % OUT)

# ---- cấu hình cho render_sprites.py, tên action đã phân giải đầy đủ
cfg = {
    "prefix": PREFIX,
    "cell": int(os.environ.get("KENNEY_CELL", "128")),
    "out_dir": os.path.dirname(OUT),
    "anims": {k: [v[0], v[1]] for k, v in found.items()},
}
cfg_path = os.path.splitext(OUT)[0] + ".cfg.json"
with open(cfg_path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print("Đã ghi cấu hình: %s" % cfg_path)
