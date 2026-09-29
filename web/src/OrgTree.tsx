import type { ModuleAccess, OrgNode } from "./types";

type Scope = "all" | "none" | ReadonlySet<number>;

function NodeView({ node, scope, roots }: { node: OrgNode; scope: Scope; roots: ReadonlySet<number> }) {
  const on = scope === "all" || (scope !== "none" && scope.has(node.id));
  return (
    <li>
      <div className={on ? "org-node on" : "org-node"}>
        <span>{node.name}</span>
        {roots.has(node.id) ? <em>raíz</em> : null}
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <NodeView key={child.id} node={child} scope={scope} roots={roots} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrgTree({ modules, org }: { modules: ModuleAccess[]; org: OrgNode[] }) {
  const assets = modules.find((module) => module.moduleKey === "assets");
  const level = assets?.level ?? "none";
  const scope: Scope =
    level === "none" ? "none" : assets && !assets.areaRestricted ? "all" : new Set(assets?.effectiveAreas.map((area) => area.id) ?? []);
  const roots = new Set(assets?.roots.map((area) => area.id) ?? []);
  const caption =
    level === "none"
      ? "Sin grant de Activos: el árbol no abre ningún área."
      : assets?.areaRestricted
        ? "Resaltadas: la raíz guardada y las subáreas que el motor expande."
        : "Sin límite de área: el grant cubre toda la empresa.";

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Alcance de Activos</h2>
        <p>{caption}</p>
      </header>
      <ul className="org">
        {org.map((node) => (
          <NodeView key={node.id} node={node} scope={scope} roots={roots} />
        ))}
      </ul>
    </section>
  );
}
