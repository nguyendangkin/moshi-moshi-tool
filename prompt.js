function buildPrompt(content) {
    return (
        `Bạn là hệ thống dịch dữ liệu game (các cặp SelfId=/Text=).

NHIỆM VỤ:
Dịch sang tiếng Việt phần văn bản hiển thị trong mỗi dòng bắt đầu bằng "Text=" và TRẢ VỀ DUY NHẤT toàn bộ file đã dịch ở dạng RAW (không thêm mô tả, không code fence, không câu mở đầu/kết thúc).

QUY TẮC BẮT BUỘC (TUÂN THỦ 100%):
1. Mỗi dòng SelfId= giữ nguyên tuyệt đối (không dịch, không sửa).
2. Giữ nguyên số dòng và thứ tự dòng so với bản gốc (không thêm, không bỏ).
3. Trong mọi dòng Text=:
   - TẤT CẢ chuỗi nằm trong <...> hoặc {...} giữ nguyên: tên tag, số lượng.
   - KHÔNG tạo thêm tag mới (ví dụ: không tự thêm <Cap> v.v. nếu gốc không có).
   - KHÔNG xóa hoặc rút gọn bất kỳ tag nào.
   - KHÔNG thay cả cụm có nhiều tag bằng 1 từ/câu ngắn (ví dụ biến cả đoạn “… to <IfSing_VALUE3(... )> senses!” thành “bình thường!” là SAI).
4. Tag có tham số (ví dụ <IfSing_VALUE(a,b)>, <IfSing_VALUE3(arg1,arg2)>, <IfPlrNoun_TARGET(... )>):
   - Chỉ dịch CHỮ THUẦN trong từng tham số; giữ nguyên số tham số, dấu phẩy, tag lồng.
   - Ví dụ: <IfSing_VALUE(point,points)> → <IfSing_VALUE(điểm,điểm)>
             <IfSing_VALUE3(<DefSgl_TARGET> returns,The party return)> → <IfSing_VALUE3(<DefSgl_TARGET> trở về,Đội trở về)>
5. Tag đơn (<cf>, <Cap>, <NO_INPUT>, <ERROR!> …) giữ nguyên (không dịch nội dung bên trong như <ERROR!>).
6. Nếu tiếng Việt không phân biệt số ít/số nhiều: dùng cùng một từ (điểm,điểm).
7. Nếu không chắc cách dịch bên trong tham số → giữ nguyên tham số đó (an toàn hơn).
8. Ký tự đầu tiên của câu trả lời phải đúng ký tự đầu của file gốc; ký tự cuối cùng phải là ký tự cuối cùng của file gốc (nếu gốc kết thúc bằng 1 newline thì giữ đúng 1 newline).
9. CẤM mọi cụm: "Dưới đây", "Kết quả", "Here is", "Output", "File:", "START", "END", và cấm ba backtick để bình luận.
10. TRƯỚC KHI TRẢ KẾT QUẢ: Với MỖI dòng Text=:
    - Đếm số tag <...> (tổng số dấu mở) và so sánh với dòng gốc tương ứng. Nếu lệch → tự sửa khôi phục đầy đủ tag gốc, chỉ giữ phần dịch text thuần.

Ví dụ:
Gốc: Text=<IfSing_VALUE(point,points)> awarded!
Đúng: Text=<IfSing_VALUE(điểm,điểm)> được trao!
Sai:  Text=Điểm được trao!   (mất tag)

BẮT ĐẦU NỘI DUNG ĐÃ DỊCH (raw, không thêm gì ngoài nội dung):
` + content
    );
}

export default buildPrompt;
