import { useEffect, useMemo, useState } from "react";
import type { Batch, CurvePoint, Dye, Lab } from "../types";
import {
  CURVE_PRESETS,
  DELTA_E_LIMIT,
  POST_FINISH_MIN_HOURS,
  buildReview,
  curveSummary,
  deltaE,
  emptyLab,
  evaluate,
  fmtDateTime,
  fmtHours,
  recipeFingerprintOf,
  toLocalInput,
  uid,
} from "../lib/bench";
import { CurveChart, CurveStageText, LabSwatch } from "./visuals";

/* ---------------- 小控件 ---------------- */

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="fld">
      <span>
        {label}
        {required && <i>*</i>}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = "any",
  min = 0,
  suffix,
  required,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number | string;
  min?: number;
  suffix?: string;
  required?: boolean;
}) {
  return (
    <label className="fld">
      <span>
        {label}
        {required && <i>*</i>}
      </span>
      <span className="num-wrap">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}

function LabFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Lab;
  onChange: (lab: Lab) => void;
}) {
  const set = (k: keyof Lab, v: number) =>
    onChange({ ...value, [k]: Number.isFinite(v) ? v : 0 });
  return (
    <div className="lab-fields">
      <span>{label}</span>
      <label>
        L
        <input
          type="number"
          value={value.L}
          step="0.1"
          onChange={(e) => set("L", Number(e.target.value))}
        />
      </label>
      <label>
        a
        <input
          type="number"
          value={value.a}
          step="0.1"
          onChange={(e) => set("a", Number(e.target.value))}
        />
      </label>
      <label>
        b
        <input
          type="number"
          value={value.b}
          step="0.1"
          onChange={(e) => set("b", Number(e.target.value))}
        />
      </label>
    </div>
  );
}

/* ---------------- 染料编辑 ---------------- */

function DyeEditor({
  draft,
  set,
}: {
  draft: Batch;
  set: (patch: Partial<Batch>) => void;
}) {
  const update = (id: string, patch: Partial<Dye>) =>
    set({ dyes: draft.dyes.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const remove = (id: string) =>
    set({ dyes: draft.dyes.filter((d) => d.id !== id) });
  const add = () =>
    set({ dyes: [...draft.dyes, { id: uid("dye"), name: "", dosage: 0 }] });

  return (
    <div className="sub-editor">
      {draft.dyes.map((d, i) => (
        <div className="inline-row" key={d.id}>
          <input
            placeholder={`染料 ${i + 1} 名称`}
            value={d.name}
            onChange={(e) => update(d.id, { name: e.target.value })}
          />
          <span className="num-wrap narrow">
            <input
              type="number"
              value={Number.isFinite(d.dosage) ? d.dosage : ""}
              step="0.01"
              min={0}
              onChange={(e) =>
                update(d.id, {
                  dosage: e.target.value === "" ? NaN : Number(e.target.value),
                })
              }
            />
            <em>%</em>
          </span>
          <button
            type="button"
            className="icon-btn danger"
            onClick={() => remove(d.id)}
            title="移除染料"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={add}>
        ＋ 添加染料
      </button>
    </div>
  );
}

/* ---------------- 温度曲线编辑 ---------------- */

function CurveEditor({
  draft,
  set,
}: {
  draft: Batch;
  set: (patch: Partial<Batch>) => void;
}) {
  const update = (id: string, patch: Partial<CurvePoint>) =>
    set({
      curve: draft.curve.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  const remove = (id: string) =>
    set({ curve: draft.curve.filter((p) => p.id !== id) });
  const add = () => {
    const last = draft.curve[draft.curve.length - 1];
    set({
      curve: [
        ...draft.curve,
        {
          id: uid("pt"),
          minute: last ? last.minute + 10 : 0,
          temp: last ? last.temp : 40,
        },
      ],
    });
  };
  const applyPreset = (idx: number) => {
    const preset = CURVE_PRESETS[idx];
    set({
      curve: preset.points.map((p) => ({ ...p, id: uid("pt") })),
      minHolding: preset.minHolding,
      fabric: draft.fabric.trim() === "" ? preset.fabric : draft.fabric,
    });
  };

  return (
    <div className="sub-editor">
      <div className="preset-row">
        {CURVE_PRESETS.map((p, i) => (
          <button key={p.name} type="button" className="chip" onClick={() => applyPreset(i)}>
            {p.name}
          </button>
        ))}
      </div>
      {draft.curve.map((p, i) => (
        <div className="inline-row" key={p.id}>
          <b className="node-index">{i + 1}</b>
          <span className="num-wrap narrow">
            <input
              type="number"
              value={Number.isFinite(p.minute) ? p.minute : ""}
              min={0}
              onChange={(e) =>
                update(p.id, {
                  minute: e.target.value === "" ? NaN : Number(e.target.value),
                })
              }
            />
            <em>min</em>
          </span>
          <span className="arrow">→</span>
          <span className="num-wrap narrow">
            <input
              type="number"
              value={Number.isFinite(p.temp) ? p.temp : ""}
              min={0}
              onChange={(e) =>
                update(p.id, {
                  temp: e.target.value === "" ? NaN : Number(e.target.value),
                })
              }
            />
            <em>℃</em>
          </span>
          <button
            type="button"
            className="icon-btn danger"
            onClick={() => remove(p.id)}
            title="删除节点"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={add}>
        ＋ 添加曲线节点
      </button>
      {draft.curve.length >= 2 && (
        <CurveChart points={draft.curve} height={130} />
      )}
    </div>
  );
}

/* ---------------- 批次表单弹窗 ---------------- */

export function BatchForm({
  initial,
  otherCodes,
  onClose,
  onSave,
}: {
  initial: Batch | null;
  otherCodes: string[];
  onClose: () => void;
  onSave: (b: Batch) => void;
}) {
  const [draft, setDraft] = useState<Batch>(
    () =>
      initial ?? {
        id: uid("batch"),
        code: "",
        customer: "",
        orderNo: "",
        fabric: "",
        weight: 0,
        dyes: [{ id: uid("dye"), name: "", dosage: 0 }],
        liquorRatio: 10,
        minHolding: 30,
        recipeVersion: 1,
        curve: [
          { id: uid("pt"), minute: 0, temp: 40 },
          { id: uid("pt"), minute: 40, temp: 40 },
        ],
        holdingMin: 0,
        postFinish: "",
        postFinishedAt: "",
        targetLab: emptyLab(),
        measuredLab: null,
        customerConfirmed: false,
        reviews: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
  );
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [newReviewIds, setNewReviewIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const set = (patch: Partial<Batch>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const origFp = initial ? recipeFingerprintOf(initial) : null;
  const draftFp = recipeFingerprintOf(draft);
  const recipeChanged = origFp !== null && draftFp !== origFp;

  // 配方修改即时使版本号 +1（旧回评指纹不再匹配 → 失效但保留）
  const baseVersion = initial ? initial.recipeVersion : 1;
  const version = recipeChanged ? baseVersion + 1 : baseVersion;
  useEffect(() => {
    if (draft.recipeVersion !== version) set({ recipeVersion: version });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const staleReviews = draft.reviews.filter((r) => r.recipeFingerprint !== draftFp);
  const currentReview = draft.reviews.find((r) => r.recipeFingerprint === draftFp);

  const eligibility = useMemo(() => evaluate(draft, now), [draft, now]);
  const measuredComplete =
    draft.measuredLab !== null &&
    [draft.measuredLab.L, draft.measuredLab.a, draft.measuredLab.b].every((v) =>
      Number.isFinite(v)
    );
  const canRecordReview = eligibility.canReview && measuredComplete;

  const liveDE = measuredComplete
    ? deltaE(draft.targetLab, draft.measuredLab as Lab)
    : null;
  const needsRereview =
    recipeChanged && measuredComplete && !currentReview;

  function recordReview() {
    if (!canRecordReview || !draft.measuredLab) return;
    const rev = buildReview(draft, draft.measuredLab, note, Date.now());
    setDraft((d) => ({ ...d, reviews: [rev, ...d.reviews], updatedAt: rev.at }));
    setNewReviewIds((ids) => [rev.id, ...ids]);
    setNote("");
  }

  function save() {
    const errs: string[] = [];
    if (!draft.code.trim()) errs.push("请填写批次号");
    if (otherCodes.includes(draft.code.trim()))
      errs.push(`批次号 ${draft.code.trim()} 已存在`);
    if (!draft.customer.trim()) errs.push("请填写客户名称");
    if (!draft.orderNo.trim()) errs.push("请填写客户订单号");
    if (!draft.fabric.trim()) errs.push("请填写面料成分");
    if (!(Number(draft.weight) > 0)) errs.push("克重需大于 0");
    const validDyes = draft.dyes.filter((d) => d.name.trim() !== "");
    if (validDyes.length === 0) errs.push("至少填写一种染料");
    if (validDyes.some((d) => !(Number(d.dosage) >= 0)))
      errs.push("染料用量需为非负数字");
    if (!(Number(draft.liquorRatio) > 0)) errs.push("浴比需大于 0");
    if (!(Number(draft.minHolding) > 0)) errs.push("配方保温下限需大于 0");
    if (!(Number(draft.holdingMin) >= 0)) errs.push("实测保温时间需为非负数字");
    if (draft.curve.length < 2) errs.push("温度曲线至少需要两个节点");
    if (draft.curve.some((p) => !Number.isFinite(p.minute) || !Number.isFinite(p.temp)))
      errs.push("温度曲线节点存在无效数值");
    if (!draft.postFinish.trim()) errs.push("请填写后整理方式");
    if (!draft.postFinishedAt || Number.isNaN(new Date(draft.postFinishedAt).getTime()))
      errs.push("请选择后整理完成时间");
    setErrors(errs);
    if (errs.length > 0) return;

    const saved: Batch = {
      ...draft,
      code: draft.code.trim(),
      customer: draft.customer.trim(),
      orderNo: draft.orderNo.trim(),
      fabric: draft.fabric.trim(),
      postFinish: draft.postFinish.trim(),
      updatedAt: new Date().toISOString(),
      recipeVersion: version,
    };
    onSave(saved);
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <header className="modal-head">
          <div>
            <p>{initial ? "编辑批次" : "新增批次"}</p>
            <h2>{initial ? initial.code : "录入小样批次"}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="关闭">
            ✕
          </button>
        </header>

        {errors.length > 0 && (
          <div className="form-errors">
            {errors.map((e) => (
              <div key={e}>⚠ {e}</div>
            ))}
          </div>
        )}

        <div className="modal-body">
          <section className="form-section">
            <h3>① 批次信息</h3>
            <div className="grid-2">
              <TextField label="批次号" required value={draft.code}
                onChange={(v) => set({ code: v })} placeholder="如 LAB-626A" />
              <TextField label="客户" required value={draft.customer}
                onChange={(v) => set({ customer: v })} placeholder="如 华澜服饰" />
              <TextField label="客户订单号" required value={draft.orderNo}
                onChange={(v) => set({ orderNo: v })} placeholder="如 PO-2026-1001" />
              <TextField label="面料成分" required value={draft.fabric}
                onChange={(v) => set({ fabric: v })} placeholder="如 棉100% / 涤棉65/35" />
              <NumField label="克重" required suffix="g/m²" value={draft.weight}
                onChange={(v) => set({ weight: v })} />
            </div>
          </section>

          <section className="form-section">
            <h3>② 染料配方</h3>
            <p className="hint">
              修改染料、用量、浴比或保温下限将产生新配方版本（v{version}），旧回评立即失效但完整保留在历史中。
            </p>
            <DyeEditor draft={draft} set={set} />
            <div className="grid-2">
              <NumField label="浴比 1 : n" required value={draft.liquorRatio}
                onChange={(v) => set({ liquorRatio: v })} />
              <NumField label="配方保温下限" required suffix="min" value={draft.minHolding}
                onChange={(v) => set({ minHolding: v })} />
            </div>
            {recipeChanged && (
              <div className="banner warn">
                ⚠ 配方已相对 v{baseVersion} 修改，{staleReviews.length} 条旧回评已失效（保留历史）；
                达标后请重新录入回评。
              </div>
            )}
          </section>

          <section className="form-section">
            <h3>③ 工艺执行</h3>
            <label className="fld">
              <span>温度曲线（时间 → 温度）</span>
            </label>
            <CurveEditor draft={draft} set={set} />
            <p className="curve-line-summary">摘要：{curveSummary(draft.curve)}</p>
            <CurveStageText points={draft.curve} />
            <div className="grid-2">
              <NumField label="实测保温时间" suffix="min" value={draft.holdingMin}
                onChange={(v) => set({ holdingMin: v })} />
              <label className="fld">
                <span>后整理完成时间<i>*</i></span>
                <input
                  type="datetime-local"
                  value={draft.postFinishedAt ? toLocalInput(draft.postFinishedAt) : ""}
                  onChange={(e) =>
                    set({
                      postFinishedAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : "",
                    })
                  }
                />
              </label>
            </div>
            <TextField label="后整理方式" required value={draft.postFinish}
              onChange={(v) => set({ postFinish: v })}
              placeholder="如 柔软剂20g/L浸轧定型" />
          </section>

          <section className="form-section">
            <h3>④ Lab 测色与评审</h3>
            <div className="grid-2">
              <div>
                <LabFields label="标样 Lab" value={draft.targetLab}
                  onChange={(lab) => set({ targetLab: lab })} />
                <div className="swatch-row">
                  <LabSwatch lab={draft.targetLab} label="标样颜色" />
                </div>
              </div>
              <div>
                <div className="measured-head">
                  <LabFields
                    label="实测 Lab（测色后填写）"
                    value={draft.measuredLab ?? emptyLab()}
                    onChange={(lab) => set({ measuredLab: lab })}
                  />
                  {draft.measuredLab && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => set({ measuredLab: null })}
                    >
                      清空实测
                    </button>
                  )}
                </div>
                <div className="swatch-row">
                  <LabSwatch
                    lab={draft.measuredLab ?? draft.targetLab}
                    label={draft.measuredLab ? "实测颜色" : "未实测"}
                  />
                </div>
              </div>
            </div>

            {liveDE !== null && (
              <div className={`live-delta ${liveDE <= DELTA_E_LIMIT ? "ok" : "bad"}`}>
                当前 ΔE*ab = <b>{liveDE.toFixed(2)}</b>
                <span>（限值 ≤ {DELTA_E_LIMIT.toFixed(1)}）</span>
                {needsRereview && <em className="tag warn">旧配方实测，需重新回评</em>}
              </div>
            )}

            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.customerConfirmed}
                onChange={(e) => set({ customerConfirmed: e.target.checked })}
              />
              客户已确认（对色灯箱/订单要求确认）
            </label>

            <div className="eligibility">
              <div className={`el-item ${eligibility.holdingOk ? "ok" : "bad"}`}>
                {eligibility.holdingOk ? "✓" : "✕"} 保温：实测 {draft.holdingMin}min
                {eligibility.holdingOk ? " ≥ " : " < "}
                下限 {draft.minHolding}min
              </div>
              <div className={`el-item ${eligibility.postOk ? "ok" : "bad"}`}>
                {eligibility.postOk ? "✓" : "✕"} 后整理：
                {eligibility.postAgeHours < 0
                  ? "尚未完成"
                  : `已完成 ${fmtHours(eligibility.postAgeHours)}（需满 ${POST_FINISH_MIN_HOURS}h）`}
              </div>
            </div>
            {!eligibility.canReview && (
              <div className="banner muted">
                保温未达下限或后整理未满 {POST_FINISH_MIN_HOURS}h，批次只能「待检」，不能录入回评。
              </div>
            )}

            <label className="fld">
              <span>回评备注</span>
              <textarea
                rows={2}
                value={note}
                placeholder="本次回评说明，如：追加黄相0.1%后复测…"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="review-actions">
              <button
                type="button"
                className="primary"
                disabled={!canRecordReview}
                title={
                  !eligibility.canReview
                    ? "保温达标且后整理满24h后才能回评"
                    : !measuredComplete
                    ? "请先填写实测 Lab"
                    : "记录回评"
                }
                onClick={recordReview}
              >
                录入本次回评
              </button>
              {!canRecordReview && (
                <small className="muted-text">
                  {!eligibility.canReview
                    ? "未达评审条件"
                    : "请填写完整的实测 Lab"}
                </small>
              )}
            </div>

            {/* 回评历史：全部保留，失效项置灰 */}
            <div className="review-history">
              <h4>回评历史（{draft.reviews.length}）</h4>
              {draft.reviews.length === 0 && <p className="muted-text">暂无回评记录</p>}
              {draft.reviews.map((r) => {
                const current = r.recipeFingerprint === draftFp;
                return (
                  <div
                    key={r.id}
                    className={`review-card ${current ? "" : "stale"} ${
                      newReviewIds.includes(r.id) ? "is-new" : ""
                    }`}
                  >
                    <header>
                      <span className="review-verdict" data-v={r.verdict}>
                        {r.verdict}
                      </span>
                      <b>配方 v{r.recipeVersion}</b>
                      <time>{fmtDateTime(r.at)}</time>
                      {!current && <em className="tag stale-tag">配方已改 · 已失效</em>}
                      {newReviewIds.includes(r.id) && <em className="tag new-tag">本次新增</em>}
                    </header>
                    <p className="review-recipe">{r.recipeSummary}</p>
                    <p className="review-meta">
                      ΔE {r.deltaE.toFixed(2)} · L {r.measuredLab.L.toFixed(1)} / a{" "}
                      {r.measuredLab.a.toFixed(1)} / b {r.measuredLab.b.toFixed(1)} ·
                      保温 {r.holdingMin}min · 后处理 {fmtHours(r.postAgeHours)} ·
                      客户{r.customerConfirmed ? "已确认" : "未确认"}
                    </p>
                    {r.note && <p className="review-note">{r.note}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="modal-foot">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={save}>
            保存批次
          </button>
        </footer>
      </div>
    </div>
  );
}
