import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiUser, hasRestSession, restoreRestAccessToken } from "@/lib/api";

export const CURRENT_USER_QUERY_KEY = ["rest", "users", "me"] as const;

type CurrentUserContextValue = {
  currentUser: ApiUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<ApiUser | null>;
  setCurrentUser: (user: ApiUser) => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionRevision, setSessionRevision] = useState(0);
  // Always gate the first user query behind refresh restoration. On a hard reload,
  // the refresh cookie may be the only durable credential; starting /users/me
  // before /auth/refresh settles can expose a false logged-out state.
  const [sessionReady, setSessionReady] = useState(false);
  const sessionActive = sessionReady && hasRestSession();

  useEffect(() => {
    let cancelled = false;
    restoreRestAccessToken({ force: true }).finally(() => {
      if (!cancelled) {
        setSessionReady(true);
        setSessionRevision(revision => revision + 1);
      }
    });
    const onSessionChange = () => {
      setSessionReady(true);
      setSessionRevision(revision => revision + 1);
    };
    window.addEventListener("yemna-session-change", onSessionChange);
    return () => {
      cancelled = true;
      window.removeEventListener("yemna-session-change", onSessionChange);
    };
  }, []);

  const query = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: api.getMe,
    enabled: sessionReady && sessionActive,
    retry: 1,
    staleTime: 60_000,
  });

  const refreshUser = useCallback(async () => {
    if (!hasRestSession()) {
      queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      return null;
    }
    const user = await api.getMe();
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
    return user;
  }, [queryClient]);

  const setCurrentUser = useCallback((user: ApiUser) => {
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
  }, [queryClient]);

  const value = useMemo<CurrentUserContextValue>(() => ({
    currentUser: sessionActive ? query.data ?? null : null,
    isLoading: !sessionReady || (sessionActive && query.isLoading),
    isAuthenticated: sessionActive && Boolean(query.data),
    refreshUser,
    setCurrentUser,
  }), [query.data, query.isLoading, refreshUser, sessionActive, sessionRevision, setCurrentUser]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) throw new Error("useCurrentUser must be used within CurrentUserProvider");
  return context;
}
