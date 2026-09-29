export function ScopeNote({ where }: { where: unknown }) {
  return (
    <section className="panel scope-note" data-scope-where={JSON.stringify(where)}>
      <header className="panel-head">
        <h2>Where de Activos</h2>
        <p>
          Predicado crudo de <code>Authz.scope</code> para <code>GET /assets</code> del perfil seleccionado. Un{" "}
          <code>in: []</code> no matchea ninguna fila.
        </p>
      </header>
      <pre>{JSON.stringify(where, null, 2)}</pre>
    </section>
  );
}
