import {
  X, ShoppingCart, BarChart3, Receipt, Trophy,
  Users, LogOut, ShieldCheck, Download, Upload
} from "lucide-react";
import type { SessionUser } from "@/store"
import { formatMoney } from "@/store";
import { downloadDataFile, importDataFile } from "@/lib/sync-file";

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

const MENU_ITEMS = [
  { id: "vender", label: "Vender", icon: ShoppingCart },
  { id: "balance", label: "Balance", icon: BarChart3 },
  { id: "reportes", label: "Reportes", icon: Receipt },
  { id: "tickets", label: "Tickets", icon: Receipt },
  { id: "sorteos", label: "Sorteos", icon: Trophy },
];

const ADMIN_ITEMS = [
  { id: "admin", label: "Panel Admin", icon: ShieldCheck },
];

export default function SideMenu({ open, onClose, user, onNavigate, onLogout }: SideMenuProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-50 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute left-0 top-0 bottom-0 w-72 z-50 bg-white shadow-2xl flex flex-col animate-in slide-in-from-left-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-green-600 to-green-800 p-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-white" />
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
          <h3 className="font-bold text-base">{user.name}</h3>
          <p className="text-green-200 text-xs mt-0.5">Banca: {user.bankNumber}</p>
          <p className="text-green-200 text-xs capitalize">{user.role}</p>
          <p className="text-green-100 text-sm font-bold mt-2">${formatMoney(user.credit)}</p>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-3 px-5 py-3 text-gray-700 hover:bg-green-50 transition-colors text-left"
            >
              <item.icon size={20} className="text-green-600" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}

          {(user.role === "admin" || user.role === "supervisor") && (
            <>
              <div className="mx-5 my-2 border-t border-gray-100" />
              {ADMIN_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-gray-700 hover:bg-green-50 transition-colors text-left"
                >
                  <item.icon size={20} className="text-green-600" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </>
          )}

          {/* Export/Import - visible to all */}
          <div className="mx-5 my-2 border-t border-gray-100" />
          <button
            onClick={() => downloadDataFile(user.name)}
            className="w-full flex items-center gap-3 px-5 py-3 text-blue-600 hover:bg-blue-50 transition-colors text-left"
          >
            <Download size={20} />
            <span className="text-sm font-medium">Exportar mis datos</span>
          </button>
          
          <label className="w-full flex items-center gap-3 px-5 py-3 text-orange-600 hover:bg-orange-50 transition-colors text-left cursor-pointer">
            <Upload size={20} />
            <span className="text-sm font-medium">Importar datos</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const text = String(ev.target?.result || "");
                  const result = importDataFile(text);
                  alert(result.message);
                  window.location.reload();
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
          </label>
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Cerrar Sesion</span>
          </button>
        </div>
      </div>
    </>
  );
}
