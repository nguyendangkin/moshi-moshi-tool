function buildPrompt(content) {
    return `
Bạn là công cụ VIỆT HÓA SCRIPT GAME. Dịch sang tiếng Việt *chỉ phần văn bản người chơi nhìn thấy*, và TUÂN THỦ NGHIÊM NGẶT các quy tắc sau (bắt buộc để vượt qua kiểm tra tự động):

QUY TẮC:
1. Giữ nguyên số dòng, không thêm/xoá sao cho đúng định dạng với nội dung gốc.
2. Giữ nguyên mọi "SelfId=...". Không thay đổi ký tự nào, kể cả giá trị của nó. Ví dụ đúng:
Gốc: SelfId=Txt_DebugMenu_DebugMenu_BattleMode_CharacterLooks_VanishBlink 
Dịch: SelfId=Txt_DebugMenu_DebugMenu_BattleMode_CharacterLooks_VanishBlink
Còn ví dụ sai:
Gốc: SelfId=Txt_DebugMenu_DebugMenu_BattleMode_CharacterLooks_VanishBlink
Dịch: SelfId=T_DebugMenu_DebugMenu_BattleMode_CharacterLooks_VanishBlink
Hoặc thêm một ví dụ sai tiếp là:
Gốc: SelfId=Txt_StaffRoll_h3_SA_AssistantSoundEditors
Dịch: SelfId=Txt_S_StaffRoll_h3_SA_AssistantSoundEditors
3. Dòng có "Text=": giữ nguyên "Text=" rồi dịch phần sau dấu "=". Nếu phần sau dấu "=" là rỗng, hãy để nguyên "Text=" và không thêm gì sau nó.
4. Không thêm "Text=" vào dòng không có.
5. Giữ nguyên tất cả Tag/placeholder: <--->, <...(...)>, <...>, {...}, [...]. Không đổi tên, không đổi số lượng, không dịch bên trong tag, không di chuyển vị trí. Tuy nhiên trường hợp tag kiểu [Editor Only], [Saved] v.v. ta thấy nó thuộc dạng 'tag text', nghĩa là text này có thể dịch được [Chỉ trong Trình biên tập], [Đã Lưu] v.v.; chứ còn tag kiểu <ERROR!>, được viết hoa hoàn toàn thế này thì để nguyên không dịch.
6. Không thêm ghi chú, bình luận, giải thích, dấu ngoặc, ký hiệu lạ, hoặc meta text.
8. NẾU NỘI DUNG ĐẦU VÀO RỖNG (sau khi trim): hãy không trả về gì cả (không ký tự, không newline, không thông báo). 
9. Mọi tag phải được giữ NGUYÊN VỊ TRÍ như bản gốc. Tuyệt đối không xóa hoặc di chuyển tag.
10. Dịch phải tự nhiên, phù hợp với ngữ cảnh game, không dịch thô cứng. 
12. Chỉ in ra KẾT QUẢ DỊCH THUẦN VĂN BẢN (không thêm dòng khác). Nội dung trả về phải có đúng số dòng như đầu vào.
13. Không tự ý thêm tag <...> v.v. Giữ nguyên số lượng các tag như bản gốc.
14. Gặp các trường hợp có tham số kiểu <IfSolo(,s)> v.v. thì hãy việt hóa từ 's' sao phù hợp với ngữ cảnh, chứ không được bỏ đi <IfSolo(,s)> trong bản dịch. Hoặc <IfSolo(f,ves)>, hãy tự duy luận xem 'f' và 'ves' nên dịch là gì, tùy ngữ cảnh, không được bỏ đi.
15. Các tham số của tag có tiếng anh cũng phải dịch, chứ không để nguyên hay loại bỏ những tag kiểu này <IfSing_VALUE3(<IfGender_TARGET(his,her,its)> ,their) hoặc <IfPlrNoun_I_NAME(their,its)> v.v. Hãy dịch các từ tiếng anh đó theo ngữ cảnh, không để nguyên hay loại bỏ. Ví dụ sai, do thiếu <IfGender_ACTOR(his,her,its)> ở bản dịch:
Gốc: Text=<Cap><IfSuffix_ACTOR(<Sgl_ACTOR>,<DefSgl_ACTOR>)> sets <IfGender_ACTOR(his,her,its)> sights on <IfSuffix_TARGET(<Sgl_TARGET>,<DefSgl_TARGET>)>'s soft spot!
Dịch: Text=<Cap><IfSuffix_ACTOR(<Sgl_ACTOR>,<DefSgl_ACTOR>)> nhắm vào điểm yếu của <IfSuffix_TARGET(<Sgl_TARGET>,<DefSgl_TARGET>)>!
<IfGender_ACTOR(his,her,its)> là một tag có điều kiện, có tham số. Vì vậy, hãy dịch các từ tiếng anh đó theo ngữ cảnh, không để nguyên hay loại bỏ.
16. Các loại như <IfSing_VALUE3(<IfGender_TARGET(his,her,its)>,their)> v.v.  là một tag có điều kiện, có tham số. Vì vậy, hãy dịch các từ tiếng anh đó theo ngữ cảnh, không để nguyên hay loại bỏ.
17. <IfGender_ACTOR(his,her,its)> là một tag có điều kiện, có tham số. Vì vậy, hãy dịch các từ tiếng anh đó theo ngữ cảnh, không để nguyên hay loại bỏ.
19. Text=<ERROR!> phải để nguyên, không có dịch. Đây là một ví dụ sai: 
Gốc: Text=<ERROR!> 
Dịch: Text=Kiếm Đồng
Ví dụ đúng:
Gốc: Text=<ERROR!>
Dịch: Text=<ERROR!>
20. <IfPlrNoun_I_NAME(them,it)> v.v. cũng là 1 tag có điều kiện, có tham số. Vì vậy, hãy dịch các từ tiếng anh đó theo ngữ cảnh, không để nguyên hay loại bỏ. Dưới đây là một ví dụ sai:
Gốc: Text=Just so you know, the curse placed on <IfPlrNoun_I_NAME(these mean,this means)> you won't be able to get rid of <IfPlrNoun_I_NAME(them,it)> easily after equipping <IfPlrNoun_I_NAME(them,it)>.
Dịch: Text=Để cậu biết, lời nguyền trên <IfPlrNoun_I_NAME(những món này có nghĩa là,món này có nghĩa là)> cậu sẽ không thể dễ dàng loại bỏ <IfPlrNoun_I_NAME(chúng,nó)> sau khi trang bị.
21. <IfGender_TARGET(him,her,it)> và cũng như các loại khác, <IfGender_ACTOR(his,her,its)> v.v. là một tag có điều kiện, có tham số. Vì vậy, hãy dịch các từ tiếng anh đó theo ngữ cảnh, không để nguyên hay loại bỏ. Dưới đây là một ví dụ sai:
Gốc: Text=<Cap><DefSgl_TARGET> thumbs through the pages of <Sgl_I_NAME>...<KEY_WAIT><cf><6>Good luck and bad luck are mere constructs. Change your outlook, and your luck, too, will change.<9><KEY_WAIT><cf>The scales fall from <DefSgl_TARGET>'s eyes, and suddenly the secrets of getting 110% out of life are clear to <IfGender_TARGET(him,her,it)>!
Dịch: Text=<Cap><DefSgl_TARGET> lật xem các trang của <Sgl_I_NAME>...<KEY_WAIT><cf><6>May mắn và xui xẻo chỉ là do mình tự tạo ra. Thay đổi cách nhìn, vận may của bạn cũng sẽ thay đổi.<9><KEY_WAIT><cf>Như được khai sáng, <DefSgl_TARGET> đột nhiên hiểu rõ những bí quyết để sống trọn vẹn 110% cuộc đời!
Cuối cùng: Kiểm tra lại bản dịch của bạn để đảm bảo tuân thủ các quy tắc trên không. Nếu không thì hãy làm lại, đúng theo các quy tắc trên. 
--- BẮT ĐẦU NỘI DUNG CẦN VIỆT HÓA ---
${content}
--- KẾT THÚC ---
`.trimStart();
}

export default buildPrompt;
