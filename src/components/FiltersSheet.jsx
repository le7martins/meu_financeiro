import S, { tint } from '../styles.js';
import { useDialog } from './Field.jsx';

const SORTS = [["date", "Data"], ["amount", "Valor"], ["status", "Status"], ["name", "Nome"]];

const chipStyle = (on, color = "var(--accent)") => ({
  display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 14px", borderRadius: "var(--radius-md)",
  border: `1px solid ${on ? color : "var(--border-subtle)"}`, background: on ? tint(color, 13) : "transparent",
  color: on ? color : "var(--text-2)", fontSize: "var(--fs-md)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
});

function Group({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

// Filtros, ordenação e agrupamento da lista de lançamentos (aplicam na hora).
export default function FiltersSheet({ statusOptions, filter, setFilter, sortBy, setSortBy, groupBy, setGroupBy, categories, filterCat, setFilterCat,
  allTags, filterTag, setFilterTag, resultCount, onClear, canClear, onClose }) {
  const { dialogProps, titleId } = useDialog(onClose);
  return (
    <div className="appOverlay" style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div {...dialogProps} style={{ ...S.modal, outline: "none" }} className="modal-in">
        <div style={S.modalHandle}/>
        <div style={S.mHeader}>
          <div id={titleId} style={S.mTitle}>Filtros</div>
          <button type="button" aria-label="Fechar" style={S.xBtn} onClick={onClose}>✕</button>
        </div>

        <Group label="Mostrar">
          {statusOptions.map(([val, label, count]) => (
            <button key={val} type="button" aria-pressed={filter === val} onClick={() => setFilter(val)} style={chipStyle(filter === val)}>{label} ({count})</button>
          ))}
        </Group>

        <Group label="Ordenar por">
          {SORTS.map(([val, label]) => (
            <button key={val} type="button" aria-pressed={sortBy === val} onClick={() => setSortBy(val)} style={chipStyle(sortBy === val)}>{label}</button>
          ))}
          <button type="button" aria-pressed={!!groupBy} onClick={() => setGroupBy(p => !p)} style={chipStyle(!!groupBy)}>Agrupar por categoria</button>
        </Group>

        {categories.length > 0 && (
          <Group label="Categoria">
            {[{ id: "all", name: "Todas" }, ...categories].map(c => {
              const color = c.color || "var(--accent)";
              const on = filterCat === c.id;
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => setFilterCat(c.id)} style={chipStyle(on, color)}>
                  {c.id !== "all" && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "var(--radius-full)", background: c.color }}/>}{c.name}
                </button>
              );
            })}
          </Group>
        )}

        {allTags.length > 0 && (
          <Group label="Tags">
            {allTags.map(t => (
              <button key={t} type="button" aria-pressed={filterTag === t} onClick={() => setFilterTag(filterTag === t ? "all" : t)} style={chipStyle(filterTag === t)}>#{t}</button>
            ))}
          </Group>
        )}

        <div style={{ display: "flex", gap: 8, position: "sticky", bottom: -36, margin: "4px -18px -36px", padding: "12px 18px 36px", background: "var(--surface-raised)", borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClear} disabled={!canClear}
            style={{ flex: 1, minHeight: 46, background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", color: "var(--text-2)", fontSize: "var(--fs-base)", fontWeight: 600, cursor: canClear ? "pointer" : "default", opacity: canClear ? 1 : 0.5, fontFamily: "inherit" }}>
            Limpar
          </button>
          <button type="button" onClick={onClose}
            style={{ flex: 2, minHeight: 46, background: "var(--primary-bg)", border: "1px solid var(--primary-border)", borderRadius: "var(--radius-md)", color: "var(--primary-text)", fontSize: "var(--fs-base)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Ver {resultCount} {resultCount === 1 ? "lançamento" : "lançamentos"}
          </button>
        </div>
      </div>
    </div>
  );
}
