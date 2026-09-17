import { buildSeedBatches } from "../src/lib/seed";
import {
  buildReview,
  deltaE,
  evaluate,
  isReviewCurrent,
  recipeFingerprintOf,
  statusOf,
  uid,
} from "../src/lib/bench";
import type { Batch } from "../src/types";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`);
  if (!cond) failures++;
}

const now = Date.now();
const seeds = buildSeedBatches(now);
const byCode = Object.fromEntries(seeds.map((b) => [b.code, b]));

// 1. 内置批次状态
check("LAB-620A 通过(ΔE≤1 且客户确认)", statusOf(byCode["LAB-620A"], now) === "通过");
check("LAB-621C 待复染(ΔE>1)", statusOf(byCode["LAB-621C"], now) === "待复染");
check("LAB-624B 待检(后处理6h)", statusOf(byCode["LAB-624B"], now) === "待检");
check("LAB-625A 待检(保温不足)", statusOf(byCode["LAB-625A"], now) === "待检");

// 2. ΔE 数值
check(
  "620A ΔE≈0.78",
  Math.abs(deltaE(byCode["LAB-620A"].targetLab, byCode["LAB-620A"].measuredLab!) - 0.78) < 0.01
);
check(
  "621C ΔE≈2.27",
  Math.abs(deltaE(byCode["LAB-621C"].targetLab, byCode["LAB-621C"].measuredLab!) - 2.27) < 0.01
);

// 3. 624B 保温达标但后处理不足
const e624 = evaluate(byCode["LAB-624B"], now);
check("624B 保温达标", e624.holdingOk === true);
check("624B 后处理未达标", e624.postOk === false);
check("624B 不可回评", e624.canReview === false);

// 4. 625A 后处理达标但保温不足
const e625 = evaluate(byCode["LAB-625A"], now);
check("625A 保温未达标", e625.holdingOk === false);
check("625A 后处理达标", e625.postOk === true);

// 5. 修改配方 → 旧回评失效、状态回落，但历史保留
const edited: Batch = JSON.parse(JSON.stringify(byCode["LAB-620A"]));
edited.dyes[0].dosage = 2.1; // 改动染料用量
check(
  "改配方后旧回评指纹不匹配",
  !edited.reviews.every((r) => isReviewCurrent(r, edited))
);
check("改配方后历史仍保留 1 条", edited.reviews.length === 1);
// 配方变了但仍达标（保温/后处理条件不变），无当前回评 → 待检
check("改配方后无当前回评 → 待检", statusOf(edited, now) === "待检");

// 6. 重新测色回评：ΔE 仍小 + 客户确认 → 通过
const newMeasured = { L: 46.4, a: 52.2, b: 18.4 };
const rev = buildReview(edited, newMeasured, "", now);
check("新回评指纹匹配新配方", rev.recipeFingerprint === recipeFingerprintOf(edited));
edited.reviews = [rev, ...edited.reviews];
check("历史变为 2 条(旧+新)", edited.reviews.length === 2);
// buildReview 需要批次上的指纹方法——直接验证 verdict
check("新回评 ΔE<1 且客户确认 → 通过", rev.verdict === "通过", `ΔE=${rev.deltaE.toFixed(2)}`);
check("新回评后批次状态 → 通过", statusOf(edited, now) === "通过");
check("旧回评仍可查且标记失效", edited.reviews[1].verdict === "通过" && !isReviewCurrent(edited.reviews[1], edited));

// 7. 达标但 ΔE 超标 → 待复染，实测保留
const rerun: Batch = JSON.parse(JSON.stringify(byCode["LAB-621C"]));
const badReview = buildReview(rerun, { L: 34.9, a: 7.1, b: -33.8 }, "", now);
check("ΔE 超标回评 → 待复染", badReview.verdict === "待复染");
check("实测 Lab 仍保留", rerun.measuredLab !== null);
check("批次 → 待复染", statusOf({ ...rerun, reviews: [badReview] }, now) === "待复染");

// 8. 达标但客户未确认（即使 ΔE 合格）→ 待复染
const unconfirmed: Batch = JSON.parse(JSON.stringify(byCode["LAB-620A"]));
unconfirmed.customerConfirmed = false;
const rev2 = buildReview(unconfirmed, { L: 46.4, a: 52.2, b: 18.4 }, "", now);
check("ΔE 合格但客户未确认 → 待复染", rev2.verdict === "待复染");

// 9. 后处理未来时间
const future: Batch = JSON.parse(JSON.stringify(byCode["LAB-620A"]));
future.postFinishedAt = new Date(now + 5 * 3600_000).toISOString();
check("后处理时间在未来 → 待检", statusOf(future, now) === "待检");

// 10. 新增批次走默认结构（uid 唯一）
check("uid 非空且不重复", uid("t") !== uid("t"));

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
