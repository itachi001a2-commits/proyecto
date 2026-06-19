import { ShoppingCart, BarChart3, Receipt, Trophy } from "lucide-react";

interface BottomNavProps {
  active: string;
  onNavigate: (screen: string) => void;
  userRole: string;
}

const NAV_ITEMS = [
  { id: "vender", label: "Vender", icon: ShoppingCart },
  { id: "balance", label: "Balance", icon: BarChart3 },
  { id: "tickets", label: "Tickets", icon: Receipt },
  { id: "sorteos", label: "Sorteos", icon: Trophy },
];

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className="shrink-0 h-16 bg-white border-t border-green-100 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex items-center justify-around px-2 z-40">
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
              isActive
                ? "bg-green-50 text-green-700 scale-105"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <item.icon
              size={22}
              className={isActive ? "text-green-600" : "text-gray-400"}
              strokeWidth={isActive ? 2.5 : 1.5}
            />
            <span className={`text-[10px] font-medium ${isActive ? "text-green-700" : ""}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
