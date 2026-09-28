// Kiểm cú pháp: biên dịch từng khối <script> trong index.html mà không chạy nó.
// new Function() ở đây chỉ để BIÊN DỊCH, không hề gọi — đầu vào là chính file nguồn của dự án.
const fs = require("fs");
const path = require("path");

const p = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(p, "utf8");
const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0, bad = 0;
while ((m = re.exec(html))) {
  i++;
  const code = m[1];
  const line = html.slice(0, m.index).split("\n").length;
  try {
    new Function(code);
    console.log("script #" + i + " (dòng " + line + "): OK, " + code.split("\n").length + " dòng");
  } catch (e) {
    bad++;
    console.log("script #" + i + " (dòng " + line + "): " + e.message);
  }
}
console.log(bad ? "FAILED" : "tất cả script đều parse được");
process.exit(bad ? 1 : 0);
