// Summarizes the newman JSON reports written by run-concurrent.ps1 / run-concurrent.sh.
// Usage: node resumen.js [reportsDir]
// Output: aggregate per request name (count, ok, failed, min/avg/max response time).

const fs = require("node:fs");
const path = require("node:path");

const dir = path.resolve(process.argv[2] || "reports");

if (!fs.existsSync(dir)) {
  console.error(`No existe el directorio de reportes: ${dir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(dir)
  .filter((file) => /^run-.*\.json$/.test(file))
  .sort();

if (files.length === 0) {
  console.error(`No hay reportes run-*.json en ${dir}. Ejecute primero la prueba de carga.`);
  process.exit(1);
}

const rows = [];
const runs = [];

for (const file of files) {
  const report = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const executions = (report.run && report.run.executions) || [];
  const failures = ((report.run && report.run.failures) || []).length;

  runs.push({
    file,
    requests: executions.length,
    failures
  });

  for (const execution of executions) {
    const response = execution.response || {};
    const assertions = execution.assertions || [];
    const assertionErrors = assertions.filter((assertion) => assertion.error);

    rows.push({
      request: (execution.item && execution.item.name) || "unknown",
      status: typeof response.code === "number" ? response.code : 0,
      responseTime: typeof response.responseTime === "number" ? response.responseTime : 0,
      assertionFailed: assertionErrors.length > 0
    });
  }
}

function stats(values) {
  if (values.length === 0) {
    return { min: 0, avg: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    min: sorted[0],
    avg: Math.round(total / sorted.length),
    max: sorted[sorted.length - 1]
  };
}

const byRequest = new Map();
for (const row of rows) {
  if (!byRequest.has(row.request)) {
    byRequest.set(row.request, []);
  }
  byRequest.get(row.request).push(row);
}

console.log(`Reportes procesados: ${runs.length}`);
console.log(`Procesos con fallos de ejecución: ${runs.filter((run) => run.failures > 0).length}`);
console.log("");

console.log("| Petición | Enviadas | OK (2xx) | Fallidas | min (ms) | avg (ms) | max (ms) |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

let totalSent = 0;
let totalOk = 0;
let totalFailed = 0;
const allTimes = [];

for (const [request, requestRows] of byRequest) {
  const times = requestRows.map((row) => row.responseTime);
  const statsByRequest = stats(times);
  const ok = requestRows.filter((row) => row.status >= 200 && row.status < 300 && !row.assertionFailed).length;
  const failed = requestRows.length - ok;

  totalSent += requestRows.length;
  totalOk += ok;
  totalFailed += failed;
  allTimes.push(...times);

  console.log(
    `| ${request} | ${requestRows.length} | ${ok} | ${failed} | ${statsByRequest.min} | ${statsByRequest.avg} | ${statsByRequest.max} |`
  );
}

const global = stats(allTimes);

console.log(
  `| **Total** | ${totalSent} | ${totalOk} | ${totalFailed} | ${global.min} | ${global.avg} | ${global.max} |`
);
console.log("");
console.log(`Tasa de éxito: ${totalSent === 0 ? 0 : ((totalOk / totalSent) * 100).toFixed(2)}%`);
