/**
 * Lightweight URL query sync without useSearchParams (avoids Suspense hangs).
 * Uses replaceState so Back from detail can still restore via popstate listeners.
 */

export function readQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export function writeQueryParam(
  key: string,
  value: string | null,
  options: { defaultValue?: string } = {},
): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const def = options.defaultValue;
  if (
    value === null ||
    value === "" ||
    (def !== undefined && value === def)
  ) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}
