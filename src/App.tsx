import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { Batch } from "./types";
import { STATUS_LABEL } from "./types";
import { useBatches } from "./store";
import { computeStatus, latestValidReview } from "./logic";
import { BatchCard } from "./components/BatchCard";
import { BatchDetail } from "./components/BatchDetail";
import { BatchForm, batchToDraft, emptyDraft } from "./components/BatchForm";
import type { BatchDraft, ReviewDraft } from "./store";

type StatusFilter = "all" | "pending" | "pass" | "redye";

function App() {
  const { batches, createBatch, updateBatch, removeBatch, addReview, resetDemo } = useBatches();
  // 每 30 秒刷新一次，驱动「后整理满 24h」等时间相关状态
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [orderQuery, setOrderQuery] = useState("");
  const [fiber, setFiber] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<
    { mode: "create" } | { mode: "edit"; batch: Batch } | null
  >(null);

  const fibers = useMemo(() => {
    const s = new Set<string>();
    batches.forEach((b) => b.composition.forEach((c) => s.add(c.fiber)));
    return ["all", ...Array.from(s).sort()];
  }, [batches]);

  const filtered = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    return batches.filter((b) => {
      if (
        q &&
        !b.orderNo.toLowerCase().includes(q) &&
        !b.code.toLowerCase().includes(q) &&
        !b.customer.toLowerCase().includes(q)
      )
        return false;
      if (fiber !== "all" && !b.composition.some((c) => c.fiber === fiber))
        return false;
      if (statusFilter !== "all" && computeStatus(b, now) !== statusFilter)
        return false;
      return true;
    });
  }, [batches, orderQuery, fiber, statusFilter, now]);

  const selected = selectedId
    ? batches.find((b) => b.id === selectedId) ?? null
    : null;

  const metrics = useMemo(() => {
    let pass = 0;
    let redye = 0;
    let overE = 0;
    const orders = new Set(batches.map((b) => b.orderNo));
    for (const b of batches) {
      const s = computeStatus(b, now);
      if (s === "pass") pass++;
      if (s === "redye") redye++;
      const r = latestValidReview(b);
      if (r?.deltaE !== null && r?.deltaE !== undefined && r.deltaE > 1.0) overE++;
    }
    return {
      total: batches.length,
      orders: orders.size,
      overE,
      rate: batches.length ? Math.round((pass / batches.length) * 100) : 0,
      pass,
      redye,
    };
  }, [batches, now]);

  const submitCreate = (draft: BatchDraft) => {
    const id = createBatch(draft);
    setFormMode(null);
    setSelectedId(id);
  };

  const submitEdit = (draft: BatchDraft) => {
    if (formMode?.mode === "edit") updateBatch(formMode.batch.id, draft);
    setFormMode(null);
  };

  const submitReview = (id: string, input: ReviewDraft) => {
    addReview(id, input);
  };

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>纺织染整小样台</h1>
          <p>
            离线可用 · 数据保存在本机浏览器 · 保温/后整理时效 + ΔE≤1.0 + 客户确认 自动判定
          </p>
        </div>
        <div className="topbar-actions">
          <button className="primary" onClick={() => setFormMode({ mode: "create" })}>
            + 新增批次
          </button>
          <button
            className="ghost"
            onClick={() => {
              if (confirm("恢复为内置演示批次？当前全部记录将被替换。")) resetDemo();
            }}
          >
            重置演示数据
          </button>
        </div>
      </header>

      <section className="metrics">
        <article>
          <small>小样批次</small>
          <strong>{metrics.total}</strong>
        </article>
        <article>
          <small>色差超限（有效回评 ΔE&gt;1.0）</small>
          <strong className="text-red">{metrics.overE}</strong>
        </article>
        <article>
          <small>客户订单</small>
          <strong>{metrics.orders}</strong>
        </article>
        <article>
          <small>通过率（{metrics.pass}/{metrics.total}）</small>
          <strong className="text-green">{metrics.rate}%</strong>
        </article>
      </section>

      {selected ? (
        <BatchDetail
          batch={selected}
          now={now}
          onBack={() => setSelectedId(null)}
          onEdit={() => setFormMode({ mode: "edit", batch: selected })}
          onRemove={() => {
            if (confirm(`确认移除批次 ${selected.code}？此操作不可恢复。`)) {
              removeBatch(selected.id);
              setSelectedId(null);
            }
          }}
          onReview={(input) => submitReview(selected.id, input)}
        />
      ) : (
        <>
          <section className="filters panel">
            <div className="filter-search">
              <label>
                <span>客户订单 / 批次 / 客户</span>
                <input
                  value={orderQuery}
                  placeholder="输入订单号（如 PO-CT2409-118）或批次、客户名"
                  onChange={(e) => setOrderQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="filter-group">
              <span className="filter-label">成分</span>
              <div className="chips">
                {fibers.map((f) => (
                  <button
                    key={f}
                    className={fiber === f ? "chip-on" : ""}
                    onClick={() => setFiber(f)}
                  >
                    {f === "all" ? "全部" : f}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="filter-label">状态</span>
              <div className="chips">
                {(["all", "pending", "redye", "pass"] as StatusFilter[]).map((s) => (
                  <button
                    key={s}
                    className={statusFilter === s ? "chip-on" : ""}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "全部" : STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            <p className="filter-count muted small">
              筛选结果：{filtered.length} / {batches.length} 个批次
            </p>
          </section>

          {filtered.length === 0 ? (
            <section className="panel empty">
              <p>没有符合筛选条件的批次。</p>
            </section>
          ) : (
            <section className="batch-grid">
              {filtered.map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  now={now}
                  onOpen={() => setSelectedId(b.id)}
                />
              ))}
            </section>
          )}
        </>
      )}

      {formMode && (
        <div className="modal-mask" onMouseDown={() => setFormMode(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{formMode.mode === "create" ? "新增小样批次" : `编辑 ${formMode.batch.code}`}</h2>
              <button className="icon-btn" onClick={() => setFormMode(null)}>
                ✕
              </button>
            </div>
            {formMode.mode === "edit" && (
              <BatchForm
                initial={batchToDraft(formMode.batch)}
                editing={formMode.batch}
                onSubmit={submitEdit}
                onCancel={() => setFormMode(null)}
              />
            )}
            {formMode.mode === "create" && (
              <BatchForm
                initial={emptyDraft()}
                onSubmit={submitCreate}
                onCancel={() => setFormMode(null)}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
