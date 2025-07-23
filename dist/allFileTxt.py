import os

def merge_with_line_tags(input_dir, output_file):
    output_path = os.path.join(input_dir, output_file)
    with open(output_path, 'w', encoding='utf-8') as out:
        for fname in sorted(os.listdir(input_dir)):
            if not fname.endswith(".txt"):
                continue
            if fname == output_file:
                continue

            path = os.path.join(input_dir, fname)
            if not os.path.isfile(path):
                continue

            out.write(f"=== BEGIN:{fname} ===\n")
            with open(path, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f, 1):
                    line = line.rstrip('\n')
                    out.write(f"[{fname}:{i}] {line}\n")
            out.write(f"=== END:{fname} ===\n\n")

    print(f"Đã gộp xong vào: {os.path.abspath(output_path)}")

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    merge_with_line_tags(current_dir, "merged.txt")
