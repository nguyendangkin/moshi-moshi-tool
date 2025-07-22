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

// Biến global để lưu đường dẫn file log chính
let runLogFile = null;

/**
 * Ghi log vào file log chính của session
 * @param {string} message - Nội dung log
 */
async function writeToMainLog(message) {
    if (runLogFile) {
        await fs.appendFile(runLogFile, `${message}\n`);
    }
}

/**
 * Ghi log chi tiết các vấn đề của file/chunk
 * @param {string} fileName - Tên file/chunk
 * @param {Array} issues - Danh sách vấn đề
 * @param {string} type - Loại ('file' hoặc 'chunk')
 */
async function logIssuesDetails(fileName, issues, type = "file") {
    const timestamp = new Date().toISOString();
    const logContent = [
        `=== VẤN ĐỀ ${type.toUpperCase()}: ${fileName} ===`,
        `Thời gian: ${timestamp}`,
        `Số lượng vấn đề: ${issues.length}`,
        `Chi tiết các vấn đề:`,
        ...issues.map((issue, index) => `${index + 1}. ${issue}`),
        `${"=".repeat(50)}`,
        "", // Dòng trống
    ];

    await writeToMainLog(logContent.join("\n"));
}

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
        const errorMsg = `LỖI: Không tìm thấy chunk gốc tại "${originalContentPath}" cho chunk lỗi "${chunkFileName}". Bỏ qua.`;
        console.log(chalk.red(errorMsg));
        await writeToMainLog(`[ERROR] ${errorMsg}`);
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
        await writeToMainLog(
            `[ERROR] Lỗi API khi dịch chunk "${baseChunkName}": ${e.message}`
        );
    }

    const chunkElapsed = Date.now() - chunkStart;
    clearInterval(intervalId);

    if (!translated || hadError) {
        const failMsg = `Dịch thất bại chunk: ${baseChunkName} | ${formatDuration(
            chunkElapsed
        )}`;
        spinner.fail(failMsg);
        await writeToMainLog(`[FAIL] ${failMsg}`);
        return { success: false, chunkFileName };
    }

    const successMsg = `Dịch xong chunk: ${baseChunkName} | ${formatDuration(
        chunkElapsed
    )}`;
    spinner.succeed(successMsg);
    await writeToMainLog(`[SUCCESS] ${successMsg}`);

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

        const okMsg = `Chunk thành công: ${outputChunkFile}`;
        console.log(chalk.green(okMsg));
        await writeToMainLog(`[OK] ${okMsg}`);
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

        const issueMsg = `Phát hiện ${issues.length} vấn đề với chunk "${baseChunkName}"`;
        console.log(chalk.red(`- ${issueMsg}`));

        // Ghi log chi tiết các vấn đề vào file log chính
        await logIssuesDetails(baseChunkName, issues, "chunk");

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

        await writeToMainLog(
            `[ISSUES] ${issueMsg} - Đã lưu vào ${outputChunkMiss}`
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

        // Khởi tạo file log chính
        runLogFile = path.join(
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
        await writeToMainLog("=== BẮT ĐẦU PHIÊN DỊCH MỚI ===");
        await writeToMainLog(`Thời gian bắt đầu: ${new Date().toISOString()}`);

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
            const noProjectMsg =
                "Không tìm thấy dự án nào để xử lý. Chương trình kết thúc.";
            console.log(chalk.yellow(noProjectMsg));
            await writeToMainLog(`[INFO] ${noProjectMsg}`);
            return;
        }

        await writeToMainLog(
            `Tìm thấy ${projects.size} dự án: ${Array.from(projects).join(
                ", "
            )}`
        );

        // In danh sách file trong inputDir (raw files)
        const rawTxtFiles = filesInRaw.filter((f) => f.endsWith(".txt"));
        if (rawTxtFiles.length > 0) {
            console.log(chalk.green("Tìm thấy các file cần xử lý:"));
            rawTxtFiles.forEach((file) => console.log(" - " + file));
            await writeToMainLog(`Raw files: ${rawTxtFiles.join(", ")}`);
        }

        // 2. Lặp qua từng dự án
        for (const baseName of projects) {
            console.log(
                chalk.magentaBright(`\n--- Xử lý dự án: ${baseName} ---`)
            );
            await writeToMainLog(`\n--- BẮT ĐẦU XỬ LÝ DỰ ÁN: ${baseName} ---`);

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

            await writeToMainLog(
                `Trạng thái dự án: file_exists=${fileExists}, is_large=${isLargeFileProject}, has_miss=${hasSmallFileMiss}`
            );

            // 3. Nếu file gốc tồn tại và chưa từng split
            if (fileExists && !isLargeFileProject) {
                const stats = await fs.stat(originalFilePath);
                const sizeKB = stats.size / 1024;
                if (sizeKB > 50) {
                    const splitMsg = `File "${baseName}.txt" lớn (${sizeKB.toFixed(
                        1
                    )} KB). Bắt đầu tách...`;
                    console.log(chalk.white(splitMsg));
                    await writeToMainLog(`[SPLIT] ${splitMsg}`);

                    const { count } = await splitToChunks(
                        originalFilePath,
                        rawTextTempChunks
                    );

                    const splitResultMsg = `Đã tách file thành ${count} chunk.`;
                    console.log(chalk.green(`-> ${splitResultMsg}`));
                    await writeToMainLog(`[SPLIT] ${splitResultMsg}`);

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

                await writeToMainLog(
                    `Chunks status: raw=${chunksInRaw.length}, miss=${chunksInMiss.length}, translated=${chunksInTrans.length}`
                );

                // FIX: KHÔNG DỊCH LẠI MISS CHUNKS - chỉ dịch chunk mới
                const chunksToProcess = [
                    ...chunksInRaw.map((f) => path.join(rawTextTempChunks, f)),
                    // Bỏ phần retry miss chunks
                ];

                if (chunksToProcess.length > 0) {
                    const processMsg = `Cần dịch ${chunksToProcess.length} chunk...`;
                    console.log(chalk.yellow(processMsg));
                    await writeToMainLog(`[PROCESS] ${processMsg}`);

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
                    const mergeMsg = `✓ Không còn chunk nào chưa dịch. Bắt đầu ghép...`;
                    console.log(chalk.green(mergeMsg));
                    await writeToMainLog(`[MERGE] ${mergeMsg}`);

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
                        const completeMsg = `HOÀN THÀNH FILE: ${path.basename(
                            mergedFile
                        )}`;
                        console.log(
                            chalk.bgGreen.black.bold(`\n  ${completeMsg}  \n`)
                        );
                        await writeToMainLog(`[COMPLETE] ${completeMsg}`);

                        // Dọn dẹp
                        if (fileExists)
                            await fs.remove(originalFilePath).catch(() => {});
                        for (const p of finalTranslatedChunks)
                            await fs.remove(p).catch(() => {});
                        await writeToMainLog(
                            `[CLEANUP] Đã dọn dẹp các chunk và file gốc cho ${baseName}`
                        );
                    }
                } else {
                    const pendingMsg = `✗ Còn ${updatedChunksInRaw.length} chunk chưa dịch hoặc ${updatedMiss.length} chunk lỗi. Sẽ thử lại lần sau.`;
                    console.log(chalk.yellow(pendingMsg));
                    await writeToMainLog(`[PENDING] ${pendingMsg}`);
                }
            }
            // 6. File nhỏ - CHỈ dịch file gốc, KHÔNG dịch lại miss
            else if (fileExists) {
                const smallFileMsg = `Dự án file nhỏ. Bắt đầu dịch trực tiếp...`;
                console.log(chalk.cyan(smallFileMsg));
                await writeToMainLog(`[SMALL_FILE] ${smallFileMsg}`);

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
                    await writeToMainLog(
                        `[ERROR] Lỗi API khi dịch file "${baseName}.txt": ${e.message}`
                    );
                }
                const fileElapsed = Date.now() - fileStart;
                clearInterval(intervalId);

                if (!translated) {
                    const failMsg = `Dịch thất bại file: ${baseName}.txt | ${formatDuration(
                        fileElapsed
                    )}`;
                    spinner.fail(failMsg);
                    await writeToMainLog(`[FAIL] ${failMsg} (API error)`);
                    continue;
                }

                const successMsg = `Dịch xong file: ${baseName}.txt | ${formatDuration(
                    fileElapsed
                )}`;
                spinner.succeed(successMsg);
                await writeToMainLog(`[SUCCESS] ${successMsg}`);

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
                        await writeToMainLog(
                            `[CLEANUP] Đã dọn dẹp các file miss cũ cho: ${baseName}`
                        );
                    }

                    const okMsg = `Thành công! File đã được lưu tại: ${outputFile}`;
                    console.log(chalk.green(okMsg + "\n"));
                    await writeToMainLog(`[OK] ${okMsg}`);
                } else {
                    const issueMsg = `Phát hiện ${issues.length} vấn đề với file "${baseName}.txt"`;
                    console.log(chalk.red(`- ${issueMsg}`));

                    // Ghi log chi tiết các vấn đề vào file log chính
                    await logIssuesDetails(baseName + ".txt", issues, "file");

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

                    const keepMsg = `Giữ file gốc "${baseName}.txt" để dịch lại lần sau.`;
                    console.log(chalk.yellow(`-> ${keepMsg}`));

                    await writeToMainLog(
                        `[ISSUES] ${issueMsg} - ${keepMsg} - Đã lưu vào ${outputFileMiss}`
                    );
                }
            }
            // FIX: BỎ HOÀN TOÀN phần xử lý file miss riêng lẻ
        }

        // Tổng kết
        const overallElapsed = Date.now() - processStart;
        const summaryMsg = [
            "\n--- TỔNG KẾT ---",
            "Hoàn tất toàn bộ quá trình!",
            `Tổng thời gian thực thi: ${formatDuration(overallElapsed)}`,
            `Chi tiết log tại: ${runLogFile}`,
        ];

        console.log(chalk.green.bold(summaryMsg[0]));
        console.log(chalk.green(summaryMsg[1]));
        console.log(chalk.green(summaryMsg[2]));
        console.log(chalk.white(summaryMsg[3]));

        await writeToMainLog(`\n=== TỔNG KẾT PHIÊN DỊCH ===`);
        await writeToMainLog(`Thời gian kết thúc: ${new Date().toISOString()}`);
        await writeToMainLog(
            `Tổng thời gian thực thi: ${formatDuration(overallElapsed)}`
        );
        await writeToMainLog(`Số dự án đã xử lý: ${projects.size}`);
        await writeToMainLog(`=== KẾT THÚC PHIÊN DỊCH ===`);
    } catch (error) {
        const errorMsg = `LỖI NGHIÊM TRỌNG TRONG QUÁ TRÌNH THỰC THI: ${error.message}`;
        console.error(chalk.red.bold("\n" + errorMsg), error);
        if (runLogFile) {
            await writeToMainLog(`[CRITICAL_ERROR] ${errorMsg}`);
            await writeToMainLog(`Stack trace: ${error.stack}`);
        }
    }
}

main();
