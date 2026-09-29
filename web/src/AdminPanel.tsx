import { useEffect, useMemo, useState } from "react";
import { degradeProfile, fetchAdminProfiles, saveGrant } from "./api";
import { AREAS, MODULES, type AccessLevel, type ModuleKey } from "./catalog";
import type { AdminGrant, AdminProfile, GrantPatch } from "./types";

type Draft = {
  level: AccessLevel;
  areaRestricted: boolean;
  areaIds: number[];
  categoryIds: number[];
};

function emptyDraft(): Draft {
  return { level: "none", areaRestricted: false, areaIds: [], categoryIds: [] };
}

function draftFrom(grant: AdminGrant | undefined): Draft {
  if (!grant) {
    return emptyDraft();
  }
  return {
    level: grant.level,
    areaRestricted: grant.areaRestricted,
    areaIds: grant.areaIds.map((area) => area.id),
    categoryIds: grant.restrictions.filter((row) => row.dimension === "category").map((row) => row.valueId),
  };
}

function GrantForm({
  profile,
  moduleKey,
  grant,
  adminId,
  onSaved,
}: {
  profile: AdminProfile;
  moduleKey: ModuleKey;
  grant: AdminGrant | undefined;
  adminId: number;
  onSaved: (profile: AdminProfile) => void;
}) {
  const module = MODULES.find((item) => item.key === moduleKey);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(grant));
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const stamp = grant
    ? `${grant.id}:${grant.level}:${grant.areaRestricted}:${grant.areaIds.map((area) => area.id).join(",")}:${grant.restrictions.map((row) => row.valueId).join(",")}`
    : "new";

  useEffect(() => {
    setDraft(draftFrom(grant));
    setResult(null);
  }, [stamp, grant]);

  async function save() {
    if (!module) {
      return;
    }
    const patch: GrantPatch = {
      profileId: profile.id,
      moduleKey,
      level: draft.level,
      areaRestricted: draft.areaRestricted,
      areaIds: draft.areaIds,
      restrictions: draft.categoryIds.map((valueId) => ({
        resourceType: moduleKey,
        dimension: "category",
        valueId,
      })),
    };
    setPending(true);
    setResult(null);
    try {
      await saveGrant(adminId, patch);
      setResult({ tone: "ok", text: "Grant guardado" });
      onSaved(profile);
    } catch (error) {
      setResult({ tone: "bad", text: error instanceof Error ? error.message : "No se pudo guardar" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="grant"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grant-top">
        <h4>{module?.label ?? moduleKey}</h4>
        <label>
          Nivel
          <select
            value={draft.level}
            onChange={(event) => setDraft((current) => ({ ...current, level: event.target.value as AccessLevel }))}
          >
            <option value="none">Sin acceso</option>
            <option value="read">Lectura</option>
            <option value="write">Escritura</option>
          </select>
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={draft.areaRestricted}
          onChange={(event) => setDraft((current) => ({ ...current, areaRestricted: event.target.checked }))}
        />
        Restringir a áreas
      </label>
      {draft.areaRestricted ? (
        <div className="checks">
          {AREAS.map((area) => (
            <label key={area.id} className="check">
              <input
                type="checkbox"
                checked={draft.areaIds.includes(area.id)}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    areaIds: event.target.checked
                      ? [...current.areaIds, area.id]
                      : current.areaIds.filter((id) => id !== area.id),
                  }));
                }}
              />
              {area.name}
            </label>
          ))}
        </div>
      ) : null}
      {module && module.categories.length > 0 ? (
        <div className="checks">
          {module.categories.map((category) => (
            <label key={category.id} className="check">
              <input
                type="checkbox"
                checked={draft.categoryIds.includes(category.id)}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    categoryIds: event.target.checked
                      ? [...current.categoryIds, category.id]
                      : current.categoryIds.filter((id) => id !== category.id),
                  }));
                }}
              />
              {category.name}
            </label>
          ))}
        </div>
      ) : null}
      <button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
      {result ? <p className={result.tone === "ok" ? "result ok" : "result bad"}>{result.text}</p> : null}
    </form>
  );
}

function DegradeButton({ adminId, profile }: { adminId: number; profile: AdminProfile }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function degrade() {
    setPending(true);
    setMessage(null);
    const result = await degradeProfile(adminId, profile.id);
    setPending(false);
    if (!result.ok) {
      setMessage(result.error);
    }
  }

  return (
    <div className="degrade">
      <button type="button" className="degrade-btn" disabled={pending} onClick={() => void degrade()}>
        {pending ? "Degradando…" : "Degradar"}
      </button>
      {message ? <p className="result bad">{message}</p> : null}
    </div>
  );
}

export function AdminPanel({
  adminId,
  reloadToken,
  onGrantSaved,
}: {
  adminId: number;
  reloadToken: number;
  onGrantSaved: (profile: AdminProfile) => void;
}) {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminProfiles(adminId, controller.signal)
      .then((next) => {
        setProfiles(next);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(caught instanceof Error ? caught.message : "No pude leer los perfiles.");
      });
    return () => controller.abort();
  }, [adminId, reloadToken]);

  const cards = useMemo(() => profiles, [profiles]);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Admin</h2>
        <p>Los cambios van con el X-User-Id del Gerente General. Un Guardar invalida la caché de ese perfil.</p>
      </header>
      {error ? <p className="banner bad">{error}</p> : null}
      <div className="admin-list">
        {cards.map((profile) => (
          <article key={profile.id} className="admin-profile">
            <header>
              <div>
                <h3>{profile.name}</h3>
                <p>{profile.users.map((user) => user.name).join(", ") || "Sin usuario"}</p>
              </div>
              <div className="admin-actions">
                {profile.isAdmin ? <span className="pill on">Administrador</span> : null}
                {profile.isAdmin ? <DegradeButton adminId={adminId} profile={profile} /> : null}
              </div>
            </header>
            <div className="grants">
              {MODULES.map((module) => (
                <GrantForm
                  key={module.key}
                  profile={profile}
                  moduleKey={module.key}
                  grant={profile.grants.find((grant) => grant.moduleKey === module.key)}
                  adminId={adminId}
                  onSaved={onGrantSaved}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
