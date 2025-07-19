import chalk from "chalk";
import gemini from "./modules/gemini/gemini.js";
import fs from "fs-extra";
import path from "path";
import ora from "ora";
import checkGameTranslation from "./modules/validateText/validateTranslation.js";
import buildPrompt from "./prompt.js";

const inputDir = path.join(process.cwd(), "raw_text");
const outputDir = path.join(process.cwd(), "trans_text");
const missDir = path.join(process.cwd(), "trans_miss");

async function main() {
    try {
        let successCount = 0;
        let failCount = 0;

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

        // xử lý từng file một
        for (let i = 0; i < txtFiles.length; i++) {
            const file = txtFiles[i];
            const filePath = path.join(inputDir, file);
            const content = await fs.readFile(filePath, "utf-8");

            // Lấy kích thước file (KB)
            const stats = await fs.stat(filePath);
            const sizeKB = (stats.size / 1024).toFixed(1); // 1 chữ số thập phân

            const prompt = buildPrompt(content);

            // Log chi tiết
            const spinner = ora(
                `Đang dịch file số ${i + 1} (${sizeKB} KB) trong tổng ${
                    txtFiles.length
                } file: ${file}`
            ).start();

            const translated = await gemini(prompt);
            if (!translated) {
                spinner.fail(`Không dịch được file: ${file}`);
                continue;
            }

            spinner.succeed(`Dịch xong file: ${file}`);

            const outputFile = path.join(
                outputDir,
                file.replace(/(\.\w+)$/, "$1")
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
            if (issues.length === 1 && issues[0].startsWith("OKE:")) {
                // Thành công
                await fs.writeFile(outputFile, translated, "utf-8");

                // Xóa file gốc
                await fs.remove(filePath);
                successCount++;
                console.log(
                    chalk.green(
                        `Thành công! Không có vấn đề nào: ${outputFile}\n`
                    )
                );
            } else {
                // thất bại
                failCount++;
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

        // Tổng kết
        console.log(
            chalk.green(
                `Hoàn thành! ${successCount} thành công, ${failCount} thất bại trong tổng ${txtFiles.length} file.`
            )
        );
    } catch (error) {
        console.error(error.message || error);
    }
}

main();
