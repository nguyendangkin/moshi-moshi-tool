// import chalk from "chalk";
// import gemini from "./modules/gemini/gemini.js";
// import fs from "fs-extra";
// import path from "path";
// import checkGameTranslation from "./modules/validateText/validateTranslation.js";

// const inputDir = path.join(process.cwd(), "raw_text");
// const outputDir = path.join(process.cwd(), "trans_text");
// const missDir = path.join(process.cwd(), "trans_miss");

// async function main() {
//     try {
//         if (await fs.ensureDir(inputDir)) {
//             console.log('Vừa tạo thư mục "raw_text", vui lòng nạp file .text.');
//         }
//         if (await fs.ensureDir(outputDir)) {
//             console.log('Vừa tạo thư mục "trans_text", vui lòng không xóa.');
//         }
//         if (await fs.ensureDir(missDir)) {
//             console.log('Vừa tạo thư mục "trans_miss", vui lòng không xóa');
//         }

//         const files = await fs.readdir(inputDir);
//         const txtFiles = files.filter((file) => file.endsWith(".txt"));

//         if (txtFiles.length === 0) {
//             console.log(
//                 chalk.yellow(
//                     "Không tìm thấy file .txt nào trong thư mục 'raw_text'"
//                 )
//             );
//         }

//         console.log(
//             chalk.green(`Tìm thấy ${txtFiles.length} file .txt để dịch...\n`)
//         );

//         for (const file of txtFiles) {
//             const filePath = path.join(inputDir, file);
//             const content = await fs.readFile(filePath, "utf-8");

//             const prompt = `Việt hóa phần Text được hiển thị. Giữ nguyên định dạng, cấu trúc file, số lượng các tag, biến:\n${content}`;

//             console.log(chalk.blue(`Đang dịch: ${file}`));

//             const translated = await gemini(prompt);
//             const outputFile = path.join(
//                 outputDir,
//                 file.replace(/(\.\w+)$/, "_vi$1")
//             );

//             const outputFileMiss = path.join(
//                 missDir,
//                 file.replace(/(\.\w+)$/, "_miss$1")
//             );

//             // check: bản dịch so với bản gốc
//             console.log(chalk.blue(`Đang check: ${file}`));
//             const result = checkGameTranslation(content, translated);
//             if (result.error) {
//                 console.error("Lỗi khi kiểm tra:", result.error);
//             } else if (result.issues.length === 0) {
//                 console.log(
//                     `Đã dịch: ${result.changes.length}/${result.totalOriginal}`
//                 );

//                 // thành công. Lưu vào folder thành công
//                 await fs.writeFile(outputFile, translated, "utf-8");
//                 console.log(
//                     chalk.green(
//                         `Thành công! Không có vấn đề nào: ${outputFile}\n`
//                     )
//                 );
//             } else {
//                 console.log(
//                     chalk.red(`Có vấn đề cần kiểm tra: ${outputFileMiss}`)
//                 );
//                 console.log(`Tổng vấn đề: ${result.issues.length}`);

//                 // thất bại. Lưu vào folder thất bại
//                 await fs.writeFile(outputFileMiss, translated, "utf-8");
//                 result.issues.forEach((issue, index) => {
//                     console.log(
//                         `${index + 1}. [${issue.type}] ${issue.selfId}: ${
//                             issue.message
//                         }`
//                     );
//                 });
//             }
//         }
//     } catch (error) {}
// }

// main();

import fs from "fs-extra";
import path from "path";
import checkGameTranslation from "./modules/validateText/validateTranslation.js";

// Đường dẫn 2 file thật
const rawFile = path.join(process.cwd(), "raw_text", "test.txt"); // file gốc
const transFile = path.join(process.cwd(), "trans_text", "test_vi.txt"); // file dịch

async function main() {
    try {
        // Kiểm tra file tồn tại
        if (!(await fs.pathExists(rawFile))) {
            console.error(`Không tìm thấy file gốc: ${rawFile}`);
            return;
        }
        if (!(await fs.pathExists(transFile))) {
            console.error(`Không tìm thấy file dịch: ${transFile}`);
            return;
        }

        // Đọc nội dung
        const content = await fs.readFile(rawFile, "utf-8");
        const translated = await fs.readFile(transFile, "utf-8");

        // Gọi hàm kiểm tra
        const issues = checkGameTranslation(content, translated);

        // In kết quả
        console.log("\n=== KẾT QUẢ KIỂM TRA ===");
        if (issues.length === 1 && issues[0].startsWith("OK")) {
            console.log(issues[0]);
        } else {
            console.log(`Tổng số vấn đề: ${issues.length}`);
            issues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue}`);
            });
        }
    } catch (err) {
        console.error("Lỗi:", err);
    }
}

main();
