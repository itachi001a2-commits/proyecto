import { useState } from "react";
import type { SessionUser } from "@/store";
import { Trophy, Plus, Lock } from "lucide-react";

interface SorteosScreenProps {
  user: SessionUser;
}

export default function SorteosScreen({ user }: SorteosScreenProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedLottery, setSelectedLottery] = useState<number | undefined>();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWinner, setNewWinner] = useState({ lotteryId: 0, firstPrize: "", secondPrize: "", thirdPrize: "" });
  const [message, setMessage] = useState("");

  // Only admin and supervisor can add winners
  const canEdit = user.role === "admin" || user.role === "supervisor";

  const lotteries = JSON.parse(localStorage.getItem("loteria_loterias") || "[]").filter((l: any) => l.active);
  const winners = JSON.parse(localStorage.getItem("loteria_winners") || "[]");

  const handleSave = () => {
    if (!newWinner.lotteryId || !newWinner.firstPrize || !newWinner.secondPrize || !newWinner.thirdPrize) {
      setMessage("Complete todos los campos"); setTimeout(() => setMessage(""), 3000); return;
    }
    const allWinners = JSON.parse(localStorage.getItem("loteria_winners") || "[]");
    const newId = Math.max(0, ...allWinners.map((w: any) => w.id)) + 1;
    allWinners.push({ id: newId, lotteryId: newWinner.lotteryId, drawDate: selectedDate.replace(/-/g, ""), firstPrize: newWinner.firstPrize, secondPrize: newWinner.secondPrize, thirdPrize: newWinner.thirdPrize });
    localStorage.setItem("loteria_winners", JSON.stringify(allWinners));
    setMessage("Guardado!"); setTimeout(() => setMessage(""), 3000);
    setShowAddForm(false); setNewWinner({ lotteryId: 0, firstPrize: "", secondPrize: "", thirdPrize: "" });
  };

  const filtered = winners.filter((w: any) => {
    const d = selectedDate.replace(/-/g, "");
    return (!selectedLottery || w.lotteryId === selectedLottery) && w.drawDate === d;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Sorteos</h2>
          {/* Only show + button for admin/supervisor */}
          {canEdit && (
            <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <Plus size={16} />
            </button>
          )}
        </div>

        {/* Non-admin message */}
        {!canEdit && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <Lock size={14} className="text-yellow-600 shrink-0" />
            <p className="text-xs text-yellow-700">Solo el administrador puede registrar numeros ganadores</p>
          </div>
        )}

        {message && <div className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{message}</div>}

        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" />

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setSelectedLottery(undefined)} className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg ${!selectedLottery ? "bg-green-600 text-white" : "bg-green-100 text-green-700"}`}>Todas</button>
          {lotteries.map((l: any) => <button key={l.id} onClick={() => setSelectedLottery(l.id)} className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg ${selectedLottery === l.id ? "bg-green-600 text-white" : "bg-green-100 text-green-700"}`}>{l.name}</button>)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-3">
        {filtered.length > 0 ? filtered.map((w: any) => {
          const lottery = lotteries.find((l: any) => l.id === w.lotteryId);
          return (
            <div key={w.id} className="bg-white rounded-xl border border-green-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-green-700">{lottery?.name || `Loteria #${w.lotteryId}`}</h3></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200"><Trophy size={16} className="mx-auto text-yellow-600 mb-1" /><p className="text-lg font-extrabold text-yellow-700">{w.firstPrize}</p><p className="text-[10px] text-gray-500">1er Premio</p></div>
                <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200"><p className="text-lg font-extrabold text-gray-800">{w.secondPrize}</p><p className="text-[10px] text-gray-500">2do Premio</p></div>
                <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200"><p className="text-lg font-extrabold text-orange-700">{w.thirdPrize}</p><p className="text-[10px] text-gray-500">3er Premio</p></div>
              </div>
            </div>
          );
        }) : <div className="flex flex-col items-center justify-center py-12 text-gray-400"><Trophy size={48} className="mb-3 text-green-200" /><p className="text-sm">Sin sorteos registrados</p></div>}
      </div>

      {/* Add Form - Only for admin/supervisor */}
      {showAddForm && canEdit && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="font-bold text-lg text-gray-900 mb-4">Registrar Ganadores</h3>
            <div className="space-y-3">
              <select value={newWinner.lotteryId} onChange={(e) => setNewWinner({ ...newWinner, lotteryId: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-green-200 rounded-lg text-sm"><option value={0}>Seleccionar loteria...</option>{lotteries.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              <div className="grid grid-cols-3 gap-2">
                <input value={newWinner.firstPrize} onChange={(e) => setNewWinner({ ...newWinner, firstPrize: e.target.value })} placeholder="1er" maxLength={6} className="px-2 py-2 border border-green-200 rounded-lg text-sm text-center font-bold" />
                <input value={newWinner.secondPrize} onChange={(e) => setNewWinner({ ...newWinner, secondPrize: e.target.value })} placeholder="2do" maxLength={6} className="px-2 py-2 border border-green-200 rounded-lg text-sm text-center font-bold" />
                <input value={newWinner.thirdPrize} onChange={(e) => setNewWinner({ ...newWinner, thirdPrize: e.target.value })} placeholder="3er" maxLength={6} className="px-2 py-2 border border-green-200 rounded-lg text-sm text-center font-bold" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAddForm(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
