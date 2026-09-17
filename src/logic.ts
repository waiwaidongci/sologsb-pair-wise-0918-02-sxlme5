import type { Batch, BatchStatus, Review } from "./types";

/** CIE76 ΔE（小样评审常用） */
export function deltaE(
  a: { L: number; a: number; b: number },
  b: { L: number; a: number; b: number }
): number {
  return Math.sqrt(
    (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2
  );
}

export const DELTA_E_LIMIT = 1.0;
export const FINISH_LOCK_HOURS = 24;

/** 后整理是否已满 24 小时 */
export function isFinishingAged(batch: Batch, now = Date.now()): boolean {
  if (!batch.finishedAt) return false;
  return now - new Date(batch.finishedAt).getTime() >= FINISH_LOCK_HOURS * 3600_000;
}

/** 保温是否达到配方下限 */
export function isHoldMet(batch: Batch): boolean {
  return batch.holdMinutes >= batch.holdMinRequired;
}

/** 后整理距放行还剩的小时数（已满为 0，未定后整理返回 null） */
export function finishingRemainingHours(
  batch: Batch,
  now = Date.now()
): number | null {
  if (!batch.finishedAt) return null;
  const ms =
    new Date(batch.finishedAt).getTime() + FINISH_LOCK_HOURS * 3600_000 - now;
  return ms <= 0 ? 0 : Math.ceil(ms / 3600_000);
}

/** 最新一次回评（可能已因改方失效） */
export function latestReview(batch: Batch): Review | null {
  return batch.reviews.length ? batch.reviews[batch.reviews.length - 1] : null;
}

/** 最新一次“与当前配方版本一致”的有效回评 */
export function latestValidReview(batch: Batch): Review | null {
  for (let i = batch.reviews.length - 1; i >= 0; i--) {
    if (batch.reviews[i].recipeVersion === batch.recipeVersion) {
      return batch.reviews[i];
    }
  }
  return null;
}

/**
 * 批次状态判定（核心规则）：
 * 1. 保温未达配方下限，或后整理未满 24h —— 只能「待检」；
 * 2. 条件齐备后：ΔE ≤ 1.0 且客户确认 —— 「评审通过」；
 * 3. 已做实测但未满足通过条件 —— 保留实测并标「待复染」；
 * 4. 条件齐备但尚未实测 —— 「待检」。
 */
export function computeStatus(batch: Batch, now = Date.now()): BatchStatus {
  const holdMet = isHoldMet(batch);
  const aged = isFinishingAged(batch, now);
  if (!holdMet || !aged) return "pending";

  const review = latestValidReview(batch);
  if (!review || review.reading === null || review.deltaE === null) {
    return "pending";
  }
  if (review.deltaE <= DELTA_E_LIMIT && review.customerConfirmed) {
    return "pass";
  }
  return "redye";
}

export interface StatusDetail {
  status: BatchStatus;
  holdMet: boolean;
  aged: boolean;
  remainingHours: number | null;
  review: Review | null;
  reasons: string[];
}

export function statusDetail(batch: Batch, now = Date.now()): StatusDetail {
  const holdMet = isHoldMet(batch);
  const aged = isFinishingAged(batch, now);
  const remainingHours = finishingRemainingHours(batch, now);
  const review = latestValidReview(batch);
  const reasons: string[] = [];

  if (!holdMet) {
    reasons.push(
      `保温 ${batch.holdMinutes}min 未达配方下限 ${batch.holdMinRequired}min`
    );
  }
  if (!aged) {
    reasons.push(
      batch.finishedAt
        ? `后整理未满 ${FINISH_LOCK_HOURS}h（还差约 ${remainingHours ?? "?"}h）`
        : "尚未登记后整理完成时间"
    );
  }
  if (holdMet && aged) {
    if (!review || review.reading === null) reasons.push("待测量 Lab 并回评");
    else if ((review.deltaE ?? Infinity) > DELTA_E_LIMIT)
      reasons.push(`ΔE ${review.deltaE!.toFixed(2)} 高于 ${DELTA_E_LIMIT.toFixed(1)}`);
    else if (!review.customerConfirmed) reasons.push("ΔE 合格，等待客户确认");
  }

  return { status: computeStatus(batch, now), holdMet, aged, remainingHours, review, reasons };
}

/** 配方指纹：染料清单、浴比、保温下限任一变化即视为改方 */
export function recipeFingerprint(batch: {
  dyes: { name: string; amount: number }[];
  liquorRatio: number;
  holdMinRequired: number;
}): string {
  const dyes = batch.dyes
    .map((d) => `${d.name.trim()}:${round3(d.amount)}`)
    .sort()
    .join("|");
  return `dyes[${dyes}];ratio=1:${round3(batch.liquorRatio)};holdMin>=${round3(
    batch.holdMinRequired
  )}`;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** 温度曲线摘要：起温 → 速率 → 保温 → 降温 */
export function curveSummary(curve: { minute: number; temp: number }[]): string {
  const pts = [...curve].sort((a, b) => a.minute - b.minute);
  if (pts.length === 0) return "未录入温度曲线";
  if (pts.length === 1) return `${pts[0].minute}min @ ${pts[0].temp}℃`;
  const segs: string[] = [];
  for (let i = 1; i < pts.length; i++) {
    const dt = pts[i].minute - pts[i - 1].minute;
    const dT = pts[i].temp - pts[i - 1].temp;
    if (dt <= 0) continue;
    const rate = dT / dt;
    const action =
      Math.abs(rate) < 0.05
        ? `${pts[i - 1].temp}℃ 保温 ${dt}min`
        : `${pts[i - 1].temp}→${pts[i].temp}℃（${rate > 0 ? "升温" : "降温"} ${Math.abs(
            Math.round(rate * 10) / 10
          )}℃/min, ${dt}min）`;
    segs.push(action);
  }
  return segs.join("；");
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
