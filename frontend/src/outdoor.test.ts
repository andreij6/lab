import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, parseWorkbook } from "./sheet.ts";
import { parseCards } from "./quiz.ts";
import { DECKS, applyReviewToGear, baseWeight, foodWorkbook, gearWorkbook, haversine, isGearWorkbook, parseGpx, parseTrackBlock, routeNote, trackBlock, trackHtml, trackStats, waterWorkbook } from "./outdoor.ts";

const GPX = `<?xml version="1.0"?><gpx><wpt lat="45.10" lon="-121.70"><ele>1500</ele><name>Lower Falls</name></wpt>
<trk><name>Ridge &amp; Lake loop</name><trkseg>
<trkpt lat="45.100" lon="-121.700"><ele>1500</ele></trkpt>
<trkpt lat="45.110" lon="-121.700"><ele>1502</ele></trkpt>
<trkpt lat="45.120" lon="-121.690"><ele>1600</ele></trkpt>
<trkpt lat="45.130" lon="-121.680"><ele>1550</ele></trkpt>
</trkseg></trk></gpx>`;

test("GPX: points, waypoints, distance and climbing, the compact block and the map", () => {
  const t = parseGpx(GPX);
  assert.equal(t.name, "Ridge & Lake loop");
  assert.equal(t.points.length, 4);
  assert.deepEqual(t.waypoints.map((w) => w.name), ["Lower Falls"]);
  assert.ok(Math.abs(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 111.19) < 0.1);
  const st = trackStats(t.points);
  assert.ok(st.km > 3.5 && st.km < 4.5, String(st.km));
  assert.deepEqual([st.ascent, st.descent, st.minEle, st.maxEle], [100, 50, 1500, 1600]);
  const back = parseTrackBlock(trackBlock(t).replace(/^```track\n|```$/g, ""));
  assert.equal(back.points.length, 4);
  assert.equal(back.waypoints[0].name, "Lower Falls");
  const html = trackHtml(t);
  assert.match(html, /<polyline/);
  assert.match(html, /track-profile/);
  assert.match(html, /Lower Falls/);
  assert.match(routeNote(t), /## Waypoint: Lower Falls/);
});

test("gear, food and water workbooks compute what they promise", () => {
  const g = gearWorkbook();
  assert.ok(isGearWorkbook(g));
  const sum = evaluate(parseWorkbook(g)).get("Summary")!;
  const [total, worn, cons, base] = [sum[1][4], sum[2][4], sum[3][4], sum[4][4]] as number[];
  assert.equal(base, total - worn - cons);
  assert.equal(baseWeight(g), base);
  assert.ok(base > 4000 && base < 8000, String(base));
  const f = evaluate(parseWorkbook(foodWorkbook(2, 4000))).get("Days")!;
  assert.equal(f[1][1], 3080);
  assert.equal(f[1][4], "LOW");
  assert.equal(typeof f[1][3], "number");
  assert.equal(f[4][1], 6160);
  const w = evaluate(parseWorkbook(waterWorkbook())).get("Water")!;
  assert.equal(w[1][4], 6.5);
  assert.equal(w[1][5], 3.3);
  assert.equal(w[5][4], "");
});

test("a post-trip review adds and removes gear, formulas renumbered", () => {
  const review = "# Review\n\n## Add to gear list\n\n- Bug net, Clothing, 30 g\n\n## Remove from gear list\n\n- Stakes\n- Puffy jacket\n";
  const r = applyReviewToGear(review, gearWorkbook());
  assert.deepEqual([r.added, r.removed], [1, 2]);
  const gear = parseWorkbook(r.json).sheets[0];
  assert.deepEqual(gear.rows[gear.rows.length - 1].slice(0, 3), ["Bug net", "Clothing", "30"]);
  assert.ok(gear.rows.every((row, i) => i === 0 || row[6] === `=C${i + 1}*D${i + 1}`));
});

test("every skills deck parses into cards", () => {
  for (const [name, d] of Object.entries(DECKS)) assert.ok(parseCards(d).length >= 5, name);
});
