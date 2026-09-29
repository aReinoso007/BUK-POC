import { useEffect, useState } from "react";
import { renameAsset } from "./api";
import type { AssetDecision } from "./types";

function Decision({ allowed, label, reason }: { allowed: boolean; label: string; reason: string }) {
  return (
    <div className={allowed ? "decision allow" : "decision deny"}>
      <strong>
        {label}
        <span>{allowed ? "permitida" : "denegada"}</span>
      </strong>
      <p>{reason}</p>
    </div>
  );
}

function AssetCard({
  asset,
  userId,
  onChanged,
}: {
  asset: AssetDecision;
  userId: number;
  onChanged: () => void;
}) {
  const [name, setName] = useState(asset.name);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  useEffect(() => {
    setName(asset.name);
  }, [asset.name]);

  async function save() {
    const next = name.trim();
    if (!next) {
      setResult({ tone: "bad", text: "El nombre no puede ir vacío." });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const response = await renameAsset(userId, asset.id, next);
      if (response.ok) {
        setResult({ tone: "ok", text: "200 guardado" });
        onChanged();
        return;
      }
      setResult({ tone: "bad", text: `${response.status} ${response.error}` });
    } catch {
      setResult({ tone: "bad", text: "No hubo respuesta del API." });
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="asset">
      <header>
        <div>
          <h3>{asset.name}</h3>
          <p>
            {asset.area?.name ?? "Sin área"}
            <span>·</span>
            {asset.category.name}
          </p>
        </div>
        <span className={asset.listed ? "pill on" : "pill"}>{asset.listed ? "En el listado" : "Fuera del listado"}</span>
      </header>
      <Decision allowed={asset.canRead} label="Lectura" reason={asset.readReason} />
      <Decision allowed={asset.canWrite} label="Escritura" reason={asset.writeReason} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label>
          Nuevo nombre
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Guardar"}
        </button>
      </form>
      {result ? <p className={result.tone === "ok" ? "result ok" : "result bad"}>{result.text}</p> : null}
    </article>
  );
}

export function AssetBoard({
  assets,
  userId,
  onChanged,
}: {
  assets: AssetDecision[];
  userId: number;
  onChanged: () => void;
}) {
  const visible = assets.filter((asset) => asset.listed).length;
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Activos</h2>
        <p>
          {visible} de {assets.length} entran en <code>GET /assets</code>. Guardar llama a <code>PATCH /assets/:id</code> con este
          usuario. La interfaz no esconde el botón: el 403 lo pone el motor.
        </p>
      </header>
      <div className="assets">
        {assets.map((asset) => (
          <AssetCard key={`${userId}-${asset.id}`} asset={asset} userId={userId} onChanged={onChanged} />
        ))}
      </div>
    </section>
  );
}
