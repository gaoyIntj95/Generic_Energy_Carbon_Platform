import { createContext, useContext, useEffect, type ReactNode } from 'react';

const PageHeaderActionsContext = createContext<((actions: ReactNode) => void) | null>(null);

export function PageHeaderActionsProvider({ children, setActions }: { children: ReactNode; setActions: (actions: ReactNode) => void }) {
  return <PageHeaderActionsContext.Provider value={setActions}>{children}</PageHeaderActionsContext.Provider>;
}

export function usePageHeaderActions(actions: ReactNode) {
  const setActions = useContext(PageHeaderActionsContext);

  useEffect(() => {
    if (!setActions) return undefined;
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);

  return Boolean(setActions);
}
