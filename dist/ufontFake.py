import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import shutil
from pathlib import Path
import subprocess
import platform
from PIL import Image, ImageDraw, ImageFont, ImageTk
import threading


class FontManagerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Font Manager")
        self.root.geometry("1400x700")

        # Variables để lưu trữ các file được chọn
        self.source_selected = None
        self.dest_selected = None
        self.source_path = None
        self.dest_path = None

        self.setup_ui()
        # Thêm sự kiện nhấn phím Enter
        self.root.bind('<Return>', lambda event: self.rename_source_to_dest())

    def setup_ui(self):
        # Main container
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Top frame cho 2 khu vực chính
        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill=tk.BOTH, expand=True)

        # Source area (bên trái)
        source_frame = ttk.LabelFrame(
            top_frame, text="Khu vực nguồn", padding=5)
        source_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))

        # Source buttons
        source_btn_frame = ttk.Frame(source_frame)
        source_btn_frame.pack(fill=tk.X, pady=(0, 5))

        ttk.Button(source_btn_frame, text="Chọn thư mục",
                   command=lambda: self.select_folder('source')).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(source_btn_frame, text=".ufont → .ttf",
                   command=lambda: self.convert_extensions('source', '.ufont', '.ttf')).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(source_btn_frame, text=".ttf → .ufont",
                   command=lambda: self.convert_extensions('source', '.ttf', '.ufont')).pack(side=tk.LEFT)

        # Source tree
        self.source_tree = ttk.Treeview(source_frame, height=12)
        self.source_tree.pack(fill=tk.BOTH, expand=True)
        self.source_tree.bind(
            '<Button-1>', lambda e: self.on_tree_select('source', e))
        self.source_tree.bind(
            '<Up>', lambda e: self.on_tree_key_navigate('source', 'up'))
        self.source_tree.bind(
            '<Down>', lambda e: self.on_tree_key_navigate('source', 'down'))
        self.source_tree.bind(
            '<FocusIn>', lambda e: self.source_tree.focus_set())

        # Source preview
        source_preview_frame = ttk.LabelFrame(
            source_frame, text="Source Preview", padding=5)
        source_preview_frame.pack(fill=tk.BOTH, expand=True, pady=(5, 0))

        source_canvas_frame = ttk.Frame(source_preview_frame)
        source_canvas_frame.pack(fill=tk.BOTH, expand=True)

        self.source_preview_canvas = tk.Canvas(
            source_canvas_frame, height=150, bg='white')
        source_scrollbar = ttk.Scrollbar(
            source_canvas_frame, orient=tk.VERTICAL, command=self.source_preview_canvas.yview)
        self.source_preview_canvas.configure(
            yscrollcommand=source_scrollbar.set)

        self.source_preview_canvas.pack(
            side=tk.LEFT, fill=tk.BOTH, expand=True)
        source_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Destination area (bên phải)
        dest_frame = ttk.LabelFrame(top_frame, text="Khu vực đích", padding=5)
        dest_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0))

        # Destination buttons - THÊM NÚT EXPORT FONT
        dest_btn_frame = ttk.Frame(dest_frame)
        dest_btn_frame.pack(fill=tk.X, pady=(0, 5))

        # Hàng đầu tiên
        dest_btn_row1 = ttk.Frame(dest_btn_frame)
        dest_btn_row1.pack(fill=tk.X, pady=(0, 2))

        ttk.Button(dest_btn_row1, text="Chọn thư mục",
                   command=lambda: self.select_folder('dest')).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(dest_btn_row1, text=".ufont → .ttf",
                   command=lambda: self.convert_extensions('dest', '.ufont', '.ttf')).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(dest_btn_row1, text=".ttf → .ufont",
                   command=lambda: self.convert_extensions('dest', '.ttf', '.ufont')).pack(side=tk.LEFT, padx=(0, 5))

        # Hàng thứ hai - NÚT MỚI
        dest_btn_row2 = ttk.Frame(dest_btn_frame)
        dest_btn_row2.pack(fill=tk.X)

        ttk.Button(dest_btn_row2, text="Xóa font thừa",
                   command=self.remove_extra_fonts).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(dest_btn_row2, text="Export font",
                   command=self.export_fonts).pack(side=tk.LEFT)

        # Destination tree
        self.dest_tree = ttk.Treeview(dest_frame, height=12)
        self.dest_tree.pack(fill=tk.BOTH, expand=True)
        self.dest_tree.bind(
            '<Button-1>', lambda e: self.on_tree_select('dest', e))
        self.dest_tree.bind(
            '<Up>', lambda e: self.on_tree_key_navigate('dest', 'up'))
        self.dest_tree.bind(
            '<Down>', lambda e: self.on_tree_key_navigate('dest', 'down'))
        self.dest_tree.bind('<FocusIn>', lambda e: self.dest_tree.focus_set())

        # Destination preview
        dest_preview_frame = ttk.LabelFrame(
            dest_frame, text="Destination Preview", padding=5)
        dest_preview_frame.pack(fill=tk.BOTH, expand=True, pady=(5, 0))

        dest_canvas_frame = ttk.Frame(dest_preview_frame)
        dest_canvas_frame.pack(fill=tk.BOTH, expand=True)

        self.dest_preview_canvas = tk.Canvas(
            dest_canvas_frame, height=150, bg='white')
        dest_scrollbar = ttk.Scrollbar(
            dest_canvas_frame, orient=tk.VERTICAL, command=self.dest_preview_canvas.yview)
        self.dest_preview_canvas.configure(yscrollcommand=dest_scrollbar.set)

        self.dest_preview_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        dest_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Middle frame cho nút "Ốp nó"
        middle_frame = ttk.Frame(main_frame)
        middle_frame.pack(fill=tk.X, pady=10)

        self.rename_btn = ttk.Button(middle_frame, text="Ốp nó",
                                     command=self.rename_source_to_dest, state=tk.DISABLED)
        self.rename_btn.pack()

    def select_folder(self, area):
        folder_path = filedialog.askdirectory()
        if folder_path:
            if area == 'source':
                self.source_path = folder_path
                self.populate_tree(self.source_tree, folder_path)
            else:
                self.dest_path = folder_path
                self.populate_tree(self.dest_tree, folder_path)

    def populate_tree(self, tree, path):
        # Clear existing items
        for item in tree.get_children():
            tree.delete(item)

        # Add files and folders
        try:
            for item in sorted(os.listdir(path)):
                item_path = os.path.join(path, item)
                if os.path.isfile(item_path):
                    # Chỉ hiển thị các file font
                    if item.lower().endswith(('.ttf', '.ufont', '.otf')):
                        tree.insert('', tk.END, text=item, values=[item_path])
                elif os.path.isdir(item_path):
                    # Thêm thư mục
                    folder_id = tree.insert(
                        '', tk.END, text=f"📁 {item}", values=[item_path])
                    # Thêm placeholder để có thể mở rộng
                    tree.insert(folder_id, tk.END, text="Loading...")

            # Bind expand event
            tree.bind('<<TreeviewOpen>>',
                      lambda e: self.on_tree_expand(tree, e))

        except PermissionError:
            messagebox.showerror("Lỗi", f"Không thể truy cập thư mục: {path}")

    def on_tree_expand(self, tree, event):
        item_id = tree.selection()[0] if tree.selection() else None
        if not item_id:
            return

        # Clear placeholder
        children = tree.get_children(item_id)
        if children and tree.item(children[0])['text'] == "Loading...":
            tree.delete(children[0])

            # Load actual content
            folder_path = tree.item(item_id)['values'][0]
            try:
                for item in sorted(os.listdir(folder_path)):
                    item_path = os.path.join(folder_path, item)
                    if os.path.isfile(item_path) and item.lower().endswith(('.ttf', '.ufont', '.otf')):
                        tree.insert(item_id, tk.END, text=item,
                                    values=[item_path])
                    elif os.path.isdir(item_path):
                        sub_folder_id = tree.insert(
                            item_id, tk.END, text=f"📁 {item}", values=[item_path])
                        tree.insert(sub_folder_id, tk.END, text="Loading...")
            except PermissionError:
                tree.insert(item_id, tk.END, text="[Không thể truy cập]")

    def on_tree_select(self, area, event):
        tree = self.source_tree if area == 'source' else self.dest_tree
        selection = tree.identify_row(event.y)

        if not selection:
            return

        tree.selection_set(selection)
        file_path = tree.item(selection)['values']

        if not file_path:
            return

        file_path = file_path[0]

        # Chỉ xử lý file, không xử lý folder
        if not os.path.isfile(file_path):
            return

        # Highlight selection
        if area == 'source':
            self.clear_tree_selection(self.source_tree)
            tree.item(selection, tags=('source_selected',))
            tree.tag_configure('source_selected', background='lightblue')
            self.source_selected = file_path

            # Show preview for source
            if file_path.lower().endswith('.ttf'):
                threading.Thread(target=self.show_font_preview,
                                 args=(file_path, 'source'), daemon=True).start()
            else:
                self.clear_preview('source')
        else:
            self.clear_tree_selection(self.dest_tree)
            tree.item(selection, tags=('dest_selected',))
            tree.tag_configure('dest_selected', background='lightgreen')
            self.dest_selected = file_path

            # Show preview for destination
            if file_path.lower().endswith('.ttf'):
                threading.Thread(target=self.show_font_preview,
                                 args=(file_path, 'dest'), daemon=True).start()
            else:
                self.clear_preview('dest')

        # Update rename button state
        self.update_rename_button()

    def on_tree_key_navigate(self, area, direction):
        tree = self.source_tree if area == 'source' else self.dest_tree
        current_selection = tree.selection()

        if not tree.get_children():
            return

        # If no selection, select first item
        if not current_selection:
            tree.selection_set(tree.get_children()[0])
        else:
            current_item = current_selection[0]
            items = tree.get_children()

            # Find current index
            current_index = items.index(current_item)

            # Calculate new index based on direction
            if direction == 'up':
                new_index = max(0, current_index - 1)
            else:  # down
                new_index = min(len(items) - 1, current_index + 1)

            # Select new item
            tree.selection_set(items[new_index])

            # Ensure item is visible
            tree.see(items[new_index])

            # Trigger selection handling
            file_path = tree.item(items[new_index])['values']
            if file_path and os.path.isfile(file_path[0]):
                if area == 'source':
                    self.clear_tree_selection(self.source_tree)
                    tree.item(items[new_index], tags=('source_selected',))
                    tree.tag_configure('source_selected',
                                       background='lightblue')
                    self.source_selected = file_path[0]

                    if file_path[0].lower().endswith('.ttf'):
                        threading.Thread(target=self.show_font_preview,
                                         args=(file_path[0], 'source'), daemon=True).start()
                    else:
                        self.clear_preview('source')
                else:
                    self.clear_tree_selection(self.dest_tree)
                    tree.item(items[new_index], tags=('dest_selected',))
                    tree.tag_configure(
                        'dest_selected', background='lightgreen')
                    self.dest_selected = file_path[0]

                    if file_path[0].lower().endswith('.ttf'):
                        threading.Thread(target=self.show_font_preview,
                                         args=(file_path[0], 'dest'), daemon=True).start()
                    else:
                        self.clear_preview('dest')

        # Update rename button state
        self.update_rename_button()

    def clear_tree_selection(self, tree):
        """Clear all selections and tags in tree recursively"""
        def clear_item(item_id):
            tree.item(item_id, tags=())
            for child in tree.get_children(item_id):
                clear_item(child)

        for item_id in tree.get_children():
            clear_item(item_id)

    def clear_preview(self, area):
        """Clear preview canvas for specified area"""
        canvas = self.source_preview_canvas if area == 'source' else self.dest_preview_canvas
        self.root.after(0, lambda: self._clear_canvas(canvas))

    def _clear_canvas(self, canvas):
        canvas.delete("all")
        canvas.create_text(canvas.winfo_width()//2, canvas.winfo_height()//2,
                           text="No preview available", fill="gray", anchor="center")

    def update_rename_button(self):
        if self.source_selected and self.dest_selected:
            self.rename_btn.config(state=tk.NORMAL)
        else:
            self.rename_btn.config(state=tk.DISABLED)

    def show_font_preview(self, font_path, area):
        try:
            # Create preview image
            width, height = 400, 120
            img = Image.new('RGB', (width, height), color='white')
            draw = ImageDraw.Draw(img)

            # Try to load font
            try:
                font_size = 18
                font = ImageFont.truetype(font_path, font_size)
                sample_text = "The quick brown fox jumps\nABCDEFGHIJKLMNOPQRSTUVWXYZ\n0123456789 !@#$%^&*()"

                # Draw text
                lines = sample_text.split('\n')
                y_offset = 8
                for line in lines:
                    draw.text((8, y_offset), line, font=font, fill='black')
                    y_offset += 25

                # Font name
                font_name = os.path.basename(font_path)
                try:
                    small_font = ImageFont.truetype(font_path, 12)
                except:
                    small_font = ImageFont.load_default()
                draw.text((8, height - 20),
                          f"Font: {font_name}", font=small_font, fill='blue')

            except Exception as e:
                # Fallback to default font
                draw.text(
                    (8, 8), f"Cannot preview font: {os.path.basename(font_path)}", fill='red')
                draw.text((8, 30), f"Error: {str(e)}", fill='red')

            # Convert to PhotoImage and display
            photo = ImageTk.PhotoImage(img)

            # Update canvas in main thread
            canvas = self.source_preview_canvas if area == 'source' else self.dest_preview_canvas
            self.root.after(
                0, lambda: self.update_preview_canvas(canvas, photo))

        except Exception as e:
            print(f"Preview error: {e}")
            # Show error message in preview area
            self.root.after(0, lambda: self.show_preview_error(area, str(e)))

    def show_preview_error(self, area, error_msg):
        """Show error message in preview area"""
        canvas = self.source_preview_canvas if area == 'source' else self.dest_preview_canvas
        canvas.delete("all")
        canvas.create_text(10, 10, text=f"Preview error: {error_msg}",
                           fill='red', anchor='nw')

    def update_preview_canvas(self, canvas, photo):
        canvas.delete("all")
        canvas.create_image(0, 0, anchor=tk.NW, image=photo)
        canvas.configure(scrollregion=canvas.bbox("all"))
        # Keep a reference to prevent garbage collection
        canvas.image = photo

    def convert_extensions(self, area, from_ext, to_ext):
        path = self.source_path if area == 'source' else self.dest_path
        if not path:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn thư mục trước")
            return

        try:
            count = 0
            for root, dirs, files in os.walk(path):
                for file in files:
                    if file.lower().endswith(from_ext.lower()):
                        old_path = os.path.join(root, file)
                        new_name = file[:-len(from_ext)] + to_ext
                        new_path = os.path.join(root, new_name)

                        if not os.path.exists(new_path):
                            os.rename(old_path, new_path)
                            count += 1

            messagebox.showinfo(
                "Hoàn thành", f"Đã chuyển đổi {count} file từ {from_ext} sang {to_ext}")

            # Refresh tree
            tree = self.source_tree if area == 'source' else self.dest_tree
            self.populate_tree(tree, path)

        except Exception as e:
            messagebox.showerror("Lỗi", f"Có lỗi xảy ra: {str(e)}")

    # Thêm event=None để xử lý cả trường hợp gọi từ sự kiện
    def rename_source_to_dest(self, event=None):
        if not self.source_selected or not self.dest_selected:
            return

        try:
            # Get source and destination info
            source_path = Path(self.source_selected)
            dest_path = Path(self.dest_selected)

            # Get new name (same as source file name but with destination extension)
            source_name = source_path.stem  # filename without extension
            dest_ext = dest_path.suffix  # extension

            new_name = source_name + dest_ext
            new_dest_path = dest_path.parent / new_name

            # Check if target name already exists
            if new_dest_path.exists() and new_dest_path != dest_path:
                if not messagebox.askyesno("Xác nhận", f"File {new_name} đã tồn tại. Ghi đè?"):
                    return

            # Rename destination file to source filename
            dest_path.rename(new_dest_path)

            messagebox.showinfo(
                "Hoàn thành", f"Đã đổi tên file đích:\n{dest_path.name} → {new_name}")

            # Refresh destination tree
            if self.dest_path:
                self.populate_tree(self.dest_tree, self.dest_path)

            # Reset selections
            self.source_selected = None
            self.dest_selected = None
            self.update_rename_button()

            # Clear previews
            self.clear_preview('source')
            self.clear_preview('dest')

        except Exception as e:
            messagebox.showerror("Lỗi", f"Không thể đổi tên file: {str(e)}")

    def get_font_names_in_directory(self, directory_path):
        """Lấy danh sách tên font (không có phần mở rộng) trong thư mục"""
        font_names = set()
        if not directory_path or not os.path.exists(directory_path):
            return font_names

        try:
            for root, dirs, files in os.walk(directory_path):
                for file in files:
                    if file.lower().endswith(('.ttf', '.ufont', '.otf')):
                        # Lấy tên file không có phần mở rộng
                        font_name = os.path.splitext(file)[0]
                        font_names.add(font_name)
        except Exception as e:
            print(f"Error reading directory {directory_path}: {e}")

        return font_names

    def remove_extra_fonts(self):
        """Xóa các font ở thư mục đích mà không có trong thư mục nguồn"""
        if not self.source_path or not self.dest_path:
            messagebox.showwarning(
                "Cảnh báo", "Vui lòng chọn cả thư mục nguồn và đích trước")
            return

        try:
            # Lấy danh sách tên font từ thư mục nguồn
            source_font_names = self.get_font_names_in_directory(
                self.source_path)

            if not source_font_names:
                messagebox.showinfo(
                    "Thông báo", "Không tìm thấy font nào trong thư mục nguồn")
                return

            # Tìm các font thừa trong thư mục đích
            extra_fonts = []
            for root, dirs, files in os.walk(self.dest_path):
                for file in files:
                    if file.lower().endswith(('.ttf', '.ufont', '.otf')):
                        font_name = os.path.splitext(file)[0]
                        if font_name not in source_font_names:
                            extra_fonts.append(os.path.join(root, file))

            if not extra_fonts:
                messagebox.showinfo(
                    "Thông báo", "Không có font thừa nào để xóa")
                return

            # Hiển thị danh sách font sẽ bị xóa
            # Chỉ hiển thị 10 font đầu
            font_list = "\n".join([os.path.basename(font)
                                  for font in extra_fonts[:10]])
            if len(extra_fonts) > 10:
                font_list += f"\n... và {len(extra_fonts) - 10} font khác"

            confirm_msg = f"Tìm thấy {len(extra_fonts)} font thừa sẽ bị xóa:\n\n{font_list}\n\nBạn có chắc chắn muốn xóa?"

            if not messagebox.askyesno("Xác nhận xóa", confirm_msg):
                return

            # Xóa các font thừa
            deleted_count = 0
            errors = []

            for font_path in extra_fonts:
                try:
                    os.remove(font_path)
                    deleted_count += 1
                except Exception as e:
                    errors.append(f"{os.path.basename(font_path)}: {str(e)}")

            # Thông báo kết quả
            result_msg = f"Đã xóa {deleted_count}/{len(extra_fonts)} font thừa"
            if errors:
                result_msg += f"\n\nLỗi khi xóa {len(errors)} font:\n" + \
                    "\n".join(errors[:5])
                if len(errors) > 5:
                    result_msg += f"\n... và {len(errors) - 5} lỗi khác"
                messagebox.showwarning("Hoàn thành với lỗi", result_msg)
            else:
                messagebox.showinfo("Hoàn thành", result_msg)

            # Refresh destination tree
            self.populate_tree(self.dest_tree, self.dest_path)

            # Clear selections and previews
            self.dest_selected = None
            self.update_rename_button()
            self.clear_preview('dest')

        except Exception as e:
            messagebox.showerror("Lỗi", f"Có lỗi xảy ra: {str(e)}")

    # CHỨC NĂNG MỚI: EXPORT FONTS
    def export_fonts(self):
        """Export tất cả font từ thư mục đích sang thư mục mới"""
        if not self.dest_path:
            messagebox.showwarning(
                "Cảnh báo", "Vui lòng chọn thư mục đích trước")
            return

        # Chọn thư mục để export
        export_path = filedialog.askdirectory(
            title="Chọn thư mục để export font")
        if not export_path:
            return

        try:
            # Tìm tất cả các font trong thư mục đích
            font_files = []
            for root, dirs, files in os.walk(self.dest_path):
                for file in files:
                    if file.lower().endswith(('.ttf', '.ufont', '.otf')):
                        font_files.append(os.path.join(root, file))

            if not font_files:
                messagebox.showinfo(
                    "Thông báo", "Không tìm thấy font nào trong thư mục đích")
                return

            # Hiển thị thông tin xác nhận
            confirm_msg = f"Sẽ export {len(font_files)} font từ:\n{self.dest_path}\n\nSang:\n{export_path}\n\nTiếp tục?"

            if not messagebox.askyesno("Xác nhận export", confirm_msg):
                return

            # Tạo thư mục đích nếu chưa tồn tại
            os.makedirs(export_path, exist_ok=True)

            # Copy các font
            exported_count = 0
            skipped_count = 0
            errors = []

            for font_path in font_files:
                try:
                    font_name = os.path.basename(font_path)
                    dest_font_path = os.path.join(export_path, font_name)

                    # Kiểm tra file đã tồn tại chưa
                    if os.path.exists(dest_font_path):
                        # So sánh kích thước file để quyết định có ghi đè không
                        if os.path.getsize(font_path) == os.path.getsize(dest_font_path):
                            skipped_count += 1
                            continue
                        else:
                            # File khác nhau, hỏi người dùng
                            if not messagebox.askyesno("File đã tồn tại",
                                                       f"Font '{font_name}' đã tồn tại trong thư mục export.\nGhi đè?"):
                                skipped_count += 1
                                continue

                    # Copy file
                    shutil.copy2(font_path, dest_font_path)
                    exported_count += 1

                except Exception as e:
                    errors.append(f"{os.path.basename(font_path)}: {str(e)}")

            # Thông báo kết quả
            result_msg = f"Đã export {exported_count} font thành công"
            if skipped_count > 0:
                result_msg += f"\nBỏ qua {skipped_count} font (đã tồn tại)"

            if errors:
                result_msg += f"\n\nLỗi khi export {len(errors)} font:\n" + \
                    "\n".join(errors[:5])
                if len(errors) > 5:
                    result_msg += f"\n... và {len(errors) - 5} lỗi khác"
                messagebox.showwarning("Hoàn thành với lỗi", result_msg)
            else:
                messagebox.showinfo("Export hoàn thành", result_msg)

        except Exception as e:
            messagebox.showerror("Lỗi", f"Có lỗi xảy ra khi export: {str(e)}")


def main():
    root = tk.Tk()
    app = FontManagerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
