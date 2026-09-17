import type { Batch } from "../types";
import { curveSummary, statusDetail } from "../logic";
import { CurveChart } from "./charts";
import { StatusPill } from "./StatusPill";

interface Props {
  batch: Batch;
  now: number;
  onOpen: () => void;
}

export function BatchCard({ batch, now, onOpen }: Props) {
  const detail = statusDetail(batch, now);
  const review = detail.review;
  const staleCount = batch.reviews.filter(
    (r) => r.recipeVersion !== batch.recipeVersion
  ).length;

  return (
    <article className={"batch-card status-" + detail.status} onClick={onOpen}>
      <div className="card-top">
        <div>
          <h3>{batch.code}</h3>
          <p className="muted small">
            {batch.customer} · {batch.orderNo} · {batch.colorName}
          </p>
        </div>
        <StatusPill status={detail.status} />
      </div>

      <div className="card-tags">
        <span>
          {batch.composition.map((c) => `${c.fiber}${c.percent}%`).join("/")}
        </span>
        <span>{batch.weight}g/m²</span>
        <span>浴比 1:{batch.liquorRatio}</span>
        <span className={detail.holdMet ? "tag-ok" : "tag-bad"}>
          保温 {batch.holdMinutes}/{batch.holdMinRequired}min
        </span>
        <span className={detail.aged ? "tag-ok" : "tag-bad"}>
          后整理{detail.aged ? "≥24h" : batch.finishedAt ? `<${detail.remainingHours}h` : "未登记"}
        </span>
      </div>

      <p className="recipe-line">
        {batch.dyes.map((d) => `${d.name} ${d.amount}%`).join(" + ") || "无配方"}
        <em>（V{batch.recipeVersion}）</em>
      </p>

      <div className="card-bottom">
        <div className="card-de">
          <small>最新有效回评</small>
          {review?.reading ? (
            <strong className={(review.deltaE ?? Infinity) <= 1 ? "de-good" : "de-bad"}>
              ΔE {review.deltaE?.toFixed(2)}
              <small>（客户{review.customerConfirmed ? "已确认" : "未确认"}）</small>
            </strong>
          ) : (
            <strong className="muted">待回评</strong>
          )}
        </div>
        <div className="card-mini-curve">
          <CurveChart points={batch.curve} />
        </div>
      </div>
      <p className="curve-line muted small" title={curveSummary(batch.curve)}>
        {curveSummary(batch.curve)}
      </p>
      {staleCount > 0 && <p className="stale-note">有 {staleCount} 条旧配方回评已失效（历史保留）</p>}
    </article>
  );
}
