import { useCallback, useEffect, useState } from "react";
import { fetchAccounts, fetchSession } from "./api";
import { AssetBoard } from "./AssetBoard";
import { OrgTree } from "./OrgTree";
import type { Account, ModuleAccess, Session } from "./types";

function levelClass(level: ModuleAccess["level"]): string {
  if (level === "write") {
    return "badge write";
  }
  if (level === "read") {
    return "badge read";
  }
  return "badge none";
}

function levelText(level: ModuleAccess["level"]): string {
  if (level === "write") {
    return "Escritura";
  }
  if (level === "read") {
    return "Lectura";
  }
  return "Sin acceso";
}

function ModuleCard({ module }: { module: ModuleAccess }) {
  let scope = "Sin grant para este módulo.";
  if (module.level !== "none" && !module.areaRestricted) {
    scope = "Toda la empresa.";
  } else if (module.level !== "none") {
    const roots = module.roots.map((area) => area.name).join(", ") || "ninguna";
    const covered = module.effectiveAreas.map((area) => area.name).join(", ") || "ninguna";
    scope = `Raíz: ${roots}. Alcance: ${covered}.`;
  }
  const categories = module.categories.map((category) => category.name).join(", ");

  return (
    <article className="module">
      <div className="module-top">
        <h3>{module.moduleLabel}</h3>
        <span className={levelClass(module.level)}>{levelText(module.level)}</span>
      </div>
      <p>{scope}</p>
      {categories ? <p className="categories">Categorías: {categories}</p> : null}
    </article>
  );
}

function monogram(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) {
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchAccounts(controller.signal)
      .then((next) => {
        setAccounts(next);
        setSelectedId((current) => current ?? next[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAccountError("No pude leer las cuentas. ¿Está la API en el puerto 3000?");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setSessionError(null);
    fetchSession(selectedId, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) {
          return;
        }
        setSession(next);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSession(null);
        setSessionError(error instanceof Error ? error.message : "No pude cargar la sesión.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [selectedId, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    document.querySelector(".accounts [aria-selected='true']")?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedId, accounts.length]);

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <p className="mark">Buk</p>
          <h1>Autorización</h1>
          <p className="aside-note">Ocho perfiles del seed. Elegir uno fija el header X-User-Id.</p>
        </div>
        {accountError ? <p className="aside-error">{accountError}</p> : null}
        {accounts.length === 0 && !accountError ? <p className="aside-note">Cargando cuentas…</p> : null}
        <div role="listbox" aria-label="Cuentas" className="accounts">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              role="option"
              aria-selected={account.id === selectedId}
              onClick={() => {
                if (account.id === selectedId) {
                  return;
                }
                setSession(null);
                setSelectedId(account.id);
              }}
            >
              <span className="mono">{monogram(account.name)}</span>
              <span>
                <strong>{account.name}</strong>
                <small>{account.profileName}</small>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <main>
        {sessionError ? <p className="banner bad">{sessionError}</p> : null}
        {loading && !session ? <p className="banner">Cargando permisos…</p> : null}
        {session ? (
          <>
            <header className="who">
              <div>
                <p className="eyebrow">{session.user.profileName}</p>
                <h2>{session.user.name}</h2>
                <p>{accounts.find((account) => account.id === session.user.id)?.summary}</p>
                <p className="lesson">{session.lesson}</p>
              </div>
              <code>X-User-Id: {session.user.id}</code>
            </header>
            <section className="panel">
              <header className="panel-head">
                <h2>Permisos efectivos</h2>
                <p>Un grant por módulo. El nivel es none, lectura o escritura. El área y la categoría solo recortan.</p>
              </header>
              <div className="modules">
                {session.modules.map((module) => (
                  <ModuleCard key={module.moduleKey} module={module} />
                ))}
              </div>
            </section>
            <OrgTree modules={session.modules} org={session.org} />
            <AssetBoard assets={session.assets} userId={session.user.id} onChanged={reload} />
          </>
        ) : null}
      </main>
    </div>
  );
}
