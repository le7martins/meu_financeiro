import { buildFatura } from '../logic.js';
import { fmt, mShort, addM, todayISO } from '../utils.js';
import { tint } from '../styles.js';

const cents = (v) => Math.round(v * 100) / 100;
const dm = (ds) => `${ds.slice(8, 10)}/${ds.slice(5, 7)}`;

// Situação de uma fatura do mês: texto + cor (token) para a linha do cartão.
function statusOf(f, today) {
  if (f.paid) return { text: "Paga", token: "success" };
  if (f.partial) return { text: `Pago ${fmt(f.paidAmount || 0)} · vence ${dm(f.dueDate)}`, token: "warning" };
  if (f.open) return { text: `Aberta · fecha ${dm(f.closeDate)}`, token: null };
  if (f.dueDate < today) return { text: `Venceu ${dm(f.dueDate)}`, token: "danger" };
  return { text: `Vence ${dm(f.dueDate)}`, token: "orange" };
}

// Planejamento: faturas do mês por cartão, projeção dos próximos meses e uso do envelope "Cartão".
export default function FaturasPlan({ cards, cardPurchases, cardFaturas, nowMonth, budget }) {
  const today = todayISO();
  const rows = cards.map(card => {
    const f = buildFatura(card, cardPurchases, cardFaturas, nowMonth, today);
    return { card, f, remaining: f.paid ? 0 : Math.max(0, cents(f.total - (f.paidAmount || 0))) };
  }).filter(r => r.f.total > 0);
  const next = [1, 2, 3].map(i => {
    const m = addM(nowMonth, i);
    return { m, total: cents(cards.reduce((s, c) => s + buildFatura(c, cardPurchases, cardFaturas, m, today).total, 0)) };
  });
  if (!rows.length && !next.some(n => n.total > 0)) return null;

  const total = cents(rows.reduce((s, r) => s + r.f.total, 0));
  const aPagar = cents(rows.reduce((s, r) => s + r.remaining, 0));
  const pago = cents(total - aPagar);
  const pct = total > 0 ? (pago / total) * 100 : 0;
  const lim = budget > 0 ? budget : 0;
  const limPct = lim > 0 ? (total / lim) * 100 : 0;
  const overLim = lim > 0 && total > lim;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--text-1)" }}>Faturas do mês</div>
        {rows.length > 0 && <div style={{ fontSize: "var(--fs-md)", fontWeight: 800, color: "var(--text-1)" }}>{fmt(total)}</div>}
      </div>

      {rows.length > 0 ? (<>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <div role="progressbar" aria-label="Faturas pagas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
            style={{ flex: 1, height: 5, background: "var(--track)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", transition: "width .5s" }}/>
          </div>
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: aPagar === 0 ? "var(--success)" : "var(--warning)", flexShrink: 0 }}>
            {aPagar === 0 ? "tudo pago" : `${fmt(aPagar)} a pagar`}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
          {rows.map(({ card, f, remaining }) => {
            const st = statusOf(f, today);
            return (
              <div key={card.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "var(--fs-base)", fontWeight: 600, color: "var(--text-1)" }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: card.color, flexShrink: 0 }}/>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.name}</span>
                  </div>
                  <div style={{ fontSize: "var(--fs-sm)", fontWeight: st.token ? 600 : 500, color: st.token ? `var(--${st.token})` : "var(--text-3)", marginTop: 1 }}>{st.text}</div>
                </div>
                <div style={{ fontSize: "var(--fs-lg)", fontWeight: 700, color: f.paid ? "var(--text-3)" : card.color, flexShrink: 0 }}>{fmt(f.paid ? f.total : remaining)}</div>
              </div>
            );
          })}
        </div>
      </>) : (
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-3)", marginTop: 6 }}>Nenhuma fatura neste mês.</div>
      )}

      {lim > 0 && rows.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-sm)", color: "var(--text-3)", marginBottom: 5 }}>
            <span>Envelope Cartão</span>
            <span style={{ fontWeight: 700, color: overLim ? "var(--danger)" : "var(--text-2)" }}>{fmt(total)} de {fmt(lim)}</span>
          </div>
          <div role="progressbar" aria-label="Uso do envelope Cartão" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, limPct))}
            style={{ height: 4, background: "var(--track)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, limPct)}%`, background: overLim ? "var(--danger)" : limPct > 80 ? "var(--warning)" : "var(--accent)", transition: "width .5s" }}/>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-3)", marginBottom: 6 }}>Próximas faturas (compras e parcelas já lançadas)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
          {next.map(n => (
            <div key={n.m} style={{ background: n.total > 0 ? tint("var(--accent)", 7) : "transparent", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "7px 10px" }}>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-3)" }}>{mShort(n.m)}</div>
              <div style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: n.total > 0 ? "var(--text-1)" : "var(--text-4)", whiteSpace: "nowrap" }}>{n.total > 0 ? fmt(n.total) : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
