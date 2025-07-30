import "dotenv/config";
import chalk from "chalk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const keys = [
    process.env.GEMINI_API_KEY_TOOL,
    process.env.GEMINI_API_KEY_TOOL_2,
    process.env.GEMINI_API_KEY_TOOL_3,
    process.env.GEMINI_API_KEY_TOOL_4,
    process.env.GEMINI_API_KEY_TOOL_5,
    // ... có thể thêm nữa
].filter(Boolean); // Lọc bỏ giá trị null/undefined

// Nếu không có key nào -> dừng chương trình
if (keys.length === 0) {
    console.error(chalk.red("Không tìm thấy API Key Gemini nào trong .env"));
    process.exit(1);
}

// Tạo danh sách client tương ứng với từng key
const clients = keys.map((k) => new GoogleGenerativeAI(k));

// Biến con trỏ key hiện hành (bắt đầu từ key đầu tiên)
let currentKeyIndex = 0;

// Hàm trả về client hiện hành dựa trên currentKeyIndex
function currentClient() {
    return clients[currentKeyIndex];
}

// Hàm xoay sang key tiếp theo (nếu hết thì quay lại key đầu - round robin)
function rotateKey() {
    currentKeyIndex = (currentKeyIndex + 1) % clients.length;
    console.log(
        chalk.cyan(
            `>> Đổi sang API key #${currentKeyIndex + 1}/${clients.length}.`
        )
    );
}

/**
 * Hàm gọi Gemini API với cơ chế retry và xoay key
 * @param {string} prompt - Nội dung yêu cầu
 * @param {number} retries - Số lần thử lại cho mỗi key
 * @param {number} delay - Thời gian chờ giữa các lần retry (ms)
 * @param {number} jitter - Tỉ lệ random để tránh retry cùng lúc (0.25 = ±25%)
 */
async function gemini(prompt, retries = 3, delay = 5000, jitter = 0.25) {
    // Tổng số attempt tối đa = số key × số lần thử lại cho mỗi key
    const maxAttempts = keys.length * retries;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const keyNumber = currentKeyIndex + 1;
        try {
            if (attempt > 1) {
                console.log(
                    chalk.yellow(
                        `\nĐang thử lại (attempt ${attempt}/${maxAttempts}) với key #${keyNumber}...`
                    )
                );
            }

            // Gọi Gemini API với client hiện tại
            const model = currentClient().getGenerativeModel({
                model: "gemini-2.5-pro",
            });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error(
                chalk.red(
                    `\nLỗi khi gọi Gemini API với key #${keyNumber} (attempt ${attempt}/${maxAttempts}):`
                )
            );

            if (error.status === 429) {
                console.error("Bạn đã vượt giới hạn (429 Too Many Requests).");
                console.error(
                    "Giải pháp: Đợi reset, tạo API key mới hoặc nâng cấp gói."
                );
                // Sau khi báo, chuyển sang key khác (nếu có >1 key)
                rotateKey();
            } else if (error.status === 403) {
                console.error(
                    chalk.red(
                        "Key bị từ chối / không có quyền. Bỏ qua key này."
                    )
                );
                rotateKey(); // Chuyển sang key khác
            } else if (error.status === 401) {
                console.error(chalk.red("Key không hợp lệ. Bỏ qua key này."));
                rotateKey(); // Chuyển sang key khác
            } else if (error.status === 503) {
                console.error("Gemini đang quá tải (503 Service Unavailable).");
                rotateKey(); // Chuyển sang key khác
            } else {
                console.error(error.message || error);
                rotateKey(); // Chuyển sang key khác
            }

            // Nếu chưa hết số lần thử thì chờ delay rồi thử lại
            if (attempt < maxAttempts) {
                // Tạo thời gian chờ với jitter (thêm chút random)
                const sleepMs =
                    delay + Math.floor(Math.random() * delay * jitter);
                console.log(
                    chalk.yellow(
                        `Đang chờ ${(sleepMs / 1000).toFixed(
                            1
                        )}s trước khi thử lại...`
                    )
                );
                await new Promise((res) => setTimeout(res, sleepMs));
            } else {
                // Hết số lần thử tối đa
                console.log(chalk.red("Đã thử hết các key & số lần. Bỏ qua."));
                return null;
            }
        }
    }
}

export default gemini;
