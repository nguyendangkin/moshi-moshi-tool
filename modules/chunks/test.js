import path from "path";
import { mergeChunksFromFile, splitToChunks } from "./chunks.js";

const file = path.resolve(process.cwd(), "GOP_Text_Item.uasset.txt");
const rawTextTempChunks = path.join(process.cwd(), "raw_text_temp_chunks");

async function test() {
    // Chia nhỏ file (bỏ comment nếu cần)
    // await splitToChunks(file, rawTextTempChunks);

    // Ghép lại file - chỉ cần 1 dòng!
    const mergedFile = await mergeChunksFromFile(rawTextTempChunks, file, {
        overwrite: false, // đổi thành true nếu muốn ghi đè file gốc
    });

    if (mergedFile) {
        console.log("Ghép thành công! File được tạo:", mergedFile);
    }
}

test();
