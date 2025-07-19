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

    // Improved tag extraction function
    function extractTags(str) {
        const tags = [];
        let i = 0;

        while (i < str.length) {
            // Look for start of tag
            if (str[i] === "<") {
                let tagStart = i;
                let depth = 1;
                i++; // Skip opening <

                // Find matching closing >, handling nested < >
                while (i < str.length && depth > 0) {
                    if (str[i] === "<") {
                        depth++;
                    } else if (str[i] === ">") {
                        depth--;
                    }
                    i++;
                }

                if (depth === 0) {
                    const fullTag = str.substring(tagStart, i);

                    // Check if it's a function tag with parameters
                    if (fullTag.includes("(")) {
                        const inside = fullTag.slice(1, -1); // Remove < >
                        const parenIndex = inside.indexOf("(");
                        const lastParenIndex = inside.lastIndexOf(")");

                        if (parenIndex > -1 && lastParenIndex > parenIndex) {
                            const mainName = inside.slice(0, parenIndex).trim();
                            tags.push({
                                tag: `<${mainName}>`,
                                full: fullTag,
                                position: tagStart,
                            });

                            // Extract inner tags from parameters - FIX: Include all nested tags
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
                                tag: fullTag,
                                full: fullTag,
                                position: tagStart,
                            });
                        }
                    } else {
                        tags.push({
                            tag: fullTag,
                            full: fullTag,
                            position: tagStart,
                        });
                    }
                }
            } else if (str[i] === "{") {
                // Handle {VALUE} tags
                let tagStart = i;
                while (i < str.length && str[i] !== "}") {
                    i++;
                }
                if (i < str.length) {
                    i++; // Include the closing }
                    const fullTag = str.substring(tagStart, i);
                    tags.push({
                        tag: fullTag,
                        full: fullTag,
                        position: tagStart,
                    });
                }
            } else if (str[i] === "[") {
                // Handle [bracket] tags
                let tagStart = i;
                while (i < str.length && str[i] !== "]") {
                    i++;
                }
                if (i < str.length) {
                    i++; // Include the closing ]
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

    // NEW: Proper extraction of all tags from parameters
    function extractTagsFromParameters(str, offset = 0) {
        const tags = [];
        let i = 0;

        while (i < str.length) {
            if (str[i] === "<") {
                // Handle nested < > tags
                let tagStart = i;
                let depth = 1;
                i++; // Skip opening <

                // Find matching closing >, handling nested < >
                while (i < str.length && depth > 0) {
                    if (str[i] === "<") {
                        depth++;
                    } else if (str[i] === ">") {
                        depth--;
                    }
                    i++;
                }

                if (depth === 0) {
                    const fullTag = str.substring(tagStart, i);
                    tags.push({
                        tag: fullTag,
                        full: fullTag,
                        position: offset + tagStart,
                    });
                }
            } else if (str[i] === "{") {
                let tagStart = i;
                while (i < str.length && str[i] !== "}") {
                    i++;
                }
                if (i < str.length) {
                    i++; // Include the closing }
                    const fullTag = str.substring(tagStart, i);
                    tags.push({
                        tag: fullTag,
                        full: fullTag,
                        position: offset + tagStart,
                    });
                }
            } else if (str[i] === "[") {
                let tagStart = i;
                while (i < str.length && str[i] !== "]") {
                    i++;
                }
                if (i < str.length) {
                    i++; // Include the closing ]
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

    // REMOVED: extractTagsFromString function - now using extractTagsFromParameters

    function canonicalTag(tag) {
        if (tag.startsWith("<")) {
            const inner = tag.slice(1, -1).trim();
            const m = inner.match(/^([A-Za-z0-9_]+)/);
            const name = m ? m[1] : inner;
            return `<${name}>`;
        }
        return tag;
    }

    function countTagsWithDetails(tags) {
        const map = {};
        const details = {};

        for (const tagObj of tags) {
            // FIX: Use full tag instead of canonical for exact matching
            const key = tagObj.tag;
            map[key] = (map[key] || 0) + 1;

            if (!details[key]) {
                details[key] = [];
            }
            details[key].push(tagObj);
        }
        return { map, details };
    }

    const maxLength = Math.max(originalLines.length, translatedLines.length);
    for (let i = 0; i < maxLength; i++) {
        const oLine = originalLines[i] ?? "";
        const tLine = translatedLines[i] ?? "";

        const oTagsObj = extractTags(oLine);
        const tTagsObj = extractTags(tLine);

        const { map: oMap, details: oDetails } = countTagsWithDetails(oTagsObj);
        const { map: tMap, details: tDetails } = countTagsWithDetails(tTagsObj);

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

        // DEBUG: Add console.log to see what tags are extracted
        if (i === 3) {
            // Line with the problematic tags
            console.log("=== DEBUG LINE 4 ===");
            console.log("Original line:", oLine);
            console.log("Translated line:", tLine);
            console.log(
                "Original tags:",
                oTagsObj.map((t) => t.tag)
            );
            console.log(
                "Translated tags:",
                tTagsObj.map((t) => t.tag)
            );
            console.log("Original map:", oMap);
            console.log("Translated map:", tMap);
            console.log("Has tag issues:", hasTagIssues);
            console.log("===================");
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
            if (oSelf === null) {
                issues.push(
                    `Dòng ${
                        i + 1
                    }: Có vấn đề về SelfId\nGốc: ${oLine}\nDịch: ${tLine}`
                );
            } else if (oSelf !== tSelf) {
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
