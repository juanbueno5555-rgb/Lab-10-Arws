#!/usr/bin/env bash
# Lanza N ejecuciones de newman en paralelo y resume el resultado.
#
# Requisitos: npm install -g newman
#
# Uso:
#   RUNS=10 ./run-concurrent.sh
#   RUNS=4  ./run-concurrent.sh

set -u

RUNS=${RUNS:-10}
ITERATIONS=${ITERATIONS:-1}
COLLECTION=${COLLECTION:-"ARSW_LOAD-BALANCING_AZURE_II.postman_collection.json"}
ENVIRONMENT=${ENVIRONMENT:-"[ARSW_LOAD-BALANCING_AZURE_II].postman_environment.json"}
REPORT_DIR=${REPORT_DIR:-"reports"}

cd "$(dirname "$0")" || exit 1

if ! command -v newman >/dev/null 2>&1; then
  echo "newman no está instalado. Ejecute: npm install -g newman" >&2
  exit 1
fi

rm -rf "$REPORT_DIR"
mkdir -p "$REPORT_DIR"

echo "Lanzando $RUNS ejecuciones concurrentes de newman..."

pids=()
for i in $(seq 1 "$RUNS"); do
  padded=$(printf "%02d" "$i")
  newman run "$COLLECTION" \
    -e "$ENVIRONMENT" \
    -n "$ITERATIONS" \
    --reporters json \
    --reporter-json-export "$REPORT_DIR/run-$padded.json" \
    >"$REPORT_DIR/run-$padded.log" 2>&1 &
  pids+=($!)
done

for pid in "${pids[@]}"; do
  wait "$pid" || true
done

echo "Resumen:"
node resumen.js "$REPORT_DIR"
