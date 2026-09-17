import { useMemo, useState } from "react";
import type { Batch } from "../types";
import type { BatchDraft } from "../store";

export function emptyDraft(): BatchDraft {
  return {
    code: "",
    orderNo: "",
    customer: "",
    colorName: "",
    composition: [{ fiber: "棉", percent: 100 }],
    weight: 0,
    dyes: [{ name: "", amount: 0 }],
    liquorRatio: 10,
    curve: [
      { minute: 0, temp: 40 },
      { minute: 30, temp: 98 },
    ],
    holdMinutes: 0,
    holdMinRequired: 30,
    holdTemp: 98,
    finishing: "",
    finishedAt: null,
    targetLab: { L: 60, a: 0, b: 0 },
  };
}

export function batchToDraft(b: Batch): BatchDraft {
  return {
    code: b.code,
    orderNo: b.orderNo,
    customer: b.customer,
    colorName: b.colorName,
    composition: b.composition.map((c) => ({ ...c })),
    weight: b.weight,
    dyes: b.dyes.map((d) => ({ ...d })),
    liquorRatio: b.liquorRatio,
    curve: b.curve.map((p) => ({ ...p })),
    holdMinutes: b.holdMinutes,
    holdMinRequired: b.holdMinRequired,
    holdTemp: b.holdTemp,
    finishing: b.finishing,
    finishedAt: b.finishedAt ? toLocalInput(b.finishedAt) : null,
    targetLab: { ...b.targetLab },
  };
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

interface Props {
  initial: BatchDraft;
  /** 编辑中的批次，用于提示改方将使旧回评失效 */
  editing?: Batch | null;
  onSubmit: (draft: BatchDraft) => void;
  onCancel: () => void;
}

export function BatchForm({ initial, editing, onSubmit, onCancel }: Props) {
  const [d, setD] = useState<BatchDraft>(initial);
  const [error, setError] = useState("");

  const patch = <K extends keyof BatchDraft>(key: K, value: BatchDraft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const totalPercent = useMemo(
    () => d.composition.reduce((s, c) => s + (Number(c.percent) || 0), 0),
    [d.composition]
  );

  const submit = () => {
    if (!d.code.trim()) return setError("请填写批次号");
    if (!d.orderNo.trim()) return setError("请填写客户订单号");
    if (!d.customer.trim() || !d.colorName.trim())
      return setError("请填写客户与颜色名称");
    if (!(Number(d.weight) > 0)) return setError("克重需大于 0");
    if (d.dyes.filter((x) => x.name.trim()).length === 0)
      return setError("至少填写一条染料配方");
    if (!(Number(d.liquorRatio) > 0)) return setError("浴比需大于 0（如 10 表示 1:10）");
    if (d.composition.some((c) => c.fiber.trim() && !(Number(c.percent) > 0)))
      return setError("成分百分比需大于 0");
    setError("");
    onSubmit(d);
  };

  return (
    <div className="form-scroll">
      <div className="field-grid">
        <label>
          <span>批次号 *</span>
          <input
            value={d.code}
            onChange={(e) => patch("code", e.target.value)}
            placeholder="如 LAB-627A"
          />
        </label>
        <label>
          <span>客户订单号 *</span>
          <input
            value={d.orderNo}
            onChange={(e) => patch("orderNo", e.target.value)}
            placeholder="如 PO-CT2409-118"
          />
        </label>
        <label>
          <span>客户 *</span>
          <input
            value={d.customer}
            onChange={(e) => patch("customer", e.target.value)}
          />
        </label>
        <label>
          <span>颜色名称 *</span>
          <input
            value={d.colorName}
            onChange={(e) => patch("colorName", e.target.value)}
          />
        </label>
      </div>

      <fieldset className="subform">
        <legend>
          面料成分
          <em className={Math.abs(totalPercent - 100) < 0.01 ? "ok" : "warn"}>
            合计 {totalPercent}%
          </em>
        </legend>
        <datalist id="fiber-options">
          <option value="棉" />
          <option value="涤纶" />
          <option value="锦纶" />
          <option value="腈纶" />
          <option value="氨纶" />
          <option value="粘胶" />
        </datalist>
        {d.composition.map((c, i) => (
          <div className="row2" key={i}>
            <input
              list="fiber-options"
              value={c.fiber}
              placeholder="纤维（棉/涤纶/锦纶/氨纶…）"
              onChange={(e) =>
                patch(
                  "composition",
                  d.composition.map((x, j) =>
                    j === i ? { ...x, fiber: e.target.value } : x
                  )
                )
              }
            />
            <input
              type="number"
              min={0}
              step={1}
              value={c.percent || ""}
              placeholder="%"
              onChange={(e) =>
                patch(
                  "composition",
                  d.composition.map((x, j) =>
                    j === i ? { ...x, percent: Number(e.target.value) } : x
                  )
                )
              }
            />
            <button
              type="button"
              className="icon-btn"
              disabled={d.composition.length === 1}
              onClick={() =>
                patch("composition", d.composition.filter((_, j) => j !== i))
              }
            >
              删
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ghost"
          onClick={() =>
            patch("composition", [...d.composition, { fiber: "", percent: 0 }])
          }
        >
          + 添加纤维
        </button>
      </fieldset>

      <div className="field-grid">
        <label>
          <span>克重 g/m² *</span>
          <input
            type="number"
            min={0}
            step={1}
            value={d.weight || ""}
            onChange={(e) => patch("weight", Number(e.target.value))}
          />
        </label>
        <label>
          <span>浴比 1:N（N）*</span>
          <input
            type="number"
            min={1}
            step={1}
            value={d.liquorRatio || ""}
            onChange={(e) => patch("liquorRatio", Number(e.target.value))}
          />
        </label>
        <label>
          <span>实际保温 min</span>
          <input
            type="number"
            min={0}
            step={1}
            value={d.holdMinutes}
            onChange={(e) => patch("holdMinutes", Number(e.target.value))}
          />
        </label>
        <label>
          <span>配方保温下限 min</span>
          <input
            type="number"
            min={0}
            step={1}
            value={d.holdMinRequired}
            onChange={(e) => patch("holdMinRequired", Number(e.target.value))}
          />
        </label>
        <label>
          <span>保温温度 ℃</span>
          <input
            type="number"
            step={1}
            value={d.holdTemp}
            onChange={(e) => patch("holdTemp", Number(e.target.value))}
          />
        </label>
      </div>

      <fieldset className="subform">
        <legend>染料配方（用量按织物重量 % owf）</legend>
        {d.dyes.map((dy, i) => (
          <div className="row2" key={i}>
            <input
              value={dy.name}
              placeholder="染料名称（如 活性红 3BS）"
              onChange={(e) =>
                patch(
                  "dyes",
                  d.dyes.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x
                  )
                )
              }
            />
            <input
              type="number"
              min={0}
              step={0.01}
              value={dy.amount || ""}
              placeholder="用量 %"
              onChange={(e) =>
                patch(
                  "dyes",
                  d.dyes.map((x, j) =>
                    j === i ? { ...x, amount: Number(e.target.value) } : x
                  )
                )
              }
            />
            <button
              type="button"
              className="icon-btn"
              disabled={d.dyes.length === 1}
              onClick={() => patch("dyes", d.dyes.filter((_, j) => j !== i))}
            >
              删
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ghost"
          onClick={() => patch("dyes", [...d.dyes, { name: "", amount: 0 }])}
        >
          + 添加染料
        </button>
      </fieldset>

      <fieldset className="subform">
        <legend>温度曲线（时间 min / 温度 ℃，按时间自动排序）</legend>
        {d.curve.map((p, i) => (
          <div className="row2" key={p.id ?? i}>
            <input
              type="number"
              step={1}
              value={p.minute}
              placeholder="分钟"
              onChange={(e) =>
                patch(
                  "curve",
                  d.curve.map((x, j) =>
                    j === i ? { ...x, minute: Number(e.target.value) } : x
                  )
                )
              }
            />
            <input
              type="number"
              step={1}
              value={p.temp}
              placeholder="℃"
              onChange={(e) =>
                patch(
                  "curve",
                  d.curve.map((x, j) =>
                    j === i ? { ...x, temp: Number(e.target.value) } : x
                  )
                )
              }
            />
            <button
              type="button"
              className="icon-btn"
              disabled={d.curve.length === 1}
              onClick={() => patch("curve", d.curve.filter((_, j) => j !== i))}
            >
              删
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ghost"
          onClick={() =>
            patch("curve", [...d.curve, { minute: 0, temp: 40 }])
          }
        >
          + 添加曲线点
        </button>
      </fieldset>

      <div className="field-grid">
        <label className="span2">
          <span>后整理方式</span>
          <input
            value={d.finishing}
            placeholder="如 柔软剂 2% 浸轧 + 150℃ 定型"
            onChange={(e) => patch("finishing", e.target.value)}
          />
        </label>
        <label className="span2">
          <span>后整理完成时间（满 24 小时方可放行）</span>
          <input
            type="datetime-local"
            value={d.finishedAt ?? ""}
            onChange={(e) => patch("finishedAt", e.target.value || null)}
          />
        </label>
        <label>
          <span>标样 L*</span>
          <input
            type="number"
            step={0.1}
            value={d.targetLab.L}
            onChange={(e) =>
              patch("targetLab", { ...d.targetLab, L: Number(e.target.value) })
            }
          />
        </label>
        <label>
          <span>标样 a*</span>
          <input
            type="number"
            step={0.1}
            value={d.targetLab.a}
            onChange={(e) =>
              patch("targetLab", { ...d.targetLab, a: Number(e.target.value) })
            }
          />
        </label>
        <label>
          <span>标样 b*</span>
          <input
            type="number"
            step={0.1}
            value={d.targetLab.b}
            onChange={(e) =>
              patch("targetLab", { ...d.targetLab, b: Number(e.target.value) })
            }
          />
        </label>
      </div>

      {editing && <p className="form-hint">注意：修改染料、用量、浴比或保温下限会升版，该批次旧回评将标记为失效但历史仍保留。</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="modal-actions">
        <button type="button" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="primary" onClick={submit}>
          {editing ? "保存修改" : "创建批次"}
        </button>
      </div>
    </div>
  );
}
