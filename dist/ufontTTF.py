import os
import tkinter as tk
from tkinter import filedialog, messagebox
from tkinterdnd2 import DND_FILES, TkinterDnD

def rename_files(path, from_ext, to_ext):
    """Đổi đuôi file hoặc tất cả file trong folder từ from_ext sang to_ext."""
    if os.path.isdir(path):
        # Nếu là thư mục -> đổi tất cả file trong thư mục
        count = 0
        for filename in os.listdir(path):
            if filename.lower().endswith(from_ext.lower()):
                old_path = os.path.join(path, filename)
                new_name = filename[: -len(from_ext)] + to_ext
                new_path = os.path.join(path, new_name)
                os.rename(old_path, new_path)
                count += 1
        messagebox.showinfo("Hoàn tất", f"Đã đổi {count} file trong thư mục '{path}'.")
    elif os.path.isfile(path):
        # Nếu là file -> chỉ đổi file đó nếu đúng đuôi
        if path.lower().endswith(from_ext.lower()):
            new_path = path[: -len(from_ext)] + to_ext
            os.rename(path, new_path)
            messagebox.showinfo("Hoàn tất", f"Đã đổi: {os.path.basename(path)} → {os.path.basename(new_path)}")
        else:
            messagebox.showwarning("Không hợp lệ", f"File '{os.path.basename(path)}' không có đuôi {from_ext}.")
    else:
        messagebox.showerror("Lỗi", f"{path} không hợp lệ (không phải file hoặc thư mục).")

def browse_path():
    """Mở hộp thoại cho phép chọn file hoặc folder."""
    path = filedialog.askopenfilename()  # Chọn file trước
    if not path:
        path = filedialog.askdirectory()  # Nếu không chọn file, chọn thư mục
    if path:
        entry_path.delete(0, tk.END)
        entry_path.insert(0, path)

def drop_files(event):
    path = event.data.strip("{}")
    entry_path.delete(0, tk.END)
    entry_path.insert(0, path)

def convert_to_ttf():
    path = entry_path.get()
    if not path:
        messagebox.showwarning("Cảnh báo", "Hãy chọn file/thư mục hoặc kéo thả vào.")
        return
    rename_files(path, ".ufont", ".ttf")

def convert_to_ufont():
    path = entry_path.get()
    if not path:
        messagebox.showwarning("Cảnh báo", "Hãy chọn file/thư mục hoặc kéo thả vào.")
        return
    rename_files(path, ".ttf", ".ufont")

# === Giao diện chính ===
root = TkinterDnD.Tk()
root.title("Đổi đuôi .ufont ↔ .ttf")
root.geometry("500x200")

tk.Label(root, text="Chọn file/thư mục hoặc kéo thả vào đây:").pack(pady=5)

entry_path = tk.Entry(root, width=60)
entry_path.pack(pady=5)
entry_path.drop_target_register(DND_FILES)
entry_path.dnd_bind('<<Drop>>', drop_files)

btn_browse = tk.Button(root, text="Chọn file/thư mục", command=browse_path)
btn_browse.pack(pady=5)

frame_buttons = tk.Frame(root)
frame_buttons.pack(pady=10)

btn_ttf = tk.Button(frame_buttons, text="Đổi .ufont → .ttf", command=convert_to_ttf, width=20)
btn_ttf.grid(row=0, column=0, padx=10)

btn_ufont = tk.Button(frame_buttons, text="Đổi .ttf → .ufont", command=convert_to_ufont, width=20)
btn_ufont.grid(row=0, column=1, padx=10)

root.mainloop()
