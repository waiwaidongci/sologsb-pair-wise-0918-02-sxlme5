interface Lab {
  L: number;
  a: number;
  b: number;
}

/** Lab(D65) → sRGB，用于色块直观比对 */
export function labToRgb({ L, a, b }: Lab): string {
  const y0 = (L + 16) / 116;
  const x0 = y0 + a / 500;
  const z0 = y0 - b / 200;
  const f = (t: number) =>
    t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787;
  const X = 95.047 * f(x0);
  const Y = 100 * f(y0);
  const Z = 108.883 * f(z0);
  const lin = [
    (X * 3.2406 + Y * -1.5372 + Z * -0.4986) / 100,
    (X * -0.9689 + Y * 1.8758 + Z * 0.0415) / 100,
    (X * 0.0557 + Y * -0.204 + Z * 1.057) / 100,
  ];
  const rgb = lin.map((c) => {
    const v = c > 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  });
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

interface SwatchProps {
  target: Lab;
  reading: Lab | null;
  deltaE: number | null;
}

export function LabSwatch({ target, reading, deltaE }: SwatchProps) {
  const pass = deltaE !== null && deltaE <= 1.0;
  return (
    <div className="swatch-row">
      <div className="swatch">
        <div className="swatch-color" style={{ background: labToRgb(target) }} />
        <small>标样</small>
        <small className="muted">
          L {target.L.toFixed(1)} / a {target.a.toFixed(1)} / b {target.b.toFixed(1)}
        </small>
      </div>
      <div className="swatch-arrow">⇄</div>
      <div className="swatch">
        <div
          className="swatch-color"
          style={{ background: reading ? labToRgb(reading) : "#e9edf3" }}
        >
          {!reading && <span>未测</span>}
        </div>
        <small>实测小样</small>
        <small className="muted">
          {reading
            ? `L ${reading.L.toFixed(1)} / a ${reading.a.toFixed(1)} / b ${reading.b.toFixed(1)}`
            : "—"}
        </small>
      </div>
      <div className={"delta-badge " + (deltaE === null ? "" : pass ? "good" : "bad")}>
        <strong>{deltaE === null ? "ΔE —" : `ΔE ${deltaE.toFixed(2)}`}</strong>
        <small>{deltaE === null ? "待测量" : pass ? "≤ 1.0 合格" : "> 1.0 超限"}</small>
      </div>
    </div>
  );
}

interface CurveProps {
  points: { minute: number; temp: number }[];
  holdTemp?: number;
}

export function CurveChart({ points, holdTemp }: CurveProps) {
  const pts = [...points].sort((a, b) => a.minute - b.minute);
  if (pts.length === 0) {
    return <p className="muted">未录入温度曲线</p>;
  }
  const W = 520;
  const H = 200;
  const padL = 38;
  const padB = 26;
  const padT = 12;
  const maxMin = Math.max(...pts.map((p) => p.minute), 1);
  const temps = pts.map((p) => p.temp);
  const minT = Math.min(...temps, 20);
  const maxT = Math.max(...temps, 100);
  const spanT = Math.max(maxT - minT, 10);
  const x = (m: number) => padL + (m / maxMin) * (W - padL - 10);
  const y = (t: number) => padT + (1 - (t - minT) / spanT) * (H - padB - padT);

  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.minute).toFixed(1)} ${y(p.temp).toFixed(1)}`)
    .join(" ");

  const ticks = 4;
  return (
    <svg className="curve-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="温度曲线">
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const t = minT + (spanT * i) / ticks;
        return (
          <g key={i}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="#e4eaf2" />
            <text x={padL - 5} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#8290a3">
              {Math.round(t)}
            </text>
          </g>
        );
      })}
      {holdTemp !== undefined && (
        <line
          x1={padL}
          x2={W - 8}
          y1={y(holdTemp)}
          y2={y(holdTemp)}
          stroke="#be123c"
          strokeDasharray="4 3"
          opacity={0.5}
        />
      )}
      <path d={path} fill="none" stroke="#4f46e5" strokeWidth={2.2} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.minute)} cy={y(p.temp)} r={3.5} fill="#4f46e5" />
          <text x={x(p.minute)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8290a3">
            {p.minute}′
          </text>
        </g>
      ))}
      <text x={padL} y={10} fontSize="10" fill="#8290a3">
        ℃
      </text>
    </svg>
  );
}
