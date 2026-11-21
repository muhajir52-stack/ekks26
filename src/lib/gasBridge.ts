export interface GoogleScriptRun {
  withSuccessHandler: <T = unknown>(callback: (result: T) => void) => GoogleScriptRun;
  withFailureHandler: (callback: (error: Error) => void) => GoogleScriptRun;
  simsGetAllCollections?: () => void;
  simsSaveCollection?: (quickKey: string, jsonString: string) => void;
  simsGetDatabaseInfo?: () => void;
}

declare global {
  interface Window {
    google?: {
      script?: {
        run?: GoogleScriptRun;
      };
    };
  }
}

export interface GasHydrationResult {
  hydrated: boolean;
  spreadsheetUrl: string | null;
  collectionCount: number;
}

let cachedSpreadsheetUrl: string | null = null;
let hasHydratedGas = false;
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function isAppsScriptEnvironment(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.google && window.google.script && window.google.script.run)
    );
  } catch {
    return false;
  }
}

export function getGasSpreadsheetUrl(): string | null {
  return cachedSpreadsheetUrl;
}

export function isGasHydrated(): boolean {
  return hasHydratedGas;
}

export function hydrateFromAppsScript(): Promise<GasHydrationResult> {
  if (!isAppsScriptEnvironment()) {
    return Promise.resolve({
      hydrated: false,
      spreadsheetUrl: null,
      collectionCount: 0,
    });
  }

  return new Promise((resolve) => {
    try {
      const runner = window.google!.script!.run!
        .withSuccessHandler<{
          spreadsheetUrl?: string | null;
          collections?: Record<string, unknown>;
        }>((res) => {
          let count = 0;
          if (res?.spreadsheetUrl) {
            cachedSpreadsheetUrl = res.spreadsheetUrl;
          }
          if (res?.collections && typeof res.collections === 'object') {
            for (const [key, val] of Object.entries(res.collections)) {
              if (val !== undefined && val !== null) {
                try {
                  localStorage.setItem(key, JSON.stringify(val));
                  count += 1;
                } catch {
                  // Ignore quota limits gracefully
                }
              }
            }
          }
          hasHydratedGas = true;
          try {
            window.dispatchEvent(new CustomEvent('sims:gas-hydrated', { detail: { count } }));
          } catch {
            // Ignore dispatch failure
          }
          resolve({
            hydrated: true,
            spreadsheetUrl: cachedSpreadsheetUrl,
            collectionCount: count,
          });
        })
        .withFailureHandler(() => {
          hasHydratedGas = true;
          resolve({
            hydrated: false,
            spreadsheetUrl: cachedSpreadsheetUrl,
            collectionCount: 0,
          });
        });

      if (typeof runner.simsGetAllCollections === 'function') {
        runner.simsGetAllCollections();
      } else {
        hasHydratedGas = true;
        resolve({ hydrated: false, spreadsheetUrl: null, collectionCount: 0 });
      }
    } catch {
      hasHydratedGas = true;
      resolve({ hydrated: false, spreadsheetUrl: null, collectionCount: 0 });
    }
  });
}

export function syncCollectionToAppsScript(key: string, payload: unknown): void {
  if (!isAppsScriptEnvironment()) return;

  const existingTimer = syncTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    syncTimers.delete(key);
    try {
      const serialized = JSON.stringify(payload);
      const runner = window.google?.script?.run
        ?.withSuccessHandler<{ spreadsheetUrl?: string } | undefined>((res) => {
          if (res?.spreadsheetUrl) {
            cachedSpreadsheetUrl = res.spreadsheetUrl;
          }
        })
        .withFailureHandler(() => {
          // Keep localStorage intact if background sheet sync hits a transient lock
        });
      if (runner && typeof runner.simsSaveCollection === 'function') {
        runner.simsSaveCollection(key, serialized);
      }
    } catch {
      // Ignore serialization/sync errors gracefully
    }
  }, 220);

  syncTimers.set(key, timer);
}
