import argparse
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        default=None,
        help="图片目录路径，默认使用项目 images 目录",
    )
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument("--delete-original", action="store_true")
    return parser.parse_args()


def resolve_root(root_arg):
    if root_arg:
        return Path(root_arg).expanduser().resolve()
    return (Path(__file__).resolve().parent / "images").resolve()


def convert_images_to_webp(root, quality, delete_original):
    from PIL import Image

    source_files = sorted(list(root.glob("*.png")) + list(root.glob("*.jpg")) + list(root.glob("*.jpeg")))
    converted = []
    for source_path in source_files:
        webp_path = source_path.with_suffix(".webp")
        with Image.open(source_path) as img:
            if img.mode in ("RGBA", "P"):
                out = img.convert("RGBA")
            else:
                out = img.convert("RGB")
            out.save(webp_path, format="WEBP", quality=quality, method=6)
        if delete_original:
            source_path.unlink()
        converted.append((source_path.name, webp_path.name))
    return converted


def main():
    args = parse_args()
    root = resolve_root(args.root)
    converted = convert_images_to_webp(root, args.quality, args.delete_original)
    for src, dst in converted:
        print(f"{src} -> {dst}")
    print(f"converted: {len(converted)}")


if __name__ == "__main__":
    main()
