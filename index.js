import chalk from "chalk";
import gemini from "./modules/gemini/gemini.js";
import fs from "fs-extra";
import path from "path";
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

        // xử lý file
        for (const file of txtFiles) {
            const filePath = path.join(inputDir, file);
            const content = await fs.readFile(filePath, "utf-8");

            const prompt = `
Dịch các dòng localization của game từ tiếng Anh sang tiếng Việt.
Quy tắc:
- Giữ nguyên tất cả các dòng, thứ tự và định dạng.
- Giữ nguyên các dòng không bắt đầu bằng "Text=" (ví dụ: SelfId=, [~NAMES-INCLUDED~], ...).
- Chỉ dịch phần nội dung sau "Text=".
- Bảo toàn TẤT CẢ các token/thẻ: {VAR}, <If...(...)>, <KEY_WAIT>, <cf>, <NO_INPUT>, <--->, v.v.
- Dịch các đối số bên trong thẻ <If...(..., ...)> riêng biệt; giữ nguyên số lượng và dấu phẩy.
- Không thêm khoảng trắng dư thừa, không dùng markdown, không bọc trong dấu ngoặc kép.
- Ưu tiên tính tự nhiên, rõ ràng; các trò chơi chữ slime trong tiếng Anh có thể dịch bình thường nếu khó hiểu.
- "(slurp)" -> hiệu ứng âm thanh tiếng Việt tự nhiên "(nuốt nước bọt)".
Chỉ trả về nội dung file đã dịch, KHÔNG thêm gì khác.

${content}
`;

            console.log(chalk.blue(`Đang dịch: ${file}`));

            const translated = await gemini(prompt);
            if (!translated) {
                console.log(chalk.red(`Không dịch được file: ${file}`));
                continue;
            }

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
                    chalk.red(`Phát hiện ${issues.length} vấn đề với "${file}"`)
                );
                await fs.writeFile(outputFileMiss, translated, "utf-8");
                console.log(chalk.red(`Bản dịch có vấn đề: ${outputFileMiss}`));
                console.log(
                    chalk.red(`Đã ghi log vấn đề vào: ${outputFileMissLog}`)
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
