// A dev-server restart (or a new deploy) invalidates the URLs of chunks the
// browser already loaded; lazy route imports then fail with
// "Failed to fetch dynamically imported module" and the page stays blank.
// Recover by reloading once so the browser picks up fresh module URLs.
const RELOAD_FLAG = "topchamal-import-recovery";

const FAILED_IMPORT =
  /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i;

function isFailedImport(reason: unknown): boolean {
  const message =
    reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
  return FAILED_IMPORT.test(message);
}

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // Storage unavailable (private mode); still try a single reload.
  }
  window.location.reload();
}

export function installImportRecovery() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    if (isFailedImport(event.message) || isFailedImport(event.error)) {
      event.preventDefault();
      reloadOnce();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isFailedImport(event.reason)) {
      event.preventDefault();
      reloadOnce();
    }
  });

  // Once the reloaded page stays alive briefly, re-arm recovery for future
  // restarts so a genuinely broken module never traps the user in a loop.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      // Ignore storage failures.
    }
  }, 5000);
}
