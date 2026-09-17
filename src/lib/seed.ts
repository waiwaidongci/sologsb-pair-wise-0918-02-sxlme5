import type { Batch, CurvePoint, Dye, Lab, ReviewEntry } from "../types";
import {
  deltaE,
  recipeFingerprintOf,
  recipeSummaryOf,
  uid,
} from "./bench";

const HOUR = 3_600_000;

function pts(rows: [number, number][]): CurvePoint[] {
  return rows.map(([minute, temp]) => ({ id: uid("pt"), minute, temp }));
}

function dyes(rows: [string, number][]): Dye[] {
  return rows.map(([name, dosage]) => ({ id: uid("dye"), name, dosage }));
}

interface SeedSpec {
  code: string;
  customer: string;
  orderNo: string;
  fabric: string;
  weight: number;
  dyes: [string, number][];
  liquorRatio: number;
  minHolding: number;
  curve: [number, number][];
  holdingMin: number;
  postFinish: string;
  postFinishedHoursAgo: number;
  targetLab: Lab;
  measuredLab: Lab | null;
  customerConfirmed: boolean;
  reviewed?: boolean;
  note?: string;
}

const SPECS: SeedSpec[] = [
  {
    code: "LAB-620A",
    customer: "华澜服饰",
    orderNo: "PO-2026-0918",
    fabric: "棉100%",
    weight: 120,
    dyes: [
      ["活性红3BS", 1.8],
      ["活性黄3RS", 0.6],
      ["活性蓝KN-G", 0.25],
    ],
    liquorRatio: 10,
    minHolding: 40,
    curve: [
      [0, 40],
      [20, 60],
      [60, 60],
      [70, 40],
    ],
    holdingMin: 42,
    postFinish: "柔软剂 20g/L 浸轧定型",
    postFinishedHoursAgo: 30,
    targetLab: { L: 46.2, a: 52.4, b: 18.1 },
    measuredLab: { L: 46.5, a: 52.0, b: 18.7 },
    customerConfirmed: true,
    reviewed: true,
    note: "头缸样，客户对色灯箱 D65 光源确认。",
  },
  {
    code: "LAB-621C",
    customer: "盛泽织造",
    orderNo: "PO-2026-0921",
    fabric: "涤纶100%",
    weight: 180,
    dyes: [
      ["分散蓝2BLN", 1.2],
      ["分散红玉S-5BL", 0.9],
      ["分散橙SE-RL", 0.35],
    ],
    liquorRatio: 12,
    minHolding: 30,
    curve: [
      [0, 40],
      [30, 80],
      [50, 130],
      [80, 130],
      [100, 80],
    ],
    holdingMin: 34,
    postFinish: "亲水柔软整理 30g/L",
    postFinishedHoursAgo: 26,
    targetLab: { L: 33.8, a: 8.6, b: -32.5 },
    measuredLab: { L: 34.9, a: 7.1, b: -33.8 },
    customerConfirmed: false,
    reviewed: true,
    note: "升温 2.5℃/min 偏快，b 值偏蓝，建议追加黄相染料后复染。",
  },
  {
    code: "LAB-624B",
    customer: "汇纺联合",
    orderNo: "PO-2026-0925",
    fabric: "涤棉 65/35 混纺",
    weight: 210,
    dyes: [
      ["分散红FB", 0.8],
      ["活性红3BS", 0.5],
    ],
    liquorRatio: 12,
    minHolding: 35,
    curve: [
      [0, 40],
      [25, 98],
      [60, 98],
      [75, 50],
    ],
    holdingMin: 38,
    postFinish: "柔软剂 2% + 预缩",
    postFinishedHoursAgo: 6,
    targetLab: { L: 51.0, a: 44.2, b: 12.6 },
    measuredLab: { L: 50.6, a: 43.8, b: 13.2 },
    customerConfirmed: false,
    note: "后整理刚完成，等待满 24h 后评审，实测已录入备查。",
  },
  {
    code: "LAB-625A",
    customer: "盛泽织造",
    orderNo: "PO-2026-0921",
    fabric: "锦纶100%",
    weight: 95,
    dyes: [
      ["酸性蓝RAW", 1.5],
      ["酸性黄N-R", 0.4],
    ],
    liquorRatio: 15,
    minHolding: 35,
    curve: [
      [0, 30],
      [25, 98],
      [60, 98],
      [75, 50],
    ],
    holdingMin: 28,
    postFinish: "抗静电整理 15g/L",
    postFinishedHoursAgo: 27,
    targetLab: { L: 40.5, a: -2.4, b: -28.0 },
    measuredLab: null,
    customerConfirmed: false,
    note: "保温时间不足，暂不测色，安排追加保温工艺后重取小样。",
  },
];

function buildSeed(spec: SeedSpec, now: number): Batch {
  const ds = dyes(spec.dyes);
  const created = now - spec.postFinishedHoursAgo * HOUR - 48 * HOUR;
  const postAt = now - spec.postFinishedHoursAgo * HOUR;
  const batch: Batch = {
    id: uid("seed"),
    code: spec.code,
    customer: spec.customer,
    orderNo: spec.orderNo,
    fabric: spec.fabric,
    weight: spec.weight,
    dyes: ds,
    liquorRatio: spec.liquorRatio,
    minHolding: spec.minHolding,
    recipeVersion: 1,
    curve: pts(spec.curve),
    holdingMin: spec.holdingMin,
    postFinish: spec.postFinish,
    postFinishedAt: new Date(postAt).toISOString(),
    targetLab: spec.targetLab,
    measuredLab: spec.measuredLab,
    customerConfirmed: spec.customerConfirmed,
    reviews: [],
    createdAt: new Date(created).toISOString(),
    updatedAt: new Date(postAt + 2 * HOUR).toISOString(),
  };

  if (spec.reviewed && spec.measuredLab) {
    const de = deltaE(spec.targetLab, spec.measuredLab);
    const review: ReviewEntry = {
      id: uid("rev"),
      at: new Date(postAt + 2 * HOUR).toISOString(),
      recipeFingerprint: recipeFingerprintOf(batch),
      recipeVersion: 1,
      recipeSummary: recipeSummaryOf(batch.dyes),
      holdingMin: batch.holdingMin,
      postAgeHours: Math.max(0, (postAt + 2 * HOUR - postAt) / HOUR),
      measuredLab: { ...spec.measuredLab },
      deltaE: de,
      customerConfirmed: spec.customerConfirmed,
      verdict: de <= 1.0 && spec.customerConfirmed ? "通过" : "待复染",
      note: spec.note ?? "",
    };
    batch.reviews = [review];
  }
  return batch;
}

export function buildSeedBatches(now: number = Date.now()): Batch[] {
  return SPECS.map((s) => buildSeed(s, now));
}
