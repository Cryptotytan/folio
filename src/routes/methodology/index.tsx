import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "@/components/fl/shell";

export const Route = createFileRoute("/methodology/")({
  component: MethodologyPage,
});

function MethodologyPage() {
  return (
    <>
      <PageHead
        kicker="Methodology"
        title="How the market becomes a signal"
        text="Readable without a quant background. The same scores can be opened up if you want the evidence."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Market flow" body="A 0–100 rotation score. It describes where attention is heating across sectors. It does not measure money leaving one coin for another." />
        <Card title="Market DNA" body="Deviation compares today's move with this asset's own daily history. The matches on the back of a card are the coins whose recent daily returns move most like it." />
        <Card title="Faults" body="Contradictions, such as price rising while participation falls. A fault is a description, not an accusation. Opened, changed, and closed faults stay on record." />
        <Card title="Structural health" body="Relative strength, volume, and how calm the daily moves are. The score is smoothed, so one reading cannot replace the one before it. Market diversity is left blank." />
      </div>
      <p className="mt-6 text-sm leading-relaxed text-muted">
        Spot prices, 24-hour volume, and hourly candles come from OKX while you have the app open, and the server keeps a journal if you step away. Market cap comes from the live cap of each coin. If a feed does not answer, the last good reading stays. None of these scores is a forecast.
      </p>
    </>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <article className="card overflow-hidden">
      <div className="h-0.5 bg-blue" />
      <div className="p-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </article>
  );
}