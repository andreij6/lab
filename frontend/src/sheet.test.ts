import { test } from "node:test";
import assert from "node:assert/strict";
import { NEW_WORKBOOK, chartSvg, colIndex, colName, evaluate, fmt, parseCsv, parseRef, parseWorkbook, serializeWorkbook, toCsv } from "./sheet.ts";

test("references and columns", () => {
  assert.equal(colName(0), "A"); assert.equal(colName(25), "Z"); assert.equal(colName(26), "AA"); assert.equal(colName(701), "ZZ");
  assert.equal(colIndex("AA"), 26); assert.deepEqual(parseRef("$B$3"), { r: 2, c: 1 }); assert.equal(parseRef("3B"), undefined);
});

test("formulas: arithmetic, ranges, functions, strings, errors, cycles, cross-sheet", () => {
  const wb = parseWorkbook(JSON.stringify({ sheets: [
    { name: "Data", rows: [["x", "y"], ["1", "10"], ["2", "20"], ["3", "=A4*10"], ["=SUM(A2:A4)", "=AVERAGE(B2:B4)"], ["=A5/0", "=1+"], ["=B7", "=A7"], ["=IF(A5>5, \"big\", \"small\")", "=\"a\"&\"b\"&LEN(\"xyz\")"], ["=ROUND(2^10/3, 2)", "=Totals!B1"], ["=-A2+B2*2", "=NOPE(1)"], ["1,000", "=COUNT(A2:B4)"]] },
    { name: "Totals", rows: [["t", "=Data!A5*2"]] },
  ] }));
  const v = evaluate(wb);
  const d = v.get("Data")!;
  assert.deepEqual([d[1][0], d[3][1], d[4][0], d[4][1]], [1, 30, 6, 20]);
  assert.deepEqual([d[5][0], d[5][1]], ["#DIV/0!", "#ERROR!"]);
  assert.deepEqual([d[6][0], d[6][1]], ["#CYCLE!", "#CYCLE!"]);
  assert.deepEqual([d[7][0], d[7][1]], ["big", "ab3"]);
  assert.deepEqual([d[8][0], d[8][1]], [341.33, 12]);
  assert.deepEqual([d[9][0], d[9][1]], [19, "#NAME?"]);
  assert.deepEqual([d[10][0], d[10][1]], [1000, 6]);
  assert.equal(v.get("Totals")![0][1], 12);
  assert.equal(fmt(1 / 3), "0.3333333333");
});

test("lookup and conditional functions", () => {
  const wb = parseWorkbook(JSON.stringify({ sheets: [{ name: "s", rows: [["name", "qty", "price"], ["apple", "3", "1.5"], ["pear", "0", "2"], ["apple", "5", "1.5"], ["=COUNTIF(A2:A4, \"apple\")", "=SUMIF(A2:A4, \"apple\", B2:B4)", "=VLOOKUP(\"pear\", A2:C4, 3)"], ["=COUNTIF(B2:B4, \">0\")", "=IFERROR(VLOOKUP(\"kiwi\", A2:C4, 2), \"none\")", "=MEDIAN(B2:B4)"], ["=INDEX(A2:C4, 2, 1)", "=MATCH(\"pear\", A2:A4)", "=AVERAGEIF(A2:A4, \"a*\", B2:B4)"]] }] }));
  const v = evaluate(wb).get("s")!;
  assert.deepEqual([v[4][0], v[4][1], v[4][2]], [2, 8, 2]);
  assert.deepEqual([v[5][0], v[5][1], v[5][2]], [2, "none", 3]);
  assert.deepEqual([v[6][0], v[6][1], v[6][2]], ["pear", 2, 4]);
});

test("csv round trip and workbook serialisation", () => {
  const rows = parseCsv('a,b\n1,"x, ""y"""\n\n2,3\r\n');
  assert.deepEqual(rows, [["a", "b"], ["1", 'x, "y"'], ["2", "3"]]);
  assert.equal(toCsv(rows), 'a,b\n1,"x, ""y"""\n2,3');
  const wb = parseWorkbook(NEW_WORKBOOK);
  wb.sheets[0].rows.push(["", "", ""]);
  const again = parseWorkbook(serializeWorkbook(wb));
  assert.equal(again.sheets[0].rows.length, 4);
  assert.equal(evaluate(again).get("Sheet1")![3][1], 1600);
  assert.equal(parseWorkbook("junk").sheets[0].name, "Sheet1");
});

test("charts draw bars, lines and pies from a label column and value columns", () => {
  const vals = evaluate(parseWorkbook(NEW_WORKBOOK)).get("Sheet1")!;
  const bar = chartSvg(vals, { id: "1", type: "bar", title: "Spend", labels: "A", values: ["B"] });
  assert.match(bar, /<rect[^>]*><title>Amount · Rent: 1200<\/title>/);
  assert.match(bar, /Spend/);
  assert.match(chartSvg(vals, { id: "2", type: "line", title: "", labels: "A", values: ["B"] }), /<path d="M[^"]*" fill="none" stroke=/);
  assert.match(chartSvg(vals, { id: "3", type: "pie", title: "", labels: "A", values: ["B"] }), /<path d="M175/);
  assert.match(chartSvg([["h"]], { id: "4", type: "bar", title: "", labels: "A", values: ["B"] }), /No data/);
});

test("chart options: several series, stacking, legends, palettes, value labels, area", () => {
  const vals = evaluate(parseWorkbook(JSON.stringify({ sheets: [{ name: "s", rows: [["m", "a", "b"], ["Jan", "1", "2"], ["Feb", "3", "4"]] }] }))).get("s")!;
  const grouped = chartSvg(vals, { id: "1", type: "bar", title: "", labels: "A", values: ["B", "C"] });
  assert.equal((grouped.match(/<rect/g) ?? []).length, 4 + 2); // 4 bars, 2 legend swatches (right legend by default for several series)
  const stacked = chartSvg(vals, { id: "2", type: "bar", title: "", labels: "A", values: ["B", "C"], stacked: true, showValues: true, legend: "bottom", palette: "warm" });
  assert.match(stacked, /#e35d6a/);
  assert.match(stacked, />4<\/text>/);
  const none = chartSvg(vals, { id: "3", type: "line", title: "", labels: "A", values: ["B", "C"], legend: "none", colors: ["#123456"], xLabel: "Month", yLabel: "Units" });
  assert.ok(!/<rect/.test(none) && /#123456/.test(none) && /Month/.test(none) && /rotate\(-90\)/.test(none));
  assert.match(chartSvg(vals, { id: "4", type: "area", title: "", labels: "A", values: ["B"], smooth: true }), /opacity="\.25"/);
});
