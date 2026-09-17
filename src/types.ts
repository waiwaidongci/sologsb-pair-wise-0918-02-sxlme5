export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface Dye {
  id: string;
  name: string;
  /** 用量，% (o.w.f) */
  dosage: number;
}

export interface CurvePoint {
  id: string;
  /** 相对开机时间，min */
  minute: number;
  /** 温度，℃ */
  temp: number;
}

export type BatchStatus = "待检" | "通过" | "待复染";

/** 一次配方回评的历史快照 */
export interface ReviewEntry {
  id: string;
  /** 回评时间 ISO */
  at: string;
  /** 回评时所针对的配方指纹 */
  recipeFingerprint: string;
  /** 配方版本号（每修改一次配方 +1） */
  recipeVersion: number;
  recipeSummary: string;
  /** 回评时实测保温 min */
  holdingMin: number;
  /** 回评时后处理已完成的小时数 */
  postAgeHours: number;
  measuredLab: Lab;
  deltaE: number;
  customerConfirmed: boolean;
  verdict: BatchStatus;
  note: string;
}

export interface Batch {
  id: string;
  /** 批次号，如 LAB-620A */
  code: string;
  customer: string;
  /** 客户订单号 */
  orderNo: string;
  /** 面料成分 */
  fabric: string;
  /** 克重 g/m² */
  weight: number;

  // —— 染料配方（修改即令旧回评失效）——
  dyes: Dye[];
  /** 浴比 1:n */
  liquorRatio: number;
  /** 配方要求的保温下限 min */
  minHolding: number;
  recipeVersion: number;

  // —— 工艺执行 ——
  curve: CurvePoint[];
  /** 实测保温 min */
  holdingMin: number;
  /** 后整理方式 */
  postFinish: string;
  /** 后处理完成时间 ISO */
  postFinishedAt: string;

  // —— Lab 与评审 ——
  targetLab: Lab;
  measuredLab: Lab | null;
  customerConfirmed: boolean;

  reviews: ReviewEntry[];
  createdAt: string;
  updatedAt: string;
}
