"use client";
import { createContext, useContext } from "react";

export interface AppNavigationContextValue {
  /**
   * Call instead of router.push/replace for in-app view switching.
   * When inside the root SPA shell this switches the view without URL change.
   * When accessed via a direct route (/cards, /game) this is null and
   * components fall back to the Next.js router.
   */
  navigateTo: (path: string) => void;
}

export const AppNavigationContext =
  createContext<AppNavigationContextValue | null>(null);

/** Returns the in-app navigation override, or null if not inside the SPA shell. */
export function useAppNavigation(): AppNavigationContextValue | null {
  return useContext(AppNavigationContext);
}

