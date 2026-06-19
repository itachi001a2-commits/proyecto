import { useState } from "react";
import type { SessionUser } from "@/store"
import { formatMoney, logAudit, calculateNetDeduction } from "@/store";
import { trpc } from "@/providers/trpc";
import { Receipt, Search, X, ChevronRight, Ban, Share2, Clock, FileText, Copy, QrCode, CheckCircle } from "lucide-react";

interface TicketsScreenProps {
  user: SessionUser;
}

const ANNUL_WINDOW_MS = 5 * 60 * 1000;

function getTimeElapsed(createdAt: string): { elapsedMs: number; canAnnul: boolean; timeLeft: string } {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsedMs = now - created;
  const remainingMs = Math.max(0, ANNUL_WINDOW_MS - elapsedMs);
  const canAnnul = remainingMs > 0;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const timeLeft = remainingMs > 0 ? `${mins}m ${secs}s` : "Expirado";
  return { elapsedMs, canAnnul, timeLeft };
}

export default function TicketsScreen({ user }: TicketsScreenProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [copyCode, setCopyCode] = useState("");
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validateCode, setValidateCode] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);

  const isAdmin = user.role === "admin" || user.role === "supervisor";

  // tRPC hooks
  const utils = trpc.useUtils();
  const trpcUsers = trpc.lotteryUser.list.useQuery();
  const trpcTickets = trpc.ticket.list.useQuery(
    isAdmin ? undefined : { userId: user.id }
  );
  const annulTicketMut = trpc.ticket.annul.useMutation({
    onSuccess: () => { utils.ticket.list.invalidate(); },
  });
  const updateCreditMut = trpc.lotteryUser.updateCredit.useMutation({
    onSuccess: () => utils.lotteryUser.list.invalidate(),
  });
  const ticketWithPlays = trpc.ticket.withPlays.useQuery(
    { id: selectedTicket?.id || 0 },
    { enabled: !!selectedTicket }
  );
  const ticketByCode = trpc.ticket.byCode.useQuery(
    { code: copyCode },
    { enabled: false }
  );
  const validateTicket = trpc.ticket.validate.useQuery(
    { code: validateCode },
    { enabled: false }
  );
  const createTicketMut = trpc.ticket.create.useMutation({
    onSuccess: () => { utils.ticket.list.invalidate(); setMsg("Ticket copiado!"); setTimeout(() => setMsg(""), 3000); },
    onError: (err: any) => { setMsg("Error: " + err.message); setTimeout(() => setMsg(""), 3000); },
  });

  const users = trpcUsers.data || [];
  const allTickets = trpcTickets.data || [];

  const filtered = allTickets.filter((t: any) => {
    const matchCode = t.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || t.status === filterStatus;
    const matchUser = !filterUser || t.userId === Number(filterUser);
    return matchCode && matchStatus && matchUser;
  });

  const annulTicket = async (ticket: any) => {
    if (!isAdmin) {
      const { canAnnul, timeLeft } = getTimeElapsed(ticket.createdAt);
      if (!canAnnul) { setMsg("Solo puedes anular dentro de 5 minutos"); setTimeout(() => setMsg(""), 3000); return; }
      if (!confirm(`Anular este ticket? Tiempo restante: ${timeLeft}`)) return;
    } else {
      if (!confirm("Anular este ticket?")) return;
    }

    // Calculate what was actually deducted from seller's credit (total - commission)
    const total = Number(ticket.total) || 0;
    const commission = Number(ticket.commission || 0);
    const netDeduction = calculateNetDeduction(total, commission);
    const commissionKept = total - netDeduction;

    try {
      // Recover only the net deduction (what was actually taken from credit), NOT the full total
      const targetUser = users.find((u: any) => u.id === ticket.userId);
      if (targetUser) {
        const currentCredit = Number(targetUser.credit) || 0;
        const newCredit = currentCredit + netDeduction;
        await updateCreditMut.mutateAsync({ id: ticket.userId, credit: String(newCredit) });
      }

      // Annul ticket via API
      await annulTicketMut.mutateAsync({ id: ticket.id, annulledBy: user.id });

      logAudit({ type: "ticket_annul", userId: ticket.userId, userName: ticket.seller || "", groupId: user.groupId, amount: total, description: `Ticket anulado: ${ticket.code} | Recuperado: $${formatMoney(netDeduction)} (comision $${formatMoney(commissionKept)} retenida)`, ticketCode: ticket.code });

      setSelectedTicket(null);
      utils.ticket.list.invalidate();
      setMsg(`Ticket anulado! Credito de $${formatMoney(netDeduction)} recuperado.`);
      setTimeout(() => setMsg(""), 3000);
    } catch (err: any) {
      setMsg("Error al anular: " + (err.message || "Intente de nuevo"));
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const downloadTicketPDF = (ticket: any) => {
    if (ticket.pdfDataUrl) {
      window.open(ticket.pdfDataUrl, "_blank");
    } else {
      setMsg("PDF no disponible");
      setTimeout(() => setMsg(""), 2000);
    }
  };

  const shareWhatsApp = (ticket: any) => {
    const lines = (ticket.plays || []).map((p: any) => `${p.number} - ${p.type.toUpperCase()} - $${formatMoney(p.amount)}`).join("\n");
    const groupName = ticket.groupName || "";
    const appName = groupName || "BANCA VICTORIA";
    const subLine = groupName ? "\n_Banca Victoria_" : "";
    const text = `*${appName}*${subLine}\nTicket: *${ticket.code}*\nFecha: ${ticket.date || new Date(ticket.createdAt).toLocaleDateString()}\nHora: ${ticket.time || new Date(ticket.createdAt).toLocaleTimeString()}\nTerminal: ${ticket.terminal}\nVendedor: ${ticket.seller}\nLoteria: ${ticket.lottery}\n\n*JUGADAS:*\n${lines}\n\n*Total: $${formatMoney(ticket.total)}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const getSellerName = (userId: number) => {
    const u = users.find((usr: any) => usr.id === userId);
    return u ? `${u.name} (${u.bankNumber})` : `Usuario #${userId}`;
  };

  const copyTicketByCode = async () => {
    if (!copyCode.trim()) { setMsg("Ingrese un codigo"); setTimeout(() => setMsg(""), 3000); return; }
    try {
      const result = await ticketByCode.refetch({ queryKey: ["ticket.byCode", { code: copyCode.trim() }] } as any);
      const data = result.data;
      if (!data || !data.ticket) { setMsg("Ticket no encontrado"); setTimeout(() => setMsg(""), 3000); return; }
      // Copy plays to a new ticket
      const t = data.ticket;
      const tPlays = data.plays || [];
      if (tPlays.length === 0) { setMsg("El ticket no tiene jugadas"); setTimeout(() => setMsg(""), 3000); return; }
      const code = `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const playList = tPlays.map((p: any) => ({
        number: p.number,
        amount: String(p.amount),
        type: p.type,
        lotteryId: p.lotteryId,
      }));
      await createTicketMut.mutateAsync({
        code,
        userId: user.id,
        lotteryId: t.lotteryId,
        total: t.total,
        playList,
      });
      setCopyCode("");
      setShowCopyModal(false);
    } catch (err: any) {
      setMsg("Error: " + (err.message || "No se pudo copiar"));
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const validateTicketByCode = async () => {
    if (!validateCode.trim()) { setMsg("Ingrese codigo"); setTimeout(() => setMsg(""), 3000); return; }
    try {
      const result = await validateTicket.refetch({ queryKey: ["ticket.validate", { code: validateCode.trim() }] } as any);
      setValidationResult(result.data || { valid: false, reason: "Error" });
    } catch {
      setValidationResult({ valid: false, reason: "Error de conexion" });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-4 shrink-0 space-y-3">
        <h2 className="text-xl font-bold text-gray-900">Tickets</h2>
        {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}

        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-green-200 rounded-xl focus:outline-none focus:border-green-500 bg-white text-sm" placeholder="Buscar por codigo..." />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={16} className="text-gray-400" /></button>}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setShowCopyModal(true)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1"><Copy size={14} /> Copiar</button>
          <button onClick={() => setShowValidateModal(true)} className="flex-1 py-2 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-100 flex items-center justify-center gap-1"><CheckCircle size={14} /> Validar</button>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm">
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="cancelled">Anulados</option>
            </select>
            <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm">
              <option value="">Todos los vendedores</option>
              {users.filter((u: any) => u.role !== "admin").map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400"><Receipt size={48} className="mb-3 text-green-200" /><p className="text-sm">No hay tickets</p></div>
        ) : (
          filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((ticket: any) => {
            const { canAnnul, timeLeft } = getTimeElapsed(ticket.createdAt);
            return (
              <button key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="w-full bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center justify-between hover:border-green-300 transition-colors text-left">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{ticket.code}</p>
                  <p className="text-[10px] text-gray-500">{new Date(ticket.createdAt).toLocaleDateString()} {new Date(ticket.createdAt).toLocaleTimeString()}</p>
                  {isAdmin && <p className="text-[10px] text-blue-600 font-medium">{getSellerName(ticket.userId)}</p>}
                  {!isAdmin && ticket.status === "active" && (
                    <p className={`text-[10px] font-medium ${canAnnul ? "text-yellow-600" : "text-red-400"}`}>
                      <Clock size={10} className="inline mr-0.5" />{canAnnul ? `Anular: ${timeLeft}` : "No anulable"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-700">${formatMoney(ticket.total)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ticket.status === "active" ? "bg-green-100 text-green-700" : ticket.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>{ticket.status}</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedTicket && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-2xl shadow-2xl w-full max-h-[80%] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div><h3 className="font-bold text-lg">{selectedTicket.code}</h3><p className="text-xs text-gray-500">{new Date(selectedTicket.createdAt).toLocaleString()}</p></div>
              <button onClick={() => setSelectedTicket(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-1">
                {isAdmin && <div className="flex justify-between text-xs"><span className="text-gray-500">Vendedor:</span><span className="font-medium text-gray-900">{getSellerName(selectedTicket.userId)}</span></div>}
                <div className="flex justify-between text-xs"><span className="text-gray-500">Loteria ID:</span><span className="font-medium text-gray-900">#{selectedTicket.lotteryId}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Terminal:</span><span className="font-medium text-gray-900">{user.bankNumber}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Estado:</span><span className={`font-medium ${selectedTicket.status === "active" ? "text-green-700" : "text-red-600"}`}>{selectedTicket.status}</span></div>
              </div>

              <div className="flex items-center justify-between mb-3 p-3 bg-green-50 rounded-lg"><span className="text-sm font-medium text-gray-700">Total</span><span className="text-xl font-extrabold text-green-700">${formatMoney(selectedTicket.total || 0)}</span></div>

              <h4 className="text-sm font-bold text-gray-900 mb-2">Jugadas</h4>
              <div className="space-y-2">
                {(ticketWithPlays.data?.plays || selectedTicket.plays || []).map((play: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2"><span className="text-sm font-bold text-gray-900">{play.number}</span><span className="text-[10px] text-green-600 uppercase bg-green-100 px-1.5 py-0.5 rounded">{play.type}</span></div>
                    <span className="text-sm font-bold text-green-700">${formatMoney(play.amount)}</span>
                  </div>
                ))}
              </div>

              {selectedTicket.status === "active" && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => shareWhatsApp(selectedTicket)} className="flex-1 py-2.5 bg-green-100 text-green-600 rounded-lg text-sm font-bold hover:bg-green-200 flex items-center justify-center gap-2"><Share2 size={16} /> WhatsApp</button>
                  {isAdmin ? (
                    <button onClick={() => annulTicket(selectedTicket)} className="flex-1 py-2.5 bg-red-100 text-red-600 rounded-lg text-sm font-bold hover:bg-red-200 flex items-center justify-center gap-2"><Ban size={16} /> Anular</button>
                  ) : (
                    (() => {
                      const { canAnnul, timeLeft } = getTimeElapsed(selectedTicket.createdAt);
                      return (
                        <button onClick={() => annulTicket(selectedTicket)} disabled={!canAnnul}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${canAnnul ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
                          <Ban size={16} /> {canAnnul ? `Anular (${timeLeft})` : "Expirado"}
                        </button>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Copy Ticket Modal */}
      {showCopyModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="font-bold text-lg text-gray-900 text-center mb-3">Copiar Ticket</h3>
            <p className="text-xs text-gray-500 text-center mb-3">Ingrese el codigo del ticket que desea copiar</p>
            <input value={copyCode} onChange={(e) => setCopyCode(e.target.value)} placeholder="Ej: TKT-ABC123" className="w-full px-4 py-3 border border-blue-200 rounded-xl text-sm font-bold mb-3" />
            <div className="flex gap-2">
              <button onClick={() => { setShowCopyModal(false); setCopyCode(""); }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm">Cancelar</button>
              <button onClick={copyTicketByCode} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2"><Copy size={16} /> Copiar</button>
            </div>
          </div>
        </div>
      )}

      {/* Validate Ticket Modal */}
      {showValidateModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="font-bold text-lg text-gray-900 text-center mb-3">Validar Ticket</h3>
            <p className="text-xs text-gray-500 text-center mb-3">Verifique si un ticket es valido y esta dentro del periodo permitido</p>
            <input value={validateCode} onChange={(e) => setValidateCode(e.target.value)} placeholder="Codigo del ticket" className="w-full px-4 py-3 border border-purple-200 rounded-xl text-sm font-bold mb-3" />
            <button onClick={validateTicketByCode} className="w-full py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 mb-3">Validar</button>
            {validationResult && (
              <div className={`rounded-xl p-3 text-center ${validationResult.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                {validationResult.valid ? (
                  <>
                    <CheckCircle size={24} className="mx-auto text-green-600 mb-1" />
                    <p className="text-sm font-bold text-green-700">Ticket VALIDO</p>
                    {validationResult.warning && <p className="text-xs text-yellow-600 mt-1">{validationResult.warning}</p>}
                  </>
                ) : (
                  <>
                    <X size={24} className="mx-auto text-red-600 mb-1" />
                    <p className="text-sm font-bold text-red-700">{validationResult.reason || "Invalido"}</p>
                  </>
                )}
              </div>
            )}
            <button onClick={() => { setShowValidateModal(false); setValidateCode(""); setValidationResult(null); }} className="w-full mt-3 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
