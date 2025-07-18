import "dotenv/config";
import chalk from "chalk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY_TOOL;

if (!apiKey) {
    console.error(chalk.red("Không có Key của Gemini trong file .env"));
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function gemini(prompt) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error(chalk.red("Lỗi khi gọi Gemini API:"));

        if (error.status === 429) {
            console.error("Bạn đã vượt giới hạn (429 Too Many Requests).");
            console.error("Nguyên nhân: Quota Free Tier chỉ 50 request/ngày.");
            console.error(
                "Giải pháp: Đợi reset, hoặc tạo API key mới (Tạo Project khác), hoặc nâng cấp gói."
            );
        } else if (error.status === 403) {
            console.error(chalk.red("API Key bị từ chối hoặc không có quyền."));
        } else if (error.status === 401) {
            console.error(chalk.red("API Key không hợp lệ. Kiểm tra .env."));
        } else {
            console.error(error.message || error);
        }
    }
}

export default gemini;
