// Mide el costo del algoritmo iterativo con enteros grandes que usa la función
// Fibonacci original (FunctionProject/Fibonacci/index.js), el que consume CPU
// en el escenario de calidad del laboratorio.
//
// Uso:
//   node medicion-iterativa.js
//
// Se ejecuta con BigInt nativo en lugar de la librería big-integer para no
// requerir dependencias; el algoritmo y el tamaño de los números son los
// mismos, por lo que el orden de crecimiento del costo es el mismo.

function fibonacciIterative(nth) {
  let nth1 = 1n;
  let nth2 = 0n;
  let answer = 0n;

  if (nth === 0) {
    return 0n;
  }
  if (nth === 1) {
    return 1n;
  }

  for (let i = 0; i < nth - 1; i++) {
    answer = nth2 + nth1;
    nth2 = nth1;
    nth1 = answer;
  }

  return answer;
}

// Número de dígitos decimales de F(n) sin convertir el número a texto.
function digitCount(nth) {
  if (nth < 2) {
    return 1;
  }
  return Math.floor(nth * Math.log10((1 + Math.sqrt(5)) / 2) - Math.log10(Math.sqrt(5))) + 1;
}

const values = [1000, 5000, 10000, 20000, 50000, 100000];

console.log("| nth | dígitos de F(n) | tiempo (ms) |");
console.log("| ---: | ---: | ---: |");

const measurements = [];
for (const nth of values) {
  const startedAt = process.hrtime.bigint();
  const value = fibonacciIterative(nth);
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  measurements.push({ nth, elapsedMs, digits: value.toString().length });

  console.log(`| ${nth} | ${digitCount(nth)} | ${elapsedMs.toFixed(2)} |`);
}

const first = measurements[1];
const last = measurements[measurements.length - 1];
const factor = last.nth / first.nth;
const expectedLinearToQuadratic = (last.nth / first.nth) ** 2;
const observed = last.elapsedMs / first.elapsedMs;

console.log("");
console.log(
  `Al pasar de nth=${first.nth} a nth=${last.nth} (x${factor} datos de entrada) el tiempo creció x${observed.toFixed(1)}.`
);
console.log(
  `Un costo lineal habría crecido x${factor}; un costo cuadrático, x${expectedLinearToQuadratic.toFixed(0)}.`
);
console.log(
  `Extrapolación cuadrática del tiempo para nth=1000000: ~${((last.elapsedMs * (1000000 / last.nth) ** 2) / 1000).toFixed(1)} s por petición.`
);
