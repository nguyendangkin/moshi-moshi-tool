import chalk from "chalk";
import gemini from "./modules/gemini/gemini.js";
import fs from "fs-extra";
import path from "path";
import ora from "ora";
import checkGameTranslation from "./modules/validateText/validateTranslation.js";
import buildPrompt from "./prompt.js";
import formatDuration from "./helpers/formatDuration.js";
import {
    splitToChunks,
    mergeChunksFromFile,
    listChunkFiles,
} from "./modules/chunks/chunks.js";

// Trỏ tới các folder cần thiết
const inputDir = path.join(process.cwd(), "raw_text");
const outputDir = path.join(process.cwd(), "trans_text");
const missDir = path.join(process.cwd(), "trans_miss");
const logsDir = path.join(process.cwd(), "logs_system");
const rawTextTempChunks = path.join(process.cwd(), "raw_text_temp_chunks");

async function cleanupMissArtifacts(baseChunkName) {
    const missFilePath = path.join(
        missDir,
        baseChunkName.replace(/(\.\w+)$/, "_miss$1")
    );
    const missLogFilePath = path.join(
        missDir,
        baseChunkName.replace(/(\.\w+)$/, "_miss_log$1")
    );
    await fs.remove(missFilePath).catch(() => {});
    await fs.remove(missLogFilePath).catch(() => {});
    console.log(
        chalk.gray(`-> Đã dọn dẹp các file miss nếu có cho: ${baseChunkName}`)
    );
}

/**
 * Xử lý dịch một chunk duy nhất, có khả năng xử lý lại các chunk bị lỗi.
 * @param {string} chunkFilePath - Đường dẫn đến chunk cần xử lý (có thể trong `rawTextTempChunks` hoặc `missDir`).
 * @param {number} fileIndex - (Không còn dùng) Chỉ số file.
 * @param {number} originalSizeKB - (Không còn dùng) Kích thước file gốc.
 * @returns {Promise<{success: boolean, chunkFileName: string, issues?: number}>}
 */
async function processChunk(chunkFilePath, fileIndex, originalSizeKB) {
    const chunkFileName = path.basename(chunkFilePath);
    const isMissedChunk = chunkFilePath.includes(missDir);

    // Tên chunk cơ bản, không có hậu tố _miss hay _miss_log
    const baseChunkName = chunkFileName.replace(/_miss_log|_miss/g, "");

    // Nội dung gốc để dịch luôn được lấy từ `rawTextTempChunks`
    const originalContentPath = path.join(rawTextTempChunks, baseChunkName);
    let content;

    try {
        content = await fs.readFile(originalContentPath, "utf-8");
    } catch (e) {
        console.log(
            chalk.red(
                `LỖI: Không tìm thấy chunk gốc tại "${originalContentPath}" cho chunk lỗi "${chunkFileName}". Bỏ qua.`
            )
        );
        return { success: false, chunkFileName };
    }

    // Gửi cho AI
    const prompt = buildPrompt(content);

    // Bắt đầu tính toán thời gian dịch chunk
    const chunkStart = Date.now();
    let lastElapsedStr = "0 giây";

    // Log thông tin về chunk
    const spinnerText = isMissedChunk
        ? "Dịch lại chunk lỗi"
        : "Đang dịch chunk";
    const spinner = ora(`${spinnerText}: ${baseChunkName} | 0 giây`).start();

    // Interval cập nhật thời gian mỗi giây
    const intervalId = setInterval(() => {
        const elapsed = Date.now() - chunkStart;
        const elapsedStr = formatDuration(elapsed);
        if (elapsedStr !== lastElapsedStr) {
            lastElapsedStr = elapsedStr;
            spinner.text = `${spinnerText}: ${baseChunkName} | ${elapsedStr}`;
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

    const chunkElapsed = Date.now() - chunkStart;
    clearInterval(intervalId);

    if (!translated || hadError) {
        spinner.fail(
            `Dịch thất bại chunk: ${baseChunkName} | ${formatDuration(
                chunkElapsed
            )}`
        );
        return { success: false, chunkFileName };
    }

    spinner.succeed(
        `Dịch xong chunk: ${baseChunkName} | ${formatDuration(chunkElapsed)}`
    );

    // Check: bản dịch so với bản gốc
    const issues = checkGameTranslation(content, translated);
    console.log(chalk.green(`Check xong chunk: ${baseChunkName}`));

    if (issues.length === 1 && issues[0].startsWith("OKE:")) {
        // Thành công - ghi chunk đã dịch vào output
        const outputChunkFile = path.join(outputDir, baseChunkName);
        await fs.writeFile(outputChunkFile, translated, "utf-8");

        // Xóa chunk gốc trong temp
        await fs.remove(originalContentPath).catch(() => {});

        await cleanupMissArtifacts(baseChunkName);

        console.log(chalk.green(`Chunk thành công: ${outputChunkFile}`));
        return { success: true, chunkFileName: baseChunkName };
    } else {
        // Thất bại - ghi chunk có vấn đề vào miss
        const outputChunkMiss = path.join(
            missDir,
            baseChunkName.replace(/(\.\w+)$/, "_miss$1")
        );
        const outputChunkMissLog = path.join(
            missDir,
            baseChunkName.replace(/(\.\w+)$/, "_miss_log$1")
        );

        console.log(
            chalk.red(
                `- Phát hiện ${issues.length} vấn đề với chunk "${baseChunkName}"`
            )
        );

        await fs.writeFile(outputChunkMiss, translated, "utf-8");
        console.log(chalk.red(`- Chunk có vấn đề: ${outputChunkMiss}`));

        await fs.writeFile(
            outputChunkMissLog,
            issues.join("\n") + "\n",
            "utf-8"
        );
        console.log(
            chalk.red(`- Đã ghi các vấn đề chunk vào: ${outputChunkMissLog}`)
        );

        return {
            success: false,
            chunkFileName: baseChunkName,
            issues: issues.length,
        };
    }
}

async function main() {
    try {
        const processStart = Date.now();
        const runLogFile = path.join(
            logsDir,
            `system_log_${new Date()
                .toISOString()
                .replace(/[:]/g, "-")
                .replace(/\..+/, "")}.txt`
        );

        // Đảm bảo thư mục tồn tại
        for (const dir of [
            inputDir,
            outputDir,
            missDir,
            logsDir,
            rawTextTempChunks,
        ]) {
            await fs.ensureDir(dir);
        }
        console.log("Các thư mục cần thiết đã sẵn sàng.");

        console.log(
            chalk.cyan("\n=== BẮT ĐẦU QUÁ TRÌNH DỊCH VÀ GHÉP FILE ===")
        );

        // 1. Lấy danh sách "baseName" - CHỈ lấy projects thật sự
        const projects = new Set();
        const filesInRaw = await fs.readdir(inputDir).catch(() => []);
        const allChunks = await fs.readdir(rawTextTempChunks).catch(() => []);
        const allMisses = await fs.readdir(missDir).catch(() => []);

        // Lấy file .txt gốc từ inputDir
        filesInRaw
            .filter((f) => f.endsWith(".txt"))
            .forEach((f) => projects.add(path.basename(f, ".txt")));

        // Lấy baseName từ chunk files (CHỈ project gốc, không phải chunk riêng lẻ)
        allChunks
            .filter((f) => f.includes("_chunk_"))
            .forEach((f) => {
                const baseName = f.split("_chunk_")[0];
                projects.add(baseName);
            });

        // Lấy baseName từ miss files của PROJECT (không phải chunk miss)
        allMisses
            .filter((f) => f.endsWith("_miss.txt") && !f.includes("_chunk_"))
            .forEach((f) => {
                const baseName = f.replace("_miss.txt", "");
                projects.add(baseName);
            });
        if (projects.size === 0) {
            console.log(
                chalk.yellow(
                    "Không tìm thấy dự án nào để xử lý. Chương trình kết thúc."
                )
            );
            return;
        }

        // In danh sách file trong inputDir (raw files)
        const rawTxtFiles = filesInRaw.filter((f) => f.endsWith(".txt"));
        if (rawTxtFiles.length > 0) {
            console.log(chalk.green("Tìm thấy các file cần xử lý:"));
            rawTxtFiles.forEach((file) => console.log(" - " + file));
        }

        // 2. Lặp qua từng dự án
        for (const baseName of projects) {
            console.log(
                chalk.magentaBright(`\n--- Xử lý dự án: ${baseName} ---`)
            );

            const originalFilePath = path.join(inputDir, `${baseName}.txt`);
            const fileExists = await fs.pathExists(originalFilePath);

            // Kiểm tra file miss (cho file nhỏ)
            const smallFileMissPath = path.join(
                missDir,
                `${baseName}_miss.txt`
            );
            const hasSmallFileMiss = await fs.pathExists(smallFileMissPath);

            // Lấy chunk liên quan
            const chunksInRaw = (
                await listChunkFiles(rawTextTempChunks, baseName, ".txt")
            ).map((p) => path.basename(p));
            const chunksInMiss = (await fs.readdir(missDir)).filter(
                (f) =>
                    f.startsWith(baseName + "_chunk_") &&
                    f.endsWith("_miss.txt")
            );
            const chunksInTrans = (
                await listChunkFiles(outputDir, baseName, ".txt")
            ).map((p) => path.basename(p));

            // Check xem dự án này là file lớn không
            let isLargeFileProject =
                chunksInRaw.length > 0 ||
                chunksInMiss.length > 0 ||
                chunksInTrans.length > 0;
            let wasJustSplit = false;

            // 3. Nếu file gốc tồn tại và chưa từng split
            if (fileExists && !isLargeFileProject) {
                const stats = await fs.stat(originalFilePath);
                const sizeKB = stats.size / 1024;
                if (sizeKB > 50) {
                    console.log(
                        chalk.white(
                            `File "${baseName}.txt" lớn (${sizeKB.toFixed(
                                1
                            )} KB). Bắt đầu tách...`
                        )
                    );
                    const { count } = await splitToChunks(
                        originalFilePath,
                        rawTextTempChunks
                    );
                    console.log(
                        chalk.green(`-> Đã tách file thành ${count} chunk.`)
                    );

                    const newChunks = await listChunkFiles(
                        rawTextTempChunks,
                        baseName,
                        ".txt"
                    );
                    chunksInRaw.push(...newChunks.map((p) => path.basename(p)));
                    isLargeFileProject = true;
                    wasJustSplit = true;
                }
            }

            // 4. Xử lý file lớn (dự án chunk)
            if (isLargeFileProject) {
                if (!wasJustSplit) {
                    console.log(chalk.cyan(`Dự án file lớn. Hiện trạng:`));
                    console.log(
                        chalk.gray(`- Chunk chưa dịch: ${chunksInRaw.length}`)
                    );
                    console.log(
                        chalk.gray(`- Chunk lỗi (file): ${chunksInMiss.length}`)
                    );
                    console.log(
                        chalk.gray(
                            `- Chunk đã dịch OK: ${chunksInTrans.length}`
                        )
                    );
                }

                // FIX: KHÔNG DỊCH LẠI MISS CHUNKS - chỉ dịch chunk mới
                const chunksToProcess = [
                    ...chunksInRaw.map((f) => path.join(rawTextTempChunks, f)),
                    // Bỏ phần retry miss chunks
                ];

                if (chunksToProcess.length > 0) {
                    console.log(
                        chalk.yellow(
                            `Cần dịch ${chunksToProcess.length} chunk...`
                        )
                    );
                    for (const chunkPath of chunksToProcess) {
                        if (!(await fs.pathExists(chunkPath))) continue;
                        await processChunk(chunkPath, 0, 0);
                    }
                }

                // 5. Kiểm tra điều kiện ghép
                const updatedChunksInRaw = await listChunkFiles(
                    rawTextTempChunks,
                    baseName,
                    ".txt"
                );
                const updatedMiss = (await fs.readdir(missDir)).filter(
                    (f) =>
                        f.startsWith(baseName + "_chunk_") &&
                        f.endsWith("_miss.txt")
                );
                const finalTranslatedChunks = await listChunkFiles(
                    outputDir,
                    baseName,
                    ".txt"
                );

                if (
                    updatedChunksInRaw.length === 0 &&
                    updatedMiss.length === 0 &&
                    finalTranslatedChunks.length > 0
                ) {
                    console.log(
                        chalk.green(
                            `✓ Không còn chunk nào chưa dịch. Bắt đầu ghép...`
                        )
                    );

                    const mergedFile = await mergeChunksFromFile(
                        outputDir,
                        path.join(outputDir, `${baseName}.txt`),
                        {
                            overwrite: true,
                            mergedDir: outputDir,
                            outputFileName: `${baseName}.txt`,
                        }
                    );

                    if (mergedFile) {
                        console.log(
                            chalk.bgGreen.black.bold(
                                `\n  HOÀN THÀNH FILE: ${path.basename(
                                    mergedFile
                                )}  \n`
                            )
                        );

                        // Dọn dẹp
                        if (fileExists)
                            await fs.remove(originalFilePath).catch(() => {});
                        for (const p of finalTranslatedChunks)
                            await fs.remove(p).catch(() => {});
                        await fs.appendFile(
                            runLogFile,
                            `- [${baseName}] Ghép thành công.\n`
                        );
                    }
                } else {
                    console.log(
                        chalk.yellow(
                            `✗ Còn ${updatedChunksInRaw.length} chunk chưa dịch hoặc ${updatedMiss.length} chunk lỗi. Sẽ thử lại lần sau.`
                        )
                    );
                }
            }
            // 6. File nhỏ - CHỈ dịch file gốc, KHÔNG dịch lại miss
            else if (fileExists) {
                console.log(
                    chalk.cyan(`Dự án file nhỏ. Bắt đầu dịch trực tiếp...`)
                );
                const stats = await fs.stat(originalFilePath);
                const sizeKB = (stats.size / 1024).toFixed(1);

                const content = await fs.readFile(originalFilePath, "utf-8");
                const prompt = buildPrompt(content);

                const fileStart = Date.now();
                let lastElapsedStr = "0 giây";

                const spinner = ora(
                    `Đang dịch file (${sizeKB} KB): ${baseName}.txt | 0 giây`
                ).start();
                const intervalId = setInterval(() => {
                    const elapsed = Date.now() - fileStart;
                    const elapsedStr = formatDuration(elapsed);
                    if (elapsedStr !== lastElapsedStr) {
                        lastElapsedStr = elapsedStr;
                        spinner.text = `Đang dịch file (${sizeKB} KB): ${baseName}.txt | ${elapsedStr}`;
                    }
                }, 1000);

                let translated;
                try {
                    translated = await gemini(prompt);
                } catch (e) {
                    translated = null;
                }
                const fileElapsed = Date.now() - fileStart;
                clearInterval(intervalId);

                if (!translated) {
                    spinner.fail(
                        `Dịch thất bại file: ${baseName}.txt | ${formatDuration(
                            fileElapsed
                        )}`
                    );
                    await fs.appendFile(
                        runLogFile,
                        `- [${baseName}] Dịch thất bại (API error).\n`
                    );
                    continue;
                }

                spinner.succeed(
                    `Dịch xong file: ${baseName}.txt | ${formatDuration(
                        fileElapsed
                    )}`
                );

                const issues = checkGameTranslation(content, translated);
                if (issues.length === 1 && issues[0].startsWith("OKE:")) {
                    const outputFile = path.join(outputDir, `${baseName}.txt`);
                    await fs.writeFile(outputFile, translated, "utf-8");
                    await fs.remove(originalFilePath);

                    // Xóa file miss cũ nếu có
                    if (hasSmallFileMiss) {
                        await fs.remove(smallFileMissPath).catch(() => {});
                        const missLogPath = path.join(
                            missDir,
                            `${baseName}_miss_log.txt`
                        );
                        await fs.remove(missLogPath).catch(() => {});
                        console.log(
                            chalk.gray(
                                `-> Đã dọn dẹp các file miss cũ cho: ${baseName}`
                            )
                        );
                    }

                    console.log(
                        chalk.green(
                            `Thành công! File đã được lưu tại: ${outputFile}\n`
                        )
                    );
                    await fs.appendFile(
                        runLogFile,
                        `- [${baseName}] Dịch thành công.\n`
                    );
                } else {
                    console.log(
                        chalk.red(
                            `- Phát hiện ${issues.length} vấn đề với file "${baseName}.txt"`
                        )
                    );
                    const outputFileMiss = path.join(
                        missDir,
                        `${baseName}_miss.txt`
                    );
                    const outputFileMissLog = path.join(
                        missDir,
                        `${baseName}_miss_log.txt`
                    );

                    await fs.writeFile(outputFileMiss, translated, "utf-8");
                    console.log(
                        chalk.red(`- Bản dịch có vấn đề: ${outputFileMiss}`)
                    );

                    await fs.writeFile(
                        outputFileMissLog,
                        issues.join("\n") + "\n",
                        "utf-8"
                    );
                    console.log(
                        chalk.red(
                            `- Đã ghi các vấn đề vào: ${outputFileMissLog}`
                        )
                    );

                    console.log(
                        chalk.yellow(
                            `-> Giữ file gốc "${baseName}.txt" để dịch lại lần sau.`
                        )
                    );

                    await fs.appendFile(
                        runLogFile,
                        `- [${baseName}] Dịch thất bại (${issues.length} vấn đề) - giữ file gốc.\n`
                    );
                }
            }
            // FIX: BỎ HOÀN TOÀN phần xử lý file miss riêng lẻ
        }

        // Tổng kết
        const overallElapsed = Date.now() - processStart;
        console.log(chalk.green.bold(`\n\n--- TỔNG KẾT ---`));
        console.log(chalk.green(`Hoàn tất toàn bộ quá trình!`));
        console.log(
            chalk.green(
                `Tổng thời gian thực thi: ${formatDuration(overallElapsed)}`
            )
        );
        console.log(chalk.white(`Chi tiết log tại: ${runLogFile}`));
    } catch (error) {
        console.error(
            chalk.red.bold("\nLỖI NGHIÊM TRỌNG TRONG QUÁ TRÌNH THỰC THI:"),
            error
        );
    }
}

main();
