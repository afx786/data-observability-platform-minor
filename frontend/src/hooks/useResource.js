import { useCallback, useEffect, useState } from "react";

/**
 * Runs a data loader, tracks loading/error state, and exposes a reload function.
 * `deps` must contain every value captured by `loader`.
 */
export function useResource(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    Promise.resolve()
      .then(loader)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            data: undefined,
            loading: false,
            error: error?.message || "Unable to load data",
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { ...state, reload };
}
