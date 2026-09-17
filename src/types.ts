// 纺织染整小样台 —— 数据模型

/** 染料配方条目（用量按织物重量百分比 owf%） */
export interface DyeItem {
  id: string;
  name: string;
  /** 用量 % (owf) */
  amount: number;
}

/** 温度曲线节点 */
export interface CurvePoint {
  id: string;
  /** 相对开工分钟 */
  minute: number;
  /** 摄氏度 */
  temp: number;
}

/** Lab 实测值 */
export interface LabReading {
  /** 测量时间 ISO 字符串 */
  at: string;
  L: number;
  a: number;
  b: number;
}

/** 回评记录（评审历史） */
export interface Review {
  id: string;
  /** 回评时的配方版本，配方修改后旧版本回评即失效 */
  recipeVersion: number;
  /** 回评时锁定的配方快照（染料清单 + 浴比 + 保温下限） */
  recipeSnapshot: string;
  /** 实测 Lab（无测量则为空） */
  reading: LabReading | null;
  /** 由目标 Lab 计算的 ΔE，未测量为空 */
  deltaE: number | null;
  /** 客户是否已书面确认 */
  customerConfirmed: boolean;
  note: string;
  reviewer: string;
  createdAt: string;
}

/** 小样批次 */
export interface Batch {
  id: string;
  /** 批次号，如 LAB-620A */
  code: string;
  /** 客户订单号 */
  orderNo: string;
  customer: string;
  colorName: string;
  /** 面料成分，如 棉 65 / 涤纶 35 */
  composition: { fiber: string; percent: number }[];
  /** 克重 g/m² */
  weight: number;
  dyes: DyeItem[];
  /** 浴比，如 1:10 -> ratio=10 */
  liquorRatio: number;
  curve: CurvePoint[];
  /** 实际保温时间（分钟） */
  holdMinutes: number;
  /** 配方要求保温下限（分钟） */
  holdMinRequired: number;
  /** 保温温度 ℃ */
  holdTemp: number;
  /** 后整理方式（柔软剂 / 定型 / 预缩 …） */
  finishing: string;
  /** 后整理完成时间；未满 24h 只能待检 */
  finishedAt: string | null;
  /** 目标（标样）Lab */
  targetLab: { L: number; a: number; b: number };
  /** 当前配方版本：染料清单/用量、浴比、保温下限变化即升版 */
  recipeVersion: number;
  reviews: Review[];
  createdAt: string;
  updatedAt: string;
}

export type BatchStatus = "pending" | "pass" | "redye";

export const STATUS_LABEL: Record<BatchStatus, string> = {
  pending: "待检",
  pass: "评审通过",
  redye: "待复染",
};
