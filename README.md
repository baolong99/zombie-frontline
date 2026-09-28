# Zombie Frontline

Game bắn zombie sinh tồn, góc nhìn từ trên xuống, chơi bằng bàn phím hoặc joystick ảo —
không dùng chuột. Toàn bộ game nằm trong một file `index.html` duy nhất: không build,
không dependency, mở bằng trình duyệt là chạy.

Song ngữ Việt / Anh, đổi được ngay giữa trận.

## Chạy

```bash
# mở thẳng file
start index.html          # Windows
open index.html           # macOS

# hoặc qua server tĩnh nếu cần
npx serve .
```

## Cách chơi

| | |
|---|---|
| Di chuyển | `↑ ↓ ← →` hoặc `WASD`, mobile dùng joystick ảo |
| Bắn | tự động — nòng súng tự khoá con zombie gần nhất trong cung 180° phía trước |
| Đổi súng | `1`–`5`, hoặc `Q` để xoay vòng |
| Tạm dừng | `P` |

Không có nút ngắm. Hướng bắn **là** hướng mặt nhân vật, và mỗi khẩu súng xoay một tốc độ
khác nhau — súng càng mạnh xoay càng chậm. Đó là đòn bẩy cân bằng chính của game.
Khi trước mặt sạch zombie, nhân vật tự quay ra sau bắn.

## Một màn chơi

Cố định **10 phút**, bản đồ vô tận không có biên.

| Mốc | Diễn biến |
|---|---|
| 2, 4, 6, 8, 10 phút | Một **elite**, hạ xong rơi hộp nâng cấp cao cấp (nâng cả một nhóm) |
| Phút 5 | **Trùm phụ Thây Chúa** — quét sạch quái thường, đếm ngược 3·2·1, nhốt trong vòng vây đỏ |
| Nhặt hộp của elite phút 10 | **Trùm chính Bạo Chúa** xuất hiện, vòng vây lần hai |
| Hạ Bạo Chúa | Thắng màn |

## Cây nâng cấp

Năm nhánh, mỗi nhánh ba node **mở khoá một lần** — không có cấp bậc. Node 1–2 là chỉ số,
node 3 luôn là một năng lực có điều kiện kích hoạt. Mở trọn ba node thì hộp elite tiếp theo
trao **nâng cấp tinh anh** của nhánh đó.

| Nhánh | Node 1 | Node 2 | Node 3 (kích hoạt) | ★ Tinh anh |
|---|---|---|---|---|
| **Hoả Lực** | Sát thương +60% | Cỡ đạn +7px, +40% dmg | **Đạn Nện** — mỗi 8 phát kèm viên nặng ×3, nổ r70 | **Xuyên Giáp** — mỗi 4 phát, và bỏ qua mọi giáp |
| **Đa Hướng** | Đa nòng +2 đường | Nòng phụ sau +2 viên | **Nổ Vòng** — cạn băng là bắn 8 hướng | **Bão Tố** — +2 đường nữa, xác nổ 6 tia bằng 30% dmg |
| **Xuyên & Nảy** | Đạn xuyên +3 | Đạn nảy +3 | **Xuyên Thấu** — mỗi lần xuyên +15% dmg, cộng dồn | **Đạn Truy Hồn** — nảy tới 260px, nhắm con yếu nhất, +25%/lần |
| **Nhịp Bắn** | Tốc độ bắn +70% | Băng đạn ×2,5, thay nhanh ×2 | **Nạp Nóng** — thay xong thì 1,5s bắn gấp đôi | **Không Ngừng** — mỗi mạng rút 0,04s hồi; Nạp Nóng 3s |
| **Sinh Tồn** | Thể Lực +90 máu, +25% chạy | Hút máu 1/8 dmg | **Khiên bảo hộ** — chặn 1 đòn, hồi 50s | **Bất Khuất** — đòn chí tử hồi 40% máu + hất văng, 90s |

Một ván cho khoảng **10–11 lần lên cấp** cộng 5 hộp elite, tức mở được chừng **3 nhánh
trọn vẹn**. Đó là ngân sách quyết định đường cong kinh nghiệm, không phải ngược lại.

Hạ trùm phụ còn được chọn **một nâng cấp độc nhất** định hình cả bản build (Đạn Nặng /
Bão Đạn / Xuyên Phá / Khổng Lồ), độc lập với cây.

Sức mạnh dài hạn **không** nằm trong cây — nó để dành cho cửa hàng: mua súng, phụ kiện,
nâng sao (★ tới ★★★★★). Cây lo bản sắc từng ván, cửa hàng lo tiến bộ qua nhiều ván.

## Bảng Tune

Bảng bên phải là công cụ thử, không phải giao diện người chơi. Nó cho chỉnh nóng mọi hằng
số cân bằng — tốc độ xoay, mật độ zombie, độ dốc kinh nghiệm, bán kính vòng vây — và có các
nút triệu hồi elite / trùm / hộp để khỏi ngồi đợi. Giá trị lưu vào `localStorage`.

## Kiến trúc

Một file, một IIFE, không framework. Các phần chính theo thứ tự trong file:

| Phần | Nội dung |
|---|---|
| `I18N` | Từ điển phẳng khoá chấm cho cả hai ngôn ngữ. Markup dùng `data-i18n`, code dùng `t()` |
| Bảng dữ liệu | `WEAPONS`, `ZTYPE`, `ELITES`, `MINI`, `BOSS`, `UNIQUES`, `GROUPS`, `FX` — chỉ số và màu, không chứa chữ hiển thị |
| `wstat(i)` | Nơi duy nhất suy ra chỉ số súng thực tế từ súng gốc + nâng cấp + nâng cấp độc nhất |
| `update(dt)` | Toàn bộ mô phỏng, chạy theo bước nhỏ để thanh tua nhanh không làm vỡ va chạm |
| Lớp art | `drawSprite()` / `SKIN` / `THEMES` — chưa có ảnh thì tự rơi về hình vẽ tay |
| `draw()` | Camera bám nhân vật, nền lát vô tận theo hàm băm toạ độ ô |
| `render_game_to_text()` | Cửa sổ chỉ-đọc trả JSON trạng thái trận đấu, dành cho kịch bản kiểm |

Vài quyết định đáng nhớ, đã ghi chú trong code tại đúng chỗ:

- **Bản đồ vô tận** — không kẹp biên. Quái sinh trên vòng tròn vừa khuất tầm nhìn, 55% rơi
  vào cung 140° phía trước hướng chạy để chạy trốn mãi không thành chiến thuật. Con nào bị
  bỏ xa quá thì dời ra rìa vòng sinh thay vì xoá.
- **Nền sinh theo hàm băm toạ độ ô** — chạy 20.000 đơn vị rồi quay lại vẫn thấy đúng đống rơm
  ở đúng chỗ mà không lưu gì.
- **Hướng nhìn: thân lật, súng xoay.** Thân nhân vật không xoay, chỉ lật trái/phải; khẩu súng
  là lớp riêng xoay đủ 360°. Rẻ hơn bộ sprite 8 hướng khoảng 4 lần.
- **Trần vật phẩm có thu hồi** — chạm trần thì gộp viên xa nhất vào chỗ vừa rơi, không vứt đi,
  nên người chơi không mất kinh nghiệm.

### Quy cách art (đã chốt, chưa có file)

| Loại | Kích thước nguồn |
|---|---|
| Nhân vật | 128×128 |
| Zombie thường | 96×96 |
| Elite | 192×192 |
| Trùm | 256×256 |
| Ô lát nền | 256×256, **liền mạch bốn cạnh** |

Đặt tên `spr_<đối tượng>_<biến thể>_<trạng thái>_<số>.png`. Nạp vào `ART.img` là đường
sprite tự bật, logic game không phải sửa.

## Kiểm thử

```bash
cd tests
npm install                 # playwright
npx playwright install chromium
npm run all
```

| Kịch bản | Kiểm cái gì |
|---|---|
| `check.js` | Biên dịch mọi khối `<script>`, bắt lỗi cú pháp. Không cần trình duyệt |
| `smoke.js` | Chạy trọn ván 650 giây trong DOM giả bằng Node `vm`, bot tự chơi và tự chọn nâng cấp |
| `perf.mjs` | Tải nặng trong Chromium: mật độ 2,5× tua 5×, đo FPS, soi NaN và mảng phình |
| `boss.mjs` | Luồng cuối màn: trùm phụ → vòng vây → elite → hộp → trùm chính → thắng |
| `arena.mjs` | Vòng vây kẹp đúng bán kính, mũi tên chỉ hộp |
| `visual.mjs` | Chụp toàn trang: HUD, bảng Tune, menu nâng cấp, đổi ngôn ngữ giữa menu |
| `themes.mjs` | Chụp ba khu vực ở cùng thời điểm để so sánh |
| `survive.mjs` | **Tắt bất tử**, 3 lượt, đo bot sống được bao lâu. Nhận đường dẫn file khác làm tham số để so hai phiên bản |

`survive.mjs` là bài duy nhất trả lời được câu "cân bằng có ổn không". Con bot chọn ngẫu
nhiên và chạy loạn nên nó dở hơn người thật nhiều — đọc nó như **mức sàn so sánh giữa hai
phiên bản**, đừng đọc như độ khó thật. Cách so:

```bash
git show HEAD:index.html > /tmp/prev.html
node survive.mjs /tmp/prev.html      # bản cũ
node survive.mjs                     # bản hiện tại
```

Ảnh chụp rơi vào `tests/output/` (đã ignore).

`smoke.js` chạy được **không cần trình duyệt** — nó dựng một DOM giả tối thiểu rồi nạp
script của game qua `vm`. Nhanh và hợp cho CI. Nhưng nó *không* thấy được lỗi hiển thị:
đã từng có lỗi tên trùm không đổi ngôn ngữ mà chỉ ảnh chụp Playwright mới lộ ra.

## Còn dang dở

- Chưa có art thật — toàn bộ vẫn là hình vẽ bằng canvas primitive.
- Ba khu vực mới khác nhau ở bảng màu và vật trang trí, chưa có ảnh lát nền.
- Chưa có sảnh, chưa có hệ thể lực, chưa có cửa hàng súng / phụ kiện / nâng sao. Bảng cân
  bằng hiện tại (`hpScale` ×1→×1,9 · trùm chính 3.800 · trùm phụ 1.600) được đặt cho người
  chơi **tay không**; khi có hệ sao thì phải nâng lại toàn bộ.
- Giãn cách quái tự tắt khi trên 110 con (xem chú thích trong `update`), nên ở mật độ cao
  đám đông dính thành khối. Cần thay bằng lưới băm không gian.
- Số DPS trên HUD chưa cộng nòng phụ sau.
