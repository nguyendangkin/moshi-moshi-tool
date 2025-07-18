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

            const prompt = `Việt hóa phần Text được hiển thị. Giữ nguyên định dạng, cấu trúc file, số lượng các tag, biến:\n${content}`;

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
            console.log(chalk.blue(`Đang check: ${file}`));
            const issues = checkGameTranslation(content, translated);
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
                        `Phát hiện ${issues.length} vấn đề trong file "${file}"`
                    )
                );
                await fs.writeFile(outputFileMiss, translated, "utf-8");
                console.log(
                    chalk.red(`Có vấn đề cần kiểm tra: ${outputFileMiss}`)
                );
                console.log(
                    chalk.red(`Đã xuất log các vấn đề: ${outputFileMissLog}`)
                );
                // ghi log vào file log
                await fs.writeFile(
                    outputFileMissLog,
                    issues.join("\n") + "\n",
                    "utf-8"
                );
            }
        }

        console.log(chalk.green("Đã hoàn thành!"));
    } catch (error) {
        console.error(error.message || error);
    }
}

main();
