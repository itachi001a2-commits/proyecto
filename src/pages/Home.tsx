import { useState, useEffect } from 'react'
import { saveSession, loadSession, clearSession, initStorage, formatMoney } from "@/store"
import { checkBackend } from "@/lib/sync"
import LoginScreen from "@/sections/LoginScreen"
import VenderScreen from "@/sections/VenderScreen"
import SideMenu from "@/sections/SideMenu"
import BottomNav from "@/sections/BottomNav"
import BalanceScreen from "@/sections/BalanceScreen"
import ReportesScreen from "@/sections/ReportesScreen"
import TicketsScreen from "@/sections/TicketsScreen"
import SorteosScreen from "@/sections/SorteosScreen"
import AdminPanel from "@/sections/AdminPanel"
import { Loader2, Wifi, WifiOff } from "lucide-react"

export type Screen = "login" | "vender" | "balance" | "reportes" | "tickets" | "sorteos" | "admin";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("login");
  const [sessionUser, setSessionUser] = useState(loadSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Initialize storage (one-time setup), check backend, and auto-login
  useEffect(() => {
    initStorage(); // This only runs once when app is first opened
    checkBackend().then((online) => setIsOnline(online));
    const saved = loadSession();
    if (saved) {
      setSessionUser(saved);
      setScreen("vender");
    }
    setIsReady(true);
  }, []);

  const handleLogin = (user: NonNullable<typeof sessionUser>) => {
    setSessionUser(user);
    saveSession(user);
    setScreen(user.role === "user" ? "vender" : "vender");
  };

  const handleLogout = () => {
    clearSession();
    setSessionUser(null);
    setScreen("login");
    setMenuOpen(false);
  };

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (screen === "login" || !sessionUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-green-50 via-white to-green-50 overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shrink-0">
        <button onClick={() => setMenuOpen(true)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div className="text-center">
          {(() => {
            const gs = JSON.parse(localStorage.getItem("loteria_groups") || "[]");
            const g = gs.find((x: any) => x.id === sessionUser.groupId);
            const displayName = g ? g.name : "BANCA VICTORIA";
            const subtitle = g ? "BANCA VICTORIA" : "";
            return (
              <>
                <h1 className="text-base font-bold tracking-tight">{displayName}</h1>
                <p className="text-[10px] text-green-100 opacity-90">
                  {sessionUser.role === "admin" ? "ADMINISTRADOR" : sessionUser.role === "supervisor" ? "SUPERVISOR" : sessionUser.role === "collector" ? "COBRADOR" : "VENDEDOR"}
                  {subtitle ? ` | ${subtitle}` : ""}
                </p>
              </>
            );
          })()}
        </div>
        <div className="text-right min-w-[80px]">
          <div className="flex items-center justify-end gap-1">
            {isOnline ? <Wifi size={10} className="text-green-300" /> : <WifiOff size={10} className="text-yellow-300" />}
            <p className="text-[10px] text-green-100">{isOnline ? "Online" : "Offline"}</p>
          </div>
          <p className="text-[10px] text-green-100">Banca {sessionUser.bankNumber}</p>
          <p className="text-sm font-bold">${formatMoney(sessionUser.credit)}</p>
        </div>
      </header>

      {/* Side Menu */}
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={sessionUser}
        onNavigate={(s) => { setScreen(s as Screen); setMenuOpen(false); }}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {screen === "vender" && (
          <VenderScreen user={sessionUser} />
        )}
        {screen === "balance" && (
          <BalanceScreen user={sessionUser} />
        )}
        {screen === "reportes" && (
          <ReportesScreen user={sessionUser} />
        )}
        {screen === "tickets" && (
          <TicketsScreen user={sessionUser} />
        )}
        {screen === "sorteos" && (
          <SorteosScreen user={sessionUser} />
        )}
        {screen === "admin" && (
          <AdminPanel user={sessionUser} />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav active={screen} onNavigate={(s) => setScreen(s as Screen)} userRole={sessionUser.role} />
    </div>
  );
}
