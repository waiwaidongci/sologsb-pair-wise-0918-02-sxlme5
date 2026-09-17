import { useState } from "react";
import type { Batch } from "../types";
import { STATUS_LABEL } from "../types";
import {
  DELTA_E_LIMIT,
  curveSummary,
  fmtDateTime,
  statusDetail,
} from "../logic";
import type { ReviewDraft } from "../store";
import { CurveChart, LabSwatch } from "./charts";
import { StatusPill } from "./StatusPill";

interface Props {
  batch: Batch;
  now: number;
  onBack: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onReview: (input: ReviewDraft) => void;
}

export function BatchDetail({ batch, now, onBack, onEdit, onRemove, onReview }: Props) {
  const detail = statusDetail(batch, now);
  const [measured, setMeasured] = useState(true);
  const [L, setL] = useState(batch.targetLab.L);
  const [a, setA] = useState(batch.targetLab.a);
  const [b, setB] = useState(batch.targetLab.b);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");

  const submitReview = () => {
    onReview({
      reading: measured
        ? { L: Number(L), a: Number(a), b: Number(b) }
        : null,
      customerConfirmed: confirmed,
      note: note.trim(),
      reviewer: reviewer.trim() || "未署名",
    });
    setNote("");
    setConfirmed(false);
  };

  const compositionText =
    batch.composition.map((c) => `${c.fiber} ${c.percent}%`).join(" / ") || "—";
  const canReview = detail.holdMet && detail.aged;

  return (
    <div className="detail">
      <div className="detail-head">
        <button className="ghost" onClick={onBack}>
          ← 返回列表
        </button>
        <div className="detail-actions">
          <button onClick={onEdit}>编辑批次</button>
          <button className="danger" onClick={onRemove}>
            移除批次
          </button>
        </div>
      </div>

      <div className="detail-title">
        <div>
          <h2>{batch.code}</h2>
          <p>
            {batch.customer} · 订单 {batch.orderNo} · {batch.colorName}
          </p>
        </div>
        <StatusPill status={detail.status} />
      </div>

      <ul className="rule-list">
        {detail.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      <div className="detail-grid">
        <section className="panel">
          <h3>面料与配方</h3>
          <dl className="kv">
            <dt>面料成分</dt>
            <dd>{compositionText}</dd>
            <dt>克重</dt>
            <dd>{batch.weight} g/m²</dd>
            <dt>浴比</dt>
            <dd>1:{batch.liquorRatio}</dd>
            <dt>染料配方（V{batch.recipeVersion}）</dt>
            <dd>
              {batch.dyes.length === 0 ? (
                "—"
              ) : (
                  <ul className="dye-list">
                    {batch.dyes.map((d) => (
                      <li key={d.id}>
                        <span>{d.name}</span>
                        <strong>{d.amount}%</strong>
                      </li>
                    ))}
                    <li className="dye-total">
                      <span>合计 owf</span>
                      <strong>
                        {batch.dyes.reduce((s, d) => s + d.amount, 0).toFixed(2)}%
                      </strong>
                    </li>
                  </ul>
                )}
            </dd>
          </dl>
        </section>

        <section className="panel">
          <h3>工艺与后整理</h3>
          <dl className="kv">
            <dt>保温</dt>
            <dd>
              <span className={detail.holdMet ? "tag-ok" : "tag-bad"}>
                实际 {batch.holdMinutes}min / 下限 {batch.holdMinRequired}min @ {batch.holdTemp}℃
              </span>
            </dd>
            <dt>后整理</dt>
            <dd>{batch.finishing || "—"}</dd>
            <dt>完成时间</dt>
            <dd>
              {fmtDateTime(batch.finishedAt)}
              <span className={"tag " + (detail.aged ? "tag-ok" : "tag-bad")}>
                {detail.aged
                  ? "已满 24h"
                  : batch.finishedAt
                  ? `还差 ${detail.remainingHours}h`
                  : "未登记"}
              </span>
            </dd>
            <dt>温度曲线摘要</dt>
            <dd className="curve-text">{curveSummary(batch.curve)}</dd>
          </dl>
          <CurveChart points={batch.curve} holdTemp={batch.holdTemp} />
        </section>
      </div>

      <section className="panel">
        <h3>Lab 色差对比（最新有效回评 · V{batch.recipeVersion}）</h3>
        {detail.review?.reading ? (
          <LabSwatch
            target={batch.targetLab}
            reading={detail.review.reading}
            deltaE={detail.review.deltaE}
          />
        ) : (
          <LabSwatch target={batch.targetLab} reading={null} deltaE={null} />
        )}
        {detail.review && (
          <p className="muted small">
            客户确认：{detail.review.customerConfirmed ? "已确认" : "未确认"} ｜ 测量时间：
            {fmtDateTime(detail.review.reading?.at ?? null)}
          </p>
        )}
      </section>

      <section className="panel">
        <h3>新增回评</h3>
        {!canReview && (
          <p className="form-error">
            保温未达配方下限或后整理未满 24 小时，本批次只能「待检」；仍可先记录实测数据，条件齐备后再评审。
          </p>
        )}
        <div className="review-form">
          <label className="check">
            <input
              type="checkbox"
              checked={measured}
              onChange={(e) => setMeasured(e.target.checked)}
            />
            <span>已测得 Lab 数据</span>
          </label>
          {measured && (
            <div className="lab-inputs">
              <label>
                <span>L*</span>
                <input type="number" step="0.1" value={L} onChange={(e) => setL(Number(e.target.value))} />
              </label>
              <label>
                <span>a*</span>
                <input type="number" step="0.1" value={a} onChange={(e) => setA(Number(e.target.value))} />
              </label>
              <label>
                <span>b*</span>
                <input type="number" step="0.1" value={b} onChange={(e) => setB(Number(e.target.value))} />
              </label>
            </div>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>客户已书面确认</span>
          </label>
          <div className="field-grid">
            <label>
              <span>评审人</span>
              <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="姓名" />
            </label>
            <label className="span2">
              <span>评审备注</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="工艺观察、复染建议…" />
            </label>
          </div>
          <p className="form-hint">
            判定规则：条件齐备后，ΔE ≤ {DELTA_E_LIMIT.toFixed(1)} 且客户确认 → 通过；
            否则保留实测并标「待复染」。
          </p>
          <div>
            <button className="primary" onClick={submitReview}>
              提交回评
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>回评历史（{batch.reviews.length}）</h3>
        {batch.reviews.length === 0 && <p className="muted">暂无回评记录。</p>}
        <div className="review-history">
          {[...batch.reviews].reverse().map((r) => {
            const valid = r.recipeVersion === batch.recipeVersion;
            return (
              <article key={r.id} className={"review-card " + (valid ? "" : "invalid")}>
                <header>
                  <strong>{r.reviewer}</strong>
                  <span className="muted">{fmtDateTime(r.createdAt)}</span>
                  <span className={"tag " + (valid ? "tag-ok" : "tag-bad")}>
                    {valid ? `V${r.recipeVersion} 有效` : `V${r.recipeVersion} 已失效（配方已改）`}
                  </span>
                </header>
                {r.reading ? (
                  <p>
                    实测 L {r.reading.L.toFixed(1)} / a {r.reading.a.toFixed(1)} / b{" "}
                    {r.reading.b.toFixed(1)}
                    <strong
                      className={
                        (r.deltaE ?? Infinity) <= DELTA_E_LIMIT ? "de-good" : "de-bad"
                      }
                    >
                      {" "}
                      ΔE {r.deltaE?.toFixed(2)}
                    </strong>
                    ｜ 客户{r.customerConfirmed ? "已确认" : "未确认"}
                  </p>
                ) : (
                  <p>无 Lab 实测</p>
                )}
                <p className="muted small">回评时配方：{r.recipeSnapshot}</p>
                {r.note && <p className="review-note">{r.note}</p>}
                {!valid && (
                  <p className="invalid-note">
                    该回评基于旧配方 V{r.recipeVersion}，当前配方为 V{batch.recipeVersion}，结果仅作历史追溯，不参与状态判定。
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
