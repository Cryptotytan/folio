import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHead, Ticker, useMarketEdition } from "@/components/fl/shell";
import { formatPct, formatUsd, healthState } from "@/lib/faultline/format";
import { sectorById } from "@/lib/faultline/view";
import { useDesk } from "@/lib/faultline/desk";

export const Route = createFileRoute("/sectors/$slug")({
  component: SectorPage,
});

function SectorPage() {
  useMarketEdition();
  const desk = useDesk();
  const { slug } = Route.useParams();
  const sector = desk.sectors.find((item) => item.id === slug) ?? sectorById(slug);
  if (!sector) {
    return (
      <>
        <p className="text-muted">That sector is not tracked.</p>
        <Link to="/sectors" className="text-blue">Back to sectors</Link>
      </>
    );
  }
  return (
    <>
      <PageHead
        kicker="Sector"
        title={sector.name}
        text={`${sector.rotation >= 60 ? "Heating" : sector.rotation <= 40 ? "Cooling" : "Steady"}. Attention heat, not fund flow. Folio calculated rotation from the live price and volume. These are not exchange quotes.`}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <Stat label="Rotation score" value={String(Math.round(sector.rotation))} />
        {desk.kind !== "equities" && <Stat label="Market cap" value={formatUsd(sector.mcap)} />}
        <Stat label="24H volume" value={formatUsd(sector.volume)} />
        <Stat label="Breadth" value={`${Math.round(sector.breadth * 100)}%`} />
        <Stat label="7D performance" value={formatPct(sector.ret7)} />
        <Stat label="Assets tracked" value={String(sector.count)} />
      </div>
      <h2 className="mt-6 text-lg font-semibold">Assets in this sector</h2>
      <ul className="card mt-3 divide-y divide-line">
        {[...sector.assets].sort((a, b) => b.change1 - a.change1).map((a) => (
          <li key={a.id}>
            <Link to="/asset/$id" params={{ id: String(a.id) }} search={{ tab: "overview" }} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
              <span className="min-w-0 flex-1">
                <Ticker symbol={a.symbol} name={a.name} />
              </span>
              <span className="text-right">
                <span className="num block text-sm font-medium">{formatUsd(a.price)}</span>
                <span className={`num block text-xs ${a.change1 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(a.change1)}</span>
              </span>
              <span className="hidden w-16 text-right sm:block">
                <span className="num block text-sm font-medium">{a.health ?? "n/a"}</span>
                <span className="block text-[10px] text-muted">{a.health == null ? "Health" : healthState(a.health)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const up = value.startsWith("+");
  const down = value.startsWith("-") || value.startsWith("−");
  return (
    <article className="card overflow-hidden">
      <div className={`h-0.5 ${up ? "bg-pos" : down ? "bg-neg" : "bg-blue"}`} />
      <div className="p-3 sm:p-4">
        <p className="text-[10px] font-medium tracking-wide text-muted uppercase">{label}</p>
        <p className={`num mt-2 truncate text-xl font-semibold leading-none sm:text-2xl ${up ? "text-pos" : down ? "text-neg" : ""}`}>{value}</p>
      </div>
    </article>
  );
}
