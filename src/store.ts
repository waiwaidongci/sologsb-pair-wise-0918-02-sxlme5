import { useCallback, useEffect, useState } from "react";
import type { Batch, LabReading, Review } from "./types";
import { deltaE, recipeFingerprint, uid } from "./logic";
import { seedBatches } from "./seed";

const STORAGE_KEY = "dye-lab-batches-v1";

/** 表单草稿：除回评、版本、时间戳之外的全部批次字段 */
export interface BatchDraft {
  code: string;
  orderNo: string;
  customer: string;
  colorName: string;
  composition: { fiber: string; percent: number }[];
  weight: number;
  dyes: { id?: string; name: string; amount: number }[];
  liquorRatio: number;
  curve: { id?: string; minute: number; temp: number }[];
  holdMinutes: number;
  holdMinRequired: number;
  holdTemp: number;
  finishing: string;
  finishedAt: string | null;
  targetLab: { L: number; a: number; b: number };
}

export interface ReviewDraft {
  reading: { L: number; a: number; b: number } | null;
  customerConfirmed: boolean;
  note: string;
  reviewer: string;
}

function load(): Batch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Batch[];
      if (Array.isArray(data)) return data;
    }
  } catch {
    // 数据损坏时回落到内置示例
  }
  return seedBatches();
}

export function useBatches() {
  const [batches, setBatches] = useState<Batch[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
    } catch {
      // 存储不可用时仅影响刷新保留，不阻断使用
    }
  }, [batches]);

  const createBatch = useCallback((draft: BatchDraft): string => {
    const id = uid();
    const now = new Date().toISOString();
    const batch: Batch = {
      ...normalizeDraft(draft),
      id,
      recipeVersion: 1,
      reviews: [],
      createdAt: now,
      updatedAt: now,
    };
    setBatches((prev) => [batch, ...prev]);
    return id;
  }, []);

  const updateBatch = useCallback((id: string, draft: BatchDraft) => {
    setBatches((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const fields = normalizeDraft(draft);
        const changed =
          recipeFingerprint(b) !== recipeFingerprint(fields);
        return {
          ...b,
          ...fields,
          // 染料配方/浴比/保温下限变化 → 升版，旧回评保留但自动失效
          recipeVersion: changed ? b.recipeVersion + 1 : b.recipeVersion,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const removeBatch = useCallback((id: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const addReview = useCallback((id: string, input: ReviewDraft) => {
    setBatches((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const reading: LabReading | null = input.reading
          ? { at: new Date().toISOString(), ...input.reading }
          : null;
        const review: Review = {
          id: uid(),
          recipeVersion: b.recipeVersion,
          recipeSnapshot:
            b.dyes.map((d) => `${d.name} ${d.amount}%`).join(" + ") +
            `；浴比 1:${b.liquorRatio}；保温下限 ${b.holdMinRequired}min`,
          reading,
          deltaE: reading ? deltaE(b.targetLab, reading) : null,
          customerConfirmed: input.customerConfirmed,
          note: input.note,
          reviewer: input.reviewer,
          createdAt: new Date().toISOString(),
        };
        return {
          ...b,
          reviews: [...b.reviews, review],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const resetDemo = useCallback(() => {
    setBatches(seedBatches());
  }, []);

  return { batches, createBatch, updateBatch, removeBatch, addReview, resetDemo };
}

/** 规整表单数据：补 id、过滤空行、限制数值范围 */
function normalizeDraft(d: BatchDraft): Omit<Batch, "id" | "recipeVersion" | "reviews" | "createdAt" | "updatedAt"> {
  return {
    code: d.code.trim(),
    orderNo: d.orderNo.trim(),
    customer: d.customer.trim(),
    colorName: d.colorName.trim(),
    composition: d.composition
      .filter((c) => c.fiber.trim())
      .map((c) => ({ fiber: c.fiber.trim(), percent: num(c.percent) })),
    weight: num(d.weight),
    dyes: d.dyes
      .filter((x) => x.name.trim())
      .map((x) => ({ id: x.id ?? uid(), name: x.name.trim(), amount: num(x.amount) })),
    liquorRatio: num(d.liquorRatio),
    curve: d.curve
      .filter((x) => Number.isFinite(num(x.minute)) && Number.isFinite(num(x.temp)))
      .map((x) => ({
        id: x.id ?? uid(),
        minute: num(x.minute),
        temp: num(x.temp),
      }))
      .sort((a, b) => a.minute - b.minute),
    holdMinutes: num(d.holdMinutes),
    holdMinRequired: num(d.holdMinRequired),
    holdTemp: num(d.holdTemp),
    finishing: d.finishing.trim(),
    finishedAt: d.finishedAt ? new Date(d.finishedAt).toISOString() : null,
    targetLab: {
      L: num(d.targetLab.L),
      a: num(d.targetLab.a),
      b: num(d.targetLab.b),
    },
  };
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}
