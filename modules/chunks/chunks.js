import fs from "fs-extra";
import path from "path";

export function junks(contentFile, coupleSize = 250) {
    const lines = contentFile.split(/\r?\n/);
    const chunkSize = coupleSize * 2;
    const chunks = [];

    for (let i = 0; i < lines.length; i += chunkSize) {
        const part = lines.slice(i, i + chunkSize).join("\n");
        chunks.push(part);
    }
    return chunks;
}

export async function splitToChunks(file, outputDir, coupleSize = 250) {
    // Đọc nội dung file gốc
    const contentFile = await fs.readFile(file, "utf-8");

    // Tách thành các chunks
    const result = junks(contentFile, coupleSize);

    // Đảm bảo thư mục tồn tại
    await fs.ensureDir(outputDir);

    // Lấy tên file gốc không có extension
    const baseName = path.basename(file, path.extname(file));

    for (let i = 0; i < result.length; i++) {
        let chunkText = result[i];
        // đảm bảo newline kết thúc để ghép dễ
        if (!chunkText.endsWith("\n") && !chunkText.endsWith("\r\n")) {
            chunkText += "\n";
        }
        const chunkPath = path.join(outputDir, `${baseName}_${i + 1}.txt`);
        await fs.writeFile(chunkPath, chunkText, "utf-8");
    }

    console.log(`Đã xuất ${result.length} chunks vào thư mục: ${outputDir}`);
    return { count: result.length };
}

/* ------------------------------------------------------------------ */
/* ---------------------- HÀM GHÉP LẠI CHUNK ------------------------ */
/* ------------------------------------------------------------------ */

/**
 * Liệt kê danh sách đường dẫn file chunk (đã sắp thứ tự) theo baseName.
 * Ví dụ baseName="GOP_Text_Item.uasset" thì match file {baseName}_<số>.txt.
 */
export async function listChunkFiles(outputDir, baseName, ext = ".txt") {
    const exists = await fs.pathExists(outputDir);
    if (!exists) return [];

    const files = await fs.readdir(outputDir);
    const pattern = new RegExp(
        `^${escapeRegex(baseName)}_(\\d+)${escapeRegex(ext)}$`,
        "i"
    );

    const matched = [];
    for (const f of files) {
        const m = f.match(pattern);
        if (m) {
            matched.push({
                file: f,
                idx: Number(m[1]),
            });
        }
    }

    matched.sort((a, b) => a.idx - b.idx);

    return matched.map((m) => path.join(outputDir, m.file));
}

/**
 * Đọc nội dung các chunk theo thứ tự.
 */
export async function readChunks(outputDir, baseName, ext = ".txt") {
    const chunkFiles = await listChunkFiles(outputDir, baseName, ext);
    const contents = [];
    for (const fp of chunkFiles) {
        contents.push(await fs.readFile(fp, "utf-8"));
    }
    return contents;
}

function ensureTrailingEOL(str, eol = "\n") {
    if (str.endsWith("\r\n")) return str;
    if (str.endsWith("\n")) return str;
    return str + eol;
}

function detectEOL(sample) {
    // Tìm CRLF trước vì đặc trưng Windows
    if (/\r\n/.test(sample)) return "\r\n";
    return "\n";
}

/**
 * Ghép nội dung các chunk thành một chuỗi duy nhất.
 * separator mặc định="" vì mỗi chunk đã chứa newline gốc giữa các dòng.
 * Nếu bạn muốn chắc chắn có newline giữa chunk, truyền separator="\n".
 */
export async function mergeChunks(
    outputDir,
    baseName,
    { ext = ".txt", separator = "" } = {}
) {
    const parts = await readChunks(outputDir, baseName, ext);
    if (parts.length === 0) return "";

    // Nếu caller không truyền separator, ta tự đảm bảo newline an toàn
    if (separator === "") {
        // Auto: bảo đảm chunk nào cũng kết thúc newline, rồi nối ""
        const eol = detectEOL(parts[0]); // đơn giản: lấy từ chunk đầu
        return parts.map((p) => ensureTrailingEOL(p, eol)).join("");
    }

    // Caller cố ý truyền separator → dùng đúng
    return parts.join(separator);
}

/**
 * Ghép và ghi ra file đích.
 *
 * @param {string} outputDir - Thư mục chứa các chunk.
 * @param {string} originalFilePath - Đường dẫn file gốc (để lấy baseName + extension).
 * @param {object} opts
 *   - ext: đuôi chunk file (mặc định ".txt")
 *   - separator: ký tự nối giữa các chunk (mặc định "")
 *   - overwrite: nếu true, ghi thẳng vào originalFilePath; nếu false, tạo file mới <baseName>_merged<origExt>
 *   - mergedDir: nếu muốn ghi ra thư mục khác (mặc định thư mục của originalFilePath)
 *   - suffix: hậu tố khi KHÔNG ghi đè (mặc định "_merged")
 *
 * @returns {string} Đường dẫn file được tạo/ghi.
 */
export async function mergeChunksToFile(
    outputDir,
    originalFilePath,
    {
        ext = ".txt",
        separator = "",
        overwrite = false,
        mergedDir = null,
        suffix = "_merged",
    } = {}
) {
    const baseName = path.basename(
        originalFilePath,
        path.extname(originalFilePath)
    );
    const origExt = path.extname(originalFilePath);

    const mergedContent = await mergeChunks(outputDir, baseName, {
        ext,
        separator,
    });

    if (mergedContent === "") {
        console.warn("Không có nội dung để ghép (không tìm thấy chunk).");
        return "";
    }

    const targetDir = mergedDir ?? path.dirname(originalFilePath);
    await fs.ensureDir(targetDir);

    const targetFile = overwrite
        ? originalFilePath
        : path.join(targetDir, `${baseName}${suffix}${origExt}`);

    await fs.writeFile(targetFile, mergedContent, "utf-8");
    console.log(
        `Đã ghép ${baseName} thành file: ${targetFile} (${mergedContent.length} ký tự).`
    );
    return targetFile;
}

/**
 * Hàm wrapper để ghép file từ chunks với kiểm tra tự động.
 * Tự động lấy baseName từ file gốc và kiểm tra chunk có tồn tại không.
 *
 * @param {string} chunkDir - Thư mục chứa các chunk
 * @param {string} originalFile - File gốc
 * @param {object} options - Các tùy chọn giống mergeChunksToFile
 * @returns {Promise<string|null>} - Đường dẫn file đã ghép, hoặc null nếu không có chunk
 */
export async function mergeChunksFromFile(
    chunkDir,
    originalFile,
    options = {}
) {
    const baseName = path.basename(originalFile, path.extname(originalFile));

    // Kiểm tra chunk files có tồn tại không
    const chunkFiles = await listChunkFiles(
        chunkDir,
        baseName,
        options.ext || ".txt"
    );

    console.log("Chunk files tìm thấy:", chunkFiles);

    if (chunkFiles.length === 0) {
        console.warn("Không tìm thấy chunk nào. Bạn đã chạy split chưa?");
        return null;
    }

    // Gọi hàm ghép
    return await mergeChunksToFile(chunkDir, originalFile, options);
}

/* ------------------------------------------------------------------ */
/* --------------------------- TIỆN ÍCH ------------------------------ */
/* ------------------------------------------------------------------ */

function escapeRegex(str) {
    // escape ký tự đặc biệt để dùng trong RegExp động
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
