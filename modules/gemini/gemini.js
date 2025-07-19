import "dotenv/config";
import chalk from "chalk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY_TOOL;

if (!apiKey) {
    console.error(chalk.red("Không có Key của Gemini trong file .env"));
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function gemini(prompt, retries = 3, delay = 5000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (attempt > 1) {
                console.log(
                    chalk.yellow(`\nĐang dịch lại file trên (kỳ ${attempt})...`)
                );
            }

            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
            });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error(
                chalk.red(`\nLỗi khi gọi Gemini API (lần ${attempt}):`)
            );

            if (error.status === 429) {
                console.error("Bạn đã vượt giới hạn (429 Too Many Requests).");
                console.error(
                    "Giải pháp: Đợi reset, tạo API key mới hoặc nâng cấp gói."
                );
            } else if (error.status === 403) {
                console.error(
                    chalk.red("API Key bị từ chối hoặc không có quyền.")
                );
            } else if (error.status === 401) {
                console.error(
                    chalk.red("API Key không hợp lệ. Kiểm tra .env.")
                );
            } else if (error.status === 503) {
                console.error("Gemini đang quá tải (503 Service Unavailable).");
            } else {
                console.error(error.message || error);
            }

            // Nếu chưa hết số lần thử thì chờ delay rồi thử lại
            if (attempt < retries) {
                console.log(
                    chalk.yellow(
                        `Đang chờ ${delay / 1000}s trước khi thử lại...`
                    )
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                console.log(chalk.red("Đã thử hết số lần, bỏ qua file này."));
                return null;
            }
        }
    }
}

export default gemini;
