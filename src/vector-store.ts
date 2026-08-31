#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface EmbeddedDoc {
  id: string;
  text: string;
  metadata?: string;
  vector: number[];
  norm: number;
}

/**
 * The Light: an in-memory semantic index with a deterministic bag-of-ngrams
 * hashed-vector embedding.
 *
 * Embedding: we split text into character 3-grams, hash each ngram into a fixed
 * bucket, and accumulate TF-style term weights into a sparse vector. Similarity
 * is cosine similarity over the unit vectors.
 *
 * This is intended as a dependency-free default. In production, swap in a real
 * embedding provider (OpenAI / voyage) and a real vector database (Pinecone /
 * Milvus) behind the `Embedder` interface below.
 */
export interface Embedder {
  embed(text: string): number[];
}

export class NgramEmbedder implements Embedder {
  private readonly dims: number;
  private readonly n: number;

  constructor(dims = 512, n = 3) {
    this.dims = dims;
    this.n = n;
  }

  embed(text: string): number[] {
    const vector = new Array<number>(this.dims).fill(0);
    const normalized = text.toLowerCase().replace(/\s+/g, " ");
    const grams: string[] = [];
    for (let i = 0; i + this.n <= normalized.length; i++) {
      grams.push(normalized.slice(i, i + this.n));
    }
    const tf = new Map<string, number>();
    for (const g of grams) {
      tf.set(g, (tf.get(g) ?? 0) + 1);
    }
    for (const [g, count] of tf) {
      let h = 0;
      for (let i = 0; i < g.length; i++) {
        h = (h * 31 + g.charCodeAt(i)) >>> 0;
      }
      const bucket = h % this.dims;
      vector[bucket] += count;
    }
    return vector;
  }
}

function cosine(a: number[], b: number[], aNorm: number, bNorm: number): number {
  if (aNorm === 0 || bNorm === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / (aNorm * bNorm);
}

export class VectorStore {
  private readonly embedder: Embedder;
  private readonly path: string;
  private docs: Map<string, EmbeddedDoc> = new Map();

  constructor(embedder: Embedder = new NgramEmbedder()) {
    this.embedder = embedder;
    const raw = process.env.MCP_LIGHT_PATH ?? "data/light.json";
    this.path = resolve(raw);
    mkdirSync(resolve(dirnameOf(this.path)), { recursive: true });
    this.load();
  }

  private load(): void {
    if (!existsSync(this.path)) return;
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as EmbeddedDoc[];
      for (const d of parsed) {
        this.docs.set(d.id, d);
      }
    } catch {
      // Corrupt or missing persistence file: start empty.
    }
  }

  private persist(): void {
    const data = Array.from(this.docs.values()).map(({ vector, ...rest }) => ({
      ...rest,
      vector,
    }));
    writeFileSync(this.path, JSON.stringify(data, null, 2), "utf8");
  }

  add(id: string, text: string, metadata?: string): void {
    const vector = this.embedder.embed(text);
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    this.docs.set(id, { id, text, metadata, vector, norm });
    this.persist();
  }

  size(): number {
    return this.docs.size;
  }

  search(
    query: string,
    topK = 5,
    threshold = 0,
  ): { id: string; score: number; text: string; metadata?: string }[] {
    const qv = this.embedder.embed(query);
    const qn = Math.sqrt(qv.reduce((s, v) => s + v * v, 0));
    const ranked: { id: string; score: number; text: string; metadata?: string }[] =
      [];
    for (const doc of this.docs.values()) {
      const score = cosine(qv, doc.vector, qn, doc.norm);
      if (score >= threshold) {
        ranked.push({ id: doc.id, score, text: doc.text, metadata: doc.metadata });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, topK);
  }
}

function dirnameOf(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(0, idx) : ".";
}
