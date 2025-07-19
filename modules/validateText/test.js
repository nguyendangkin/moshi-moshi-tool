// import fs from "fs";
// import path from "path";
// import validateTranslation from "./validateTranslation.js";

// // Lấy arguments từ command line
// const args = process.argv.slice(2);

// if (args.length < 2) {
//     console.log("❌ Thiếu tham số!");
//     console.log(
//         "Cách dùng: node test.js <gốc1> <dịch1> [gốc2] [dịch2] [gốc3] [dịch3]..."
//     );
//     console.log(
//         "Ví dụ: node test.js original1.txt translated1.txt original2.txt translated2.txt"
//     );
//     process.exit(1);
// }

// if (args.length % 2 !== 0) {
//     console.log(
//         "❌ Số lượng file phải chẵn (mỗi cặp gồm 1 file gốc và 1 file dịch)!"
//     );
//     process.exit(1);
// }

// // Chia thành các cặp file
// const filePairs = [];
// for (let i = 0; i < args.length; i += 2) {
//     filePairs.push({
//         original: args[i],
//         translated: args[i + 1],
//     });
// }

// console.log(`🚀 Bắt đầu kiểm tra ${filePairs.length} cặp file...\n`);

// let totalIssues = 0;
// let filesWithIssues = 0;

// for (let i = 0; i < filePairs.length; i++) {
//     const { original: originalPath, translated: translatedPath } = filePairs[i];

//     console.log(
//         `📁 [${i + 1}/${filePairs.length}] ${path.basename(
//             originalPath
//         )} ↔ ${path.basename(translatedPath)}`
//     );
//     console.log("=".repeat(80));

//     // Kiểm tra file có tồn tại không
//     if (!fs.existsSync(originalPath)) {
//         console.log(`❌ File gốc không tồn tại: ${originalPath}\n`);
//         continue;
//     }

//     if (!fs.existsSync(translatedPath)) {
//         console.log(`❌ File dịch không tồn tại: ${translatedPath}\n`);
//         continue;
//     }

//     try {
//         // Đọc nội dung file
//         const originalContent = fs.readFileSync(originalPath, "utf8");
//         const translatedContent = fs.readFileSync(translatedPath, "utf8");

//         // Validate
//         const issues = validateTranslation(originalContent, translatedContent);

//         if (issues.length === 1 && issues[0].includes("HOÀN HẢO")) {
//             console.log("✅ HOÀN HẢO: Không có lỗi nào!");
//         } else {
//             filesWithIssues++;
//             totalIssues += issues.length;

//             console.log(`❌ Phát hiện ${issues.length} vấn đề:`);

//             issues.forEach((issue, index) => {
//                 console.log(`\n${index + 1}. ${issue}`);
//             });
//         }
//     } catch (error) {
//         console.log(`❌ Lỗi khi xử lý: ${error.message}`);
//     }

//     console.log("\n" + "=".repeat(80) + "\n");
// }

// // Tổng kết
// console.log("📊 TỔNG KẾT:");
// console.log(`• Tổng số cặp file: ${filePairs.length}`);
// console.log(`• File có vấn đề: ${filesWithIssues}`);
// console.log(`• File hoàn hảo: ${filePairs.length - filesWithIssues}`);
// console.log(`• Tổng số vấn đề: ${totalIssues}`);
// console.log("=".repeat(80));

import validateTranslation from "./validateTranslation.js";

// Test data
const original = `SelfId=Txt_Test_01
Text=Hello <Cap>world<Cap>!

SelfId=Txt_Test_02
Text=Welcome <IfSing_VALUE(cat,cats)>! <IfSing_VALUE(<a>,<b(<x>)>)>`;

const translated = `SelfId=Txt_Test_01
Text=Xin chào <Cap>thế giới<Cap>!

SelfId=Txt_Test_02
Text=Chào mừng <IfSing_VALUE(mèo,mèo)>! <IfSing_VALUE(<a>,<b(<x>)>)>`;

console.log("=== RUNNING DEBUG ===");
const issues = validateTranslation(original, translated);

console.log("\n=== FINAL RESULT ===");
console.log(issues);
