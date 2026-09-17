import type { Batch, CurvePoint, DyeItem, Review } from "./types";
import { deltaE, uid } from "./logic";

const HOUR = 3600_000;

function dyes(...items: [string, number][]): DyeItem[] {
  return items.map(([name, amount]) => ({ id: uid(), name, amount }));
}

function curve(...pts: [number, number][]): CurvePoint[] {
  return pts.map(([minute, temp]) => ({ id: uid(), minute, temp }));
}

function review(
  partial: Omit<Review, "id" | "createdAt"> & { hoursAgo?: number }
): Review {
  const { hoursAgo = 1, ...rest } = partial;
  return {
    id: uid(),
    createdAt: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
    ...rest,
  };
}

function snap(d: { name: string; amount: number }[], ratio: number, holdMin: number) {
  return (
    d.map((x) => `${x.name} ${x.amount}%`).join(" + ") +
    `；浴比 1:${ratio}；保温下限 ${holdMin}min`
  );
}

/** 首次使用时写入的内置批次（时间戳相对当前时间生成，便于演示状态规则） */
export function seedBatches(): Batch[] {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  // ① 条件齐备、ΔE 合格且客户确认 —— 通过
  const b1Dyes = dyes(["活性红 3BS", 1.8], ["活性黄 3RS", 0.42], ["活性蓝 BRF", 0.18]);
  const b1Target = { L: 62.4, a: 38.6, b: 12.2 };
  const b1Reading = { at: iso(now - 30 * HOUR), L: 62.1, a: 38.1, b: 12.6 };
  const b1: Batch = {
    id: uid(),
    code: "LAB-620A",
    orderNo: "PO-CT2409-118",
    customer: "南通弘远家纺",
    colorName: "枣红",
    composition: [{ fiber: "棉", percent: 100 }],
    weight: 120,
    dyes: b1Dyes,
    liquorRatio: 10,
    curve: curve([0, 40], [20, 60], [40, 98], [70, 98], [90, 70]),
    holdMinutes: 40,
    holdMinRequired: 30,
    holdTemp: 98,
    finishing: "柔软剂 2%（浸轧）+ 150℃ 定型",
    finishedAt: iso(now - 40 * HOUR),
    targetLab: b1Target,
    recipeVersion: 1,
    reviews: [
      review({
        recipeVersion: 1,
        recipeSnapshot: snap(b1Dyes, 10, 30),
        reading: b1Reading,
        deltaE: round(deltaE(b1Target, b1Reading)),
        customerConfirmed: true,
        note: "缸差稳定，客户来函确认放行。",
        reviewer: "王敏",
        hoursAgo: 26,
      }),
    ],
    createdAt: iso(now - 72 * HOUR),
    updatedAt: iso(now - 26 * HOUR),
  };

  // ② 条件齐备但 ΔE 超 1.0 —— 待复染（保留实测）
  const b2Dyes = dyes(["分散红 60", 1.2], ["分散橙 30", 0.35]);
  const b2Target = { L: 55.8, a: 30.4, b: 18.9 };
  const b2Reading = { at: iso(now - 26 * HOUR), L: 54.1, a: 28.7, b: 17.2 };
  const b2: Batch = {
    id: uid(),
    code: "LAB-621C",
    orderNo: "PO-HX2409-205",
    customer: "绍兴华星针织",
    colorName: "砖红",
    composition: [{ fiber: "涤纶", percent: 100 }],
    weight: 165,
    dyes: b2Dyes,
    liquorRatio: 12,
    curve: curve([0, 50], [15, 80], [25, 130], [65, 130], [80, 80]),
    holdMinutes: 45,
    holdMinRequired: 40,
    holdTemp: 130,
    finishing: "还原清洗 + 160℃ 定型",
    finishedAt: iso(now - 30 * HOUR),
    targetLab: b2Target,
    recipeVersion: 1,
    reviews: [
      review({
        recipeVersion: 1,
        recipeSnapshot: snap(b2Dyes, 12, 40),
        reading: b2Reading,
        deltaE: round(deltaE(b2Target, b2Reading)),
        customerConfirmed: false,
        note: "升温偏快导致得色偏暗偏浅，建议降升温速率并追加分散红 0.15%。",
        reviewer: "李振东",
        hoursAgo: 24,
      }),
    ],
    createdAt: iso(now - 52 * HOUR),
    updatedAt: iso(now - 24 * HOUR),
  };

  // ③ 后整理未满 24h —— 待检（ΔE 虽好也不能放行）
  const b3Dyes = dyes(["活性红 3BS", 0.9], ["分散红玉 S-5BL", 0.6], ["活性黄 3RS", 0.2]);
  const b3Target = { L: 48.6, a: 34.2, b: 8.4 };
  const b3Reading = { at: iso(now - 4 * HOUR), L: 48.9, a: 34.0, b: 8.9 };
  const b3: Batch = {
    id: uid(),
    code: "LAB-624B",
    orderNo: "PO-JL2409-077",
    customer: "晋江利郎织造",
    colorName: "酒红（一浴两步）",
    composition: [
      { fiber: "棉", percent: 60 },
      { fiber: "涤纶", percent: 40 },
    ],
    weight: 210,
    dyes: b3Dyes,
    liquorRatio: 10,
    curve: curve([0, 40], [20, 80], [35, 130], [60, 130], [75, 70], [95, 98], [115, 98]),
    holdMinutes: 35,
    holdMinRequired: 30,
    holdTemp: 130,
    finishing: "柔软剂 2% + 预缩",
    finishedAt: iso(now - 6 * HOUR),
    targetLab: b3Target,
    recipeVersion: 1,
    reviews: [
      review({
        recipeVersion: 1,
        recipeSnapshot: snap(b3Dyes, 10, 30),
        reading: b3Reading,
        deltaE: round(deltaE(b3Target, b3Reading)),
        customerConfirmed: false,
        note: "初测 ΔE 达标，但后整理时效未满，客户确认函待回传。",
        reviewer: "王敏",
        hoursAgo: 3,
      }),
    ],
    createdAt: iso(now - 40 * HOUR),
    updatedAt: iso(now - 3 * HOUR),
  };

  // ④ 保温未达配方下限 —— 待检
  const b4Dyes = dyes(["酸性红 N-R", 1.5], ["酸性黄 N-RL", 0.28]);
  const b4Target = { L: 58.2, a: 26.8, b: 14.6 };
  const b4: Batch = {
    id: uid(),
    code: "LAB-625A",
    orderNo: "PO-NS2409-312",
    customer: "宁波顺和锦纶",
    colorName: "铁锈红",
    composition: [{ fiber: "锦纶", percent: 100 }],
    weight: 140,
    dyes: b4Dyes,
    liquorRatio: 15,
    curve: curve([0, 40], [25, 98], [45, 98]),
    holdMinutes: 20,
    holdMinRequired: 35,
    holdTemp: 98,
    finishing: "—",
    finishedAt: null,
    targetLab: b4Target,
    recipeVersion: 1,
    reviews: [],
    createdAt: iso(now - 10 * HOUR),
    updatedAt: iso(now - 8 * HOUR),
  };

  // ⑤ 已改方（V2）：V1 回评保留但失效，V2 尚未回评 —— 待检
  const b5DyesV1 = dyes(["活性红 3BS", 1.6], ["活性蓝 BRF", 0.22]);
  const b5Dyes = dyes(["活性红 3BS", 1.9], ["活性蓝 BRF", 0.12], ["活性黄 3RS", 0.15]);
  const b5Target = { L: 44.1, a: 36.8, b: 10.5 };
  const b5ReadingV1 = { at: iso(now - 20 * HOUR), L: 45.0, a: 35.9, b: 12.8 };
  const b5: Batch = {
    id: uid(),
    code: "LAB-626B",
    orderNo: "PO-CT2409-118",
    customer: "南通弘远家纺",
    colorName: "深枣红",
    composition: [
      { fiber: "棉", percent: 95 },
      { fiber: "氨纶", percent: 5 },
    ],
    weight: 180,
    dyes: b5Dyes,
    liquorRatio: 10,
    curve: curve([0, 40], [20, 60], [45, 98], [80, 98], [100, 60]),
    holdMinutes: 40,
    holdMinRequired: 35,
    holdTemp: 98,
    finishing: "柔软剂 1.5% + 150℃ 定型",
    finishedAt: iso(now - 18 * HOUR),
    targetLab: b5Target,
    recipeVersion: 2,
    reviews: [
      review({
        recipeVersion: 1,
        recipeSnapshot: snap(b5DyesV1, 10, 35),
        reading: b5ReadingV1,
        deltaE: round(deltaE(b5Target, b5ReadingV1)),
        customerConfirmed: false,
        note: "V1 偏黄光，ΔE 超标，调整染料比例后打 V2 小样。",
        reviewer: "李振东",
        hoursAgo: 16,
      }),
    ],
    createdAt: iso(now - 30 * HOUR),
    updatedAt: iso(now - 12 * HOUR),
  };

  return [b1, b2, b3, b4, b5];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
