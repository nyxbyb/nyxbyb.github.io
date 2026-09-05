#!/usr/bin/env python3
"""凿星图 · 嵌入 + 降维
读 corpus/books_raw.json（[{title, author, rating, source}]），
用 fastembed 的轻量中文模型嵌入，TSNE 降到 2D，输出前端用的 graph.json。
首次运行会从 HuggingFace 下载模型（~100MB）。
"""
import json, os, sys, time

BASE = os.path.expanduser("~/Desktop/Caelum")
RAW = os.path.join(BASE, "corpus/books_raw.json")
OUT = os.path.join(BASE, "web/public/data/graph.json")

MODEL = os.environ.get("EMBED_MODEL", "BAAI/bge-small-zh-v1.5")

def load_books():
    if not os.path.exists(RAW):
        sys.exit(f"找不到 {RAW}，先跑爬虫生成 books_raw.json")
    books = json.load(open(RAW))
    return books

def make_text(b):
    # 节点文本 = 标题 + 作者 + 评分提示，尽量简洁但可区分
    parts = [b.get("title", "")]
    if b.get("author"):
        parts.append(b["author"])
    if b.get("rating"):
        parts.append(f"评分{int(b['rating'])}")
    return " | ".join(parts)

def main():
    books = load_books()
    print(f"共 {len(books)} 本书")

    print("加载嵌入模型...")
    from fastembed import TextEmbedding
    model = TextEmbedding(MODEL)
    texts = [make_text(b) for b in books]
    print(f"开始嵌入 {len(texts)} 条（首次会下载模型）...")
    t0 = time.time()
    vecs = list(model.embed(texts))
    dt = time.time() - t0
    print(f"嵌入完成，{len(vecs)} 条，耗时 {dt:.1f}s")

    import numpy as np
    X = np.array(vecs, dtype=np.float32)
    print(f"维度: {X.shape}")

    print("TSNE 降维到 2D...")
    from sklearn.manifold import TSNE
    perp = min(30, max(5, len(books) // 5))
    t0 = time.time()
    Y = TSNE(n_components=2, perplexity=perp, random_state=42, init="pca").fit_transform(X)
    print(f"降维完成，耗时 {time.time()-t0:.1f}s")

    # 缩放到 0~1，便于前端坐标系
    Y -= Y.min(axis=0)
    Y /= Y.max(axis=0)

    nodes = []
    for b, (x, y) in zip(books, Y):
        nodes.append({
            "id": f"book_{len(nodes):04d}",
            "type": "book",
            "title": b.get("title"),
            "author": b.get("author", ""),
            "rating": b.get("rating"),
            "status": "unread",
            "douban_rating": b.get("rating"),
            "x": round(float(x), 4),
            "y": round(float(y), 4),
        })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"nodes": nodes}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"✅ 已写 {OUT}，{len(nodes)} 个节点")

if __name__ == "__main__":
    main()