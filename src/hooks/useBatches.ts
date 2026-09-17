import { useCallback, useEffect, useState } from "react";
import type { Batch } from "../types";
import { STORAGE_KEY } from "../lib/bench";
import { buildSeedBatches } from "../lib/seed";

function load(): Batch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Batch[];
    }
  } catch {
    /* 存储损坏时回退到内置数据 */
  }
  return buildSeedBatches();
}

export function useBatches() {
  const [batches, setBatches] = useState<Batch[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
    } catch {
      /* 配额或隐私模式下忽略 */
    }
  }, [batches]);

  // 后处理时长是相对“现在”计算的，每 30s 刷新一次判定
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const upsertBatch = useCallback((batch: Batch) => {
    setBatches((prev) => {
      const idx = prev.findIndex((b) => b.id === batch.id);
      if (idx === -1) return [batch, ...prev];
      const next = [...prev];
      next[idx] = batch;
      return next;
    });
  }, []);

  const removeBatch = useCallback((id: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const resetAll = useCallback(() => {
    setBatches(buildSeedBatches());
  }, []);

  return { batches, upsertBatch, removeBatch, resetAll };
}
