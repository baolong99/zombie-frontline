# Dựng một cảnh thử tối giản để kiểm render_sprites.py mà không cần mô hình thật.
#
#   blender --background --python tools/make_test_scene.py
#
# Nhân vật thử là một hình trụ có CÁI MŨI CHĨA VỀ -Y. Trong Blender -Y là hướng quay mặt
# về phía camera, tức hướng NAM trên màn hình — nên ở hàng 0 của sprite sheet cái mũi phải
# chĩa XUỐNG DƯỚI. Nhìn cái mũi là kiểm được ngay thứ tự 8 hướng có đúng không.
import bpy, math, os

bpy.ops.wm.read_factory_settings(use_empty=True)

# thân
bpy.ops.mesh.primitive_cylinder_add(radius=0.30, depth=1.60, location=(0, 0, 0.80))
body = bpy.context.object
body.name = "TestBody"

# mũi chĩa về -Y, đặt cao ngang đầu
bpy.ops.mesh.primitive_cone_add(radius1=0.18, depth=0.55,
                                rotation=(math.radians(90), 0, 0),
                                location=(0, -0.45, 1.25))
nose = bpy.context.object
nose.name = "TestNose"
nose.parent = body
nose.matrix_parent_inverse = body.matrix_world.inverted()

# một dấu lệch sang phải để phân biệt trái/phải nếu bị lật gương
bpy.ops.mesh.primitive_cube_add(size=0.22, location=(0.34, 0, 1.05))
tag = bpy.context.object
tag.name = "TestTag"
tag.parent = body
tag.matrix_parent_inverse = body.matrix_world.inverted()

# hoạt cảnh "Walk": thân nhún lên xuống, đủ để có nhiều khung khác nhau
body.animation_data_create()
act = bpy.data.actions.new("Walk")
body.animation_data.action = act
for frame, z in [(1, 0.80), (10, 1.00), (20, 0.80)]:
    body.location.z = z
    body.keyframe_insert("location", frame=frame)
body.location.z = 0.80

out = os.path.join(os.path.dirname(bpy.data.filepath) or os.getcwd(), "test_scene.blend")
bpy.ops.wm.save_as_mainfile(filepath=out)
print("Đã lưu cảnh thử: %s" % out)
