# Render sprite sheet 8 hướng từ mô hình 3D, đúng bố cục mà index.html đang chờ.
#
#   blender cảnh.blend --background --python tools/render_sprites.py
#
# hoặc mở Blender, dán file này vào Scripting rồi bấm Run.
#
# Kết quả: mỗi hoạt cảnh một file PNG dạng lưới ô vuông — hàng là hướng quay, cột là khung —
# cộng một file sprites.json chứa sẵn đoạn khai báo SKIN để dán thẳng vào game.
#
# Bốn chỗ hay sai mà script này lo hộ:
#   1. Góc camera phải khớp LEAN = 0.5 trong game, tức nghiêng đúng 60° so với phương đứng
#   2. Hàng 0 phải là hướng quay mặt XUỐNG DƯỚI, các hàng sau theo chiều kim đồng hồ
#   3. Điểm neo foot phải tính ra chứ không đoán, nếu không nhân vật trôi lệch khỏi bóng
#   4. View transform phải là Standard, để Filmic/AgX không làm nhạt hết màu sprite

import bpy, os, json, math
import numpy as np

# ============================================================ cấu hình
CFG = {
    # thư mục xuất. Để trống thì lấy thư mục chứa file .blend
    "out_dir": "",
    "prefix": "z",                 # tiền tố tên file: z_walk.png, z_die.png...

    "dirs": 8,                     # số hàng = số hướng quay
    "cell": 128,                   # cạnh mỗi ô, pixel. Ô BẮT BUỘC vuông
    # Nghiêng so với phương thẳng đứng. RÀNG BUỘC: phải khớp với LEAN trong index.html theo
    #     LEAN = cos(tilt_deg)
    # 60° -> LEAN 0.50 (mặc định hiện tại) · 50° -> 0.64 (nhìn từ trên xuống nhiều hơn)
    # 45° -> 0.71 · 70° -> 0.34 (gần như nhìn ngang). Đổi ở đây thì phải đổi cả trong game,
    # nếu không bóng đổ và vật cản sẽ lệch phối cảnh so với nhân vật.
    "tilt_deg": 60.0,
    "margin": 1.18,                # nới khung quanh nhân vật, 1.0 là sát khít

    # Hoạt cảnh: tên trong game -> (tên action trong Blender, số khung lấy mẫu).
    # Số khung lấy đều trên toàn bộ độ dài action.
    #
    # Để RỖNG {} thì script tự dò: nó liệt kê mọi action có trong file và ghép theo từ khoá
    # (xem AUTO bên dưới). Tiện khi mở một bộ lạ mà chưa biết họ đặt tên action thế nào.
    # Dù tự dò hay không, script luôn in ra danh sách action đầy đủ để bạn chỉnh lại.
    "anims": {},

    # Mô hình quay mặt về đâu ở tư thế gốc. Nếu render ra mà hàng 0 không phải là quay mặt
    # xuống dưới thì chỉnh số này: thử 180, rồi 90, rồi -90.
    "facing_offset_deg": 0.0,
}

# Có thể đè cấu hình từ ngoài mà không phải sửa file, tiện khi render nhiều nhân vật:
#   set SPRITE_CFG=C:\duong\dan\cau-hinh.json   (Windows)
#   SPRITE_CFG=cau-hinh.json blender ...        (macOS/Linux)
_ext = os.environ.get("SPRITE_CFG")
if _ext and os.path.exists(_ext):
    # utf-8-sig chứ không phải utf-8: PowerShell trên Windows ghi JSON kèm BOM, và
    # json.load sẽ chết ngay ở ký tự đầu tiên nếu đọc bằng utf-8 thuần.
    with open(_ext, encoding="utf-8-sig") as _f:
        _over = json.load(_f)
    # anims trong JSON là {"walk": ["Walk", 8]}; đổi về tuple cho khớp
    if "anims" in _over:
        _over["anims"] = {k: tuple(v) for k, v in _over["anims"].items()}
    CFG.update(_over)
    print("Đã nạp cấu hình ngoài: %s" % _ext)
# ============================================================


def pick_subject():
    """Đối tượng sẽ được xoay: ưu tiên armature, không có thì lấy mesh gốc lớn nhất."""
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE" and o.parent is None]
    if arms:
        return arms[0]
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.parent is None]
    if not meshes:
        raise RuntimeError("Không thấy armature hay mesh nào trong cảnh")
    return max(meshes, key=lambda o: max(o.dimensions))


def _ancestors(o):
    out, p = [], o.parent
    while p:
        out.append(p)
        p = p.parent
    return out


def world_bounds(root):
    """Hộp bao của mọi mesh thuộc root (kể cả con cháu), trong toạ độ thế giới."""
    from mathutils import Vector
    objs = [o for o in bpy.data.objects
            if o.type == "MESH" and (o is root or root in _ancestors(o))]
    if not objs:                                   # mô hình rời, không gắn vào armature
        objs = [o for o in bpy.data.objects if o.type == "MESH"]
    if not objs:
        raise RuntimeError("Không thấy mesh nào để đo kích thước")
    lo = [1e9, 1e9, 1e9]
    hi = [-1e9, -1e9, -1e9]
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    return lo, hi


def setup_scene(subject):
    sc = bpy.context.scene

    # --- màu: Standard, nếu không Filmic/AgX sẽ làm nhạt và bệt hết sprite
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"

    # --- nền trong suốt, game tự vẽ bóng nên không render bóng đổ xuống đất
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.resolution_x = CFG["cell"]
    sc.render.resolution_y = CFG["cell"]
    sc.render.resolution_percentage = 100

    lo, hi = world_bounds(subject)
    height = hi[2] - lo[2]
    width = max(hi[0] - lo[0], hi[1] - lo[1])
    tilt = math.radians(CFG["tilt_deg"])

    # Chiều cao chiếu lên khung ảnh bị nén theo sin(nghiêng), bề ngang thì không.
    # Lấy chiều lớn hơn làm khung để nhân vật không bị cắt ở hướng nào cả.
    span = max(width, height * math.sin(tilt)) * CFG["margin"]

    # --- camera trực giao, ngắm vào giữa thân nhân vật
    cam_data = bpy.data.cameras.new("SpriteCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = span
    cam = bpy.data.objects.new("SpriteCam", cam_data)
    sc.collection.objects.link(cam)

    target_z = lo[2] + height * 0.5
    dist = max(10.0, height * 6)
    # Camera nghiêng quanh trục X: 0° là nhìn thẳng từ đỉnh xuống, 90° là nhìn ngang.
    cam.rotation_euler = (tilt, 0.0, 0.0)
    cam.location = (0.0, -math.sin(tilt) * dist, target_z + math.cos(tilt) * dist)
    sc.camera = cam

    # --- đèn đặt cố định trong thế giới. Camera đứng yên và chỉ mô hình xoay, nên đèn cố
    # định trong thế giới CHÍNH LÀ đèn cố định so với camera: cả 8 hướng sáng như nhau.
    #
    # Dùng đèn MẶT TRỜI chứ không phải đèn vùng: cường độ mặt trời không phụ thuộc khoảng
    # cách, nên không phải dò lại công suất mỗi khi mô hình to nhỏ khác nhau. Bản đầu dùng
    # đèn vùng và render ra đen thui vì công suất quá nhỏ so với khoảng cách.
    for name, direction, energy in [
        ("Key",  (-0.4, -0.7, -1.0), 4.0),     # chính, từ trên chếch trái trước
        ("Fill", ( 0.8, -0.4, -0.5), 1.2),     # phụ, làm mềm bóng bên phải
        ("Rim",  ( 0.0,  0.9, -0.4), 2.5),     # viền sau, tách nhân vật khỏi nền
    ]:
        d = bpy.data.lights.new(name, type="SUN")
        d.energy = energy
        d.angle = math.radians(12)             # mép bóng mềm một chút
        o = bpy.data.objects.new(name, d)
        o.location = (0, 0, height * 3)
        # Đèn ở tư thế gốc chiếu theo -Z. Xoay X một góc thì -Z nghiêng về phía +Y, nên
        # phải xoay Z sao cho +Y cục bộ trùng với hình chiếu ngang của hướng chiếu.
        dx, dy, dz = direction
        o.rotation_euler = (math.atan2(math.hypot(dx, dy), -dz), 0.0, math.atan2(-dx, dy))
        sc.collection.objects.link(o)

    print("  hộp bao: lo=%s hi=%s" % (tuple(round(v, 2) for v in lo), tuple(round(v, 2) for v in hi)))
    print("  cao=%.2f rộng=%.2f khung=%.2f camera=%s" %
          (height, width, span, tuple(round(v, 2) for v in cam.location)))

    # --- Trục quay rời. KHÔNG xoay trực tiếp nhân vật: action nhập từ FBX thường chứa cả
    # phép biến đổi của chính đối tượng, nên mỗi lần frame_set là góc xoay ta đặt bị ghi đè
    # và cả 8 hàng ra giống hệt nhau. Bọc nhân vật vào một trục cha rồi xoay cái trục đó.
    piv = bpy.data.objects.new("Turntable", None)
    sc.collection.objects.link(piv)
    subject.parent = piv
    subject.matrix_parent_inverse = piv.matrix_world.inverted()

    # --- foot: điểm chạm đất nằm ở đâu trong ô, tính từ đỉnh ô
    # Khung ngắm vào target_z. Điểm z=0 nằm thấp hơn tâm khung một đoạn target_z*sin(nghiêng).
    foot = 0.5 + (target_z * math.sin(tilt)) / span
    # tỉ lệ chiều cao nhân vật so với chiều cao ô, để suy ra hMul
    frac = (height * math.sin(tilt)) / span
    return piv, foot, frac


# Blender 4.4 trở đi, gán action vào animation_data KHÔNG còn đủ: action chứa nhiều "slot"
# và phải chỉ định slot thì dữ liệu mới thực sự tác dụng lên xương. Quên bước này thì nhân
# vật đứng nguyên tư thế gốc ở mọi khung mà không báo lỗi gì cả.
def bind_action(obj, act):
    if obj.animation_data is None:
        obj.animation_data_create()
    ad = obj.animation_data
    ad.action = act
    if not hasattr(ad, "action_slot"):
        return                                  # Blender cũ, không có slot
    if ad.action_slot is not None:
        return
    slots = list(getattr(act, "slots", []) or [])
    pick = next((s for s in slots if getattr(s, "target_id_type", "") == obj.id_type), None)
    if pick is None and slots:
        pick = slots[0]
    if pick is not None:
        ad.action_slot = pick


# Từ khoá để tự dò hoạt cảnh, xét theo thứ tự — cái đứng trước được ưu tiên.
# Bỏ qua mấy action rác hay gặp trong FBX như "Targeting Pose", "T-Pose", "Rest".
AUTO = {
    "walk": (["walk", "run", "move", "shamble"], 8),
    "idle": (["idle", "stand"], 4),
    "die":  (["death", "die", "dead", "fall"], 10),
    "attack": (["attack", "punch", "bite", "hit", "swing"], 6),
}
JUNK = ["targeting", "t-pose", "tpose", "rest", "bind"]


def auto_anims():
    """Ghép action có sẵn trong file vào tên hoạt cảnh của game bằng từ khoá."""
    names = [a.name for a in bpy.data.actions]
    print("Action có trong file (%d):" % len(names))
    for n in names:
        print("    %s" % n)
    usable = [n for n in names if not any(j in n.lower() for j in JUNK)]
    out, taken = {}, set()
    for game_name, (keys, frames) in AUTO.items():
        for k in keys:
            pick = next((n for n in usable if k in n.lower() and n not in taken), None)
            if pick:
                out[game_name] = (pick, frames)
                taken.add(pick)
                print("  tự dò: %-7s <- '%s'" % (game_name, pick))
                break
    if not out and usable:                      # không khớp từ khoá nào thì lấy đại cái đầu
        out["walk"] = (usable[0], 8)
        print("  tự dò: không khớp từ khoá nào, dùng tạm '%s' làm walk" % usable[0])
    return out


def action_of(name):
    a = bpy.data.actions.get(name)
    if a is None:
        have = ", ".join(sorted(x.name for x in bpy.data.actions)) or "(không có action nào)"
        raise RuntimeError("Không thấy action '%s'. Các action đang có: %s" % (name, have))
    return a


def render_sheet(subject, pivot, game_name, action_name, frames, out_path):
    sc = bpy.context.scene
    act = action_of(action_name)
    bind_action(subject, act)

    f0, f1 = act.frame_range
    dirs = CFG["dirs"]
    cell = CFG["cell"]
    sheet = np.zeros((dirs * cell, frames * cell, 4), dtype=np.float32)

    base_z = pivot.rotation_euler.z
    tmp = os.path.join(CFG["_out"], "_tmp.png")

    for row in range(dirs):
        # Hàng 0 quay mặt xuống dưới, các hàng sau theo chiều kim đồng hồ trên màn hình.
        # Trên màn hình chiều kim đồng hồ ứng với xoay ÂM quanh trục Z trong Blender.
        pivot.rotation_euler.z = base_z \
            - row * (2 * math.pi / dirs) + math.radians(CFG["facing_offset_deg"])

        for col in range(frames):
            # lấy mẫu đều trên toàn bộ action; khung cuối không trùng khung đầu với vòng lặp
            t = col / frames if game_name != "die" else (col / max(1, frames - 1))
            sc.frame_set(int(round(f0 + (f1 - f0) * t)))

            sc.render.filepath = tmp
            bpy.ops.render.render(write_still=True)

            img = bpy.data.images.load(tmp)
            buf = np.empty(cell * cell * 4, dtype=np.float32)
            img.pixels.foreach_get(buf)
            bpy.data.images.remove(img)

            # Blender xếp pixel từ DƯỚI lên, sprite sheet của game xếp từ TRÊN xuống,
            # nên hàng row phải ghi vào vị trí (dirs-1-row) trong bộ đệm.
            y0 = (dirs - 1 - row) * cell
            sheet[y0:y0 + cell, col * cell:(col + 1) * cell] = buf.reshape(cell, cell, 4)

    pivot.rotation_euler.z = base_z
    if os.path.exists(tmp):
        os.remove(tmp)

    out = bpy.data.images.new("sheet", frames * cell, dirs * cell, alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = out_path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    print("  -> %s  (%d cột × %d hàng)" % (out_path, frames, dirs))


def main():
    out_dir = CFG["out_dir"] or os.path.dirname(bpy.data.filepath) or os.getcwd()
    out_dir = os.path.join(out_dir, "sprites")
    os.makedirs(out_dir, exist_ok=True)
    CFG["_out"] = out_dir

    subject = pick_subject()
    print("Đối tượng xoay: %s" % subject.name)

    pivot, foot, frac = setup_scene(subject)
    print("foot = %.3f · nhân vật cao %.0f%% chiều cao ô" % (foot, frac * 100))

    want = CFG["anims"] or auto_anims()
    if not want:
        raise RuntimeError("Không có action nào để render")

    anims = {}
    for game_name, (action_name, frames) in want.items():
        key = "%s_%s" % (CFG["prefix"], game_name)
        path = os.path.join(out_dir, key + ".png")
        print("Render %s (action '%s', %d khung)..." % (game_name, action_name, frames))
        render_sheet(subject, pivot, game_name, action_name, frames, path)
        anims[game_name] = key

    # đoạn khai báo dán thẳng vào game
    snippet = {
        "SKIN": {
            "dirs": CFG["dirs"],
            "hMul": round(3.2 / max(frac, 0.01) * 0.75, 2),
            "foot": round(foot, 3),
            "anims": anims,
        },
        "loadArt": {k: "assets/%s.png" % k for k in anims.values()},
        "ghichu": "hMul chỉ là ước lượng ban đầu, chỉnh bằng mắt cho khớp bóng và tỉ lệ quái",
    }
    with open(os.path.join(out_dir, "sprites.json"), "w", encoding="utf-8") as f:
        json.dump(snippet, f, indent=2, ensure_ascii=False)

    print("\nXong. Dán vào game:")
    print("  SKIN.walker = %s;" % json.dumps(snippet["SKIN"], ensure_ascii=False))
    print("  loadArt(%s);" % json.dumps(snippet["loadArt"], ensure_ascii=False))


main()
