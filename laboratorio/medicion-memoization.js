// Mide el comportamiento de la memoization en memoria de proceso, que es lo
// que ocurre dentro de una Azure Function.
//
// Uso:
//   node medicion-memoization.js
//
// El script no depende de azure-functions-core-tools: reproduce la misma
// función recursiva con memoization que está en
// FunctionProject/FibonacciMemo/index.js y simula el ciclo de vida real de una
// instancia (instancia caliente, reciclaje del worker y scale out).

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const NTH = 5000;

// ---------------------------------------------------------------- algoritmo

function createFibonacciMemo() {
  const memo = new Map();

  function fibMemo(nth) {
    const cached = memo.get(nth);
    if (cached !== undefined) {
      return cached;
    }

    const value = nth < 2 ? BigInt(nth) : fibMemo(nth - 1) + fibMemo(nth - 2);
    memo.set(nth, value);
    return value;
  }

  return { fibMemo, memo };
}

// --------------------------------------------------------------- mediciones

function measure(callback) {
  const startedAt = process.hrtime.bigint();
  const result = callback();
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  return { result, elapsedMs };
}

function runChild(nth) {
  const scriptPath = path.resolve(__filename);
  const startedAt = process.hrtime.bigint();
  const child = spawnSync(process.execPath, [scriptPath, "--child", String(nth)], {
    encoding: "utf8"
  });
  const wallMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  if (child.status !== 0) {
    throw new Error(`El proceso hijo falló: ${child.stderr || child.stdout}`);
  }

  return { ...JSON.parse(child.stdout.trim()), wallMs: Number(wallMs.toFixed(3)) };
}

function firstErrorLine(stderr) {
  const lines = String(stderr || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.find((line) => /RangeError|Maximum call stack|Error:/.test(line)) || lines[0] || "";
}

// ------------------------------------------------------- modo proceso hijo

if (process.argv[2] === "--child") {
  const nth = Number.parseInt(process.argv[3], 10);
  const instanceStartedAt = Date.now();
  const { fibMemo, memo } = createFibonacciMemo();

  const { result, elapsedMs } = measure(() => fibMemo(nth));

  process.stdout.write(
    JSON.stringify({
      pid: process.pid,
      nth,
      value: result.toString(),
      elapsedMs: Number(elapsedMs.toFixed(3)),
      cacheEntries: memo.size,
      instanceStartedAt
    })
  );
  process.exit(0);
}

// ------------------------------------------------------------ proceso padre

const { fibMemo, memo } = createFibonacciMemo();

const cold = measure(() => fibMemo(NTH));
const warm = measure(() => fibMemo(NTH));
const warm2 = measure(() => fibMemo(NTH));

const recycled = runChild(NTH);

// Scale out: dos instancias nuevas en paralelo, cada una con su propio cache.
const instances = [runChild(NTH), runChild(NTH)];

// Límite de pila de la recursión (una instancia nueva por sondeo).
let maxDepth = 0;
let stackError = null;
for (const probe of [5000, 8000, 10000, 12000, 14000]) {
  const child = spawnSync(process.execPath, [path.resolve(__filename), "--child", String(probe)], {
    encoding: "utf8"
  });
  if (child.status === 0) {
    maxDepth = probe;
    continue;
  }
  stackError = { nth: probe, message: (child.stderr || child.stdout).split("\n")[0].trim() };
  break;
}

const rows = [
  ["misma instancia, primera llamada (cache vacío)", cold.elapsedMs],
  ["misma instancia, segunda llamada (cache caliente)", warm.elapsedMs],
  ["misma instancia, tercera llamada (cache caliente)", warm2.elapsedMs],
  ["proceso nuevo (cold start simulado)", recycled.elapsedMs],
  ["instancia nueva en paralelo #1 (scale out)", instances[0].elapsedMs],
  ["instancia nueva en paralelo #2 (scale out)", instances[1].elapsedMs]
];

console.log(`nth = ${NTH}`);
console.log(`valor = ${cold.result.toString().slice(0, 16)}... (${cold.result.toString().length} dígitos)`);
console.log("");
console.log("| Escenario | Tiempo (ms) |");
console.log("| --- | ---: |");
for (const [label, elapsedMs] of rows) {
  console.log(`| ${label} | ${elapsedMs.toFixed(3)} |`);
}

console.log("");
console.log(`Entradas en el cache del proceso padre: ${memo.size}`);
console.log(`Entradas en el cache de cada instancia nueva: ${recycled.cacheEntries}`);
console.log(`pid padre: ${process.pid}`);
console.log(`pid instancia reciclada: ${recycled.pid}`);
console.log(
  `pids de las instancias en paralelo: ${instances[0].pid}, ${instances[1].pid} (caches independientes)`
);
console.log("");
console.log(
  `Mayor profundidad recursiva soportada en este Node.js: ${maxDepth || "ninguna de las probadas"}` +
    (stackError ? `; con ${stackError.nth} falla con: ${stackError.message}` : "")
);
console.log("");
console.log(
  `Aceleración de la segunda llamada dentro de la misma instancia: ${(cold.elapsedMs / warm.elapsedMs).toFixed(0)}x`
);
