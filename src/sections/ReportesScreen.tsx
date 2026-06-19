import { useState } from "react";
import type { SessionUser } from "@/store"
import { formatMoney, getAuditLog } from "@/store";
import type { AuditEntry } from "@/store";
import { Receipt, Calendar, User, Users, TrendingUp, TrendingDown, DollarSign, Award, Filter, BarChart3 } from "lucide-react";
import { trpc } from "@/providers/trpc";

interface ReportesScreenProps {
  user: SessionUser;
}

type ReportTab = "resumen" | "por_usuario" | "por_grupo" | "historial" | "ganancias";

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
  }
  return new Date(dateStr);
}

function isDateInRange(dateStr: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const d = parseLocalDate(dateStr).getTime();
  if (from && d < new Date(from).getTime()) return false;
  if (to) {
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    if (d >= toDate.getTime()) return false;
  }
  return true;
}

export default function ReportesScreen({ user }: ReportesScreenProps) {
  const isAdmin = user.role === "admin" || user.role === "supervisor";
  const allTickets = JSON.parse(localStorage.getItem("loteria_tickets") || "[]");
  const activeTickets = allTickets.filter((t: any) => t.status === "active");
  const myTickets = activeTickets.filter((t: any) => t.userId === user.id);
  const totalSales = myTickets.reduce((sum: number, t: any) => sum + Number(t.total), 0);
  const myCommission = totalSales * (Number(user.commission) || 0) / 100;

  const allUsers = JSON.parse(localStorage.getItem("loteria_users") || "[]");
  const allGroups = JSON.parse(localStorage.getItem("loteria_groups") || "[]");
  const allLotteries = JSON.parse(localStorage.getItem("loteria_loterias") || "[]");
  const totalAllSales = activeTickets.reduce((sum: number, t: any) => sum + Number(t.total), 0);
  const totalCommission = activeTickets.reduce((sum: number, t: any) => sum + (Number(t.total) * (Number(t.commission || 0) / 100)), 0);

  const [tab, setTab] = useState<ReportTab>("resumen");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");

  // Winner report (admin only)
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split("T")[0]);
  const winnerReport = trpc.winner.report.useQuery(
    { drawDate: reportDate.replace(/-/g, ""), lotteryId: undefined },
    { enabled: isAdmin && tab === "ganancias" }
  );

  const auditLog = getAuditLog();

  const filteredTickets = activeTickets.filter((t: any) => isDateInRange(t.date, fromDate, toDate));
  const filteredAudit = auditLog.filter((l) => isDateInRange(l.date, fromDate, toDate));

  // User report data
  const userReport = (userId: number) => {
    const u = allUsers.find((usr: any) => usr.id === Number(userId));
    if (!u) return null;
    const userTickets = filteredTickets.filter((t: any) => t.userId === Number(userId));
    const userSales = userTickets.reduce((sum: number, t: any) => sum + Number(t.total), 0);
    const userCommission = userSales * (Number(u.commission || 0) / 100);
    const userLog = filteredAudit.filter((l) => l.userId === Number(userId));
    const creditAdded = userLog.filter((l) => l.type === "credit_add").reduce((sum, l) => sum + l.amount, 0);
    const creditDeducted = userLog.filter((l) => l.type === "credit_deduct").reduce((sum, l) => sum + l.amount, 0);
    const ticketsAnnulled = userLog.filter((l) => l.type === "ticket_annul").length;
    const prizesWon = userLog.filter((l) => l.type === "prize_win").reduce((sum, l) => sum + l.amount, 0);
    return { user: u, tickets: userTickets, sales: userSales, commission: userCommission, creditAdded, creditDeducted, ticketsAnnulled, prizesWon, log: userLog };
  };

  // Group report data
  const groupReport = (groupId: number) => {
    const g = allGroups.find((grp: any) => grp.id === Number(groupId));
    if (!g) return null;
    const groupUsers = allUsers.filter((u: any) => u.groupId === Number(groupId));
    const groupUserIds = groupUsers.map((u: any) => u.id);
    const groupTickets = filteredTickets.filter((t: any) => groupUserIds.includes(t.userId));
    const groupSales = groupTickets.reduce((sum: number, t: any) => sum + Number(t.total), 0);
    const groupCommission = groupTickets.reduce((sum: number, t: any) => sum + (Number(t.total) * (Number(t.commission || 0) / 100)), 0);
    const groupLog = filteredAudit.filter((l) => groupUserIds.includes(l.userId));
    return { group: g, users: groupUsers, tickets: groupTickets, sales: groupSales, commission: groupCommission, log: groupLog };
  };

  // My history
  const myLog = filteredAudit.filter((l) => l.userId === user.id);
  const myCreditAdded = myLog.filter((l) => l.type === "credit_add").reduce((sum, l) => sum + l.amount, 0);
  const myCreditDeducted = myLog.filter((l) => l.type === "credit_deduct").reduce((sum, l) => sum + l.amount, 0);
  const myAnnulled = myLog.filter((l) => l.type === "ticket_annul").length;
  const myPrizes = myLog.filter((l) => l.type === "prize_win").reduce((sum, l) => sum + l.amount, 0);
  const myCommissionLost = myLog.filter((l) => l.type === "ticket_annul").length > 0
    ? myLog.filter((l) => l.type === "ticket_annul").reduce((sum, l) => sum + (l.amount * (Number(user.commission) || 0) / 100), 0)
    : 0;

  const renderLogEntry = (entry: AuditEntry) => {
    const typeColors: Record<string, string> = {
      credit_add: "bg-green-100 text-green-700",
      credit_deduct: "bg-red-100 text-red-700",
      ticket_sale: "bg-blue-100 text-blue-700",
      ticket_annul: "bg-orange-100 text-orange-700",
      prize_win: "bg-yellow-100 text-yellow-700",
    };
    const typeLabels: Record<string, string> = {
      credit_add: "Credito +",
      credit_deduct: "Credito -",
      ticket_sale: "Venta",
      ticket_annul: "Anulado",
      prize_win: "Premio",
    };
    return (
      <div key={entry.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg text-xs">
        <span className={`px-2 py-0.5 rounded-full font-bold shrink-0 ${typeColors[entry.type] || "bg-gray-100"}`}>{typeLabels[entry.type] || entry.type}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{entry.description}</p>
          <p className="text-gray-400">{entry.date} {entry.time}</p>
        </div>
        {entry.amount > 0 && <span className={`font-bold shrink-0 ${entry.type === "credit_deduct" || entry.type === "ticket_annul" ? "text-red-600" : "text-green-700"}`}>${formatMoney(entry.amount)}</span>}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Reportes</h2>

      {/* Date Filters */}
      <div className="bg-white rounded-xl border border-green-100 p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Filter size={14} className="text-green-600" />
          <span className="text-xs font-bold text-green-700">Filtro por Fecha</span>
        </div>
        <div className="flex gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="flex-1 px-2 py-1.5 border border-green-200 rounded-lg text-xs" placeholder="Desde" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="flex-1 px-2 py-1.5 border border-green-200 rounded-lg text-xs" placeholder="Hasta" />
          {(fromDate || toDate) && <button onClick={() => { setFromDate(""); setToDate(""); }} className="px-2 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">Limpiar</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setTab("resumen")} className={`flex-1 py-1.5 rounded-md text-xs font-bold ${tab === "resumen" ? "bg-white text-green-700 shadow" : "text-gray-500"}`}>Resumen</button>
        {isAdmin && <button onClick={() => setTab("por_usuario")} className={`flex-1 py-1.5 rounded-md text-xs font-bold ${tab === "por_usuario" ? "bg-white text-green-700 shadow" : "text-gray-500"}`}>Por Usuario</button>}
        {isAdmin && <button onClick={() => setTab("por_grupo")} className={`flex-1 py-1.5 rounded-md text-xs font-bold ${tab === "por_grupo" ? "bg-white text-green-700 shadow" : "text-gray-500"}`}>Por Grupo</button>}
        {isAdmin && <button onClick={() => setTab("ganancias")} className={`flex-1 py-1.5 rounded-md text-xs font-bold ${tab === "ganancias" ? "bg-white text-green-700 shadow" : "text-gray-500"}`}>G/P</button>}
        <button onClick={() => setTab("historial")} className={`flex-1 py-1.5 rounded-md text-xs font-bold ${tab === "historial" ? "bg-white text-green-700 shadow" : "text-gray-500"}`}>Historial</button>
      </div>

      {/* ===== RESUMEN ===== */}
      {tab === "resumen" && (
        <>
          {/* Personal Summary */}
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2"><Receipt size={16} /> Mi Resumen</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-lg font-extrabold text-green-700">{myTickets.length}</p><p className="text-[10px] text-gray-600">Tickets Activos</p></div>
              <div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-lg font-extrabold text-green-700">${formatMoney(totalSales)}</p><p className="text-[10px] text-gray-600">Ventas Netas</p></div>
              <div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-lg font-extrabold text-green-700">${formatMoney(myCommission)}</p><p className="text-[10px] text-gray-600">Mi Comision</p></div>
            </div>
          </div>

          {/* My Credit History */}
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2"><DollarSign size={16} /> Mi Credito</h3>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-2 bg-green-50 rounded-lg"><p className="text-sm font-extrabold text-green-700">${formatMoney(myCreditAdded)}</p><p className="text-[9px] text-gray-600">Agregado</p></div>
              <div className="text-center p-2 bg-red-50 rounded-lg"><p className="text-sm font-extrabold text-red-600">${formatMoney(myCreditDeducted)}</p><p className="text-[9px] text-gray-600">Descontado</p></div>
              <div className="text-center p-2 bg-yellow-50 rounded-lg"><p className="text-sm font-extrabold text-yellow-700">${formatMoney(myPrizes)}</p><p className="text-[9px] text-gray-600">Premios</p></div>
              <div className="text-center p-2 bg-orange-50 rounded-lg"><p className="text-sm font-extrabold text-orange-600">{myAnnulled}</p><p className="text-[9px] text-gray-600">Anulados</p></div>
            </div>
          </div>

          {/* Admin Dashboard */}
          {isAdmin && (
            <>
              <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-5 text-white shadow-lg">
                <h3 className="text-sm font-bold mb-3">Dashboard General</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-lg p-3"><p className="text-2xl font-extrabold">{allUsers.length}</p><p className="text-[10px] text-green-200">Usuarios</p></div>
                  <div className="bg-white/10 rounded-lg p-3"><p className="text-2xl font-extrabold">{allGroups.length}</p><p className="text-[10px] text-green-200">Grupos</p></div>
                  <div className="bg-white/10 rounded-lg p-3"><p className="text-2xl font-extrabold">{allLotteries.length}</p><p className="text-[10px] text-green-200">Loterias</p></div>
                  <div className="bg-white/10 rounded-lg p-3"><p className="text-2xl font-extrabold">{activeTickets.length}</p><p className="text-[10px] text-green-200">Tickets Activos</p></div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-green-700 mb-3">Ventas Totales (Activas)</h3>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div><p className="text-xs text-gray-600">Total en Ventas</p><p className="text-2xl font-extrabold text-green-700">${formatMoney(totalAllSales)}</p><p className="text-[10px] text-gray-500 mt-1">Comisiones: ${formatMoney(totalCommission)}</p></div>
                  <Receipt size={32} className="text-green-600" />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ===== POR USUARIO ===== */}
      {tab === "por_usuario" && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-green-100 p-3 shadow-sm">
            <label className="text-xs font-bold text-green-700 mb-1 block">Seleccionar Vendedor</label>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm">
              <option value="">-- Seleccionar --</option>
              {allUsers.filter((u: any) => u.role !== "admin").map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.bankNumber})</option>)}
            </select>
          </div>

          {selectedUserId && (() => {
            const rep = userReport(Number(selectedUserId));
            if (!rep) return <p className="text-sm text-gray-400 text-center">Seleccione un usuario</p>;
            return (
              <>
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-lg">
                  <h3 className="text-sm font-bold mb-3">{rep.user.name} ({rep.user.bankNumber})</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/10 rounded-lg p-3"><p className="text-xl font-extrabold">{rep.tickets.length}</p><p className="text-[10px] text-blue-200">Tickets Activos</p></div>
                    <div className="bg-white/10 rounded-lg p-3"><p className="text-xl font-extrabold">${formatMoney(rep.sales)}</p><p className="text-[10px] text-blue-200">Ventas</p></div>
                    <div className="bg-white/10 rounded-lg p-3"><p className="text-xl font-extrabold">${formatMoney(rep.commission)}</p><p className="text-[10px] text-blue-200">Comision ({rep.user.commission || 0}%)</p></div>
                    <div className="bg-white/10 rounded-lg p-3"><p className="text-xl font-extrabold">{rep.ticketsAnnulled}</p><p className="text-[10px] text-blue-200">Anulados</p></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-xl border border-green-100 p-3 text-center shadow-sm"><TrendingUp size={16} className="mx-auto text-green-600 mb-1" /><p className="text-sm font-extrabold text-green-700">${formatMoney(rep.creditAdded)}</p><p className="text-[9px] text-gray-500">Credito Agregado</p></div>
                  <div className="bg-white rounded-xl border border-red-100 p-3 text-center shadow-sm"><TrendingDown size={16} className="mx-auto text-red-500 mb-1" /><p className="text-sm font-extrabold text-red-600">${formatMoney(rep.creditDeducted)}</p><p className="text-[9px] text-gray-500">Credito Descontado</p></div>
                  <div className="bg-white rounded-xl border border-yellow-100 p-3 text-center shadow-sm"><Award size={16} className="mx-auto text-yellow-600 mb-1" /><p className="text-sm font-extrabold text-yellow-700">${formatMoney(rep.prizesWon)}</p><p className="text-[9px] text-gray-500">Premios Ganados</p></div>
                  <div className="bg-white rounded-xl border border-green-100 p-3 text-center shadow-sm"><DollarSign size={16} className="mx-auto text-green-600 mb-1" /><p className="text-sm font-extrabold text-green-700">${formatMoney(rep.sales - rep.commission)}</p><p className="text-[9px] text-gray-500">Ganancia Neta</p></div>
                </div>
                {rep.log.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-gray-900">Historial</h4>
                    {rep.log.slice(0, 20).map(renderLogEntry)}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ===== POR GRUPO ===== */}
      {tab === "por_grupo" && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-green-100 p-3 shadow-sm">
            <label className="text-xs font-bold text-green-700 mb-1 block">Seleccionar Grupo</label>
            <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm">
              <option value="">-- Seleccionar --</option>
              {allGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {selectedGroupId && (() => {
            const rep = groupReport(Number(selectedGroupId));
            if (!rep) return <p className="text-sm text-gray-400 text-center">Seleccione un grupo</p>;
            return (
              <>
                <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-5 text-white shadow-lg">
                  <h3 className="text-sm font-bold mb-3">{rep.group.name}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/10 rounded-lg p-3"><p className="text-xl font-extrabold">{rep.users.length}</p><p className="text-[10px] text-purple-200">Miembros</p></div>
                    <div className="bg-white/10 rounded-lg p-3"><p className="text-xl font-extrabold">{rep.tickets.length}</p><p className="text-[10px] text-purple-200">Tickets Activos</p></div>
                    <div className="bg-white/10 rounded-lg p-3"><p className="text-xl font-extrabold">${formatMoney(rep.sales)}</p><p className="text-[10px] text-purple-200">Ventas Totales</p></div>
                    <div className="bg-white/10 rounded-lg p-3"><p className="text-xl font-extrabold">${formatMoney(rep.commission)}</p><p className="text-[10px] text-purple-200">Comisiones</p></div>
                  </div>
                </div>

                {/* Users in group */}
                <h4 className="text-sm font-bold text-gray-900">Vendedores del Grupo</h4>
                {rep.users.map((u: any) => {
                  const uRep = userReport(u.id);
                  if (!uRep) return null;
                  return (
                    <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-900">{u.name} <span className="text-[10px] text-gray-500">({u.bankNumber})</span></p>
                        <span className="text-xs font-bold text-green-700">${formatMoney(uRep.sales)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-green-50 rounded p-1"><p className="text-xs font-bold text-green-700">{uRep.tickets.length}</p><p className="text-[8px] text-gray-500">Tickets</p></div>
                        <div className="bg-blue-50 rounded p-1"><p className="text-xs font-bold text-blue-700">${formatMoney(uRep.commission)}</p><p className="text-[8px] text-gray-500">Comision</p></div>
                        <div className="bg-yellow-50 rounded p-1"><p className="text-xs font-bold text-yellow-700">${formatMoney(uRep.prizesWon)}</p><p className="text-[8px] text-gray-500">Premios</p></div>
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}

      {/* ===== GANANCIAS/PERDIDAS ===== */}
      {tab === "ganancias" && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2"><BarChart3 size={16} /> Reporte Ganancia/Perdida</h3>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm mb-3" />
            <div className="space-y-3">
              {(winnerReport.data || []).length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay datos para esta fecha</p>}
              {(winnerReport.data || []).map((r: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">Loteria #{r.lotteryId}</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${r.netResult >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.netResult >= 0 ? "GANANCIA" : "PERDIDA"}</span>
                  </div>
                  <div className="flex gap-2">
                    {r.winningNumbers.map((n: string, j: number) => (
                      <span key={j} className={`px-2 py-1 rounded text-xs font-bold ${j === 0 ? "bg-yellow-100 text-yellow-700" : j === 1 ? "bg-gray-100 text-gray-700" : "bg-orange-100 text-orange-700"}`}>{n}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white rounded p-2"><p className="text-xs font-bold text-green-700">${formatMoney(r.totalSales)}</p><p className="text-[8px] text-gray-500">Ventas</p></div>
                    <div className="bg-white rounded p-2"><p className="text-xs font-bold text-red-600">${formatMoney(r.totalPrizes)}</p><p className="text-[8px] text-gray-500">Premios</p></div>
                    <div className="bg-white rounded p-2"><p className={`text-xs font-bold ${r.netResult >= 0 ? "text-green-700" : "text-red-600"}`}>${formatMoney(Math.abs(r.netResult))}</p><p className="text-[8px] text-gray-500">{r.netResult >= 0 ? "Ganancia" : "Perdida"}</p></div>
                  </div>
                  {r.winningTickets.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-600">Tickets Ganadores:</p>
                      {r.winningTickets.map((wt: any, j: number) => (
                        <div key={j} className="flex justify-between text-xs bg-white rounded p-1.5">
                          <span className="text-gray-700">{wt.ticketCode} - {wt.sellerName}</span>
                          <span className="font-bold text-green-700">${formatMoney(wt.prize)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== HISTORIAL ===== */}
      {tab === "historial" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">{isAdmin ? "Historial Global" : "Mi Historial"}</h3>
            <span className="text-[10px] text-gray-500">{filteredAudit.length} registro(s)</span>
          </div>
          {filteredAudit.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Sin registros</p>}
          {filteredAudit.map(renderLogEntry)}
        </div>
      )}
    </div>
  );
}
