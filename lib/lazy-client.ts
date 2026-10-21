/**
 * Defer constructing an SDK client until it is first used.
 *
 * Several SDKs (Resend, OpenAI) throw in their constructor when the API key is
 * missing. Clients created at module scope therefore broke `next build`, which
 * imports every route while collecting page data, unless the build machine had
 * every production secret. Wrapped in lazyClient, a missing key only fails the
 * request that actually calls the service.
 */
export function lazyClient<T extends object>(factory: () => T): T {
  let instance: T | null = null;
  const get = () => (instance ??= factory());
  return new Proxy({} as T, {
    get(_target, prop) {
      const target = get();
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
