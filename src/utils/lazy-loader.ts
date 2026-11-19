/** Creates a memoized async loader that resets on rejection so subsequent retries can succeed. */
export function createLazyLoader<T>(loader: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = loader().catch((err: unknown) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
}
