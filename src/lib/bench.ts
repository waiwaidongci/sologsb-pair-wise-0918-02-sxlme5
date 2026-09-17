import type {
  Batch,
  BatchStatus,
  CurvePoint,
  Dye,
  Lab,
  ReviewEntry,
} from "../types";

export const DELTA_E_LIMIT = 1.0;
export const POST_FINISH_MIN_HOURS = 24;

export const STORAGE_KEY = "dye-bench-batches-v1";

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/* ---------------- Lab / 色差 ---------------- */

export function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt(
    (a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2
  );
}

/** CIE Lab（D65）→ sRGB，用于色块可视化 */
export function labToRgb({ L, a, b }: Lab): string {
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  const f = (t: number) =>
    t > 6 / 29 ? t ** 3 : 3 * (6 / 29) ** 2 * (t - 4 / 29);
  x = 0.95047 * f(x);
  y = 1.0 * f(y);
  z = 1.08883 * f(z);
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bl = x * 0.0557 + y * -0.204 + z * 1.057;
  const enc = (c: number) => {
    const v = c > 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  return `rgb(${enc(r)}, ${enc(g)}, ${enc(bl)})`;
}

export function emptyLab(): Lab {
  return { L: 0, a: 0, b: 0 };
}

/* ---------------- 配方指纹与版本 ---------------- */

/** 仅配方相关字段参与指纹：染料（名称+用量）、浴比、保温下限 */
export function recipeFingerprintOf(parts: {
  dyes: Dye[];
  liquorRatio: number;
  minHolding: number;
}): string {
  const dyes = parts.dyes
    .filter((d) => d.name.trim() !== "")
    .map((d) => `${d.name.trim()}@${Number(d.dosage) || 0}`)
    .sort()
    .join("|");
  return `${dyes}#lr${Number(parts.liquorRatio) || 0}#hold${
    Number(parts.minHolding) || 0
  }`;
}

export function recipeSummaryOf(dyes: Dye[]): string {
  const rows = dyes
    .filter((d) => d.name.trim() !== "")
    .map((d) => `${d.name.trim()} ${Number(d.dosage) || 0}%`);
  return rows.length ? rows.join("、") : "（未填写染料）";
}

export function isReviewCurrent(r: ReviewEntry, batch: Batch): boolean {
  return r.recipeFingerprint === recipeFingerprintOf(batch);
}

/* ---------------- 状态判定规则 ---------------- */

export interface Eligibility {
  holdingOk: boolean;
  postOk: boolean;
  postAgeHours: number;
  reasons: string[];
  /** 允许录入回评（保温达标且后处理满 24h） */
  canReview: boolean;
}

export function evaluate(batch: Batch, now: number = Date.now()): Eligibility {
  const postAgeHours =
    (now - new Date(batch.postFinishedAt).getTime()) / 3_600_000;
  const holdingOk =
    Number(batch.holdingMin) >= Number(batch.minHolding) &&
    Number(batch.minHolding) > 0;
  const postOk = postAgeHours >= POST_FINISH_MIN_HOURS;
  const reasons: string[] = [];
  if (!holdingOk)
    reasons.push(
      `实测保温 ${batch.holdingMin}min 未达配方下限 ${batch.minHolding}min`
    );
  if (!postOk) {
    if (postAgeHours < 0) {
      reasons.push("后整理尚未完成");
    } else {
      reasons.push(
        `后整理完成仅 ${postAgeHours.toFixed(1)}h，未满 ${POST_FINISH_MIN_HOURS}h`
      );
    }
  }
  return {
    holdingOk,
    postOk,
    postAgeHours,
    reasons,
    canReview: holdingOk && postOk,
  };
}

/** 当前批次的展示状态：待检 / 通过 / 待复染 */
export function statusOf(batch: Batch, now: number = Date.now()): BatchStatus {
  const e = evaluate(batch, now);
  if (!e.canReview) return "待检";
  const current = batch.reviews.find((r) => isReviewCurrent(r, batch));
  if (!current) return "待检";
  if (current.verdict === "通过") return "通过";
  return "待复染";
}

/** 依据当前实测数据试算一次回评结论（不入库） */
export function previewVerdict(
  batch: Pick<Batch, "holdingMin" | "minHolding" | "postFinishedAt" | "customerConfirmed">,
  measured: Lab | null,
  now: number = Date.now()
): { verdict: BatchStatus; deltaE: number | null; reasons: string[] } {
  const e = evaluate(batch as Batch, now);
  if (!e.canReview) return { verdict: "待检", deltaE: null, reasons: e.reasons };
  if (!measured)
    return {
      verdict: "待检",
      deltaE: null,
      reasons: [...e.reasons, "尚未录入实测 Lab"],
    };
  const de = deltaE((batch as Batch).targetLab, measured);
  const reasons = [...e.reasons];
  if (de > DELTA_E_LIMIT)
    reasons.push(`ΔE ${de.toFixed(2)} 高于限值 ${DELTA_E_LIMIT.toFixed(1)}`);
  if (!batch.customerConfirmed) reasons.push("客户尚未确认");
  const pass = de <= DELTA_E_LIMIT && batch.customerConfirmed;
  return { verdict: pass ? "通过" : "待复染", deltaE: de, reasons };
}

/* ---------------- 回评 ---------------- */

export function buildReview(
  batch: Batch,
  measuredLab: Lab,
  note: string,
  now: number = Date.now()
): ReviewEntry {
  const e = evaluate(batch, now);
  const de = deltaE(batch.targetLab, measuredLab);
  const pass = de <= DELTA_E_LIMIT && batch.customerConfirmed;
  return {
    id: uid("rev"),
    at: new Date(now).toISOString(),
    recipeFingerprint: recipeFingerprintOf(batch),
    recipeVersion: batch.recipeVersion,
    recipeSummary: recipeSummaryOf(batch.dyes),
    holdingMin: Number(batch.holdingMin),
    postAgeHours: Math.max(0, e.postAgeHours),
    measuredLab: { ...measuredLab },
    deltaE: de,
    customerConfirmed: batch.customerConfirmed,
    verdict: pass ? "通过" : "待复染",
    note: note.trim(),
  };
}

/* ---------------- 温度曲线 ---------------- */

export function sortedCurve(points: CurvePoint[]): CurvePoint[] {
  return [...points]
    .map((p) => ({ ...p, minute: Number(p.minute), temp: Number(p.temp) }))
    .sort((a, b) => a.minute - b.minute || a.temp - b.temp);
}

export interface CurveStage {
  from: CurvePoint;
  to: CurvePoint;
  span: number;
  rate: number;
  hold: boolean;
}

export function curveStages(points: CurvePoint[]): CurveStage[] {
  const pts = sortedCurve(points);
  const stages: CurveStage[] = [];
  for (let i = 1; i < pts.length; i++) {
    const span = pts[i].minute - pts[i - 1].minute;
    const rate = span > 0 ? (pts[i].temp - pts[i - 1].temp) / span : 0;
    stages.push({
      from: pts[i - 1],
      to: pts[i],
      span,
      rate,
      hold: Math.abs(rate) < 0.001,
    });
  }
  return stages;
}

/** 曲线摘要，例如：40℃→130℃ 升温 1.5℃/min · 130℃ 保温 30min */
export function curveSummary(points: CurvePoint[]): string {
  const pts = sortedCurve(points);
  if (pts.length === 0) return "未设置温度曲线";
  if (pts.length === 1) return `恒温 ${pts[0].temp}℃`;
  const parts: string[] = [];
  for (const s of curveStages(pts)) {
    if (s.hold) {
      parts.push(`${s.to.temp}℃ 保温 ${s.span}min`);
    } else {
      const dir = s.rate > 0 ? "升温" : "降温";
      parts.push(
        `${s.from.temp}℃→${s.to.temp}℃ ${dir} ${Math.abs(s.rate).toFixed(1)}℃/min`
      );
    }
  }
  return parts.join(" · ");
}

export interface CurvePreset {
  name: string;
  fabric: string;
  minHolding: number;
  points: CurvePoint[];
}

/** 内置常用工艺曲线（id 留空，加入表单时再生成） */
export const CURVE_PRESETS: CurvePreset[] = [
  {
    name: "棉 活性染料 60℃",
    fabric: "棉100%",
    minHolding: 40,
    points: [
      { id: "", minute: 0, temp: 40 },
      { id: "", minute: 20, temp: 60 },
      { id: "", minute: 60, temp: 60 },
      { id: "", minute: 70, temp: 40 },
    ],
  },
  {
    name: "涤纶 分散染料 130℃",
    fabric: "涤纶100%",
    minHolding: 30,
    points: [
      { id: "", minute: 0, temp: 40 },
      { id: "", minute: 30, temp: 80 },
      { id: "", minute: 50, temp: 130 },
      { id: "", minute: 80, temp: 130 },
      { id: "", minute: 100, temp: 80 },
    ],
  },
  {
    name: "锦纶 酸性染料 98℃",
    fabric: "锦纶100%",
    minHolding: 35,
    points: [
      { id: "", minute: 0, temp: 30 },
      { id: "", minute: 25, temp: 98 },
      { id: "", minute: 60, temp: 98 },
      { id: "", minute: 75, temp: 50 },
    ],
  },
];

/* ---------------- 时间工具 ---------------- */

/** Date → datetime-local 输入框值（本地时区） */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function fmtHours(h: number): string {
  if (h < 0) return "未完成";
  if (h < 1) return `${Math.round(h * 60)}min`;
  return `${h.toFixed(1)}h`;
}
