import { useMemo, useState } from "react";
import "./styles.css";
import type { Batch, BatchStatus } from "./types";
import { useBatches } from "./hooks/useBatches";
import {
  deltaE,
  evaluate,
  isReviewCurrent,
  recipeFingerprintOf,
} from "./lib/bench";
import { BatchCard } from "./components/BatchCard";
import { BatchForm } from "./components/BatchForm";

const FABRIC_FILTERS = ["棉", "涤纶", "锦纶", "混纺"];
const STATUS_FILTERS: BatchStatus[] = ["待检", "通过", "待复染"];

function matchesFabric(fabric: string, key: string): boolean {
  if (key === "混纺") return /混纺|\//.test(fabric) || /涤棉|锦棉|棉涤/.test(fabric);
  return fabric.includes(key);
}

export default function App() {
  const { batches, upsertBatch, removeBatch, resetAll } = useBatches();
  const now = Date.now();

  const [q, setQ] = useState("");
  const [orderNo, setOrderNo] = useState("全部订单");
  const [fabricKey, setFabricKey] = useState<string | null>(null);
  const [statusKey, setStatusKey] = useState<BatchStatus | null>(null);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Batch | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const orders = useMemo(() => {
    const map = new Map<string, { no: string; customer: string; count: number }>();
    for (const b of batches) {
      const cur = map.get(b.orderNo);
      if (cur) cur.count += 1;
      else map.set(b.orderNo, { no: b.orderNo, customer: b.customer, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.no.localeCompare(b.no));
  }, [batches]);

  // 指标
  const metrics = useMemo(() => {
    let passed = 0;
    let overLimit = 0;
    for (const b of batches) {
      const e = evaluate(b, now);
      const cur = b.reviews.find((r) => isReviewCurrent(r, b));
      if (e.canReview && cur?.verdict === "通过") passed += 1;
      if (b.measuredLab && deltaE(b.targetLab, b.measuredLab) > 1.0) overLimit += 1;
    }
    return {
      total: batches.length,
      overLimit,
      orders: orders.length,
      passRate: batches.length ? Math.round((passed / batches.length) * 100) : 0,
    };
  }, [batches, orders, now]);

  // 筛选
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return batches
      .filter((b) => {
        if (orderNo !== "全部订单" && b.orderNo !== orderNo) return false;
        if (fabricKey && !matchesFabric(b.fabric, fabricKey)) return false;
        if (statusKey) {
          const e = evaluate(b, now);
          const cur = b.reviews.find((r) => isReviewCurrent(r, b));
          const status: BatchStatus =
            e.canReview && cur
              ? cur.verdict === "通过"
                ? "通过"
                : "待复染"
              : "待检";
          if (status !== statusKey) return false;
        }
        if (kw) {
          const hay = `${b.code} ${b.customer} ${b.orderNo} ${b.fabric} ${b.postFinish}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      })
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [batches, q, orderNo, fabricKey, statusKey, now]);

  const hasFilter =
    q.trim() !== "" ||
    orderNo !== "全部订单" ||
    fabricKey !== null ||
    statusKey !== null;

  const resetFilters = () => {
    setQ("");
    setOrderNo("全部订单");
    setFabricKey(null);
    setStatusKey(null);
  };

  return (
    <main className="app">
      <section className="hero">
        <p>纺织染整实验室 · 离线小样台</p>
        <h1>小样批次评审工作台</h1>
        <span>
          记录面料成分、克重、染料配方、浴比、温度曲线、保温与后整理，按 Lab
          色差（ΔE*ab ≤ 1.0）与客户确认进行评审。数据保存在本机浏览器，断网可刷新、可继续使用。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>小样批次</small>
          <strong>{metrics.total}</strong>
        </article>
        <article>
          <small>色差超限（ΔE&gt;1.0）</small>
          <strong className={metrics.overLimit > 0 ? "num-bad" : ""}>
            {metrics.overLimit}
          </strong>
        </article>
        <article>
          <small>客户订单</small>
          <strong>{metrics.orders}</strong>
        </article>
        <article>
          <small>通过率</small>
          <strong>{metrics.passRate}%</strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="panel filters">
          <h2>筛选</h2>

          <label className="fld">
            <span>搜索批次 / 客户</span>
            <input
              placeholder="批次号、客户、后整理…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="filter-group">
            <span>客户订单</span>
            <div className="chips vertical">
              <button
                className={orderNo === "全部订单" ? "active" : ""}
                onClick={() => setOrderNo("全部订单")}
              >
                全部订单 <b>{batches.length}</b>
              </button>
              {orders.map((o) => (
                <button
                  key={o.no}
                  className={orderNo === o.no ? "active" : ""}
                  onClick={() => setOrderNo(o.no)}
                  title={`${o.customer} · ${o.no}`}
                >
                  <span className="order-chip">
                    {o.no}
                    <small>{o.customer}</small>
                  </span>
                  <b>{o.count}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span>面料成分</span>
            <div className="chips">
              {FABRIC_FILTERS.map((f) => (
                <button
                  key={f}
                  className={fabricKey === f ? "active" : ""}
                  onClick={() => setFabricKey(fabricKey === f ? null : f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span>评审状态</span>
            <div className="chips">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  className={`status-chip ${statusKey === s ? "active" : ""} s-${s}`}
                  onClick={() => setStatusKey(statusKey === s ? null : s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-foot">
            {hasFilter && (
              <button className="ghost" onClick={resetFilters}>
                清除筛选
              </button>
            )}
            <button
              className="ghost danger-text"
              onClick={() => setConfirmReset(true)}
              title="清空当前数据并恢复内置批次"
            >
              恢复演示数据
            </button>
          </div>
        </aside>

        <section className="panel list-panel">
          <div className="heading">
            <div>
              <p>批次列表 · 配方 · 色差 · 曲线 · 评审同步联动</p>
              <h2>
                小样批次
                <small className="result-count">
                  显示 {filtered.length} / {batches.length}
                </small>
              </h2>
            </div>
            <button className="primary" onClick={() => setCreating(true)}>
              ＋ 新增批次
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              {batches.length === 0
                ? "暂无批次，点击「新增批次」录入第一条小样"
                : "没有符合筛选条件的批次"}
            </div>
          ) : (
            <div className="card-grid">
              {filtered.map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  now={now}
                  onEdit={setEditing}
                  onRemove={setConfirmRemove}
                />
              ))}
            </div>
          )}
        </section>
      </section>

      <footer className="page-foot">
        规则：保温未达配方下限或后整理未满 24h 只能待检；达标后 ΔE ≤ 1.0
        且客户确认方可通过，否则保留实测并标记待复染；修改配方后旧回评失效、历史保留。
      </footer>

      {(creating || editing) && (
        <BatchForm
          initial={editing}
          otherCodes={batches
            .filter((b) => b.id !== editing?.id)
            .map((b) => b.code.trim())}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(b) => {
            upsertBatch(b);
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {confirmRemove && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmRemove(null)}
        >
          <div className="modal small">
            <header className="modal-head">
              <h2>移除批次 {confirmRemove.code}？</h2>
            </header>
            <div className="modal-body">
              <p>该操作会从本机删除此批次及其全部回评历史，且无法撤销。</p>
            </div>
            <footer className="modal-foot">
              <button onClick={() => setConfirmRemove(null)}>取消</button>
              <button
                className="primary danger-bg"
                onClick={() => {
                  removeBatch(confirmRemove.id);
                  setConfirmRemove(null);
                }}
              >
                确认移除
              </button>
            </footer>
          </div>
        </div>
      )}

      {confirmReset && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setConfirmReset(false)}
        >
          <div className="modal small">
            <header className="modal-head">
              <h2>恢复演示数据？</h2>
            </header>
            <div className="modal-body">
              <p>将清空全部现有批次（含回评历史），并恢复为内置的 4 条演示批次。</p>
            </div>
            <footer className="modal-foot">
              <button onClick={() => setConfirmReset(false)}>取消</button>
              <button
                className="primary danger-bg"
                onClick={() => {
                  resetAll();
                  setConfirmReset(false);
                  resetFilters();
                }}
              >
                确认恢复
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
