const bigInt = require("big-integer");

// The memo lives in the private memory of the worker process that serves this
// invocation. It is lost on cold start, on worker recycle, and it is never
// shared between instances (scale out). That limitation is the point of the
// lab, so it is declared at module scope on purpose.
const memo = new Map();
const instanceStartedAt = new Date().toISOString();

// Recursive memoization keeps one stack frame per distinct nth, so the depth
// is bounded by the Node.js stack (about 10k-12k frames). Above that the
// function throws RangeError: Maximum call stack size exceeded.
const MAX_SUPPORTED_NTH = 5000;

function fibMemo(nth) {
  const cached = memo.get(nth);
  if (cached !== undefined) {
    return cached;
  }

  const value = nth < 2 ? bigInt(nth) : fibMemo(nth - 1).add(fibMemo(nth - 2));
  memo.set(nth, value);
  return value;
}

module.exports = async function (context, req) {
  const startedAt = Date.now();

  const rawNth = req.query && req.query.nth !== undefined
    ? req.query.nth
    : req.body && req.body.nth;
  const nth = Number.parseInt(rawNth, 10);

  if (!Number.isInteger(nth) || nth < 0) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: {
        error: "nth must be an integer greater than or equal to 0"
      }
    };
    return;
  }

  if (nth > MAX_SUPPORTED_NTH) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: {
        error: `nth must be less than or equal to ${MAX_SUPPORTED_NTH}`,
        reason:
          "Recursive memoization uses one stack frame per index; larger values overflow the stack."
      }
    };
    return;
  }

  const cacheEntriesBefore = memo.size;
  const value = fibMemo(nth);
  const elapsedMs = Date.now() - startedAt;

  context.log(
    `fibonacci-memo nth=${nth} elapsedMs=${elapsedMs} ` +
      `cacheEntriesBefore=${cacheEntriesBefore} cacheEntriesAfter=${memo.size}`
  );

  context.res = {
    headers: { "Content-Type": "application/json" },
    body: {
      nth,
      value: value.toString(),
      elapsedMs,
      cacheHit: cacheEntriesBefore > 0 && cacheEntriesBefore === memo.size,
      cacheEntries: memo.size,
      processId: process.pid,
      processUptimeSeconds: Number(process.uptime().toFixed(3)),
      instanceStartedAt
    }
  };
};
