import type { CurvePoint, Dye, Lab } from "../types";
import { curveStages, deltaE, fmtHours, labToRgb, sortedCurve } from "../lib/bench";

/* ---------------- 温度曲线 SVG ---------------- */

export function CurveChart({
  points,
  height = 120,
}: {
  points: CurvePoint[];
  height?: number;
}) {
  const pts = sortedCurve(points);
  const W = 320;
  const H = height;
  const padL = 34;
  const padB = 22;
  const padT = 8;
  const padR = 8;

  if (pts.length < 2) {
    return (
      <div className="chart-empty" style={{ height: H }}>
        至少需要两个曲线节点
      </div>
    );
  }

  const mins = pts.map((p) => p.minute);
  const temps = pts.map((p) => p.temp);
  const minT = Math.min(...temps) - 5;
  const maxT = Math.max(...temps) + 5;
  const maxX = Math.max(...mins, 1);

  const x = (m: number) => padL + (m / maxX) * (W - padL - padR);
  const y = (t: number) =>
    padT + (1 - (t - minT) / (maxT - minT || 1)) * (H - padT - padB);

  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.minute).toFixed(1)} ${y(p.temp).toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${x(pts[pts.length - 1].minute)} ${H - padB} L ${x(
    pts[0].minute
  )} ${H - padB} Z`;

  const gridT = [0.25, 0.5, 0.75].map((f) => minT + f * (maxT - minT));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="curve-chart" role="img" aria-label="温度曲线">
      {gridT.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="grid" />
          <text x={padL - 5} y={y(t) + 3} textAnchor="end" className="axis-label">
            {Math.round(t)}
          </text>
        </g>
      ))}
      <line x1={padL} x2={padL} y1={padT} y2={H - padB} className="axis" />
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} className="axis" />
      <path d={area} className="curve-area" />
      <path d={path} className="curve-line" />
      {pts.map((p) => (
        <g key={p.id}>
          <circle cx={x(p.minute)} cy={y(p.temp)} r={3.2} className="curve-dot" />
          <text x={x(p.minute)} y={H - padB + 14} textAnchor="middle" className="axis-label">
            {p.minute}
          </text>
        </g>
      ))}
      <text x={W - padR} y={H - 4} textAnchor="end" className="axis-unit">
        min
      </text>
    </svg>
  );
}

export function CurveStageText({ points }: { points: CurvePoint[] }) {
  const stages = curveStages(points);
  if (stages.length === 0) return null;
  return (
    <ul className="stage-list">
      {stages.map((s, i) => (
        <li key={i} className={s.hold ? "hold" : s.rate > 0 ? "heat" : "cool"}>
          {s.hold
            ? `${s.to.temp}℃ 保温 ${s.span}min`
            : `${s.from.temp}→${s.to.temp}℃ ${
                s.rate > 0 ? "升温" : "降温"
              } ${Math.abs(s.rate).toFixed(1)}℃/min（${s.span}min）`}
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Lab 色块对比 ---------------- */

export function LabSwatch({ lab, label }: { lab: Lab; label: string }) {
  return (
    <div className="swatch">
      <span className="swatch-color" style={{ background: labToRgb(lab) }} />
      <div className="swatch-meta">
        <small>{label}</small>
        <b>
          L {lab.L.toFixed(1)} / a {lab.a.toFixed(1)} / b {lab.b.toFixed(1)}
        </b>
      </div>
    </div>
  );
}

export function LabCompare({ target, measured }: { target: Lab; measured: Lab | null }) {
  if (!measured) {
    return (
      <div className="lab-compare">
        <LabSwatch lab={target} label="标样" />
        <div className="lab-empty">暂无实测 Lab</div>
      </div>
    );
  }
  const de = deltaE(target, measured);
  return (
    <div className="lab-compare">
      <LabSwatch lab={target} label="标样" />
      <div className={`delta-e ${de <= 1.0 ? "ok" : "bad"}`}>
        <small>ΔE*ab</small>
        <strong>{de.toFixed(2)}</strong>
        <em>{de <= 1.0 ? "≤ 1.0" : "> 1.0"}</em>
      </div>
      <LabSwatch lab={measured} label="实测" />
    </div>
  );
}

/* ---------------- 染料配方比例 ---------------- */

const DYE_COLORS = ["#be123c", "#4f46e5", "#16a34a", "#d97706", "#0891b2", "#7c3aed"];

export function DyeBars({ dyes, liquorRatio }: { dyes: Dye[]; liquorRatio: number }) {
  const valid = dyes.filter((d) => d.name.trim() !== "");
  const total = valid.reduce((s, d) => s + (Number(d.dosage) || 0), 0);
  return (
    <div className="dye-bars">
      {valid.length > 0 && total > 0 && (
        <div className="dye-stack">
          {valid.map((d, i) => (
            <span
              key={d.id}
              style={{
                width: `${((Number(d.dosage) || 0) / total) * 100}%`,
                background: DYE_COLORS[i % DYE_COLORS.length],
              }}
              title={`${d.name} ${d.dosage}%`}
            />
          ))}
        </div>
      )}
      <ul className="dye-legend">
        {valid.map((d, i) => (
          <li key={d.id}>
            <i style={{ background: DYE_COLORS[i % DYE_COLORS.length] }} />
            {d.name}
            <b>{Number(d.dosage) || 0}%</b>
          </li>
        ))}
        <li className="liquor">
          <i className="neutral" />
          浴比 1:{Number(liquorRatio) || 0}
        </li>
      </ul>
    </div>
  );
}

/* ---------------- 后处理倒计时 ---------------- */

export function PostAge({
  postFinishedAt,
  now,
}: {
  postFinishedAt: string;
  now: number;
}) {
  const hours = (now - new Date(postFinishedAt).getTime()) / 3_600_000;
  return (
    <span className={hours >= 24 ? "age-ok" : "age-wait"}>
      {hours < 0 ? "后整理未完成" : `后整理 ${fmtHours(hours)} / 24h`}
    </span>
  );
}
