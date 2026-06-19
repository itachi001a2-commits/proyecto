import { useState } from "react";
import type { SessionUser } from "@/store";
import { formatMoney, logAudit, calculateNetDeduction } from "@/store";
import { trpc } from "@/providers/trpc";
import {
  Ticket, Users, Plus, ArrowLeft, Trash2,
  Settings, Trophy, Ban, BarChart3, ChevronRight, X, DollarSign, Wallet, Percent,
  ChevronLeft, UserPlus, Pencil, Shield, Lock
} from "lucide-react";

type AdminSection = "menu" | "loterias" | "grupos" | "usuarios" | "premios" | "ganadores" | "anular" | "reportes" | "limites" | "config";

interface AdminPanelProps {
  user: SessionUser;
}

const MENU_ITEMS = [
  { id: "loterias" as AdminSection, label: "Loterias", icon: Ticket, desc: "Gestionar loterias" },
  { id: "grupos" as AdminSection, label: "Grupos", icon: Users, desc: "Crear y editar grupos" },
  { id: "usuarios" as AdminSection, label: "Usuarios", icon: Users, desc: "Crear y gestionar usuarios" },
  { id: "premios" as AdminSection, label: "Premios", icon: DollarSign, desc: "Configurar premios por tipo" },
  { id: "ganadores" as AdminSection, label: "Ganadores", icon: Trophy, desc: "Numeros ganadores" },
  { id: "anular" as AdminSection, label: "Anular Tickets", icon: Ban, desc: "Anular tickets" },
  { id: "reportes" as AdminSection, label: "Reportes", icon: BarChart3, desc: "Ver reportes" },
  { id: "limites" as AdminSection, label: "Limites", icon: Ban, desc: "Limites y bloqueos de jugadas" },
  { id: "config" as AdminSection, label: "Configuracion", icon: Settings, desc: "Ajustes del sistema" },
];

export default function AdminPanel({ user: _user }: AdminPanelProps) {
  const [section, setSection] = useState<AdminSection>("menu");
  return (
    <div className="h-full flex flex-col">
      {section === "menu" ? (
        <MenuScreen onNavigate={setSection} />
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
            <button onClick={() => setSection("menu")} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <h2 className="text-lg font-bold text-gray-900">
              {MENU_ITEMS.find((m) => m.id === section)?.label}
            </h2>
          </div>
          {section === "loterias" && <LoteriasSection />}
          {section === "grupos" && <GruposSection />}
          {section === "usuarios" && <UsuariosSection />}
          {section === "premios" && <PremiosSection />}
          {section === "ganadores" && <GanadoresSection />}
          {section === "anular" && <AnularSection />}
          {section === "reportes" && <ReportesGrupoSection />}
          {section === "limites" && <LimitesSection />}
          {section === "config" && <ConfigSection />}
        </div>
      )}
    </div>
  );
}

function MenuScreen({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 py-4 space-y-2">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Panel de Administracion</h2>
      {MENU_ITEMS.map((item) => (
        <button key={item.id} onClick={() => onNavigate(item.id)}
          className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-green-300 shadow-sm transition-all text-left">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <item.icon size={20} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">{item.label}</p>
            <p className="text-xs text-gray-500">{item.desc}</p>
          </div>
          <ChevronRight size={16} className="text-gray-300 shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ─── LOTERIAS ──────────────────────────────────────────────────────
const DAY_LABELS: Record<string, string> = { mon: "Lun", tue: "Mar", wed: "Mie", thu: "Jue", fri: "Vie", sat: "Sab", sun: "Dom" };

function LoteriasSection() {
  const utils = trpc.useUtils();
  const lotteryList = trpc.lottery.list.useQuery();
  const createLottery = trpc.lottery.create.useMutation({ onSuccess: () => utils.lottery.list.invalidate() });
  const updateLottery = trpc.lottery.update.useMutation({ onSuccess: () => utils.lottery.list.invalidate() });
  const deleteLottery = trpc.lottery.delete.useMutation({ onSuccess: () => utils.lottery.list.invalidate() });

  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [drawTime, setDrawTime] = useState("12:00");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<Record<number, Record<string, { open: string; close: string }>>>({});
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const lotteries = lotteryList.data || [];

  const getSchedule = (l: any): Record<string, { open: string; close: string }> => {
    if (schedules[l.id]) return schedules[l.id];
    if (l.schedule) { try { return JSON.parse(l.schedule); } catch { } }
    return { mon: { open: "06:00", close: l.closeTime || "20:00" }, tue: { open: "06:00", close: l.closeTime || "20:00" }, wed: { open: "06:00", close: l.closeTime || "20:00" }, thu: { open: "06:00", close: l.closeTime || "20:00" }, fri: { open: "06:00", close: l.closeTime || "20:00" }, sat: { open: "06:00", close: l.closeTime || "20:00" }, sun: { open: "06:00", close: l.closeTime || "20:00" } };
  };

  const updateSchedule = (lotteryId: number, day: string, field: "open" | "close", value: string) => {
    setSchedules(prev => {
      const current = prev[lotteryId] || getSchedule(lotteries.find((l: any) => l.id === lotteryId));
      return { ...prev, [lotteryId]: { ...current, [day]: { ...current[day], [field]: value } } };
    });
  };

  const saveSchedule = (lotteryId: number) => {
    const sched = schedules[lotteryId];
    if (sched) {
      updateLottery.mutate({ id: lotteryId, schedule: JSON.stringify(sched) }, {
        onSuccess: () => showMsg("Horarios guardados!"),
        onError: (err) => showMsg("Error: " + err.message),
      });
    }
  };

  const add = () => {
    if (!name) { showMsg("Ingrese nombre"); return; }
    const defaultSched = JSON.stringify({
      mon: { open: "06:00", close: drawTime }, tue: { open: "06:00", close: drawTime }, wed: { open: "06:00", close: drawTime },
      thu: { open: "06:00", close: drawTime }, fri: { open: "06:00", close: drawTime }, sat: { open: "06:00", close: drawTime }, sun: { open: "06:00", close: drawTime },
    });
    createLottery.mutate({ name, drawTime, openTime: "06:00", closeTime: drawTime, schedule: defaultSched }, {
      onSuccess: () => { setName(""); showMsg("Loteria creada!"); },
      onError: (err) => showMsg("Error: " + err.message),
    });
  };

  const toggle = (id: number, current: boolean) => {
    updateLottery.mutate({ id, active: !current });
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}
      <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-green-700">Nueva Loteria</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
        <input type="time" value={drawTime} onChange={(e) => setDrawTime(e.target.value)} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
        <button onClick={add} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2">
          <Plus size={16} /> Crear
        </button>
      </div>
      <div className="space-y-3">
        {lotteries.map((l: any) => (
          <div key={l.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">{l.name}</p>
                <p className="text-[10px] text-gray-500">Sorteo: {l.drawTime}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggle(l.id, l.active)} className={`px-2 py-1 rounded text-[10px] font-bold ${l.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {l.active ? "Activa" : "Inactiva"}
                </button>
                <button onClick={() => setExpandedId(expandedId === l.id ? null : l.id)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500">
                  <Settings size={14} />
                </button>
                <button onClick={() => { if (confirm("Eliminar?")) deleteLottery.mutate({ id: l.id }); }} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={16} className="text-red-500" /></button>
              </div>
            </div>
            {expandedId === l.id && (
              <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                <p className="text-xs font-bold text-blue-700 mb-2">Horarios por dia de semana</p>
                <div className="space-y-1.5">
                  {Object.entries(DAY_LABELS).map(([day, label]) => {
                    const sched = getSchedule(l);
                    return (
                      <div key={day} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold w-8 text-gray-600">{label}</span>
                        <input type="time" value={sched[day]?.open || "06:00"} onChange={(e) => updateSchedule(l.id, day, "open", e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded" />
                        <span className="text-gray-400 text-xs">a</span>
                        <input type="time" value={sched[day]?.close || "20:00"} onChange={(e) => updateSchedule(l.id, day, "close", e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded" />
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => saveSchedule(l.id)} className="w-full mt-2 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">Guardar Horarios</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GRUPOS ────────────────────────────────────────────────────────
function GruposSection() {
  const utils = trpc.useUtils();
  const groupList = trpc.group.list.useQuery();
  const createGroup = trpc.group.create.useMutation({ onSuccess: () => utils.group.list.invalidate() });
  const updateGroup = trpc.group.update.useMutation({ onSuccess: () => { utils.group.list.invalidate(); utils.lotteryUser.list.invalidate(); } });
  const deleteGroup = trpc.group.delete.useMutation({ onSuccess: () => utils.group.list.invalidate() });
  const userList = trpc.lotteryUser.list.useQuery();
  const updateUser = trpc.lotteryUser.update.useMutation({ onSuccess: () => utils.lotteryUser.list.invalidate() });
  const updateCredit = trpc.lotteryUser.updateCredit.useMutation({ onSuccess: () => utils.lotteryUser.list.invalidate() });

  const [msg, setMsg] = useState("");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const [name, setName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [editMemberData, setEditMemberData] = useState({ name: "", username: "", password: "", phone: "", role: "user", credit: "", commission: "", active: true });
  const [creditModal, setCreditModal] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditAction, setCreditAction] = useState<"add" | "subtract">("add");

  const groups = groupList.data || [];
  const allUsers = userList.data || [];
  const roleLabels: Record<string, string> = { admin: "Admin", supervisor: "Supervisor", collector: "Cobrador", user: "Vendedor" };

  const add = () => {
    if (!name) { showMsg("Ingrese un nombre"); return; }
    createGroup.mutate({ name, maxSalesPerDay: "50000" }, {
      onSuccess: () => { setName(""); showMsg("Grupo creado!"); },
      onError: (err) => showMsg("Error: " + err.message),
    });
  };

  const updateGroupNameFn = () => {
    if (!editGroupName.trim() || !selectedGroup) return;
    updateGroup.mutate({ id: selectedGroup.id, name: editGroupName });
    setSelectedGroup({ ...selectedGroup, name: editGroupName });
    showMsg("Nombre actualizado!");
  };

  const removeUserFromGroup = (userId: number) => {
    if (!confirm("Quitar usuario del grupo?")) return;
    updateUser.mutate({ id: userId, groupId: 0 });
    showMsg("Usuario removido!");
  };

  const addUserToGroup = (userId: number) => {
    if (!selectedGroup) return;
    updateUser.mutate({ id: userId, groupId: selectedGroup.id });
    showMsg("Usuario agregado!");
  };

  const handleEditMember = () => {
    if (!editMember) return;
    const payload: any = { id: editMember.id };
    if (editMemberData.name !== editMember.name) payload.name = editMemberData.name;
    if (editMemberData.username !== editMember.username) payload.username = editMemberData.username;
    if (editMemberData.password) payload.password = editMemberData.password;
    if (editMemberData.phone !== (editMember.phone || "")) payload.phone = editMemberData.phone || null;
    if (editMemberData.role !== editMember.role) payload.role = editMemberData.role;
    if (editMemberData.credit !== String(editMember.credit)) payload.credit = editMemberData.credit;
    if (editMemberData.active !== !!editMember.active) payload.active = editMemberData.active;
    updateUser.mutate(payload);
    setEditMember(null);
    showMsg("Usuario actualizado!");
  };

  const handleCreditChange = () => {
    if (!creditModal || !creditAmount || Number(creditAmount) <= 0) { showMsg("Ingrese un monto valido"); return; }
    const amount = Number(creditAmount);
    const currentCredit = Number(creditModal.credit) || 0;
    const newCredit = creditAction === "add" ? currentCredit + amount : Math.max(0, currentCredit - amount);
    updateCredit.mutate({ id: creditModal.id, credit: String(newCredit) });
    setCreditModal(null); setCreditAmount("");
    logAudit({ type: "credit_add", userId: creditModal.id, userName: creditModal.name, groupId: creditModal.groupId, amount, description: `Credito ${creditAction === "add" ? "agregado" : "reducido"} en $${formatMoney(amount)}` });
    showMsg(`Credito ${creditAction === "add" ? "aumentado" : "reducido"} en $${formatMoney(amount)}!`);
  };

  // GROUP DETAIL VIEW
  if (selectedGroup) {
    const groupUsers = allUsers.filter((u: any) => u.groupId === selectedGroup.id);
    const availableUsers = allUsers.filter((u: any) => !u.groupId && u.role !== "admin");

    return (
      <div className="px-4 py-4 space-y-4">
        {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}
        <button onClick={() => setSelectedGroup(null)} className="flex items-center gap-1.5 text-sm text-green-700 font-bold">
          <ChevronLeft size={18} /> Volver a grupos
        </button>
        <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-green-700">Informacion del Grupo</h3>
          <div className="flex gap-2">
            <input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm font-bold" />
            <button onClick={updateGroupNameFn} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700"><Pencil size={14} /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold">{groupUsers.length} usuario(s)</span>
            <span className="text-[10px] px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">ID: {selectedGroup.id}</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold text-gray-900">Miembros del Grupo</h4>
          {groupUsers.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin miembros.</p>}
          {groupUsers.map((u: any) => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{u.name} <span className="text-[10px] font-normal text-green-600">({u.bankNumber})</span></p>
                  <p className="text-[10px] text-gray-500">{u.username} | {roleLabels[u.role] || u.role} | ${formatMoney(u.credit)} | Com: {u.commission || 0}%</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{u.active ? "Activo" : "Bloqueado"}</span>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <button onClick={() => { setEditMember(u); setEditMemberData({ name: u.name, username: u.username, password: "", phone: u.phone || "", role: u.role, credit: String(u.credit), commission: String(u.commission || "0"), active: !!u.active }); }} className="flex-1 py-1.5 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold hover:bg-green-100">Editar</button>
                <button onClick={() => { setCreditModal(u); setCreditAmount(""); setCreditAction("add"); }} className="flex-1 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-[11px] font-bold hover:bg-yellow-100">Credito</button>
                <button onClick={() => removeUserFromGroup(u.id)} className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold hover:bg-red-100">Quitar</button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {!showAddUser ? (
            <button onClick={() => setShowAddUser(true)} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2">
              <UserPlus size={16} /> Agregar Usuario Existente
            </button>
          ) : (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 space-y-2">
              <h4 className="text-sm font-bold text-blue-700">Usuarios sin grupo</h4>
              {availableUsers.length === 0 && <p className="text-xs text-gray-400">No hay usuarios disponibles.</p>}
              {availableUsers.map((u: any) => (
                <button key={u.id} onClick={() => { addUserToGroup(u.id); setShowAddUser(false); }} className="w-full flex items-center justify-between p-2 bg-white rounded-lg border border-blue-100 hover:border-blue-300 transition-all text-left">
                  <span className="text-sm font-medium text-gray-900">{u.name} <span className="text-[10px] text-gray-500">({u.username} - {roleLabels[u.role]})</span></span>
                  <UserPlus size={14} className="text-blue-600" />
                </button>
              ))}
              <button onClick={() => setShowAddUser(false)} className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">Cancelar</button>
            </div>
          )}
        </div>

        {editMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85%] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-100"><h3 className="font-bold text-lg text-gray-900">Editar Usuario</h3><button onClick={() => setEditMember(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button></div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Nombre</label><input value={editMemberData.name} onChange={(e) => setEditMemberData({ ...editMemberData, name: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
                <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Usuario</label><input value={editMemberData.username} onChange={(e) => setEditMemberData({ ...editMemberData, username: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
                <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Contrasena (dejar vacio para no cambiar)</label><input type="password" value={editMemberData.password} onChange={(e) => setEditMemberData({ ...editMemberData, password: e.target.value })} placeholder="Nueva contrasena" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
                <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Telefono</label><input value={editMemberData.phone} onChange={(e) => setEditMemberData({ ...editMemberData, phone: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
                <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Rol</label><select value={editMemberData.role} onChange={(e) => setEditMemberData({ ...editMemberData, role: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm"><option value="user">Vendedor</option><option value="collector">Cobrador</option><option value="supervisor">Supervisor</option></select></div>
                <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Credito</label><input type="number" value={editMemberData.credit} onChange={(e) => setEditMemberData({ ...editMemberData, credit: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
                <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Comision %</label><input type="number" value={editMemberData.commission} onChange={(e) => setEditMemberData({ ...editMemberData, commission: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editMemberData.active} onChange={(e) => setEditMemberData({ ...editMemberData, active: e.target.checked })} className="w-4 h-4 accent-green-600" /><span className={editMemberData.active ? "text-green-700 font-medium" : "text-gray-500"}>{editMemberData.active ? "Activo" : "Bloqueado"}</span></label>
              </div>
              <div className="p-3 border-t border-gray-100"><button onClick={handleEditMember} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700">Guardar Cambios</button></div>
            </div>
          </div>
        )}

        {creditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
              <div className="text-center mb-4">
                <div className="w-14 h-14 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-2"><Wallet size={28} className="text-yellow-600" /></div>
                <h3 className="font-bold text-lg text-gray-900">Gestionar Credito</h3>
                <p className="text-sm text-gray-500">{creditModal.name}</p>
                <p className="text-sm font-bold text-green-700 mt-1">Credito actual: ${formatMoney(creditModal.credit)}</p>
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setCreditAction("add")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${creditAction === "add" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>Agregar</button>
                <button onClick={() => setCreditAction("subtract")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${creditAction === "subtract" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}>Reducir</button>
              </div>
              <input type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="Monto" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm font-bold text-center text-lg mb-3" autoFocus />
              <div className="flex gap-2">
                <button onClick={() => setCreditModal(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">Cancelar</button>
                <button onClick={handleCreditChange} className={`flex-1 py-2.5 rounded-xl font-bold text-sm text-white ${creditAction === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>{creditAction === "add" ? "Agregar" : "Reducir"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // GROUP LIST VIEW
  return (
    <div className="px-4 py-4 space-y-4">
      {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}
      <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-green-700">Nuevo Grupo</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
        <button onClick={add} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2">
          <Plus size={16} /> Crear Grupo
        </button>
      </div>
      <div className="space-y-2">
        {groups.map((g: any) => {
          const memberCount = allUsers.filter((u: any) => u.groupId === g.id).length;
          return (
            <div key={g.id} className="flex items-center gap-2">
              <button onClick={() => { setSelectedGroup(g); setEditGroupName(g.name); setShowAddUser(false); }} className="flex-1 flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-green-300 transition-all text-left">
                <div>
                  <p className="text-sm font-bold text-gray-900">{g.name}</p>
                  <p className="text-[10px] text-gray-500">{memberCount} miembro(s) | Toca para ver detalles</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
              <button onClick={() => { if (confirm(`Eliminar grupo "${g.name}"?`)) deleteGroup.mutate({ id: g.id }); }} className="p-3 bg-white rounded-xl border border-red-100 shadow-sm hover:bg-red-50 transition-all shrink-0">
                <Trash2 size={16} className="text-red-500" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── USUARIOS ──────────────────────────────────────────────────────
function UsuariosSection() {
  const utils = trpc.useUtils();
  const userList = trpc.lotteryUser.list.useQuery();
  const createUser = trpc.lotteryUser.create.useMutation({ onSuccess: () => utils.lotteryUser.list.invalidate() });
  const updateUser = trpc.lotteryUser.update.useMutation({ onSuccess: () => utils.lotteryUser.list.invalidate() });
  const deleteUser = trpc.lotteryUser.delete.useMutation({ onSuccess: () => utils.lotteryUser.list.invalidate() });
  const updateCredit = trpc.lotteryUser.updateCredit.useMutation({ onSuccess: () => utils.lotteryUser.list.invalidate() });
  const groupList = trpc.group.list.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", username: "", password: "", phone: "", role: "user" as any, groupId: "", credit: "5000", commission: "10" });
  const [msg, setMsg] = useState("");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const [search, setSearch] = useState("");
  const [viewUser, setViewUser] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [editData, setEditData] = useState({ name: "", username: "", password: "", phone: "", role: "user", groupId: "", credit: "5000", commission: "10", active: true });
  const [creditModal, setCreditModal] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditAction, setCreditAction] = useState<"add" | "subtract">("add");
  const [deleteUserData, setDeleteUserData] = useState<any>(null);

  const users = userList.data || [];
  const groups = groupList.data || [];
  const roleLabels: Record<string, string> = { admin: "Administrador", supervisor: "Supervisor", collector: "Cobrador", user: "Vendedor" };

  const filtered = search ? users.filter((u: any) => u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())) : users;

  const handleCreate = () => {
    if (!formData.name || !formData.username || !formData.password) { showMsg("Complete los campos obligatorios"); return; }
    if (formData.password.length < 4) { showMsg("La contrasena debe tener al menos 4 caracteres"); return; }
    createUser.mutate({
      name: formData.name,
      username: formData.username,
      password: formData.password,
      phone: formData.phone || undefined,
      role: formData.role,
      groupId: formData.groupId ? Number(formData.groupId) : undefined,
      credit: formData.credit,
      commission: formData.commission,
    }, {
      onSuccess: () => {
        setShowForm(false);
        setFormData({ name: "", username: "", password: "", phone: "", role: "user", groupId: "", credit: "5000", commission: "10" });
        showMsg("Usuario creado!");
      },
      onError: (err) => showMsg("Error: " + err.message),
    });
  };

  const handleEditSave = () => {
    if (!editUser) return;
    const payload: any = { id: editUser.id };
    if (editData.name !== editUser.name) payload.name = editData.name;
    if (editData.username !== editUser.username) payload.username = editData.username;
    if (editData.password) payload.password = editData.password;
    if (editData.phone !== (editUser.phone || "")) payload.phone = editData.phone || null;
    if (editData.role !== editUser.role) payload.role = editData.role;
    if (editData.groupId !== (editUser.groupId || "")) payload.groupId = editData.groupId ? Number(editData.groupId) : 0;
    if (editData.credit !== String(editUser.credit)) payload.credit = editData.credit;
    if (editData.commission !== String(editUser.commission || "0")) payload.commission = editData.commission;
    if (editData.active !== !!editUser.active) payload.active = editData.active;
    updateUser.mutate(payload);
    setEditUser(null);
    showMsg("Usuario actualizado!");
  };

  const handleCreditChange = () => {
    if (!creditModal || !creditAmount || Number(creditAmount) <= 0) { showMsg("Ingrese un monto valido"); return; }
    const amount = Number(creditAmount);
    const currentCredit = Number(creditModal.credit) || 0;
    const newCredit = creditAction === "add" ? currentCredit + amount : Math.max(0, currentCredit - amount);
    updateCredit.mutate({ id: creditModal.id, credit: String(newCredit) });
    setCreditModal(null); setCreditAmount("");
    showMsg(`Credito ${creditAction === "add" ? "aumentado" : "reducido"} en $${formatMoney(amount)}!`);
  };

  const handleDelete = () => {
    if (!deleteUserData) return;
    deleteUser.mutate({ id: deleteUserData.id });
    setDeleteUserData(null);
    showMsg("Usuario eliminado!");
  };

  const openEdit = (u: any) => {
    setEditData({ name: u.name, username: u.username, password: "", phone: u.phone || "", role: u.role, groupId: u.groupId || "", credit: String(u.credit), commission: String(u.commission || "0"), active: !!u.active });
    setEditUser(u);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o usuario..." className="w-full px-3 py-2.5 border border-green-200 rounded-lg text-sm focus:outline-none focus:border-green-500" />
      <button onClick={() => setShowForm(!showForm)} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2">
        <Plus size={16} /> {showForm ? "Cancelar" : "Crear Usuario"}
      </button>
      {showForm && (
        <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm space-y-3">
          <h4 className="text-sm font-bold text-green-700">Nuevo Usuario</h4>
          <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre completo *" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
          <input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="Usuario *" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" autoCapitalize="none" />
          <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Contrasena *" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
          <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Telefono" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
          <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm">
            <option value="user">Vendedor</option><option value="collector">Cobrador</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option>
          </select>
          <select value={formData.groupId} onChange={(e) => setFormData({ ...formData, groupId: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm">
            <option value="">Sin grupo</option>{groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input type="number" value={formData.credit} onChange={(e) => setFormData({ ...formData, credit: e.target.value })} placeholder="Credito inicial" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
          <input type="number" value={formData.commission} onChange={(e) => setFormData({ ...formData, commission: e.target.value })} placeholder="Comision % (ej: 10)" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
          <button onClick={handleCreate} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700">Guardar Usuario</button>
        </div>
      )}
      <div className="space-y-2">
        {filtered.length > 0 ? filtered.map((u: any) => (
          <div key={u.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">{u.name} <span className="text-[10px] font-normal text-green-600">({u.bankNumber})</span></p>
                <p className="text-[10px] text-gray-500">{u.username} | {roleLabels[u.role] || u.role} | ${formatMoney(u.credit)} | Com: {u.commission || 0}%</p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{u.active ? "Activo" : "Bloqueado"}</span>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <button onClick={() => setViewUser(u)} className="flex-1 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold hover:bg-blue-100">Ver Info</button>
              <button onClick={() => openEdit(u)} className="flex-1 py-1.5 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold hover:bg-green-100">Editar</button>
              <button onClick={() => { setCreditModal(u); setCreditAmount(""); setCreditAction("add"); }} className="flex-1 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-[11px] font-bold hover:bg-yellow-100">Credito</button>
              <button onClick={() => setDeleteUserData(u)} className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold hover:bg-red-100">Eliminar</button>
            </div>
          </div>
        )) : <p className="text-sm text-gray-400 text-center py-4">No se encontraron usuarios</p>}
      </div>

      {viewUser && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85%] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100"><h3 className="font-bold text-lg text-gray-900">Informacion del Usuario</h3><button onClick={() => setViewUser(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button></div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <div className="w-16 h-16 mx-auto bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2">{viewUser.name.charAt(0).toUpperCase()}</div>
                <p className="font-bold text-gray-900">{viewUser.name}</p><p className="text-xs text-green-600">{viewUser.bankNumber}</p>
              </div>
              {[["Nombre", viewUser.name], ["Usuario", viewUser.username], ["Telefono", viewUser.phone || "No registrado"], ["Rol", roleLabels[viewUser.role] || viewUser.role], ["Banca", viewUser.bankNumber], ["Credito", `$${formatMoney(viewUser.credit)}`], ["Comision", `${viewUser.commission || 0}%`], ["Estado", viewUser.active ? "Activo" : "Bloqueado"]].map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 border-b border-gray-50"><span className="text-xs text-gray-500">{label}</span><span className="text-sm font-medium text-gray-900">{value}</span></div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-100"><button onClick={() => { setViewUser(null); openEdit(viewUser); }} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700">Editar Usuario</button></div>
          </div>
        </div>
      )}
      {editUser && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85%] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100"><h3 className="font-bold text-lg text-gray-900">Editar Usuario</h3><button onClick={() => setEditUser(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button></div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Nombre</label><input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
              <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Usuario</label><input value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
              <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Contrasena (dejar vacio para no cambiar)</label><input type="password" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} placeholder="Nueva contrasena" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
              <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Telefono</label><input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
              <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Rol</label><select value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm"><option value="user">Vendedor</option><option value="collector">Cobrador</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option></select></div>
              <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Grupo</label><select value={editData.groupId} onChange={(e) => setEditData({ ...editData, groupId: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm"><option value="">Sin grupo</option>{groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
              <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Credito</label><input type="number" value={editData.credit} onChange={(e) => setEditData({ ...editData, credit: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
              <div><label className="text-[10px] font-medium text-gray-600 mb-1 block">Comision %</label><input type="number" value={editData.commission} onChange={(e) => setEditData({ ...editData, commission: e.target.value })} placeholder="Ej: 10" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editData.active} onChange={(e) => setEditData({ ...editData, active: e.target.checked })} className="w-4 h-4 accent-green-600" /><span className={editData.active ? "text-green-700 font-medium" : "text-gray-500"}>{editData.active ? "Usuario Activo" : "Usuario Bloqueado"}</span></label>
            </div>
            <div className="p-3 border-t border-gray-100"><button onClick={handleEditSave} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700">Guardar Cambios</button></div>
          </div>
        </div>
      )}
      {deleteUserData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-3"><Trash2 size={24} className="text-red-600" /></div>
            <h3 className="font-bold text-lg text-gray-900 text-center mb-1">Eliminar Usuario</h3>
            <p className="text-sm text-gray-500 text-center mb-4">Eliminar a <strong>{deleteUserData.name}</strong> ({deleteUserData.bankNumber})?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteUserData(null)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
      {creditModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-2"><Wallet size={28} className="text-yellow-600" /></div>
              <h3 className="font-bold text-lg text-gray-900">Gestionar Credito</h3>
              <p className="text-sm text-gray-500">{creditModal.name} ({creditModal.bankNumber})</p>
              <p className="text-sm font-bold text-green-700 mt-1">Credito actual: ${formatMoney(creditModal.credit)}</p>
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setCreditAction("add")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${creditAction === "add" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>Agregar</button>
              <button onClick={() => setCreditAction("subtract")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${creditAction === "subtract" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}>Reducir</button>
            </div>
            <input type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="Monto" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm font-bold text-center text-lg mb-3" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setCreditModal(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">Cancelar</button>
              <button onClick={handleCreditChange} className={`flex-1 py-2.5 rounded-xl font-bold text-sm text-white ${creditAction === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>{creditAction === "add" ? "Agregar" : "Reducir"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PREMIOS ───────────────────────────────────────────────────────
function PremiosSection() {
  const utils = trpc.useUtils();
  const prizeList = trpc.prize.list.useQuery();
  const updatePrize = trpc.prize.update.useMutation({ onSuccess: () => utils.prize.list.invalidate() });
  const [msg, setMsg] = useState("");

  const prizes = prizeList.data || [];

  const update = (id: number, field: string, value: string) => {
    updatePrize.mutate({ id, [field]: value });
    setMsg("Premio actualizado!"); setTimeout(() => setMsg(""), 2000);
  };

  const typeLabels: Record<string, string> = { directo: "Directo", pale: "Pale", terna: "Terna (3 cifras)", cuatrena: "Cuatrena (4 cifras)", tripleta: "Tripleta" };

  return (
    <div className="px-4 py-4 space-y-4">
      {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}
      <p className="text-sm text-gray-600">Configure cuanto paga cada tipo de jugada.</p>
      {prizes.map((prize: any) => (
        <div key={prize.id} className="bg-white rounded-xl border border-green-100 p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-green-700">{typeLabels[prize.playType] || prize.playType}</h3>
          <p className="text-[10px] text-gray-500">{prize.description}</p>
          {prize.playType === "directo" && (
            <div className="grid grid-cols-3 gap-2">
              {[["1er Premio (x)", "firstPrizeMultiplier"], ["2do Premio (x)", "secondPrizeMultiplier"], ["3er Premio (x)", "thirdPrizeMultiplier"]].map(([label, field]) => (
                <div key={field}><label className="text-[10px] font-medium text-gray-700 block mb-1">{label}</label><input type="number" step="0.01" defaultValue={prize[field]} onBlur={(e) => update(prize.id, field, e.target.value)} className="w-full px-2 py-1.5 border border-green-200 rounded-lg text-sm text-center font-bold" /></div>
              ))}
            </div>
          )}
          {prize.playType === "pale" && (
            <div className="grid grid-cols-3 gap-2">
              {[["1er + 2do (x)", "paleFirstSecondMultiplier"], ["1er + 3ro (x)", "paleFirstThirdMultiplier"], ["2do + 3ro (x)", "paleSecondThirdMultiplier"]].map(([label, field]) => (
                <div key={field}><label className="text-[10px] font-medium text-gray-700 block mb-1">{label}</label><input type="number" step="0.01" defaultValue={prize[field]} onBlur={(e) => update(prize.id, field, e.target.value)} className="w-full px-2 py-1.5 border border-green-200 rounded-lg text-sm text-center font-bold" /></div>
              ))}
            </div>
          )}
          {["terna", "cuatrena", "tripleta"].includes(prize.playType) && (
            <div><label className="text-[10px] font-medium text-gray-700 block mb-1">Por cada euro jugado (x)</label><input type="number" step="0.01" defaultValue={prize.fixedMultiplier} onBlur={(e) => update(prize.id, "fixedMultiplier", e.target.value)} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm font-bold" /></div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── GANADORES ─────────────────────────────────────────────────────
function GanadoresSection() {
  const utils = trpc.useUtils();
  const winnerList = trpc.winner.list.useQuery();
  const createWinner = trpc.winner.create.useMutation({ onSuccess: () => utils.winner.list.invalidate() });
  const lotteryList = trpc.lottery.list.useQuery();

  const [msg, setMsg] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [lottery, setLottery] = useState("");
  const [prizes, setPrizes] = useState({ first: "", second: "", third: "" });

  const winners = winnerList.data || [];
  const lotteries = lotteryList.data || [];

  const [lastProcessed, setLastProcessed] = useState<any>(null);

  const handleSave = () => {
    if (!lottery || !prizes.first || !prizes.second || !prizes.third) { setMsg("Complete todos los campos"); setTimeout(() => setMsg(""), 3000); return; }
    createWinner.mutate({ lotteryId: Number(lottery), firstPrize: prizes.first, secondPrize: prizes.second, thirdPrize: prizes.third, drawDate: date.replace(/-/g, "") }, {
      onSuccess: (data) => {
        setPrizes({ first: "", second: "", third: "" });
        setLastProcessed(data);
        setMsg(`Guardado! ${data.processed || 0} ticket(s) ganador(es) procesados.`);
        setTimeout(() => setMsg(""), 4000);
      },
      onError: (err) => { setMsg("Error: " + err.message); setTimeout(() => setMsg(""), 3000); },
    });
  };

  const filtered = winners.filter((w: any) => {
    const d = date.replace(/-/g, "");
    return (!lottery || w.lotteryId === Number(lottery)) && w.drawDate === d;
  });

  return (
    <div className="px-4 py-4 space-y-4">
      {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}
      <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-green-700">Registrar Numeros</h3>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
        <select value={lottery} onChange={(e) => setLottery(e.target.value)} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm"><option value="">Seleccionar loteria...</option>{lotteries.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <div className="grid grid-cols-3 gap-2">
          {[["1er", "first"], ["2do", "second"], ["3er", "third"]].map(([label, field]) => (
            <div key={field}><label className="text-[10px] font-medium text-gray-700 block mb-1">{label}</label><input value={(prizes as any)[field]} onChange={(e) => setPrizes({ ...prizes, [field]: e.target.value })} placeholder={label} maxLength={6} className="w-full px-2 py-2 border border-green-200 rounded-lg text-sm text-center font-bold" /></div>
          ))}
        </div>
        <button onClick={handleSave} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700">Guardar</button>
      </div>
      <div className="space-y-2">
        {filtered.map((w: any) => {
          const lot = lotteries.find((l: any) => l.id === w.lotteryId);
          return (
            <div key={w.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
              <p className="text-sm font-bold text-green-700">{lot?.name || `Loteria #${w.lotteryId}`}</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">{w.firstPrize}</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold">{w.secondPrize}</span>
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold">{w.thirdPrize}</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin resultados para esta fecha</p>}
      </div>
      {lastProcessed && lastProcessed.winners && lastProcessed.winners.length > 0 && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <h4 className="text-sm font-bold text-yellow-800 mb-2">Tickets Ganadores Procesados</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {lastProcessed.winners.map((w: any, i: number) => (
              <div key={i} className="bg-white rounded-lg p-2 text-xs">
                <p className="font-bold text-gray-900">{w.ticketCode} - ${formatMoney(w.totalPrize)}</p>
                <p className="text-gray-500">{w.details?.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ANULAR ────────────────────────────────────────────────────────
function AnularSection() {
  const utils = trpc.useUtils();
  const ticketList = trpc.ticket.list.useQuery();
  const userList = trpc.lotteryUser.list.useQuery();
  const annulTicketMut = trpc.ticket.annul.useMutation({ onSuccess: () => utils.ticket.list.invalidate() });
  const updateCreditMut = trpc.lotteryUser.updateCredit.useMutation({ onSuccess: () => utils.lotteryUser.list.invalidate() });

  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [msg, setMsg] = useState("");

  const tickets = ticketList.data || [];
  const users = userList.data || [];

  const filtered = tickets.filter((t: any) => {
    const matchCode = t.code.toLowerCase().includes(search.toLowerCase());
    const matchUser = !filterUser || t.userId === Number(filterUser);
    return matchCode && matchUser && t.status === "active";
  });

  const annulTicket = async (ticket: any) => {
    if (!confirm(`Anular ticket ${ticket.code}? El vendedor recuperara solo el monto neto (sin comision).`)) return;
    // Calculate what was actually deducted from seller's credit (total - commission)
    const total = Number(ticket.total) || 0;
    const commission = Number(ticket.commission || 0);
    const netDeduction = calculateNetDeduction(total, commission);
    const commissionKept = total - netDeduction;
    try {
      // Recover only the net deduction (what was actually taken from credit), NOT the full total
      const seller = users.find((u: any) => u.id === ticket.userId);
      if (seller) {
        const currentCredit = Number(seller.credit) || 0;
        await updateCreditMut.mutateAsync({ id: ticket.userId, credit: String(currentCredit + netDeduction) });
      }
      await annulTicketMut.mutateAsync({ id: ticket.id, annulledBy: 1 }); // admin id
      utils.ticket.list.invalidate();
      setMsg(`Anulado! Recuperado: $${formatMoney(netDeduction)} | Comision retenida: $${formatMoney(commissionKept)}`);
      setTimeout(() => setMsg(""), 5000);
    } catch (err: any) {
      setMsg("Error: " + err.message);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}
      <p className="text-sm text-gray-600">Como administrador, puedes anular tickets de cualquier usuario.</p>
      <div className="space-y-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por codigo..." className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm">
          <option value="">Todos los usuarios</option>
          {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.bankNumber})</option>)}
        </select>
      </div>
      <div className="bg-green-50 rounded-lg p-3 flex items-center justify-between">
        <span className="text-sm text-green-800 font-medium">{filtered.length} ticket(s) activo(s)</span>
        <span className="text-sm text-green-700 font-bold">${formatMoney(filtered.reduce((sum: number, t: any) => sum + Number(t.total), 0))}</span>
      </div>
      <div className="space-y-2">
        {filtered.length > 0 ? filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((t: any) => {
          const seller = users.find((u: any) => u.id === t.userId);
          return (
            <div key={t.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{t.code}</p>
                  <p className="text-[10px] text-gray-500">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-sm font-bold text-green-700">${formatMoney(t.total)}</p>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2 mb-2">
                <span className="text-xs text-gray-600">Vendedor: <strong className="text-gray-900">{seller?.name || "Desconocido"}</strong></span>
              </div>
              <button onClick={() => annulTicket(t)} className="w-full py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 flex items-center justify-center gap-1"><Ban size={12} /> Anular Ticket</button>
            </div>
          );
        }) : <p className="text-sm text-gray-400 text-center py-4">No hay tickets activos</p>}
      </div>
    </div>
  );
}

// ─── REPORTES ──────────────────────────────────────────────────────
function ReportesGrupoSection() {
  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-sm text-gray-600">Reportes de ventas por grupo.</p>
      <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
        <p className="text-sm text-gray-500 text-center py-4">Funcion disponible proximamente</p>
      </div>
    </div>
  );
}

// ─── CONFIG ────────────────────────────────────────────────────────
function ConfigSection() {
  const [msg, setMsg] = useState("");
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem("loteria_config");
    return saved ? JSON.parse(saved) : { maxBetAmount: "" };
  });

  const saveConfig = (newConfig: any) => {
    localStorage.setItem("loteria_config", JSON.stringify(newConfig));
    setConfig(newConfig);
    setMsg("Configuracion guardada!");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}
      <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-green-700 mb-3">Limite por Jugada</h3>
        <div className="flex gap-2">
          <input type="number" value={config.maxBetAmount} onChange={(e) => saveConfig({ ...config, maxBetAmount: e.target.value })} placeholder="Ej: 1000" className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm font-bold" />
          <button onClick={() => saveConfig({ ...config, maxBetAmount: "" })} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">Quitar</button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-green-700 mb-3">Informacion del Sistema</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-600">Version</span><span className="font-medium">2.0.0</span></div>
          <div className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-600">Modo</span><span className="font-medium text-green-600">Online (Base de Datos)</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── LIMITES ───────────────────────────────────────────────────────
interface LimitEntry { id: number; type: "global" | "user"; userId: number | null; lotteryId: number | null; playType: string | null; maxAmount: number; blockedNumbers: string[]; active: boolean; }
const PLAY_TYPES: { value: string; label: string }[] = [
  { value: "directo", label: "Directo" }, { value: "pale", label: "Pale" }, { value: "terna", label: "3 Cifras" }, { value: "cuatrena", label: "4 Cifras" }, { value: "tripleta", label: "Tripleta" },
];

function LimitesSection() {
  const utils = trpc.useUtils();
  const [msg, setMsg] = useState("");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const [limits, setLimits] = useState<LimitEntry[]>(() => { const saved = localStorage.getItem("loteria_limits"); return saved ? JSON.parse(saved) : []; });
  const userList = trpc.lotteryUser.list.useQuery();
  const lotteryList = trpc.lottery.list.useQuery();

  const allUsers = userList.data || [];
  const allLotteries = lotteryList.data || [];

  const saveLimits = (data: LimitEntry[]) => { localStorage.setItem("loteria_limits", JSON.stringify(data)); setLimits(data); };
  const [form, setForm] = useState({ type: "global" as "global" | "user", userId: "", lotteryId: "", playType: "", maxAmount: "", blockedNumbers: "" });
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"limits" | "blocked" | "palelimits">("limits");

  // Pale/Tripleta server limits
  const serverLimits = trpc.lottery.getLimits.useQuery();
  const setServerLimit = trpc.lottery.setLimit.useMutation({
    onSuccess: () => { utils.lottery.getLimits.invalidate(); showMsg("Limite guardado!"); },
    onError: (err) => showMsg("Error: " + err.message),
  });
  const deleteServerLimit = trpc.lottery.deleteLimit.useMutation({
    onSuccess: () => { utils.lottery.getLimits.invalidate(); showMsg("Limite eliminado!"); },
    onError: (err) => showMsg("Error: " + err.message),
  });
  const [paleForm, setPaleForm] = useState({ lotteryId: "", playType: "pale" as "pale" | "tripleta", numberCombo: "", maxAmount: "" });

  const addLimit = () => {
    const newLimit: LimitEntry = { id: Date.now(), type: form.type, userId: form.type === "user" && form.userId ? Number(form.userId) : null, lotteryId: form.lotteryId ? Number(form.lotteryId) : null, playType: form.playType || null, maxAmount: Number(form.maxAmount) || 0, blockedNumbers: form.blockedNumbers.split(",").map((s) => s.trim()).filter(Boolean), active: true };
    saveLimits([...limits, newLimit]);
    setForm({ type: "global", userId: "", lotteryId: "", playType: "", maxAmount: "", blockedNumbers: "" });
    setShowForm(false);
    showMsg("Limite creado!");
  };

  const toggleActive = (id: number) => { saveLimits(limits.map((l) => l.id === id ? { ...l, active: !l.active } : l)); };
  const removeLimit = (id: number) => { if (confirm("Eliminar este limite?")) saveLimits(limits.filter((l) => l.id !== id)); };
  const getLotteryName = (id: number | null) => { if (!id) return "Todas"; const l = allLotteries.find((x: any) => x.id === id); return l ? l.name : `ID: ${id}`; };
  const getUserName = (id: number | null) => { if (!id) return "Todos"; const u = allUsers.find((x: any) => x.id === id); return u ? `${u.name} (${u.bankNumber})` : `ID: ${id}`; };
  const getPlayTypeLabel = (pt: string | null) => { if (!pt) return "Todos"; return PLAY_TYPES.find((t) => t.value === pt)?.label || pt; };

  return (
    <div className="px-4 py-4 space-y-4">
      {msg && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{msg}</div>}
      <div className="flex gap-2">
        <button onClick={() => setTab("limits")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab === "limits" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>Limites</button>
        <button onClick={() => setTab("blocked")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab === "blocked" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}>Bloqueos</button>
        <button onClick={() => setTab("palelimits")} className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab === "palelimits" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>Pale</button>
      </div>
      {/* Pale/Tripleta Limits Tab */}
      {tab === "palelimits" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-blue-700">Limite por Combinacion Pale/Tripleta</h3>
            <p className="text-xs text-gray-500">Si un vendedor ya jugo una combinacion y alcanza el limite, no podra repetirla.</p>
            <select value={paleForm.lotteryId} onChange={(e) => setPaleForm({ ...paleForm, lotteryId: e.target.value })} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm">
              <option value="">-- Seleccionar Loteria --</option>
              {allLotteries.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={paleForm.playType} onChange={(e) => setPaleForm({ ...paleForm, playType: e.target.value as "pale" | "tripleta" })} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm">
              <option value="pale">Pale (2 numeros)</option>
              <option value="tripleta">Tripleta (3 numeros)</option>
            </select>
            <input value={paleForm.numberCombo} onChange={(e) => setPaleForm({ ...paleForm, numberCombo: e.target.value })} placeholder="Ej: 12+34 o 12+34+56" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm" />
            <input type="number" value={paleForm.maxAmount} onChange={(e) => setPaleForm({ ...paleForm, maxAmount: e.target.value })} placeholder="Monto maximo ($)" className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm" />
            <button onClick={() => {
              if (!paleForm.lotteryId || !paleForm.numberCombo || !paleForm.maxAmount) { showMsg("Complete todos los campos"); return; }
              setServerLimit.mutate({ lotteryId: Number(paleForm.lotteryId), playType: paleForm.playType, numberCombo: paleForm.numberCombo, maxAmount: paleForm.maxAmount });
              setPaleForm({ lotteryId: "", playType: "pale", numberCombo: "", maxAmount: "" });
            }} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700">Guardar Limite</button>
          </div>
          <div className="space-y-2">
            {(serverLimits.data || []).length === 0 && <div className="text-center py-6 text-gray-400 text-sm">No hay limites de pale/tripleta</div>}
            {(serverLimits.data || []).map((lim: any) => (
              <div key={lim.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{lim.numberCombo} <span className="text-blue-600">({lim.playType})</span></p>
                  <p className="text-[10px] text-gray-500">{getLotteryName(lim.lotteryId)}</p>
                  <p className="text-xs font-bold text-green-700">Max: ${formatMoney(lim.maxAmount)}</p>
                </div>
                <button onClick={() => { if (confirm("Eliminar?")) deleteServerLimit.mutate({ id: lim.id }); }} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={16} className="text-red-500" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab !== "palelimits" && !showForm && (
        <button onClick={() => setShowForm(true)} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2">
          <Plus size={16} /> Nuevo {tab === "limits" ? "Limite" : "Bloqueo"}
        </button>
      )}
      {showForm && (
        <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-green-700">{tab === "limits" ? "Nuevo Limite" : "Nuevo Bloqueo"}</h3>
          <div>
            <label className="text-[10px] font-medium text-gray-600 mb-1 block">Aplicar a</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "global" | "user", userId: "" })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm">
              <option value="global">Todos los usuarios</option>
              <option value="user">Usuario especifico</option>
            </select>
          </div>
          {form.type === "user" && (
            <div>
              <label className="text-[10px] font-medium text-gray-600 mb-1 block">Usuario</label>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm">
                <option value="">-- Seleccionar --</option>
                {allUsers.filter((u: any) => u.role !== "admin").map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.bankNumber})</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-[10px] font-medium text-gray-600 mb-1 block">Loteria</label>
            <select value={form.lotteryId} onChange={(e) => setForm({ ...form, lotteryId: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm">
              <option value="">Todas</option>
              {allLotteries.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-600 mb-1 block">Tipo de jugada</label>
            <select value={form.playType} onChange={(e) => setForm({ ...form, playType: e.target.value })} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm">
              <option value="">Todos</option>
              {PLAY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {tab === "limits" && (
            <div>
              <label className="text-[10px] font-medium text-gray-600 mb-1 block">Monto maximo ($)</label>
              <input type="number" value={form.maxAmount} onChange={(e) => setForm({ ...form, maxAmount: e.target.value })} placeholder="Ej: 500" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
            </div>
          )}
          <div>
            <label className="text-[10px] font-medium text-gray-600 mb-1 block">Numeros bloqueados (separados por coma)</label>
            <input value={form.blockedNumbers} onChange={(e) => setForm({ ...form, blockedNumbers: e.target.value })} placeholder="Ej: 03, 13+23" className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">Cancelar</button>
            <button onClick={addLimit} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700">Guardar</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {limits.filter((l) => tab === "blocked" ? l.blockedNumbers.length > 0 : true).length === 0 && (
          <div className="text-center py-8 text-gray-400">{tab === "limits" ? <Shield size={32} className="mx-auto mb-2 text-green-200" /> : <Lock size={32} className="mx-auto mb-2 text-red-200" />}<p className="text-sm">No hay {tab === "limits" ? "limites" : "bloqueos"} configurados</p></div>
        )}
        {limits.filter((l) => tab === "blocked" ? l.blockedNumbers.length > 0 : true).map((limit) => (
          <div key={limit.id} className={`rounded-xl border shadow-sm p-3 ${limit.active ? "bg-white border-gray-100" : "bg-gray-50 border-gray-200 opacity-60"}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${limit.type === "global" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{limit.type === "global" ? "GLOBAL" : "USUARIO"}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-bold">{getPlayTypeLabel(limit.playType)}</span>
                  {limit.blockedNumbers.length > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold flex items-center gap-0.5"><Lock size={8} /> {limit.blockedNumbers.length} bloqueado(s)</span>}
                </div>
                <p className="text-xs text-gray-600 mt-1">{getLotteryName(limit.lotteryId)}</p>
                {limit.type === "user" && <p className="text-[10px] text-gray-500">{getUserName(limit.userId)}</p>}
                {limit.maxAmount > 0 && <p className="text-xs font-bold text-green-700">Max: ${formatMoney(limit.maxAmount)}</p>}
                {limit.blockedNumbers.length > 0 && <p className="text-[10px] text-red-500 font-medium">Bloqueados: {limit.blockedNumbers.join(", ")}</p>}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => toggleActive(limit.id)} className={`px-2 py-1 rounded text-[10px] font-bold ${limit.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{limit.active ? "ON" : "OFF"}</button>
                <button onClick={() => removeLimit(limit.id)} className={`p-1 hover:bg-red-50 rounded`}><Trash2 size={14} className="text-red-500" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
