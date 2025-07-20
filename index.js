import chalk from "chalk";
import gemini from "./modules/gemini/gemini.js";
import fs from "fs-extra";
import path from "path";
import ora from "ora";
import checkGameTranslation from "./modules/validateText/validateTranslation.js";
import buildPrompt from "./prompt.js";
import formatDuration from "./helpers/formatDuration.js";
import ollama from "./modules/gemini/ollama.js";

// trở tới các folder cần thiết
const inputDir = path.join(process.cwd(), "raw_text");
const outputDir = path.join(process.cwd(), "trans_text");
const missDir = path.join(process.cwd(), "trans_miss");
const logsDir = path.join(process.cwd(), "logs_system");

async function main() {
    try {
        // biến đếm số lượng thành công hay thất bại
        let successCount = 0;
        let failCount = 0;
        const processStart = Date.now();

        // chỉ định file ghi log hệ thống
        const runLogFile = path.join(
            logsDir,
            `system_log_${new Date()
                .toISOString()
                .replace(/[:]/g, "-")
                .replace(/\..+/, "")}.txt`
        );

        // kiểm tra và tạo các thư mục nếu chưa có
        if (await fs.ensureDir(inputDir)) {
            console.log('Vừa tạo thư mục "raw_text", vui lòng nạp file .text.');
        }
        if (await fs.ensureDir(outputDir)) {
            console.log('Vừa tạo thư mục "trans_text", vui lòng không xóa.');
        }
        if (await fs.ensureDir(missDir)) {
            console.log('Vừa tạo thư mục "trans_miss", vui lòng không xóa');
        }
        if (await fs.ensureDir(logsDir)) {
            console.log('Vừa tạo thư mục "logs_system", vui lòng không xóa');
        }

        // lấy các file trong thực mục
        const files = await fs.readdir(inputDir);
        // lọc lấy các file .txt và thêm thông tin size
        const txtFilesWithSize = await Promise.all(
            files
                .filter((file) => file.endsWith(".txt"))
                .map(async (file) => {
                    const filePath = path.join(inputDir, file);
                    const stats = await fs.stat(filePath);
                    return { file, size: stats.size };
                })
        );

        // sắp xếp theo size tăng dần
        txtFilesWithSize.sort((a, b) => a.size - b.size);

        // chỉ giữ danh sách tên file
        const txtFiles = txtFilesWithSize.map((f) => f.file);

        // check tồn tại
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

        // bắt đầu xử lý từng file một
        for (let i = 0; i < txtFiles.length; i++) {
            const file = txtFiles[i];
            // lấy ra path của file
            const filePath = path.join(inputDir, file);
            // lấy ra nội dung của file
            const content = await fs.readFile(filePath, "utf-8");

            // Lấy kích thước file (KB)
            const stats = await fs.stat(filePath);
            const sizeKB = (stats.size / 1024).toFixed(1); // 1 chữ số thập phân

            const prompt = buildPrompt(content);

            // bắt đầu tính toán thời gian dịch
            const fileStart = Date.now();
            let lastElapsedStr = "0 giây";

            // Log thông tin về file
            const spinner = ora(
                `Đang dịch file ${i + 1}/${
                    txtFiles.length
                } (${sizeKB} KB): ${file} | 0 giây`
            ).start();
            // Interval cập nhật thời gian mỗi giây
            const intervalId = setInterval(() => {
                const elapsed = Date.now() - fileStart;
                const elapsedStr = formatDuration(elapsed);
                if (elapsedStr !== lastElapsedStr) {
                    lastElapsedStr = elapsedStr;
                    spinner.text = `Đang dịch file ${i + 1}/${
                        txtFiles.length
                    } (${sizeKB} KB): ${file} | ${elapsedStr}`;
                }
            }, 1000);

            // Gọi hàm dịch
            let translated;
            let hadError = false;
            try {
                translated = await gemini(prompt);
            } catch (e) {
                hadError = true;
                translated = null;
            }

            // tính toán thời gian
            const fileElapsed = Date.now() - fileStart;

            clearInterval(intervalId);

            // check tồn tại bản dịch
            if (!translated || hadError) {
                spinner.fail(
                    `Dịch thất bại file ${i + 1}/${
                        txtFiles.length
                    } (${sizeKB} KB): ${file} | ${formatDuration(fileElapsed)}`
                );
                failCount++;
                continue;
            }

            // log thông tin về file đã oke
            spinner.succeed(
                `Dịch xong file số ${i + 1} (${sizeKB} KB) trong tổng ${
                    txtFiles.length
                } file: ${file} | ${formatDuration(fileElapsed)}`
            );

            // Tạo đường dẫn cho file dịch
            // Giữ nguyên đuôi file gốc
            const outputFile = path.join(
                outputDir,
                file.replace(/(\.\w+)$/, "$1")
            );

            // Tạo đường dẫn cho file dịch có vấn đề
            // Thêm _miss vào tên file
            const outputFileMiss = path.join(
                missDir,
                file.replace(/(\.\w+)$/, "_miss$1")
            );
            // Tạo đường dẫn cho file ghi log vấn đề
            // Thêm _miss_log vào tên file
            const outputFileMissLog = path.join(
                missDir,
                file.replace(/(\.\w+)$/, "_miss_log$1")
            );

            // check: bản dịch so với bản gốc
            const issues = checkGameTranslation(content, translated);
            console.log(chalk.green(`Check xong: ${file}`));
            if (issues.length === 1 && issues[0].startsWith("OKE:")) {
                // Thành công
                await fs.writeFile(outputFile, translated, "utf-8");
                // Xóa file gốc khi thành công
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
                        `- Phát hiện ${issues.length} vấn đề khi so với "${file}"`
                    )
                );
                await fs.writeFile(outputFileMiss, translated, "utf-8");
                console.log(
                    chalk.red(`- Bản dịch có vấn đề: ${outputFileMiss}`)
                );

                // ghi log chi tiết vào file log miss
                await fs.writeFile(
                    outputFileMissLog,
                    issues.join("\n") + "\n",
                    "utf-8"
                );
                console.log(
                    chalk.red(`- Đã ghi các vấn đề vào: ${outputFileMissLog}`)
                );

                // Ghi log hệ thống
                await fs.appendFile(
                    runLogFile,
                    `- Phát hiện ${
                        issues.length
                    } vấn đề với "${file}" (size: ${sizeKB} KB, time: ${formatDuration(
                        fileElapsed
                    )})\n`
                );
                console.log(chalk.white(`Đã ghi log vào: ${runLogFile}`));
            }
        }

        // tính tổng thời gian toàn bộ chương trình
        const overallElapsed = Date.now() - processStart;

        // Tổng kết
        console.log(
            chalk.green(
                `Hoàn thành! ${successCount} thành công, ${failCount} thất bại trong tổng ${txtFiles.length} file.`
            )
        );

        console.log(
            chalk.green(
                `Tổng thời gian toàn bộ chương trình (bao gồm I/O, khởi tạo, v.v.): ${formatDuration(
                    overallElapsed
                )}`
            )
        );
    } catch (error) {
        console.error(error.message || error);
    }
}

main();
