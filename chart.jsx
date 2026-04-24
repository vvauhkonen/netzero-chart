// StackedAreaChart — interactive stacked area chart component
// Supports: hover crosshair + tooltip, legend toggles, time brush, event markers,
// optional total envelope line. All visual knobs passed via `theme` prop so
// each variation can restyle without forking.

const DATA = [
  { year: 2025, scope1: 1200, scope2: 850, scope3: 2400 },
  { year: 2026, scope1: 1180, scope2: 820, scope3: 2350 },
  { year: 2027, scope1: 1140, scope2: 780, scope3: 2280 },
  { year: 2028, scope1: 1090, scope2: 730, scope3: 2190 },
  { year: 2029, scope1: 1030, scope2: 680, scope3: 2080 },
  { year: 2030, scope1: 960, scope2: 620, scope3: 1960 },
  { year: 2031, scope1: 890, scope2: 570, scope3: 1820 },
  { year: 2032, scope1: 820, scope2: 520, scope3: 1680 },
  { year: 2033, scope1: 750, scope2: 470, scope3: 1540 },
  { year: 2034, scope1: 680, scope2: 420, scope3: 1400 },
  { year: 2035, scope1: 620, scope2: 380, scope3: 1270 },
  { year: 2036, scope1: 560, scope2: 340, scope3: 1140 },
  { year: 2037, scope1: 500, scope2: 300, scope3: 1020 },
  { year: 2038, scope1: 450, scope2: 270, scope3: 910 },
  { year: 2039, scope1: 400, scope2: 240, scope3: 800 },
  { year: 2040, scope1: 350, scope2: 210, scope3: 690 },
  { year: 2041, scope1: 305, scope2: 180, scope3: 590 },
  { year: 2042, scope1: 260, scope2: 155, scope3: 500 },
  { year: 2043, scope1: 220, scope2: 130, scope3: 420 },
  { year: 2044, scope1: 180, scope2: 105, scope3: 350 },
  { year: 2045, scope1: 145, scope2: 85, scope3: 280 },
  { year: 2046, scope1: 115, scope2: 65, scope3: 220 },
  { year: 2047, scope1: 85, scope2: 48, scope3: 165 },
  { year: 2048, scope1: 60, scope2: 32, scope3: 115 },
  { year: 2049, scope1: 35, scope2: 18, scope3: 65 },
  { year: 2050, scope1: 15, scope2: 8, scope3: 25 },
];

const SERIES = [
  { key: 'scope1', label: 'Scope 1', sub: 'Direct' },
  { key: 'scope2', label: 'Scope 2', sub: 'Energy' },
  { key: 'scope3', label: 'Scope 3', sub: 'Value chain' },
];

const EVENTS = [
  { year: 2030, label: '−50% interim target', short: '2030' },
  { year: 2050, label: 'Net-zero goal', short: '2050' },
];

// Format helpers
const fmt = (n) => {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
};
const fmtFull = (n) => Math.round(n).toLocaleString('en-US');

// Build stacked series for rendering. Returns for each series:
//   points: [{x, y0, y1}] where y0/y1 are VALUES (not coords)
function buildStacks(data, seriesKeys) {
  return data.map((d) => {
    let acc = 0;
    const layers = {};
    for (const k of seriesKeys) {
      const v = d[k];
      layers[k] = { y0: acc, y1: acc + v };
      acc += v;
    }
    return { year: d.year, total: acc, layers };
  });
}

// Build SVG path for a stacked layer. Goes along top then back along bottom.
function layerPath(stacks, key, xScale, yScale) {
  if (stacks.length === 0) return '';
  const top = stacks
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${xScale(s.year)},${yScale(s.layers[key].y1)}`)
    .join(' ');
  const bot = stacks
    .slice()
    .reverse()
    .map((s) => `L${xScale(s.year)},${yScale(s.layers[key].y0)}`)
    .join(' ');
  return `${top} ${bot} Z`;
}
function totalPath(stacks, xScale, yScale) {
  return stacks
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${xScale(s.year)},${yScale(s.total)}`)
    .join(' ');
}

function StackedAreaChart({ theme, width = 900, height = 540, data }) {
  const t = theme;
  const chartData = data && data.length ? data : DATA;
  const [hidden, setHidden] = React.useState({});
  const [hover, setHover] = React.useState(null); // {year, px, py}
  const yearMin = chartData[0].year;
  const yearMax = chartData[chartData.length - 1].year;
  const [brush, setBrush] = React.useState([yearMin, yearMax]);

  // Keep brush in sync when data range changes
  React.useEffect(() => {
    setBrush([yearMin, yearMax]);
  }, [yearMin, yearMax]);

  const activeSeries = SERIES.filter((s) => !hidden[s.key]);
  const activeKeys = activeSeries.map((s) => s.key);

  // Filter data to brush range
  const visibleData = React.useMemo(
    () => chartData.filter((d) => d.year >= brush[0] && d.year <= brush[1]),
    [brush, chartData]
  );
  const stacks = React.useMemo(
    () => buildStacks(visibleData, activeKeys),
    [visibleData, activeKeys]
  );
  const fullStacks = React.useMemo(
    () => buildStacks(chartData, activeKeys),
    [activeKeys, chartData]
  );

  // Layout
  const pad = { t: 40, r: 120, b: 90, l: 60 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const xDom = brush;
  const yMax = React.useMemo(() => {
    const m = Math.max(...stacks.map((s) => s.total), 1);
    // round up to nice
    const mag = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / mag) * mag;
  }, [stacks]);

  const xScale = (yr) =>
    pad.l + ((yr - xDom[0]) / (xDom[1] - xDom[0] || 1)) * innerW;
  const yScale = (v) => pad.t + innerH - (v / yMax) * innerH;

  // Gradient ids (unique per chart instance via theme.id)
  const gradId = (key) => `grad-${t.id}-${key}`;

  // Mouse -> year
  const svgRef = React.useRef(null);
  function onMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    if (x < pad.l || x > pad.l + innerW) { setHover(null); return; }
    const ratio = (x - pad.l) / innerW;
    const yr = Math.round(xDom[0] + ratio * (xDom[1] - xDom[0]));
    const clamped = Math.max(xDom[0], Math.min(xDom[1], yr));
    setHover({ year: clamped });
  }
  function onLeave() { setHover(null); }

  // Hover data
  const hoverStack = hover ? stacks.find((s) => s.year === hover.year) : null;

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(yMax * r));
  const xTickYears = [xDom[0], 2030, 2035, 2040, 2045, xDom[1]].filter(
    (y, i, arr) => arr.indexOf(y) === i && y >= xDom[0] && y <= xDom[1] && y >= yearMin && y <= yearMax
  );

  // Toggle
  const toggle = (k) => setHidden((h) => ({ ...h, [k]: !h[k] }));

  // Brush handlers (mini chart at bottom)
  const brushY = height - 50;
  const brushH = 32;
  const yearSpan = yearMax - yearMin || 1;
  const brushX = (yr) => pad.l + ((yr - yearMin) / yearSpan) * innerW;
  const brushYearFromX = (px) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((px - rect.left) / rect.width) * width;
    const r = (x - pad.l) / innerW;
    return Math.max(yearMin, Math.min(yearMax, Math.round(yearMin + r * yearSpan)));
  };
  const [dragging, setDragging] = React.useState(null); // 'l' | 'r' | 'm' | null
  const dragRef = React.useRef({ startX: 0, startBrush: [2025, 2050] });
  function brushDown(mode) {
    return (e) => {
      e.preventDefault();
      setDragging(mode);
      dragRef.current = { startX: e.clientX, startBrush: brush };
    };
  }
  React.useEffect(() => {
    if (!dragging) return;
    function move(e) {
      const yr = brushYearFromX(e.clientX);
      const [s, ee] = dragRef.current.startBrush;
      if (dragging === 'l') {
        setBrush([Math.min(yr, ee - 2), ee]);
      } else if (dragging === 'r') {
        setBrush([s, Math.max(yr, s + 2)]);
      } else if (dragging === 'm') {
        const rect = svgRef.current.getBoundingClientRect();
        const dx = ((e.clientX - dragRef.current.startX) / rect.width) * width;
        const deltaYears = Math.round((dx / innerW) * yearSpan);
        let ns = s + deltaYears;
        let ne = ee + deltaYears;
        if (ns < yearMin) { ne += yearMin - ns; ns = yearMin; }
        if (ne > yearMax) { ns -= ne - yearMax; ne = yearMax; }
        setBrush([ns, ne]);
      }
    }
    function up() { setDragging(null); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging]);

  // Full-range mini line path for brush
  const miniYMax = Math.max(...fullStacks.map((s) => s.total), 1);
  const miniPath = fullStacks
    .map((s, i) => {
      const x = pad.l + ((s.year - yearMin) / yearSpan) * innerW;
      const y = brushY + brushH - (s.total / miniYMax) * brushH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  const miniArea = miniPath +
    ` L${pad.l + innerW},${brushY + brushH} L${pad.l},${brushY + brushH} Z`;

  // Event markers (only if in brush range)
  const visibleEvents = EVENTS.filter((e) => e.year >= brush[0] && e.year <= brush[1]);

  return (
    <div style={{
      background: t.bg,
      color: t.fg,
      fontFamily: t.font,
      width: '100%',
      height: '100%',
      padding: '28px 32px 24px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 500, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: t.muted, marginBottom: 8,
            fontFamily: t.monoFont,
          }}>
            {t.eyebrow}
          </div>
          <h2 style={{
            margin: 0, fontSize: 26, fontWeight: t.titleWeight ?? 600,
            letterSpacing: t.titleSpacing ?? '-0.01em',
            fontFamily: t.titleFont || t.font, color: t.fg,
            lineHeight: 1.15,
          }}>
            {t.title}
          </h2>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>
            {t.subtitle}
          </div>
        </div>
        <div style={{
          fontSize: 11, fontFamily: t.monoFont, color: t.muted,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          textAlign: 'right', lineHeight: 1.6, whiteSpace: 'nowrap',
        }}>
          <div>Unit · tCO₂e</div>
          <div>{brush[0]}–{brush[1]}</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {SERIES.map((s) => {
          const isHidden = !!hidden[s.key];
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'transparent', border: 'none',
                padding: '6px 10px 6px 6px', borderRadius: 6,
                cursor: 'pointer', fontFamily: t.font,
                fontSize: 13, color: isHidden ? t.muted : t.fg,
                opacity: isHidden ? 0.5 : 1,
                transition: 'opacity .15s, background .15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = t.hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{
                width: 14, height: 14, borderRadius: t.swatchRadius ?? 3,
                background: t.colors[s.key],
                border: t.swatchBorder ? `1px solid ${t.swatchBorder}` : 'none',
                flexShrink: 0,
                textDecoration: isHidden ? 'line-through' : 'none',
              }} />
              <span style={{ fontWeight: 500 }}>{s.label}</span>
              <span style={{ color: t.muted, fontSize: 12 }}>· {s.sub}</span>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={gradId(s.key)} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={t.colors[s.key]} stopOpacity={t.fillTop ?? 1} />
                <stop offset="100%" stopColor={t.colors[s.key]} stopOpacity={t.fillBottom ?? 1} />
              </linearGradient>
            ))}
          </defs>

          {/* Y gridlines + labels */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line
                x1={pad.l} x2={pad.l + innerW}
                y1={yScale(v)} y2={yScale(v)}
                stroke={i === 0 ? t.axis : t.gridline}
                strokeWidth={i === 0 ? 1 : 1}
                strokeDasharray={i === 0 ? 'none' : (t.gridDash ?? '2 4')}
              />
              <text
                x={pad.l - 10} y={yScale(v) + 4}
                textAnchor="end"
                fontSize="11" fontFamily={t.monoFont} fill={t.muted}
              >
                {fmt(v)}
              </text>
            </g>
          ))}

          {/* Stacked areas */}
          {activeSeries.map((s) => (
            <path
              key={s.key}
              d={layerPath(stacks, s.key, xScale, yScale)}
              fill={t.useGradient ? `url(#${gradId(s.key)})` : t.colors[s.key]}
              stroke={t.strokeLayers ? t.strokeColor : 'none'}
              strokeWidth={t.strokeLayers ? 1 : 0}
              style={{ transition: 'opacity .2s' }}
            />
          ))}

          {/* Total envelope line */}
          {t.showTotal && activeSeries.length > 0 && (
            <path
              d={totalPath(stacks, xScale, yScale)}
              fill="none"
              stroke={t.totalStroke}
              strokeWidth={t.totalWidth ?? 1.5}
              strokeDasharray={t.totalDash ?? 'none'}
            />
          )}

          {/* X-axis tick labels */}
          {xTickYears.map((yr) => (
            <text
              key={yr}
              x={xScale(yr)} y={pad.t + innerH + 18}
              textAnchor="middle"
              fontSize="11" fontFamily={t.monoFont} fill={t.muted}
            >
              {yr}
            </text>
          ))}

          {/* Event markers */}
          {visibleEvents.map((ev) => {
            const x = xScale(ev.year);
            const stk = stacks.find((s) => s.year === ev.year);
            const topY = stk ? yScale(stk.total) : pad.t;
            // Size chip to label: ~5.6px per char for 10px mono + 14px side padding
            const chipW = Math.max(44, ev.label.length * 5.6 + 14);
            return (
              <g key={ev.year}>
                <line
                  x1={x} x2={x}
                  y1={pad.t} y2={pad.t + innerH}
                  stroke={t.eventLine}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle cx={x} cy={topY} r={4} fill={t.bg} stroke={t.eventDot} strokeWidth={1.5} />
                <g transform={`translate(${x}, ${pad.t - 10})`}>
                  <rect
                    x={-chipW / 2} y={-18} width={chipW} height={18}
                    rx={3}
                    fill={t.eventChipBg}
                    stroke={t.eventChipBorder}
                    strokeWidth={0.5}
                  />
                  <text
                    x={0} y={-5}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily={t.monoFont}
                    fill={t.eventChipText}
                    letterSpacing="0.04em"
                  >
                    {ev.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* End-of-line series labels — deconflicted vertically */}
          {(() => {
            const last = stacks[stacks.length - 1];
            if (!last) return null;
            // Raw midpoints for each series, anchored to actual stack position
            const raw = activeSeries.map((s) => {
              const mid = (last.layers[s.key].y0 + last.layers[s.key].y1) / 2;
              return { s, y: yScale(mid) };
            });
            // Deconflict: sort by y, push apart with min gap
            const minGap = 28;
            const sorted = raw.slice().sort((a, b) => a.y - b.y);
            for (let i = 1; i < sorted.length; i++) {
              if (sorted[i].y - sorted[i - 1].y < minGap) {
                sorted[i].y = sorted[i - 1].y + minGap;
              }
            }
            // Keep within chart vertical bounds
            const bot = pad.t + innerH;
            for (let i = sorted.length - 1; i > 0; i--) {
              if (sorted[i].y > bot) sorted[i].y = bot;
              if (sorted[i].y - sorted[i - 1].y < minGap) {
                sorted[i - 1].y = sorted[i].y - minGap;
              }
            }
            const yByKey = Object.fromEntries(sorted.map((r) => [r.s.key, r.y]));
            return activeSeries.map((s) => {
              const rawMid = (last.layers[s.key].y0 + last.layers[s.key].y1) / 2;
              const anchorY = yScale(rawMid);
              const labelY = yByKey[s.key];
              const value = chartData.find((d) => d.year === last.year)[s.key];
              return (
                <g key={s.key}>
                  {/* connector if label shifted */}
                  {Math.abs(labelY - anchorY) > 2 && (
                    <path
                      d={`M${pad.l + innerW},${anchorY} L${pad.l + innerW + 6},${anchorY} L${pad.l + innerW + 6},${labelY} L${pad.l + innerW + 10},${labelY}`}
                      fill="none"
                      stroke={t.colors[s.key]}
                      strokeWidth={1}
                      opacity={0.5}
                    />
                  )}
                  <g transform={`translate(${pad.l + innerW + 10}, ${labelY})`}>
                    <line x1={-6} x2={0} y1={0} y2={0} stroke={t.colors[s.key]} strokeWidth={2} />
                    <text
                      x={4} y={-2}
                      fontSize="11" fontWeight="600"
                      fontFamily={t.font} fill={t.fg}
                    >
                      {s.label}
                    </text>
                    <text
                      x={4} y={11}
                      fontSize="10" fontFamily={t.monoFont} fill={t.muted}
                    >
                      {fmt(value)}
                    </text>
                  </g>
                </g>
              );
            });
          })()}

          {/* Hover crosshair */}
          {hover && hoverStack && (
            <g>
              <line
                x1={xScale(hover.year)} x2={xScale(hover.year)}
                y1={pad.t} y2={pad.t + innerH}
                stroke={t.crosshair}
                strokeWidth={1}
              />
              {activeSeries.map((s) => {
                const layer = hoverStack.layers[s.key];
                const midV = (layer.y0 + layer.y1) / 2;
                return (
                  <circle
                    key={s.key}
                    cx={xScale(hover.year)}
                    cy={yScale(midV)}
                    r={3}
                    fill={t.bg}
                    stroke={t.colors[s.key]}
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}

          {/* Brush mini chart */}
          <g>
            {/* Track */}
            <rect
              x={pad.l} y={brushY} width={innerW} height={brushH}
              fill={t.brushTrack}
              rx={2}
            />
            <path d={miniArea} fill={t.brushFill} />
            <path d={miniPath} fill="none" stroke={t.brushStroke} strokeWidth={1} />

            {/* Unselected overlay */}
            <rect
              x={pad.l} y={brushY}
              width={brushX(brush[0]) - pad.l} height={brushH}
              fill={t.brushMask}
            />
            <rect
              x={brushX(brush[1])} y={brushY}
              width={pad.l + innerW - brushX(brush[1])} height={brushH}
              fill={t.brushMask}
            />

            {/* Selection frame */}
            <rect
              x={brushX(brush[0])} y={brushY}
              width={brushX(brush[1]) - brushX(brush[0])} height={brushH}
              fill="transparent"
              stroke={t.brushSelStroke}
              strokeWidth={1}
              onMouseDown={brushDown('m')}
              style={{ cursor: 'grab' }}
            />

            {/* Handles */}
            {['l', 'r'].map((side) => {
              const yr = side === 'l' ? brush[0] : brush[1];
              return (
                <g key={side} onMouseDown={brushDown(side)} style={{ cursor: 'ew-resize' }}>
                  <rect
                    x={brushX(yr) - 4} y={brushY - 2}
                    width={8} height={brushH + 4}
                    fill={t.brushHandle}
                    rx={1.5}
                  />
                  <line
                    x1={brushX(yr)} x2={brushX(yr)}
                    y1={brushY + 6} y2={brushY + brushH - 6}
                    stroke={t.bg}
                    strokeWidth={1}
                  />
                  <text
                    x={brushX(yr)}
                    y={brushY + brushH + 14}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily={t.monoFont}
                    fill={t.muted}
                  >
                    {yr}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* HTML tooltip (absolute-positioned) */}
        {hover && hoverStack && (
          <div style={{
            position: 'absolute',
            left: `${(xScale(hover.year) / width) * 100}%`,
            top: `${(pad.t / height) * 100}%`,
            transform: xScale(hover.year) > pad.l + innerW * 0.6
              ? 'translate(calc(-100% - 12px), 0)'
              : 'translate(12px, 0)',
            background: t.tooltipBg,
            color: t.tooltipFg,
            border: `1px solid ${t.tooltipBorder}`,
            borderRadius: t.tooltipRadius ?? 4,
            padding: '10px 12px',
            fontSize: 12,
            fontFamily: t.font,
            boxShadow: t.tooltipShadow,
            pointerEvents: 'none',
            minWidth: 180,
            zIndex: 5,
          }}>
            <div style={{
              fontSize: 10, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: t.muted,
              fontFamily: t.monoFont, marginBottom: 6,
            }}>
              Year {hover.year}
            </div>
            {activeSeries.slice().reverse().map((s) => {
              const v = chartData.find((d) => d.year === hover.year)[s.key];
              return (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center',
                  gap: 8, marginBottom: 3,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: t.colors[s.key],
                    flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, color: t.fg }}>{s.label}</span>
                  <span style={{ fontFamily: t.monoFont, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtFull(v)}
                  </span>
                </div>
              );
            })}
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: `1px solid ${t.tooltipBorder}`,
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, fontFamily: t.monoFont,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: t.muted }}>Total</span>
              <span style={{ fontWeight: 600 }}>{fmtFull(hoverStack.total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.StackedAreaChart = StackedAreaChart;
