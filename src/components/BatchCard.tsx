import type { Batch, BatchStatus } from "../types";
import {
  deltaE,
  evaluate,
  fmtDateTime,
  fmtHours,
  isReviewCurrent,
  recipeFingerprintOf,
} from "../lib/bench";
import {
  CurveChart,
  DyeBars,
  LabCompare,
  PostAge,
} from "./visuals";

const STATUS_LABEL: Record<BatchStatus, string> = {
  待检: "待检",
  通过: "通过",
  待复染: "待复染",
};

export function BatchCard({
  batch,
  now,
  onEdit,
  onRemove,
}: {
  batch: Batch;
  now: number;
  onEdit: (b: Batch) => void;
  onRemove: (b: Batch) => void;
}) {
  const e = evaluate(batch, now);
  const fp = recipeFingerprintOf(batch);
  const current = batch.reviews.find((r) => r.recipeFingerprint === fp);
  const stale = batch.reviews.filter((r) => r.recipeFingerprint !== fp);

  let status: BatchStatus = "待检";
  if (e.canReview && current) {
    status = current.verdict === "通过" ? "通过" : "待复染";
  }

  const de = batch.measuredLab
    ? deltaE(batch.targetLab, batch.measuredLab)
    : null;

  return (
    <article className={`batch-card status-${status}`}>
      <header className="card-head">
        <div>
          <h3>{batch.code}</h3>
          <p>
            {batch.customer} · {batch.orderNo}
          </p>
        </div>
        <span className={`status-badge s-${status}`}>{STATUS_LABEL[status]}</span>
      </header>

      <div className="card-tags">
        <span>{batch.fabric}</span>
        <span>{batch.weight} g/m²</span>
        <span>配方 v{batch.recipeVersion}</span>
      </div>

      <div className="card-block">
        <h4>染料配方</h4>
        <DyeBars dyes={batch.dyes} liquorRatio={batch.liquorRatio} />
      </div>

      <div className="card-block">
        <h4>工艺曲线</h4>
        <CurveChart points={batch.curve} height={104} />
        <ul className="card-meta-row">
          <li className={e.holdingOk ? "ok" : "bad"}>
            保温 {batch.holdingMin}/{batch.minHolding}min
          </li>
          <li className={e.postOk ? "ok" : "bad"}>
            <PostAge postFinishedAt={batch.postFinishedAt} now={now} />
          </li>
        </ul>
      </div>

      <div className="card-block">
        <h4>后整理</h4>
        <p className="post-finish">{batch.postFinish}</p>
        <small className="muted-text">完成于 {fmtDateTime(batch.postFinishedAt)}</small>
      </div>

      <div className="card-block">
        <h4>Lab 色差对比</h4>
        <LabCompare target={batch.targetLab} measured={batch.measuredLab} />
      </div>

      <div className="card-block verdict-block">
        <h4>评审</h4>
        {!e.canReview && (
          <div className="reasons">
            {e.reasons.map((r) => (
              <p key={r} className="reason wait">⏳ {r}，只能待检</p>
            ))}
          </div>
        )}
        {e.canReview && !current && (
          <p className="reason wait">⏳ 已达评审条件，尚未录入回评，保持待检</p>
        )}
        {current && (
          <div className="current-review">
            <span className="review-verdict" data-v={current.verdict}>
              {current.verdict}
            </span>
            <p className="reason">
              ΔE {current.deltaE.toFixed(2)}
              {current.deltaE > 1.0 && "（超 1.0）"} · 客户
              {current.customerConfirmed ? "已确认" : "未确认"}
            </p>
            <small className="muted-text">
              回评于 {fmtDateTime(current.at)}
              {current.note ? ` · ${current.note}` : ""}
            </small>
          </div>
        )}
        {stale.length > 0 && (
          <p className="stale-note">
            旧配方回评 {stale.length} 条已失效（历史保留：
            {stale
              .slice()
              .reverse()
              .map((r) => `v${r.recipeVersion} ${r.verdict}`)
              .join("，")}
            ）
          </p>
        )}
        {de !== null && status === "待复染" && (
          <p className="reason rerun">保留实测 ΔE {de.toFixed(2)}，标记待复染</p>
        )}
      </div>

      <footer className="card-actions">
        <button className="ghost" onClick={() => onEdit(batch)}>
          编辑
        </button>
        <button className="ghost danger-text" onClick={() => onRemove(batch)}>
          移除
        </button>
      </footer>
    </article>
  );
}
