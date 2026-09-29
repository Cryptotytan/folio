import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { probeCmc } from "@/lib/faultline/cmc.functions";
import { asOf, assetCount } from "@/lib/faultline/view";

export const Route = createFileRoute("/methodology/data")({
  component: DataPage,
});

const ENDPOINTS = [
  ["/v1/cryptocurrency/map", "Stable ids", "Not called"],
  ["/v3/cryptocurrency/quotes/latest", "Spot quotes", "Probe only, if a key exists"],
  ["/v2/cryptocurrency/ohlcv/historical", "DNA history", "Not called · fixture path used"],
  ["/v1/cryptocurrency/categories", "Continents", "Not called · curated taxonomy"],
  ["/v1/global-metrics/quotes/latest", "Market strip", "Computed inside the snapshot"],
  ["/v3/fear-and-greed/latest", "Sentiment", "Unavailable"],
  ["/v1/altcoin-season-index/latest", "Altcoin season", "Unavailable"],
  ["/v5/derivatives/liquidations/quotes/latest", "Liquidations", "Unavailable"],
  ["/v5/real-world-assets/assets/list", "RWA region", "Partial fixture only"],
];

function DataPage() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string>("");

  return (
    <main className="min-h-dvh bg-bg px-4 py-8 text-fg md:px-8">
      <Link to="/methodology" className="text-sm text-muted">
        Methodology
      </Link>
      <p className="mt-6 text-xs tracking-[0.16em] text-faint">DATA</p>
      <h1 className="mt-1 text-3xl font-medium">Where the numbers come from</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Spot quotes cache from OKX until 00:00 UTC. Date {asOf}. {assetCount} assets. Scores are computed here.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <th className="pb-2 font-medium">Endpoint</th>
              <th className="pb-2 font-medium">Purpose</th>
              <th className="pb-2 font-medium">This build</th>
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map((row) => (
              <tr key={row[0]} className="border-t border-line">
                <td className="py-2 font-mono text-xs">{row[0]}</td>
                <td className="py-2">{row[1]}</td>
                <td className="py-2 text-muted">{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={pending}
        className="btn mt-6"
        onClick={() => {
          setPending(true);
          probeCmc()
            .then((res) => setResult(JSON.stringify(res, null, 2)))
            .catch(() => setResult("The probe could not run."))
            .finally(() => setPending(false));
        }}
      >
        {pending ? "Running" : "Run live CMC test"}
      </button>
      {result && (
        <pre className="mt-4 max-w-3xl overflow-auto rounded-md border border-line bg-surface p-4 font-mono text-xs text-muted">
          {result}
        </pre>
      )}
    </main>
  );
}
