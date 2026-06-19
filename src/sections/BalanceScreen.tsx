import type { SessionUser } from "@/store"
import { formatMoney } from "@/store";
import { Receipt, TrendingUp, TrendingDown } from "lucide-react";

interface BalanceScreenProps {
  user: SessionUser;
}

export default function BalanceScreen({ user }: BalanceScreenProps) {
  const tickets = JSON.parse(localStorage.getItem("loteria_tickets") || "[]").filter((t: any) => t.userId === user.id);
  const activeTickets = tickets.filter((t: any) => t.status === "active");
  // Only count ACTIVE tickets for sales total
  const totalSales = activeTickets.reduce((sum: number, t: any) => sum + Number(t.total), 0);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Balance</h2>

      {/* Credit Card */}
      <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-green-100 text-sm">Credito Disponible</p>
        <p className="text-3xl font-extrabold mt-1">${formatMoney(user.credit)}</p>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20">
          <div><p className="text-[10px] text-green-200">Banca</p><p className="text-sm font-bold">{user.bankNumber}</p></div>
          <div><p className="text-[10px] text-green-200">Usuario</p><p className="text-sm font-bold">{user.name}</p></div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-green-100 p-4 text-center shadow-sm"><Receipt size={20} className="mx-auto text-green-600 mb-1" /><p className="text-xl font-extrabold text-gray-900">{tickets.length}</p><p className="text-[10px] text-gray-500">Tickets</p></div>
        <div className="bg-white rounded-xl border border-green-100 p-4 text-center shadow-sm"><TrendingUp size={20} className="mx-auto text-green-600 mb-1" /><p className="text-xl font-extrabold text-green-700">{activeTickets.length}</p><p className="text-[10px] text-gray-500">Activos</p></div>
        <div className="bg-white rounded-xl border border-green-100 p-4 text-center shadow-sm"><TrendingDown size={20} className="mx-auto text-red-500 mb-1" /><p className="text-xl font-extrabold text-red-600">{tickets.length - activeTickets.length}</p><p className="text-[10px] text-gray-500">Anulados</p></div>
      </div>

      {/* Total Sales */}
      <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-gray-500">Total en Ventas</p><p className="text-2xl font-extrabold text-green-700">${formatMoney(totalSales)}</p></div>
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"><Receipt size={24} className="text-green-600" /></div>
        </div>
      </div>

      {/* Recent Tickets */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Tickets Recientes</h3>
        <div className="space-y-2">
          {tickets.length > 0 ? tickets.slice(0, 10).reverse().map((ticket: any) => (
            <div key={ticket.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center justify-between">
              <div><p className="text-sm font-bold text-gray-900">{ticket.code}</p><p className="text-[10px] text-gray-500">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : "-"}</p></div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-700">${formatMoney(ticket.total)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ticket.status === "active" ? "bg-green-100 text-green-700" : ticket.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>{ticket.status}</span>
              </div>
            </div>
          )) : <p className="text-sm text-gray-400 text-center py-4">Sin tickets recientes</p>}
        </div>
      </div>
    </div>
  );
}
