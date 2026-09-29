import { createFileRoute } from "@tanstack/react-router";
import { WORLD } from "@/lib/faultline/model";

export const Route = createFileRoute("/api/world")({
  server: {
    handlers: {
      GET: async () => {
        const day = WORLD.days - 1;
        return Response.json({
          generatedAt: WORLD.asOf,
          status: WORLD.status,
          layoutVersion: WORLD.layoutVersion,
          notice: "DEMO SNAPSHOT. Prices and scores are computed from a frozen fixture, not a live CoinMarketCap response.",
          market: WORLD.market[day],
          regions: WORLD.regions.map((r) => ({
            id: r.id,
            name: r.name,
            rotation: r.rotation[day],
            health: r.health[day],
            breadth: r.breadth[day],
            deteriorating: r.deteriorating[day],
            assets: r.assetIds.length,
          })),
          nodes: WORLD.nodes.map((n) => ({
            id: n.id,
            symbol: n.symbol,
            name: n.name,
            category: n.category,
            x: n.x,
            y: n.y,
            price: n.price[day],
            marketCap: n.mcap[day],
            volume: n.volume[day],
            rotation: n.rotation[day],
            health: n.health[day],
            contradiction: n.contradiction[day],
            faultType: n.faultType[day],
            faultMagnitude: n.faultMagnitude[day],
            dnaDeviation: n.dnaDeviation[day],
          })),
          links: WORLD.links,
        });
      },
    },
  },
});
