import chalk from "chalk";
import gemini from "./modules/gemini/gemini.js";
import fs from "fs-extra";
import path from "path";
import ora from "ora";
import checkGameTranslation from "./modules/validateText/validateTranslation.js";

const inputDir = path.join(process.cwd(), "raw_text");
const outputDir = path.join(process.cwd(), "trans_text");
const missDir = path.join(process.cwd(), "trans_miss");

async function main() {
    try {
        if (await fs.ensureDir(inputDir)) {
            console.log('Vừa tạo thư mục "raw_text", vui lòng nạp file .text.');
        }
        if (await fs.ensureDir(outputDir)) {
            console.log('Vừa tạo thư mục "trans_text", vui lòng không xóa.');
        }
        if (await fs.ensureDir(missDir)) {
            console.log('Vừa tạo thư mục "trans_miss", vui lòng không xóa');
        }

        const files = await fs.readdir(inputDir);
        const txtFiles = files.filter((file) => file.endsWith(".txt"));

        if (txtFiles.length === 0) {
            console.log(
                chalk.yellow(
                    "Không tìm thấy file .txt nào trong thư mục 'raw_text'"
                )
            );
        }

        console.log(
            chalk.green(`Tìm thấy ${txtFiles.length} file .txt để dịch...\n`)
        );

        function buildPrompt(content) {
            return (
                `Bạn là hệ thống dịch dữ liệu game (các cặp SelfId=/Text=).

NHIỆM VỤ:
Dịch sang tiếng Việt phần văn bản hiển thị trong mỗi dòng bắt đầu bằng "Text=" và TRẢ VỀ DUY NHẤT toàn bộ file đã dịch ở dạng RAW (không thêm mô tả, không code fence, không câu mở đầu/kết thúc).

QUY TẮC BẮT BUỘC (TUÂN THỦ 100%):
1. Mỗi dòng SelfId= giữ nguyên tuyệt đối (không dịch, không sửa).
2. Giữ nguyên số dòng và thứ tự dòng so với bản gốc (không thêm, không bỏ).
3. Trong mọi dòng Text=:
   - TẤT CẢ chuỗi nằm trong <...> hoặc {...} giữ nguyên: tên tag, số lượng.
   - KHÔNG tạo thêm tag mới (ví dụ: không tự thêm <Cap> v.v. nếu gốc không có).
   - KHÔNG xóa hoặc rút gọn bất kỳ tag nào.
   - KHÔNG thay cả cụm có nhiều tag bằng 1 từ/câu ngắn (ví dụ biến cả đoạn “… to <IfSing_VALUE3(... )> senses!” thành “bình thường!” là SAI).
4. Tag có tham số (ví dụ <IfSing_VALUE(a,b)>, <IfSing_VALUE3(arg1,arg2)>, <IfPlrNoun_TARGET(... )>):
   - Chỉ dịch CHỮ THUẦN trong từng tham số; giữ nguyên số tham số, dấu phẩy, tag lồng.
   - Ví dụ: <IfSing_VALUE(point,points)> → <IfSing_VALUE(điểm,điểm)>
             <IfSing_VALUE3(<DefSgl_TARGET> returns,The party return)> → <IfSing_VALUE3(<DefSgl_TARGET> trở về,Đội trở về)>
5. Tag đơn (<cf>, <Cap>, <NO_INPUT>, <ERROR!> …) giữ nguyên (không dịch nội dung bên trong như <ERROR!>).
6. Nếu tiếng Việt không phân biệt số ít/số nhiều: dùng cùng một từ (điểm,điểm).
7. Nếu không chắc cách dịch bên trong tham số → giữ nguyên tham số đó (an toàn hơn).
8. Ký tự đầu tiên của câu trả lời phải đúng ký tự đầu của file gốc; ký tự cuối cùng phải là ký tự cuối cùng của file gốc (nếu gốc kết thúc bằng 1 newline thì giữ đúng 1 newline).
9. CẤM mọi cụm: "Dưới đây", "Kết quả", "Here is", "Output", "File:", "START", "END", và cấm ba backtick để bình luận.
10. TRƯỚC KHI TRẢ KẾT QUẢ: Với MỖI dòng Text=:
    - Đếm số tag <...> (tổng số dấu mở) và so sánh với dòng gốc tương ứng. Nếu lệch → tự sửa khôi phục đầy đủ tag gốc, chỉ giữ phần dịch text thuần.

Ví dụ:
Gốc: Text=<IfSing_VALUE(point,points)> awarded!
Đúng: Text=<IfSing_VALUE(điểm,điểm)> được trao!
Sai:  Text=Điểm được trao!   (mất tag)

BẮT ĐẦU NỘI DUNG ĐÃ DỊCH (raw, không thêm gì ngoài nội dung):
` + content
            );
        }

        // xử lý từng file
        for (const file of txtFiles) {
            const filePath = path.join(inputDir, file);
            const content = await fs.readFile(filePath, "utf-8");

            const prompt = buildPrompt(content);

            const spinner = ora(`Đang dịch file: ${file}`).start();

            const translated = await gemini(prompt);

            if (!translated) {
                spinner.fail(`Không dịch được file: ${file}`);
                continue;
            }

            spinner.succeed(`Dịch xong file: ${file}`);

            const outputFile = path.join(
                outputDir,
                file.replace(/(\.\w+)$/, "_vi$1")
            );

            const outputFileMiss = path.join(
                missDir,
                file.replace(/(\.\w+)$/, "_miss$1")
            );
            const outputFileMissLog = path.join(
                missDir,
                file.replace(/(\.\w+)$/, "_miss_log$1")
            );

            // check: bản dịch so với bản gốc
            const issues = checkGameTranslation(content, translated);
            console.log(chalk.blue(`Check xong: ${file}`));
            if (issues.length === 1 && issues[0].startsWith("OK:")) {
                // Thành công
                await fs.writeFile(outputFile, translated, "utf-8");
                console.log(
                    chalk.green(
                        `Thành công! Không có vấn đề nào: ${outputFile}\n`
                    )
                );
            } else {
                // thất bại
                console.log(
                    chalk.red(
                        `- Phát hiện ${issues.length} vấn đề với "${file}"`
                    )
                );
                await fs.writeFile(outputFileMiss, translated, "utf-8");
                console.log(
                    chalk.red(`- Bản dịch có vấn đề: ${outputFileMiss}`)
                );
                console.log(
                    chalk.red(`- Đã ghi log vấn đề vào: ${outputFileMissLog}`)
                );
                // ghi log vào file log
                await fs.writeFile(
                    outputFileMissLog,
                    issues.join("\n") + "\n",
                    "utf-8"
                );
            }
        }

        console.log("Đã hoàn thành.");
    } catch (error) {
        console.error(error.message || error);
    }
}

main();
