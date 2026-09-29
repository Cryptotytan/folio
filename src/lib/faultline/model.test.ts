import assert from "node:assert/strict";
import test from "node:test";
import { HEALTH_PERSISTENCE } from "./config.ts";
import { buildWorld, hiddenCracks, quietStrength, timeline, WORLD } from "./model.ts";
import { corrRange, percentile } from "./stats.ts";

test("correlation and percentile are bounded", () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const b = a.map((v) => v * 2);
  const c = corrRange(a, b, 0, a.length - 1);
  assert.ok(c != null && c > 0.99);
  assert.equal(percentile(1, [1, 2, 3]), 0);
  assert.equal(percentile(3, [1, 2, 3]), 1);
});

test("layout is finite and deterministic", () => {
  const again = buildWorld();
  assert.equal(again.nodes.length, WORLD.nodes.length);
  for (let i = 0; i < WORLD.nodes.length; i++) {
    assert.ok(Number.isFinite(WORLD.nodes[i].x) && Number.isFinite(WORLD.nodes[i].y));
    assert.equal(again.nodes[i].x, WORLD.nodes[i].x);
    assert.equal(again.nodes[i].y, WORLD.nodes[i].y);
    assert.equal(again.nodes[i].symbol, WORLD.nodes[i].symbol);
  }
});

test("structural health cannot jump on a single day", () => {
  const cap = (1 - HEALTH_PERSISTENCE) * 100 + 0.75;
  for (const node of WORLD.nodes) {
    for (let t = 1; t < WORLD.days; t++) {
      const a = node.health[t - 1];
      const b = node.health[t];
      if (a == null || b == null) continue;
      assert.ok(Math.abs(b - a) <= cap, `${node.symbol} day ${t} moved ${b - a}`);
    }
  }
});

test("timeline never cites a future date", () => {
  const day = 80;
  for (const node of WORLD.nodes) {
    for (const event of timeline(node, day)) {
      assert.ok(event.date <= WORLD.dates[day]);
    }
  }
});

test("demo story has an AI fault, cooling gaming, and both discovery modes", () => {
  const t = WORLD.days - 1;
  const wld = WORLD.nodes.find((n) => n.symbol === "WLD");
  assert.equal(wld?.faultType[t], "PRICE_VOLUME_DIVERGENCE");
  assert.ok(hiddenCracks(t).some((n) => n.symbol === "WLD"));
  assert.ok(quietStrength(t).length > 0);
  const ai = WORLD.regions.find((r) => r.id === "ai")!;
  const gaming = WORLD.regions.find((r) => r.id === "gaming")!;
  assert.ok((ai.rotation[t] ?? 0) > (gaming.rotation[t] ?? 100));
});
