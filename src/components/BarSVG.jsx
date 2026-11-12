import { useState, useCallback } from 'react';
import { fmtShort, fmt } from '../utils.js';
import { tint } from '../styles.js';

export default function BarSVG({ data, type, faded }) {
  const [tip, setTip] = useState(null);
  const handleEnter = useCallback((di, d, x) => setTip({ di, d, x }), []);
  const handleLeave = useCallback(() => setTip(null), []);
  const W=340, H=190, PL=50, PB=26, PT=10, PR=8;
  const cW=W-PL-PR, cH=H-PB-PT;
  if (!data || data.length === 0) return null;

  const series = type === "evolucao"
    ? [{ key:"receitas", color:"var(--chart-2)" }, { key:"despesas", color:"var(--chart-4)" }, { key:"saldo", color:"var(--chart-1)", line:true }]
    : [{ key:"receitas", color: faded?tint("var(--chart-2)",40):"var(--chart-2)" }, { key:"despesas", color: faded?tint("var(--chart-4)",40):"var(--chart-4)" }];

  const allVals = data.flatMap(d => series.map(s => d[s.key] || 0));
  const maxVal  = Math.max(...allVals, 1);
  const minVal  = type === "evolucao" ? Math.min(...allVals, 0) : 0;
  const range2  = maxVal - minVal || 1;
  const toY = v  => PT + cH - ((v - minVal) / range2) * cH;
  const toX = i  => PL + (i / (data.length - 1 || 1)) * cW;

  const ariaLabel = (type === "evolucao" ? "Gráfico de evolução do saldo. " : "Gráfico de barras de receitas e despesas. ")
    + data.map(d => `${d.month}: receitas ${fmt(d.receitas)}, despesas ${fmt(d.despesas)}${type === "evolucao" ? `, saldo ${fmt(d.saldo)}` : ""}`).join("; ");

  const barCount = series.filter(s => !s.line).length;
  const totalW   = cW / data.length;
  const barW     = Math.min(20, (totalW * 0.7) / barCount);
  const groupOff = i => -((barCount - 1) / 2) * barW + i * barW;
  const yTicks   = Array.from({ length: 5 }, (_, i) => minVal + (range2 / 4) * i);
  const pathFor  = key => data.map((d, i) => i === 0 ? `M${toX(i)},${toY(d[key]||0)}` : `L${toX(i)},${toY(d[key]||0)}`).join(" ");
  const areaFor  = key => {
    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d[key]||0) }));
    const base = toY(0);
    return `${pts.map((p, i) => i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`).join(" ")} L${pts[pts.length-1].x},${base} L${pts[0].x},${base} Z`;
  };

  // Tooltip: posicionamento inteligente (não sai dos limites)
  const TIP_W = 124, TIP_H = type === "evolucao" ? 72 : 56;
  const renderTip = () => {
    if (!tip) return null;
    const tx = Math.min(Math.max(tip.x - TIP_W / 2, PL), W - TIP_W - PR);
    const ty = PT + 4;
    const d  = tip.d;
    return (
      <g style={{ pointerEvents: "none" }}>
        {/* sombra */}
        <rect x={tx+2} y={ty+2} width={TIP_W} height={TIP_H} rx="7" style={{ fill:"var(--backdrop-soft)" }}/>
        {/* fundo */}
        <rect x={tx} y={ty} width={TIP_W} height={TIP_H} rx="7" strokeWidth="1"
          style={{ fill:"var(--chart-tooltip-bg)", stroke:"var(--chart-tooltip-border)" }}/>
        {/* linha pontilhada até o eixo */}
        <line x1={tip.x} y1={ty+TIP_H} x2={tip.x} y2={H-PB} strokeWidth="1" strokeDasharray="3 2"
          style={{ stroke:tint("var(--chart-1)",27) }}/>
        {/* mês */}
        <text x={tx+TIP_W/2} y={ty+15} textAnchor="middle" fontSize="11" fontWeight="bold" style={{ fill:"var(--accent)" }}>{d.month}</text>
        {/* receita */}
        <text x={tx+8} y={ty+31} fontSize="11" style={{ fill:"var(--success)" }}>↑ {fmtShort(d.receitas)}</text>
        {/* despesa */}
        <text x={tx+8} y={ty+45} fontSize="11" style={{ fill:"var(--orange)" }}>↓ {fmtShort(d.despesas)}</text>
        {/* saldo — só evolução */}
        {type === "evolucao" && (
          <text x={tx+8} y={ty+59} fontSize="11" style={{ fill:d.saldo>=0?"var(--success)":"var(--danger)" }}>≈ {fmtShort(d.saldo)}</text>
        )}
      </g>
    );
  };


  return (
    <div style={{ position:"relative", width:"100%" }}
      onMouseLeave={handleLeave}
      onTouchEnd={() => setTimeout(() => setTip(null), 2200)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ width:"100%", height:"auto", display:"block" }}>
        <defs>
          {series.filter(s => s.line).map(s => (
            <linearGradient key={s.key} id={`g_${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopOpacity="0.2" style={{ stopColor:s.color }}/>
              <stop offset="100%" stopOpacity="0" style={{ stopColor:s.color }}/>
            </linearGradient>
          ))}
        </defs>

        {/* Grade horizontal */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PL} x2={W-PR} y1={toY(v)} y2={toY(v)} strokeDasharray="3 3" style={{ stroke:"var(--chart-grid)" }}/>
            <text x={PL-4} y={toY(v)+4} textAnchor="end" fontSize="11" style={{ fill:"var(--chart-label)" }}>{fmtShort(v)}</text>
          </g>
        ))}
        {minVal < 0 && <line x1={PL} x2={W-PR} y1={toY(0)} y2={toY(0)} strokeWidth="1" style={{ stroke:"var(--chart-axis)" }}/>}

        {/* Áreas de fundo (evolução) */}
        {type === "evolucao" && series.filter(s => !s.line).map(s => (
          <path key={s.key+"_a"} d={areaFor(s.key)} opacity="0.12" style={{ fill:s.color }}/>
        ))}
        {type === "evolucao" && series.filter(s => s.line).map(s => (
          <path key={s.key+"_a"} d={areaFor(s.key)} fill={`url(#g_${s.key})`}/>
        ))}

        {/* Linhas (evolução) */}
        {type === "evolucao" && series.map(s => (
          <path key={s.key} d={pathFor(s.key)} fill="none"
            strokeWidth={s.line?"1.5":"2"} strokeDasharray={s.line?"4 2":"none"} style={{ stroke:s.color }}/>
        ))}

        {/* Barras — zona de hover grande (invisível) para facilitar toque mobile */}
        {type !== "evolucao" && data.map((d, di) => {
          const cx = PL + (di + 0.5) * (cW / data.length);
          const isActive = tip?.di === di;
          return (
            <g key={di}>
              {/* Hitbox largo para toque */}
              <rect x={cx - totalW/2} y={PT} width={totalW} height={cH+PB}
                fill="transparent"
                onMouseEnter={() => handleEnter(di, d, cx)}
                onTouchStart={e => { e.preventDefault(); handleEnter(di, d, cx); }}/>
              {/* Fundo destaque quando ativo */}
              {isActive && <rect x={cx-totalW/2} y={PT} width={totalW} height={cH}
                rx="3" style={{ fill:"var(--surface-hover)" }}/>}
              {series.filter(s => !s.line).map((s, si) => {
                const x=cx+groupOff(si)-barW/2, y0=toY(0), y1=toY(d[s.key]||0), bH=Math.abs(y1-y0);
                return (
                  <rect key={s.key} x={x} y={Math.min(y0,y1)} width={barW}
                    height={Math.max(bH, 2)} rx="3"
                    opacity={faded ? 0.7 : (isActive ? 1 : 0.88)}
                    style={{ fill:s.color, transition:"opacity var(--dur-fast)" }}/>
                );
              })}
            </g>
          );
        })}

        {/* Pontos clicáveis (evolução) */}
        {type === "evolucao" && series.filter(s => s.line).map(s =>
          data.map((d, i) => (
            <circle key={i} cx={toX(i)} cy={toY(d[s.key]||0)} r="4"
              strokeWidth="1.5"
              onMouseEnter={() => handleEnter(i, d, toX(i))}
              onTouchStart={e => { e.preventDefault(); handleEnter(i, d, toX(i)); }}
              style={{ cursor:"pointer", fill:s.color, stroke:"var(--bg)" }}/>
          ))
        )}

        {/* Rótulos eixo X */}
        {data.map((d, i) => (data.length > 12 && i % 2 === 1 && tip?.di !== i) ? null : (
          <text key={i} x={PL+(i+0.5)*(cW/data.length)} y={H-7}
            textAnchor="middle" fontSize="11"
            fontWeight={tip?.di===i?700:400}
            style={{ fill:tip?.di===i?"var(--accent)":"var(--chart-label)" }}>
            {d.month}
          </text>
        ))}

        {/* Tooltip */}
        {renderTip()}
      </svg>

      {/* Tooltip HTML overlay para valores completos (abaixo do gráfico) */}
      {tip && (
        <div role="status" style={{ marginTop:6, padding:"8px 12px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", fontSize:"var(--fs-md)", display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap" }}>
          <span style={{ fontWeight:700, color:"var(--text-2)" }}>{tip.d.month}</span>
          <span style={{ color:"var(--success)" }}>↑ {fmt(tip.d.receitas)}</span>
          <span style={{ color:"var(--orange)" }}>↓ {fmt(tip.d.despesas)}</span>
          {type==="evolucao" && <span style={{ color: tip.d.saldo>=0?"var(--success)":"var(--danger)" }}>≈ {fmt(tip.d.saldo)}</span>}
        </div>
      )}
    </div>
  );
}
