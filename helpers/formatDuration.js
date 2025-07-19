// Helper: định dạng thời gian
export default function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    const parts = [];
    if (h) parts.push(`${h} giờ`);
    if (m) parts.push(`${m} phút`);
    // Luôn hiển thị giây, ngay cả khi 0 (nếu muốn ẩn thì kiểm tra s !== 0)
    parts.push(`${s} giây`);

    return parts.join(" ");
}
