function validateTranslationImproved(content, translated) {
    let originalLines = content.split(/\r?\n/);
    let translatedLines = translated.split(/\r?\n/);

    const issues = [];

    function trimTrailingEmptyLines(arr) {
        while (arr.length > 0 && arr[arr.length - 1].trim() === "") {
            arr.pop();
        }
        return arr;
    }

    originalLines = trimTrailingEmptyLines(originalLines);
    translatedLines = trimTrailingEmptyLines(translatedLines);

    if (originalLines.length !== translatedLines.length) {
        issues.push(
            `Số dòng khác nhau: ${originalLines.length} → ${translatedLines.length}`
        );
    }

    const selfIdRegex = /SelfId=([^\s]+)/;
    const textKeyRegex = /^Text=/;

    function getSelfId(line) {
        const m = line.match(selfIdRegex);
        return m ? m[1] : null;
    }

    function hasTextKey(line) {
        return textKeyRegex.test(line);
    }

    // Hàm chuẩn hóa tag: chỉ giữ tên thẻ trước dấu "("
    function canonicalTag(tag) {
        if (tag.startsWith("<")) {
            const inner = tag.slice(1, -1).trim();
            const m = inner.match(/^([A-Za-z0-9_]+)/);
            const name = m ? m[1] : inner;
            return `<${name}>`;
        }
        return tag;
    }

    // Hàm đếm tag
    function countTagsWithDetails(tags) {
        const map = {};
        const details = {};
        for (const tagObj of tags) {
            const key = canonicalTag(tagObj.tag); // Dùng tên thẻ chuẩn hóa
            map[key] = (map[key] || 0) + 1;
            if (!details[key]) details[key] = [];
            details[key].push(tagObj);
        }
        return { map, details };
    }

    // Trích xuất toàn bộ tag
    function extractTags(str) {
        const tags = [];
        let i = 0;

        while (i < str.length) {
            if (str[i] === "<") {
                let tagStart = i;
                let depth = 1;
                i++;
                while (i < str.length && depth > 0) {
                    if (str[i] === "<") depth++;
                    else if (str[i] === ">") depth--;
                    i++;
                }
                if (depth === 0) {
                    const fullTag = str.substring(tagStart, i);
                    if (fullTag.includes("(")) {
                        const inside = fullTag.slice(1, -1);
                        const parenIndex = inside.indexOf("(");
                        const lastParenIndex = inside.lastIndexOf(")");
                        if (parenIndex > -1 && lastParenIndex > parenIndex) {
                            const mainName = inside.slice(0, parenIndex).trim();
                            tags.push({
                                tag: `<${mainName}>`,
                                full: fullTag,
                                position: tagStart,
                            });
                            const argSection = inside.slice(
                                parenIndex + 1,
                                lastParenIndex
                            );
                            const innerTags = extractTagsFromParameters(
                                argSection,
                                tagStart + parenIndex + 2
                            );
                            tags.push(...innerTags);
                        } else {
                            tags.push({
                                tag: canonicalTag(fullTag),
                                full: fullTag,
                                position: tagStart,
                            });
                        }
                    } else {
                        tags.push({
                            tag: canonicalTag(fullTag),
                            full: fullTag,
                            position: tagStart,
                        });
                    }
                }
            } else if (str[i] === "{") {
                let tagStart = i;
                while (i < str.length && str[i] !== "}") i++;
                if (i < str.length) {
                    i++;
                    const fullTag = str.substring(tagStart, i);
                    tags.push({
                        tag: fullTag,
                        full: fullTag,
                        position: tagStart,
                    });
                }
            } else if (str[i] === "[") {
                let tagStart = i;
                while (i < str.length && str[i] !== "]") i++;
                if (i < str.length) {
                    i++;
                    const fullTag = str.substring(tagStart, i);
                    tags.push({
                        tag: fullTag,
                        full: fullTag,
                        position: tagStart,
                    });
                }
            } else {
                i++;
            }
        }
        return tags;
    }

    function extractTagsFromParameters(str, offset = 0) {
        const tags = [];
        let i = 0;
        while (i < str.length) {
            if (str[i] === "<") {
                let tagStart = i;
                let depth = 1;
                i++;
                while (i < str.length && depth > 0) {
                    if (str[i] === "<") depth++;
                    else if (str[i] === ">") depth--;
                    i++;
                }
                if (depth === 0) {
                    const fullTag = str.substring(tagStart, i);
                    tags.push({
                        tag: canonicalTag(fullTag),
                        full: fullTag,
                        position: offset + tagStart,
                    });
                }
            } else if (str[i] === "{") {
                let tagStart = i;
                while (i < str.length && str[i] !== "}") i++;
                if (i < str.length) {
                    i++;
                    const fullTag = str.substring(tagStart, i);
                    tags.push({
                        tag: fullTag,
                        full: fullTag,
                        position: offset + tagStart,
                    });
                }
            } else if (str[i] === "[") {
                let tagStart = i;
                while (i < str.length && str[i] !== "]") i++;
                if (i < str.length) {
                    i++;
                    const fullTag = str.substring(tagStart, i);
                    tags.push({
                        tag: fullTag,
                        full: fullTag,
                        position: offset + tagStart,
                    });
                }
            } else {
                i++;
            }
        }
        return tags;
    }

    const maxLength = Math.max(originalLines.length, translatedLines.length);
    for (let i = 0; i < maxLength; i++) {
        const oLine = originalLines[i] ?? "";
        const tLine = translatedLines[i] ?? "";

        const oTagsObj = extractTags(oLine);
        const tTagsObj = extractTags(tLine);

        const { map: oMap } = countTagsWithDetails(oTagsObj);
        const { map: tMap } = countTagsWithDetails(tTagsObj);

        const allTags = new Set([...Object.keys(oMap), ...Object.keys(tMap)]);
        let hasTagIssues = false;
        for (const tag of allTags) {
            const oc = oMap[tag] || 0;
            const tc = tMap[tag] || 0;
            if (oc !== tc) {
                hasTagIssues = true;
                break;
            }
        }

        if (hasTagIssues) {
            issues.push(
                `Dòng ${
                    i + 1
                }: Có vấn đề về các Tag\nGốc: ${oLine}\nDịch: ${tLine}`
            );
        }

        const oSelf = getSelfId(oLine);
        const tSelf = getSelfId(tLine);
        if (tSelf !== null) {
            if (oSelf === null || oSelf !== tSelf) {
                issues.push(
                    `Dòng ${
                        i + 1
                    }: Có vấn đề về SelfId\nGốc: ${oLine}\nDịch: ${tLine}`
                );
            }
        } else if (oSelf !== null) {
            issues.push(
                `Dòng ${
                    i + 1
                }: Có vấn đề về SelfId\nGốc: ${oLine}\nDịch: ${tLine}`
            );
        }

        const oHasText = hasTextKey(oLine);
        const tHasText = hasTextKey(tLine);
        if (oHasText && !tHasText) {
            issues.push(
                `Dòng ${
                    i + 1
                }: Có vấn đề về Text=\nGốc: ${oLine}\nDịch: ${tLine}`
            );
        } else if (!oHasText && tHasText) {
            issues.push(
                `Dòng ${
                    i + 1
                }: Có vấn đề về Text=\nGốc: ${oLine}\nDịch: ${tLine}`
            );
        }
    }

    return issues.length > 0 ? issues : ["HOÀN HẢO: Tất cả đều khớp!"];
}

export default validateTranslationImproved;
