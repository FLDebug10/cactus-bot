// A lookup table that is safe to index with anything a person typed. Plain
// object literals inherit keys like "constructor" and "toString", so
// `SLANG["constructor"]` would hand back one of Object's built-in functions.
// These tables have no prototype: an unknown word finds nothing.
export function table<T>(entries: Record<string, T>): Readonly<Record<string, T>> {
  return Object.freeze(Object.assign(Object.create(null) as Record<string, T>, entries));
}
