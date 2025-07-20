import "dotenv/config";
import chalk from "chalk";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "deepseek-r1";

/**
 * Gọi Ollama local model.
 * @param {string} prompt - nội dung cần gửi vào model
 * @param {number} retries - số lần thử lại
 * @param {number} delay - thời gian chờ giữa các lần thử
 * @returns {Promise<string|null>} - kết quả trả về hoặc null nếu lỗi
 */
async function ollama(prompt, retries = 3, delay = 5000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (attempt > 1) {
                console.log(
                    chalk.yellow(
                        `\nĐang gọi lại Ollama local (kỳ ${attempt})...`
                    )
                );
            }

            const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: MODEL,
                    prompt: prompt,
                    stream: false,
                }),
            });

            if (!res.ok) {
                console.error(
                    chalk.red(
                        `\nHTTP ${res.status} khi gọi Ollama (lần ${attempt}).`
                    )
                );
                if (attempt < retries) {
                    console.log(
                        chalk.yellow(
                            `Đang chờ ${delay / 1000}s trước khi thử lại...`
                        )
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else {
                    console.log(chalk.red("Đã thử hết số lần, bỏ qua."));
                    return null;
                }
            } else {
                const data = await res.json();
                return data.response;
            }
        } catch (error) {
            console.error(
                chalk.red(`\nLỗi khi gọi Ollama (lần ${attempt}):`),
                error.message || error
            );

            if (attempt < retries) {
                console.log(
                    chalk.yellow(
                        `Đang chờ ${delay / 1000}s trước khi thử lại...`
                    )
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                console.log(chalk.red("Đã thử hết số lần, bỏ qua."));
                return null;
            }
        }
    }
}

export default ollama;
