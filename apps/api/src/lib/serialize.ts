/**
 * Recursively converts BigInt values to strings so Fastify's JSON
 * serializer (which cannot handle BigInt) can send the payload. Every route
 * handler runs its response through this before calling reply.send() —
 * this is purely a wire-format concern, never a rounding or precision loss,
 * since the string carries the exact paise value.
 */
export function serializeBigInts<T>(value: T): T {
  if (typeof value === "bigint") return value.toString() as unknown as T;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (Array.isArray(value)) return value.map(serializeBigInts) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeBigInts(v);
    return out as T;
  }
  return value;
}
