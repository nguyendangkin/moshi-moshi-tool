function validateTranslation(content, translated) {
    const originalLines = content.split(/\r?\n/);
    const translatedLines = translated.split(/\r?\n/);

    const issues = [];

    // --- helper: cắt dòng gọn để hiển thị trong log ---
    function snippet(str, max = 80) {
        const s = str.trim();
        return s.length > max ? s.slice(0, max - 3) + "..." : s;
    }

    // 1. Kiểm tra số lượng dòng
    if (originalLines.length !== translatedLines.length) {
        issues.push(
            `Số dòng khác nhau: bản gốc = ${originalLines.length}, bản dịch = ${translatedLines.length}.`
        );
    }

    // 2. Regex tag: bắt tất cả
    const tagRegex = /<[^>]+>|\{[^}]+\}|\[[^\]]+\]/g;

    // 3. Regex SelfId CHUẨN: KHÔNG khoảng trắng sau '='
    const selfIdRegex = /SelfId=([^\s]+)/; // case-sensitive

    // 3b. Regex Text= CHUẨN
    const textKeyRegex = /^Text=/;

    function getSelfId(line) {
        const m = line.match(selfIdRegex);
        return m ? m[1] : null;
    }

    function hasTextKey(line) {
        return textKeyRegex.test(line);
    }

    /**
     * Chuẩn hoá tag để so sánh:
     * - <Something(foo,bar)>  -> <Something>
     * - <Cap>                  -> <Cap>
     * - {VALUE}                -> {VALUE}  (giữ nguyên, KHÔNG dịch)
     * - [3]                    -> [3]      (giữ nguyên)
     */
    function canonicalTag(tag) {
        if (tag.startsWith("<")) {
            // bỏ dấu < >
            const inner = tag.slice(1, -1).trim();
            // lấy tên đến trước '(' hoặc khoảng trắng
            const m = inner.match(/^([A-Za-z0-9_]+)/);
            const name = m ? m[1] : inner; // fallback nếu không match
            return `<${name}>`;
        }
        // ngoặc nhọn / vuông: không đổi
        return tag;
    }

    function countTags(tags) {
        const map = {};
        for (const t of tags) {
            const key = canonicalTag(t);
            map[key] = (map[key] || 0) + 1;
        }
        return map;
    }

    // 4. So sánh từng dòng
    const maxLength = Math.max(originalLines.length, translatedLines.length);
    for (let i = 0; i < maxLength; i++) {
        const oLine = originalLines[i] ?? "";
        const tLine = translatedLines[i] ?? "";

        // --- Tag per line ---
        const oTags = oLine.match(tagRegex) || [];
        const tTags = tLine.match(tagRegex) || [];

        const oMap = countTags(oTags);
        const tMap = countTags(tTags);

        const allTags = new Set([...Object.keys(oMap), ...Object.keys(tMap)]);
        for (const tag of allTags) {
            const oc = oMap[tag] || 0;
            const tc = tMap[tag] || 0;
            if (oc !== tc) {
                if (oc > tc) {
                    // bản dịch thiếu tag có trong bản gốc
                    issues.push(
                        `Dòng ${
                            i + 1
                        } (bản dịch) thiếu tag "${tag}" — bản gốc: ${oc} | bản dịch: ${tc}.` +
                            `\n  bản gốc : ${snippet(oLine)}` +
                            `\n  bản dịch: ${snippet(tLine)}`
                    );
                } else {
                    // bản dịch thừa tag
                    issues.push(
                        `Dòng ${
                            i + 1
                        } (bản dịch) thừa tag "${tag}" — bản gốc: ${oc} | bản dịch: ${tc}.` +
                            `\n  bản gốc : ${snippet(oLine)}` +
                            `\n  bản dịch: ${snippet(tLine)}`
                    );
                }
            }
        }

        // --- SelfId per line ---
        const oSelf = getSelfId(oLine);
        const tSelf = getSelfId(tLine);

        if (tSelf !== null) {
            if (oSelf === null) {
                issues.push(
                    `Dòng ${
                        i + 1
                    } (bản dịch) có SelfId="${tSelf}" nhưng bản gốc không có SelfId hợp lệ (phải "SelfId=GIATRI").` +
                        `\n  bản gốc : ${snippet(oLine)}` +
                        `\n  bản dịch: ${snippet(tLine)}`
                );
            } else if (oSelf !== tSelf) {
                issues.push(
                    `Dòng ${
                        i + 1
                    }: SelfId không khớp — bản gốc: "${oSelf}" | bản dịch: "${tSelf}".` +
                        `\n  bản gốc : ${snippet(oLine)}` +
                        `\n  bản dịch: ${snippet(tLine)}`
                );
            }
        } else if (oSelf !== null) {
            issues.push(
                `Dòng ${
                    i + 1
                } (bản dịch) thiếu SelfId="${oSelf}" hoặc sai định dạng (phải "SelfId=GIATRI").` +
                    `\n  bản gốc : ${snippet(oLine)}` +
                    `\n  bản dịch: ${snippet(tLine)}`
            );
        }

        // --- Text= per line ---
        const oHasText = hasTextKey(oLine);
        const tHasText = hasTextKey(tLine);
        if (oHasText && !tHasText) {
            issues.push(
                `Dòng ${
                    i + 1
                } (bản dịch) thiếu khóa "Text=" (bản gốc có). Có thể gõ sai như "Texdt=" hoặc thiếu '='.` +
                    `\n  bản gốc : ${snippet(oLine)}` +
                    `\n  bản dịch: ${snippet(tLine)}`
            );
        } else if (!oHasText && tHasText) {
            issues.push(
                `Dòng ${
                    i + 1
                } (bản dịch) có "Text=" nhưng bản gốc không có — lệch cấu trúc.` +
                    `\n  bản gốc : ${snippet(oLine)}` +
                    `\n  bản dịch: ${snippet(tLine)}`
            );
        }
    }

    return issues.length > 0
        ? issues
        : ["OK: Số dòng; tag; SelfId; Text= đều khớp."];
}

export default validateTranslation;
