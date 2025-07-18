function validateTranslation(content, translated) {
    const originalLines = content.split(/\r?\n/);
    const translatedLines = translated.split(/\r?\n/);

    const issues = [];

    // 1. Kiểm tra số lượng dòng
    if (originalLines.length !== translatedLines.length) {
        issues.push(
            `Số dòng khác nhau: Gốc = ${originalLines.length}, Dịch = ${translatedLines.length}`
        );
    }

    // 2. Regex tag
    const tagRegex = /<[^>]+>|\{[^}]+\}|\[[^\]]+\]/g;

    // 3. Regex SelfId CHUẨN: KHÔNG khoảng trắng sau '='
    //    Ví dụ hợp lệ:  SelfId=Txt_ABC
    //    Ví dụ lỗi:     SelfId= Txt_ABC  (có khoảng trắng)
    const selfIdRegex = /SelfId=([^\s]+)/; // nếu muốn không phân biệt hoa/thường: /SelfId=([^\s]+)/i

    // 3b. Regex Text= CHUẨN: KHÔNG khoảng trắng quanh '='
    //     Ví dụ hợp lệ:  Text=Hello
    //     Ví dụ lỗi:     Text =Hello, Texdt=Hello, v.v.
    const textKeyRegex = /^Text=/;

    function getSelfId(line) {
        const m = line.match(selfIdRegex);
        return m ? m[1] : null;
    }

    function hasTextKey(line) {
        return textKeyRegex.test(line);
    }

    function countTags(tags) {
        const map = {};
        for (const t of tags) {
            map[t] = (map[t] || 0) + 1;
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
                issues.push(
                    `Dòng ${i + 1}: Tag "${tag}" (Gốc: ${oc}, Dịch: ${tc})`
                );
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
                    }: Bản dịch có SelfId="${tSelf}" nhưng gốc không có SelfId hợp lệ (chuẩn "SelfId=GIATRI").`
                );
            } else if (oSelf !== tSelf) {
                issues.push(
                    `Dòng ${
                        i + 1
                    }: SelfId khác nhau (Gốc: "${oSelf}", Dịch: "${tSelf}")`
                );
            }
        } else if (oSelf !== null) {
            issues.push(
                `Dòng ${
                    i + 1
                }: Thiếu SelfId="${oSelf}" trong bản dịch hoặc sai định dạng (phải "SelfId=GIATRI").`
            );
        }

        // --- Text= per line ---
        const oHasText = hasTextKey(oLine);
        const tHasText = hasTextKey(tLine);
        if (oHasText && !tHasText) {
            issues.push(
                `Dòng ${
                    i + 1
                }: Gốc có "Text=" nhưng bản dịch không có đúng "Text=" (có thể gõ sai như "Texdt=" hoặc thiếu '=').`
            );
        } else if (!oHasText && tHasText) {
            issues.push(
                `Dòng ${
                    i + 1
                }: Bản dịch có "Text=" nhưng gốc không có — lệch cấu trúc.`
            );
        }
    }

    return issues.length > 0
        ? issues
        : ["OK: Số dòng; tag; SelfId; Text= đều khớp."];
}

export default validateTranslation;
