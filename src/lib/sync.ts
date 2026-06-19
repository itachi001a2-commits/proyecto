// Hybrid sync: uses localStorage as primary, syncs to backend when available
// This NEVER fails - if backend is down, data stays in localStorage

let isOnline = false;

// Check if backend is available (runs once on load)
export async function checkBackend(): Promise<boolean> {
  try {
    const response = await fetch("/api/trpc/sync.ping", { method: "GET", signal: AbortSignal.timeout(3000) });
    isOnline = response.ok;
    return isOnline;
  } catch {
    isOnline = false;
    return false;
  }
}

export function getOnlineStatus(): boolean {
  return isOnline;
}

// Sync all localStorage data to backend (called after ticket creation, user creation, etc.)
export async function syncAllToBackend(): Promise<void> {
  if (!isOnline) return; // Skip if backend not available

  try {
    // Sync users
    const users = JSON.parse(localStorage.getItem("loteria_users") || "[]");
    if (users.length > 0) {
      await fetch("/api/trpc/sync.uploadUsers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: users }),
        signal: AbortSignal.timeout(5000),
      });
    }

    // Sync groups
    const groups = JSON.parse(localStorage.getItem("loteria_groups") || "[]");
    if (groups.length > 0) {
      await fetch("/api/trpc/sync.uploadGroups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: groups }),
        signal: AbortSignal.timeout(5000),
      });
    }

    // Sync tickets
    const tickets = JSON.parse(localStorage.getItem("loteria_tickets") || "[]");
    if (tickets.length > 0) {
      await fetch("/api/trpc/sync.uploadTickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: tickets }),
        signal: AbortSignal.timeout(5000),
      });
    }
  } catch {
    // Silently fail - data is safe in localStorage
    isOnline = false;
  }
}

// Quick sync after important actions (fire and forget)
export function quickSync(): void {
  // Run in background without blocking UI
  setTimeout(() => {
    syncAllToBackend().catch(() => {});
  }, 100);
}
