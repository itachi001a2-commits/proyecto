import { useState, useEffect, useCallback, useRef } from "react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import {
  saveDraft, loadDraft, clearDraft, detectPlayType,
  generatePaleCombos, generateDirectoCombos,
  generateTicketCode, calculateNetDeduction, checkWinningPlays,
  formatMoney, logAudit,
  generateParPlays, generateDecimalPlays, generateUnidadPlays,
  generateAzarPlays, generateMezclarPlays,
  checkPaleLimit, normalizeCombo,
} from "@/store";
import { trpc } from "@/providers/trpc";
import type { Play, PlayType, SessionUser } from "@/store";
import {
  Trash2, Edit2, Check, X, Share2, Ticket,
  ChevronDown, ChevronUp, Plus, Save, FileText,
  Keyboard, Lock, Wallet, Percent, Zap, Dices, Shuffle, Hash, QrCode, Copy
} from "lucide-react";

interface VenderScreenProps {
  user: SessionUser;
}

interface Lottery {
  id: number;
  name: string;
  drawTime: string;
  closeTime: string;
  active: boolean;
  schedule: Record<string, { open: string; close: string }>;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function isLotteryOpenNow(lottery: Lottery): boolean {
  const now = new Date();
  const dayIndex = now.getDay();
  const dayKey = DAY_KEYS[dayIndex];
  const daySched = lottery.schedule?.[dayKey];
  if (!daySched) return true;
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = daySched.open.split(":").map(Number);
  const [closeH, closeM] = daySched.close.split(":").map(Number);
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  return currentMins >= openMins && currentMins < closeMins;
}

function getLotteryStatus(lottery: Lottery): { isOpen: boolean; countdown: string } {
  const now = new Date();
  const dayIndex = now.getDay();
  const dayKey = DAY_KEYS[dayIndex];
  const daySched = lottery.schedule?.[dayKey];
  if (!daySched) return { isOpen: true, countdown: "Abierta" };
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const [,] = daySched.open.split(":").map(Number);
  const [closeH, closeM] = daySched.close.split(":").map(Number);
  const closeMins = closeH * 60 + closeM;
  const isOpen = currentMins < closeMins && currentMins >= (Number(daySched.open.split(":")[0]) * 60 + Number(daySched.open.split(":")[1]));
  if (isOpen) {
    const diffMins = closeMins - currentMins;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return { isOpen: true, countdown: h > 0 ? `${h}h ${m}m` : `${m}m` };
  }
  return { isOpen: false, countdown: "Cerrada" };
}

function migrateLottery(lottery: any): Lottery {
  if (lottery.schedule) return lottery as Lottery;
  const closeTime = lottery.closeTime || lottery.drawTime || "20:00";
  const defaultSched = { open: "07:00", close: closeTime };
  return {
    ...lottery,
    schedule: {
      mon: { ...defaultSched }, tue: { ...defaultSched }, wed: { ...defaultSched },
      thu: { ...defaultSched }, fri: { ...defaultSched }, sat: { ...defaultSched }, sun: { ...defaultSched },
    },
  };
}

export default function VenderScreen({ user }: VenderScreenProps) {
  // tRPC hooks - TODOS los hooks deben estar aquí adentro
  const utils = trpc.useUtils();
  const userQuery = trpc.lotteryUser.byId.useQuery({ id: user.id }, { refetchInterval: 10000 });
  const updateCreditMut = trpc.lotteryUser.updateCredit.useMutation({
    onSuccess: () => utils.lotteryUser.byId.invalidate({ id: user.id }),
  });
  const createTicketMut = trpc.ticket.create.useMutation({
    onSuccess: () => utils.ticket.list.invalidate(),
  });
  const lotteryListQuery = trpc.lottery.list.useQuery();
  const prizeListQuery = trpc.prize.list.useQuery();

  // ✅ MOVIDO ADENTRO DEL COMPONENTE - hook de tRPC
  const limitCheckQuery = trpc.lottery.checkLimit.useQuery(
    { lotteryId: 0, playType: "pale", numberCombo: "", amount: "0" },
    { enabled: false }
  );

  // Get lotteries from API
  const allLotteries: Lottery[] = (lotteryListQuery.data || []).map(migrateLottery).filter((l: Lottery) => l.active !== false);
  const openLotteries = allLotteries.filter(isLotteryOpenNow);
  const prizeList = prizeListQuery.data || [];

  // Credit from API
  const apiCredit = userQuery.data ? Number(userQuery.data.credit) || 0 : Number(user.credit) || 0;

  const [plays, setPlays] = useState<Play[]>(() => loadDraft());
  const [input, setInput] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedLotteries, setSelectedLotteries] = useState<Lottery[]>([]);
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [countdowns, setCountdowns] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [message, setMessage] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [lastTicket, setLastTicket] = useState<any>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [activeField, setActiveField] = useState<"numero" | "monto">("numero");
  const [showKeypad, setShowKeypad] = useState(true);
  const [userCredit, setUserCredit] = useState<number>(Number(user.credit) || 0);
  const [userCommission] = useState<number>(Number(user.commission) || 0);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const touchStartY = useRef<number>(0);

  // Quick play modal state
  const [showQuickPlay, setShowQuickPlay] = useState(false);
  const [quickType, setQuickType] = useState<"par" | "decimal" | "unidad" | "azar" | "mezclar" | null>(null);
  const [quickDigit, setQuickDigit] = useState("");
  const [quickNumbers, setQuickNumbers] = useState("");
  const [quickCount, setQuickCount] = useState("5");
  const [quickPlayType, setQuickPlayType] = useState<PlayType>("directo");

  // Sync credit from API
  useEffect(() => {
    if (apiCredit !== userCredit) {
      setUserCredit(apiCredit);
    }
  }, [apiCredit]);

  useEffect(() => {
    if (openLotteries.length > 0 && selectedLotteries.length === 0) {
      setSelectedLotteries([openLotteries[0]]);
    }
  }, [openLotteries.length]);

  useEffect(() => {
    const calculateCountdown = () => {
      const newCountdowns: Record<number, string> = {};
      allLotteries.forEach((lottery) => {
        const status = getLotteryStatus(lottery);
        newCountdowns[lottery.id] = status.countdown;
      });
      setCountdowns(newCountdowns);
    };
    calculateCountdown();
    const interval = setInterval(calculateCountdown, 30000);
    return () => clearInterval(interval);
  }, [allLotteries]);

  useEffect(() => { saveDraft(plays); }, [plays]);

  const total = plays.reduce((sum, p) => sum + p.amount, 0);
  const showMsg = useCallback((msg: string) => { setMessage(msg); setTimeout(() => setMessage(""), 3000); }, []);

  const getPotentialPrize = useCallback((play: Play): string => {
    const prize = prizeList.find((p: any) => p.playType === play.type);
    if (!prize) return "0";
    const amt = play.amount;
    let mult = 0;
    switch (play.type) {
      case "directo": mult = Number(prize.firstPrizeMultiplier || 0); break;
      case "pale": mult = Number(prize.paleFirstSecondMultiplier || 0); break;
      case "terna": mult = Number(prize.fixedMultiplier || 0); break;
      case "cuatrena": mult = Number(prize.fixedMultiplier || 0); break;
      case "tripleta": mult = Number(prize.fixedMultiplier || 0); break;
    }
    return formatMoney(amt * mult);
  }, [prizeList]);

  function getMaxBetLimit(): number {
    const config = localStorage.getItem("loteria_config");
    if (config) { try { return Number(JSON.parse(config).maxBetAmount) || 0; } catch { return 0; } }
    return 0;
  }

  interface LimitEntry {
    id: number; type: "global" | "user"; userId: number | null; lotteryId: number | null;
    playType: string | null; maxAmount: number; blockedNumbers: string[]; active: boolean;
  }

  function normalizeBlockedNumber(number: string, type: string): string {
    const digits = number.replace(/[^0-9]/g, "");
    if ((type === "pale" || type === "terna" || type === "cuatrena") && digits.length === 4 && !number.includes("+")) {
      return [digits.slice(0, 2), digits.slice(2, 4)].sort().join("+");
    }
    if ((type === "tripleta") && digits.length === 6 && !number.includes("+")) {
      return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].sort().join("+");
    }
    const parts = number.split("+").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts.sort().join("+");
    return number.trim();
  }

  function checkPlayLimit(lotteryId: number, playType: string, number: string, amount: number, userId: number): { allowed: boolean; reason?: string } {
    const limitsRaw = localStorage.getItem("loteria_limits");
    if (!limitsRaw) return { allowed: true };
    const limits: LimitEntry[] = JSON.parse(limitsRaw);
    const normalizedNum = normalizeBlockedNumber(number, playType);
    const applicable = limits.filter((l) => {
      if (!l.active) return false;
      if (l.type === "user" && l.userId !== userId) return false;
      if (l.lotteryId !== null && l.lotteryId !== lotteryId) return false;
      if (l.playType !== null && l.playType !== playType) return false;
      return true;
    });
    for (const limit of applicable) {
      for (const blocked of limit.blockedNumbers) {
        const normalizedBlocked = normalizeBlockedNumber(blocked, playType);
        if (normalizedNum === normalizedBlocked) {
          return { allowed: false, reason: `"${number}" esta BLOQUEADO` };
        }
      }
    }
    for (const limit of applicable) {
      if (limit.maxAmount > 0 && amount > limit.maxAmount) {
        return { allowed: false, reason: `Limite de $${formatMoney(limit.maxAmount)} para ${playType}` };
      }
    }
    return { allowed: true };
  }

  const normalizePlayNumber = useCallback((number: string, type: PlayType): string => {
    const digits = number.replace(/[^0-9]/g, "");
    if (type === "pale") {
      if (digits.length === 4 && !number.includes("+")) {
        const parts = [digits.slice(0, 2), digits.slice(2, 4)];
        return parts.sort().join("+");
      }
      const parts = number.split("+").map((p) => p.trim()).filter(Boolean);
      if (parts.length === 2) return parts.sort().join("+");
    }
    if (type === "tripleta") {
      if (digits.length === 6 && !number.includes("+")) {
        const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];
        return parts.sort().join("+");
      }
      const parts = number.split("+").map((p) => p.trim()).filter(Boolean);
      if (parts.length === 3) return parts.sort().join("+");
    }
    return number;
  }, []);

  const addPlay = useCallback(() => {
    if (selectedLotteries.length === 0) { showMsg("Seleccione al menos una loteria"); return; }
    const playCost = Number(amount) || 0;
    if (playCost > 0 && playCost > userCredit) { showMsg(`Credito insuficiente. Disponible: $${formatMoney(userCredit)}`); return; }
    if (!input.trim()) { showMsg("Ingrese un numero"); return; }
    if (!amount || Number(amount) <= 0) { showMsg("Ingrese monto valido"); return; }

    const trimmed = input.trim();
    const isCombo = trimmed.endsWith("/");
    const baseNumber = isCombo ? trimmed.slice(0, -1) : trimmed;

    function detectChainType(inputStr: string): { parts: string[]; isSinglePlay: boolean } {
      const rawParts = inputStr.split("+").map((s) => s.trim()).filter(Boolean);
      if (rawParts.length === 2 && rawParts.every((p) => p.length === 2 && /^\d+$/.test(p))) {
        return { parts: [inputStr], isSinglePlay: true };
      }
      if (rawParts.length === 3 && rawParts.every((p) => p.length === 2 && /^\d+$/.test(p))) {
        return { parts: [inputStr], isSinglePlay: true };
      }
      return { parts: rawParts, isSinglePlay: false };
    }
    const chainResult = detectChainType(baseNumber);
    const chainParts = chainResult.parts;

    setPlays((prevPlays) => {
      const newPlays = [...prevPlays];
      for (const lottery of selectedLotteries) {
        for (const part of chainParts) {
          const cleanDigits = part.replace(/[^0-9]/g, "");
          let combosToAdd: { number: string; type: PlayType }[] = [];

          if (isCombo) {
            if (cleanDigits.length === 4) {
              generatePaleCombos(cleanDigits).forEach((combo) => combosToAdd.push({ number: combo, type: "pale" }));
            } else if (cleanDigits.length >= 2 && cleanDigits.length <= 3) {
              generateDirectoCombos(cleanDigits).forEach((combo) => combosToAdd.push({ number: combo, type: "directo" }));
            } else {
              const detectedType = detectPlayType(part);
              if (detectedType === "invalido" as PlayType) { showMsg(`"${part}" no es valido`); continue; }
              combosToAdd.push({ number: part, type: detectedType });
            }
          } else {
            const detectedType = detectPlayType(part);
            if (detectedType === "invalido" as PlayType) { showMsg(`"${part}" no es valido`); continue; }
            combosToAdd.push({ number: part, type: detectedType });
          }

          for (const combo of combosToAdd) {
            const limitCheck = checkPlayLimit(lottery.id, combo.type, combo.number, Number(amount), user.id);
            if (!limitCheck.allowed) { showMsg(limitCheck.reason || "No permitido"); continue; }

            const existingIndex = newPlays.findIndex(
              (p) => p.type === combo.type && p.lotteryId === lottery.id && normalizePlayNumber(p.number, p.type) === normalizePlayNumber(combo.number, combo.type)
            );
            const limit = getMaxBetLimit();
            if (existingIndex >= 0) {
              const currentAmt = newPlays[existingIndex].amount;
              const newAmt = currentAmt + Number(amount);
              if (limit > 0 && newAmt > limit) {
                newPlays[existingIndex] = { ...newPlays[existingIndex], amount: limit };
                showMsg(`Limite de $${limit} alcanzado`);
              } else {
                newPlays[existingIndex] = { ...newPlays[existingIndex], amount: newAmt };
              }
            } else if (limit > 0 && Number(amount) > limit) {
              newPlays.push({ id: Math.random().toString(36).substr(2, 9), number: combo.number, amount: limit, type: combo.type, lotteryId: lottery.id, lotteryName: lottery.name });
              showMsg(`Monto limitado a $${limit}`);
            } else {
              newPlays.push({ id: Math.random().toString(36).substr(2, 9), number: combo.number, amount: Number(amount), type: combo.type, lotteryId: lottery.id, lotteryName: lottery.name });
            }
          }
        }
      }
      return newPlays;
    });
    setInput("");
  }, [input, amount, selectedLotteries, showMsg, normalizePlayNumber, userCredit, user.id]);

  const handleKeypad = useCallback((key: string) => {
    if (key === "+" && input.trim() && amount && Number(amount) > 0) { addPlay(); return; }
    if (activeField === "monto") {
      if (key === "C") setAmount("");
      else if (key === "DEL") setAmount((prev) => prev.slice(0, -1));
      else if (key === ".") setAmount((prev) => prev.includes(".") ? prev : prev + ".");
      else if (key !== "+" && key !== "/") setAmount((prev) => prev + key);
    } else {
      if (key === "C") setInput("");
      else if (key === "DEL") setInput((prev) => prev.slice(0, -1));
      else if (key === "+") setInput((prev) => prev + "+");
      else if (key === ".") setInput((prev) => prev + ".");
      else if (key === "/") setInput((prev) => prev + "/");
      else setInput((prev) => prev + key);
    }
  }, [activeField, input, amount, addPlay]);

  const deletePlay = useCallback((id: string) => { setPlays((prev) => prev.filter((p) => p.id !== id)); }, []);
  const startEdit = useCallback((play: Play) => { setEditingId(play.id); setEditAmount(play.amount.toString()); }, []);
  const saveEdit = useCallback((id: string) => {
    const newAmount = Number(editAmount) || 0;
    const limit = getMaxBetLimit();
    if (limit > 0 && newAmount > limit) {
      setPlays((prev) => prev.map((p) => p.id === id ? { ...p, amount: limit } : p));
      showMsg(`Monto limitado a $${limit}`);
    } else {
      setPlays((prev) => prev.map((p) => p.id === id ? { ...p, amount: newAmount } : p));
    }
    setEditingId(null);
  }, [editAmount, showMsg]);
  const clearAll = useCallback(() => { setPlays([]); setInput(""); clearDraft(); }, []);

  // ─── Pale/Tripleta Limit Check (server) ──────────────────────────
  const checkPaleTripletaLimit = useCallback(async (playType: "pale" | "tripleta", number: string, newAmount: number): Promise<{ allowed: boolean; reason?: string }> => {
    if (selectedLotteries.length === 0) return { allowed: true };
    try {
      const result = await limitCheckQuery.refetch({
        lotteryId: selectedLotteries[0].id,
        playType,
        numberCombo: number,
        amount: String(newAmount + plays.filter(p => p.lotteryId === selectedLotteries[0].id && p.type === playType && normalizeCombo(p.number) === normalizeCombo(number)).reduce((s, p) => s + p.amount, 0)),
      });
      if (result.data && !result.data.allowed) {
        return { allowed: false, reason: result.data.reason };
      }
    } catch { /* server check failed, allow locally */ }
    return { allowed: true };
  }, [selectedLotteries, plays, limitCheckQuery]);

  // ─── Quick Play Functions ────────────────────────────────────────
  const executeQuickPlay = useCallback((newPlays: Play[]) => {
    if (selectedLotteries.length === 0) { showMsg("Seleccione loteria primero"); return; }
    const amt = Number(amount) || 0;
    if (amt <= 0) { showMsg("Ingrese monto primero"); return; }
    const totalCost = newPlays.length * amt;
    if (totalCost > userCredit) { showMsg(`Credito insuficiente. Necesita: $${formatMoney(totalCost)}`); return; }

    setPlays((prev) => {
      const all = [...prev];
      for (const play of newPlays) {
        const existingIndex = all.findIndex(
          (p) => p.type === play.type && p.lotteryId === selectedLotteries[0].id && normalizeCombo(p.number) === normalizeCombo(play.number)
        );
        if (existingIndex >= 0) {
          all[existingIndex] = { ...all[existingIndex], amount: all[existingIndex].amount + amt };
        } else {
          all.push({ ...play, amount: amt, lotteryId: selectedLotteries[0].id, lotteryName: selectedLotteries[0].name });
        }
      }
      return all;
    });
    setShowQuickPlay(false);
    setQuickType(null);
    showMsg(`${newPlays.length} jugadas agregadas!`);
  }, [selectedLotteries, amount, userCredit, showMsg]);

  const handlePar = useCallback(() => {
    if (selectedLotteries.length === 0) return;
    const plays = generateParPlays(selectedLotteries[0].id, selectedLotteries[0].name, 0);
    executeQuickPlay(plays);
  }, [selectedLotteries, executeQuickPlay]);

  const handleDecimal = useCallback(() => {
    if (selectedLotteries.length === 0 || quickDigit === "") return;
    const plays = generateDecimalPlays(Number(quickDigit), selectedLotteries[0].id, selectedLotteries[0].name, 0);
    executeQuickPlay(plays);
    setQuickDigit("");
  }, [selectedLotteries, quickDigit, executeQuickPlay]);

  const handleUnidad = useCallback(() => {
    if (selectedLotteries.length === 0 || quickDigit === "") return;
    const plays = generateUnidadPlays(Number(quickDigit), selectedLotteries[0].id, selectedLotteries[0].name, 0);
    executeQuickPlay(plays);
    setQuickDigit("");
  }, [selectedLotteries, quickDigit, executeQuickPlay]);

  const handleAzar = useCallback(() => {
    if (selectedLotteries.length === 0) return;
    const count = Number(quickCount) || 5;
    const plays = generateAzarPlays(quickPlayType, count, selectedLotteries[0].id, selectedLotteries[0].name, 0);
    executeQuickPlay(plays);
  }, [selectedLotteries, quickCount, quickPlayType, executeQuickPlay]);

  const handleMezclar = useCallback(() => {
    if (selectedLotteries.length === 0 || !quickNumbers.trim()) return;
    const nums = quickNumbers.split(/[+,\s]+/).map(s => s.trim()).filter(s => s.length === 2 && /^\d+$/.test(s));
    if (nums.length < 2) { showMsg("Ingrese al menos 2 numeros de 2 cifras"); return; }
    if (quickPlayType !== "pale" && quickPlayType !== "tripleta") { showMsg("Seleccione pale o tripleta"); return; }
    const plays = generateMezclarPlays(quickPlayType, nums, selectedLotteries[0].id, selectedLotteries[0].name, 0);
    executeQuickPlay(plays);
    setQuickNumbers("");
  }, [selectedLotteries, quickNumbers, quickPlayType, executeQuickPlay, showMsg]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 50) setShowKeypad(false);
    else if (diff < -50) setShowKeypad(true);
  }, []);

  const handleSaveTicket = useCallback(() => {
    if (plays.length === 0) { showMsg("Agregue jugadas primero"); return; }
    setShowConfirmModal(true);
  }, [plays.length, showMsg]);

  const generateQR = async (data: string): Promise<string> => {
    try { return await QRCode.toDataURL(data, { width: 200, margin: 2 }); } catch { return ""; }
  };

  const buildPDF = async (ticketData: any): Promise<jsPDF> => {
    const doc = new jsPDF({ unit: "mm", format: [80, 150 + ticketData.plays.length * 8] });
    const pageWidth = 80;
    let y = 8;
    doc.setFillColor(76, 175, 80);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(ticketData.groupName || "BANCA VICTORIA", pageWidth / 2, y + 5, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Sistema de Loteria", pageWidth / 2, y + 10, { align: "center" });
    y = 28;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text(`Ticket No: ${ticketData.code}`, 5, y); y += 5;
    doc.text(`Fecha: ${ticketData.date}`, 5, y); y += 5;
    doc.text(`Hora: ${ticketData.time}`, 5, y); y += 5;
    doc.text(`Terminal: ${ticketData.terminal}`, 5, y); y += 5;
    doc.text(`Vendedor: ${ticketData.seller}`, 5, y); y += 5;
    if (ticketData.groupName) { doc.text(`Grupo: ${ticketData.groupName}`, 5, y); y += 5; }
    doc.text(`Loteria: ${ticketData.lottery}`, 5, y); y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(5, y - 3, pageWidth - 5, y - 3);
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("JUGADAS", 5, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    ticketData.plays.forEach((play: any) => {
      doc.text(`${play.number}`, 5, y);
      doc.text(`${play.type.toUpperCase()}`, 35, y);
      doc.text(`$${formatMoney(play.amount)}`, pageWidth - 5, y, { align: "right" });
      y += 6;
    });
    y += 2;
    doc.line(5, y - 3, pageWidth - 5, y - 3);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", 5, y + 4);
    doc.text(`$${formatMoney(Number(ticketData.total))}`, pageWidth - 5, y + 4, { align: "right" });
    y += 12;
    const qrData = `TICKET:${ticketData.code}|DATE:${ticketData.date}|TIME:${ticketData.time}|TERMINAL:${ticketData.terminal}|TOTAL:${ticketData.total}`;
    const qrDataUrl = await generateQR(qrData);
    if (qrDataUrl) { doc.addImage(qrDataUrl, "PNG", (pageWidth - 30) / 2, y, 30, 30); y += 35; }
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.setTextColor(128, 128, 128);
    doc.text("Gracias por jugar con nosotros!", pageWidth / 2, y, { align: "center" });
    return doc;
  };

  const downloadPDF = async (ticketData: any) => {
    const doc = await buildPDF(ticketData);
    doc.save(`${ticketData.code}.pdf`);
  };

  const generatePDFDataUrl = async (ticketData: any): Promise<string> => {
    const doc = await buildPDF(ticketData);
    return doc.output("datauristring");
  };

  const confirmSave = useCallback(async () => {
    if (selectedLotteries.length === 0) return;
    const netDeduction = calculateNetDeduction(total, userCommission);
    if (netDeduction > userCredit) { showMsg(`Credito insuficiente. Necesita: $${formatMoney(netDeduction)}`); setShowConfirmModal(false); return; }

    // Deduct credit via API
    const newCredit = userCredit - netDeduction;
    try {
      await updateCreditMut.mutateAsync({ id: user.id, credit: String(newCredit) });
      setUserCredit(newCredit);
    } catch (err: any) {
      showMsg("Error al descontar credito: " + (err.message || "Intente de nuevo"));
      setShowConfirmModal(false);
      return;
    }

    // Check for winners
    const { prize: totalPrize, details: prizeDetails } = checkWinningPlays(plays);
    let prizeMsg = "";
    if (totalPrize > 0) {
      const creditWithPrize = newCredit + totalPrize;
      try {
        await updateCreditMut.mutateAsync({ id: user.id, credit: String(creditWithPrize) });
        setUserCredit(creditWithPrize);
        prizeMsg = ` | Premio: $${formatMoney(totalPrize)}!`;
      } catch { /* prize failed but continue */ }
    }

    const code = generateTicketCode();
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString();
    const lotteryNames = selectedLotteries.map((l) => l.name).join(", ");
    const gs = JSON.parse(localStorage.getItem("loteria_groups") || "[]");
    const groupName = user.groupId ? (gs.find((g: any) => g.id === user.groupId)?.name || "") : "";

    const ticketData: any = {
      id: Date.now(), code, userId: user.id,
      lotteryId: selectedLotteries[0].id,
      total: formatMoney(total), status: "active", date, time,
      createdAt: now.toISOString(),
      netDeduction: netDeduction.toFixed(2),
      commission: String(userCommission),
      plays: plays.map((p) => ({ ...p, id: Math.random().toString(36).substr(2, 9) })),
      terminal: user.bankNumber, seller: user.name, lottery: lotteryNames, groupName,
    };

    try {
      const pdfDataUrl = await generatePDFDataUrl(ticketData);
      ticketData.pdfDataUrl = pdfDataUrl;
    } catch { /* PDF failed */ }

    // Save ticket to database via tRPC
    try {
      const playList = ticketData.plays.map((p: any) => ({
        number: p.number,
        amount: String(p.amount),
        type: p.type,
        lotteryId: p.lotteryId,
      }));
      await createTicketMut.mutateAsync({
        code,
        userId: user.id,
        lotteryId: selectedLotteries[0].id,
        total: formatMoney(total),
        commission: String(userCommission),
        netDeduction: String(netDeduction),
        playList,
      });
    } catch (err: any) {
      showMsg("Error al guardar ticket: " + (err.message || "Verifique conexion"));
      // Restore credit on failure
      await updateCreditMut.mutateAsync({ id: user.id, credit: String(userCredit) });
      setShowConfirmModal(false);
      return;
    }

    logAudit({ type: "ticket_sale", userId: user.id, userName: user.name, groupId: user.groupId, amount: total, description: `Venta: ${ticketData.plays.length} jugadas por $${formatMoney(total)}`, ticketCode: code, balanceAfter: newCredit });
    if (totalPrize > 0) {
      logAudit({ type: "prize_win", userId: user.id, userName: user.name, groupId: user.groupId, amount: totalPrize, description: `Premio: $${formatMoney(totalPrize)} | ${prizeDetails.join(", ")}`, ticketCode: code, balanceAfter: newCredit + totalPrize });
    }

    clearDraft();
    setPlays([]);
    setLastTicket(ticketData);
    setShowConfirmModal(false);
    setShowTicketModal(true);
    setMessage(`Ticket ${code} guardado! -$${formatMoney(netDeduction)}${prizeMsg}`);
    setTimeout(() => setMessage(""), 5000);
  }, [plays, selectedLotteries, total, user, userCredit, userCommission, updateCreditMut, createTicketMut, showMsg]);

  const shareWhatsApp = useCallback(() => {
    const ticket = lastTicket;
    if (!ticket) { showMsg("Guarde un ticket primero"); return; }
    const lines = ticket.plays.map((p: any) => `${p.number} - ${p.type.toUpperCase()} - $${formatMoney(p.amount)}`).join("\n");
    const gs = JSON.parse(localStorage.getItem("loteria_groups") || "[]");
    const groupName = user.groupId ? (gs.find((g: any) => g.id === user.groupId)?.name || "") : "";
    const appName = groupName || "BANCA VICTORIA";
    const subLine = groupName ? "\n_Banca Victoria_" : "";
    const text = `*${appName}*${subLine}\nTicket: *${ticket.code}*\nFecha: ${ticket.date}\nHora: ${ticket.time}\nTerminal: ${ticket.terminal}\nVendedor: ${ticket.seller}\nLoteria: ${ticket.lottery}\n\n*JUGADAS:*\n${lines}\n\n*Total: $${ticket.total}*\n\nCodigo QR: ${ticket.code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, [lastTicket, showMsg, user]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 shrink-0">
        <button onClick={() => setShowLotteryModal(true)} className="w-full flex items-center justify-between px-3 py-1.5 bg-white/15 backdrop-blur rounded-lg hover:bg-white/25 transition-all border border-white/20">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Ticket size={16} className="text-white shrink-0" />
            <div className="text-left min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">
                {selectedLotteries.length === 0 ? "Seleccionar Loterias" : selectedLotteries.length === 1 ? selectedLotteries[0].name : `${selectedLotteries.length} loterias`}
              </p>
              <p className="text-[10px] text-green-200">
                {selectedLotteries.length > 0 ? selectedLotteries.map((l) => `${l.name} (${countdowns[l.id] || "..."})`).join(", ") : "Toca para seleccionar"}
              </p>
            </div>
          </div>
          <ChevronDown size={16} className="text-white/80 shrink-0 ml-2" />
        </button>
      </div>

      <div className="px-3 py-1 bg-green-800/50 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Wallet size={12} className="text-green-200" />
          <span className="text-[10px] text-green-200">Credito: <span className="font-bold text-white">${formatMoney(userCredit)}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Percent size={12} className="text-green-200" />
          <span className="text-[10px] text-green-200">Comision: <span className="font-bold text-white">{userCommission}%</span></span>
        </div>
      </div>

      {openLotteries.length === 0 && (
        <div className="mx-3 mt-2 bg-red-600 text-white px-3 py-2 rounded-lg text-sm text-center flex items-center justify-center gap-2">
          <Lock size={14} /> No hay loterias abiertas
        </div>
      )}

      {message && <div className="mx-3 mt-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm text-center">{message}</div>}

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
        {plays.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
            <Ticket size={48} className="mb-3 text-green-200" />
            <p className="text-sm">Sin jugadas. Ingrese numeros y monto.</p>
            <p className="text-xs mt-1 text-gray-300">Use + para cadenas, / para combos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plays.map((play) => (
              <div key={play.id} className="play-row bg-white rounded-xl border border-green-200 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{play.number}</p>
                    <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">{play.type} - {play.lotteryName}</p>
                  </div>
                  {editingId === play.id ? (
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-20 px-2 py-1.5 text-base border border-green-300 rounded-lg text-right font-bold" autoFocus />
                      <button onClick={() => saveEdit(play.id)} className="p-2 bg-green-100 rounded-lg"><Check size={16} className="text-green-700" /></button>
                      <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 rounded-lg"><X size={16} className="text-gray-600" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        <span className="text-lg font-bold text-green-700">${formatMoney(play.amount)}</span>
                        <span className="text-[10px] block text-yellow-600 font-medium">Paga: ${getPotentialPrize(play)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => startEdit(play)} className="p-1.5 bg-blue-50 rounded-md hover:bg-blue-100"><Edit2 size={14} className="text-blue-600" /></button>
                        <button onClick={() => deletePlay(play.id)} className="p-1.5 bg-red-50 rounded-md hover:bg-red-100"><Trash2 size={14} className="text-red-500" /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {plays.length > 0 && (
        <div className="px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white shrink-0">
          <div className="flex items-center justify-between">
            <button onClick={clearAll} className="flex items-center gap-1.5 text-xs text-red-200"><Trash2 size={14} /> Limpiar</button>
            <p className="text-[10px] text-green-200">{plays.length} jugada(s)</p>
            <p className="text-xl font-extrabold">${formatMoney(total)}</p>
          </div>
          {userCommission > 0 && (
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/20">
              <p className="text-[10px] text-green-200">Desc. comision ({userCommission}%):</p>
              <p className="text-[10px] font-bold text-yellow-200">-${formatMoney(total * (userCommission / 100))}</p>
            </div>
          )}
        </div>
      )}

      <div className="px-3 pt-2 pb-1 bg-white border-t border-green-100 shrink-0 space-y-1.5">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input type="text" value={input} readOnly inputMode="none" className={`w-full px-3 py-2 text-base font-bold border-2 rounded-xl outline-none bg-green-50/50 text-gray-900 placeholder-green-300 cursor-pointer transition-all ${activeField === "numero" ? "border-green-500 ring-2 ring-green-200" : "border-green-200"}`} placeholder="Numero" onClick={() => { setActiveField("numero"); setShowKeypad(true); }} />
            {input && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                {input.endsWith("/") ? (input.replace(/[^0-9]/g, "").length === 4 ? "COMBO PALE" : "COMBO DIRECTO") : detectPlayType(input).toUpperCase()}
              </span>
            )}
          </div>
          <div className="w-28">
            <input type="text" value={amount} readOnly inputMode="none" className={`w-full px-3 py-2 text-base font-bold border-2 rounded-xl outline-none bg-green-50/50 text-green-700 placeholder-green-300 text-right cursor-pointer transition-all ${activeField === "monto" ? "border-green-500 ring-2 ring-green-200" : "border-green-200"}`} placeholder="Monto" onClick={() => { setActiveField("monto"); setShowKeypad(true); }} />
          </div>
        </div>
      </div>

      {showKeypad && (
        <div className="shrink-0 bg-white px-3 pb-1 pt-0 cursor-grab active:cursor-grabbing select-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={() => setShowKeypad(false)}>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
            <span className="text-[9px] text-gray-400">Desliza o toca para ocultar</span>
          </div>
        </div>
      )}

      {!showKeypad && (
        <div className="shrink-0 bg-white px-3 py-1 border-t border-green-100">
          <button onClick={() => setShowKeypad(true)} className="w-full flex items-center justify-center gap-2 py-2 bg-green-50 rounded-xl border border-green-200 hover:bg-green-100 transition-all">
            <Keyboard size={16} className="text-green-600" />
            <ChevronUp size={14} className="text-green-600" />
            <span className="text-xs font-semibold text-green-700">Mostrar Teclado</span>
          </button>
        </div>
      )}

      {showKeypad && (
        <div className="px-3 pb-1.5 pt-1 bg-white shrink-0 transition-all" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="grid grid-cols-4 gap-1">
            <button onClick={() => handleKeypad("1")} className="keypad-btn">1</button>
            <button onClick={() => handleKeypad("2")} className="keypad-btn">2</button>
            <button onClick={() => handleKeypad("3")} className="keypad-btn">3</button>
            <button onClick={() => handleKeypad("+")} className="keypad-btn-green" title="Agregar jugada"><Plus size={18} /></button>
            <button onClick={() => handleKeypad("4")} className="keypad-btn">4</button>
            <button onClick={() => handleKeypad("5")} className="keypad-btn">5</button>
            <button onClick={() => handleKeypad("6")} className="keypad-btn">6</button>
            <button onClick={() => handleKeypad("/")} className="keypad-btn-green text-sm">/</button>
            <button onClick={() => handleKeypad("7")} className="keypad-btn">7</button>
            <button onClick={() => handleKeypad("8")} className="keypad-btn">8</button>
            <button onClick={() => handleKeypad("9")} className="keypad-btn">9</button>
            <button onClick={() => handleKeypad(".")} className="keypad-btn-green">.</button>
            <button onClick={() => handleKeypad("C")} className="keypad-btn-red">C</button>
            <button onClick={() => handleKeypad("0")} className="keypad-btn">0</button>
            <button onClick={() => handleKeypad("DEL")} className="keypad-btn-red text-xs">DEL</button>
            <button onClick={() => addPlay()} className="keypad-btn-green" title="Agregar"><Plus size={18} /></button>
            <button onClick={() => setShowQuickPlay(true)} className="col-span-1 keypad-btn-green flex items-center justify-center gap-1 text-xs font-bold"><Zap size={14} /> Rapida</button>
            <button onClick={handleSaveTicket} className="col-span-1 keypad-btn-green flex items-center justify-center gap-1 text-sm"><Save size={16} /> Guardar</button>
            <button onClick={() => { if (lastTicket) downloadPDF(lastTicket); else showMsg("Guarde un ticket primero"); }} className="keypad-btn flex items-center justify-center text-red-600"><FileText size={16} /></button>
            <button onClick={shareWhatsApp} className="keypad-btn flex items-center justify-center text-green-600"><Share2 size={16} /></button>
          </div>
        </div>
      )}

      {showLotteryModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80%] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">Seleccionar Loterias</h3>
              <button onClick={() => setShowLotteryModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="px-4 py-2 bg-green-50 border-b border-green-100">
              <p className="text-xs text-green-700">Toca para seleccionar multiples loterias.</p>
            </div>
            <div className="overflow-y-auto custom-scrollbar p-3 space-y-2 flex-1">
              {openLotteries.length > 0 && <div className="text-[10px] font-bold text-green-700 mb-1">ABIERTAS AHORA</div>}
              {openLotteries.map((lottery) => {
                const isSelected = selectedLotteries.some((l) => l.id === lottery.id);
                return (
                  <button key={lottery.id} onClick={() => { setSelectedLotteries((prev) => isSelected ? prev.filter((l) => l.id !== lottery.id) : [...prev, lottery]); }} className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected ? "bg-green-50 border-green-400" : "bg-white border-gray-200 hover:border-green-300"}`}>
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-green-500 border-green-500" : "border-gray-300"}`}>{isSelected && <Check size={14} className="text-white" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{lottery.name}</p>
                      <p className="text-[10px] text-gray-500">Cierra en: <span className="font-bold text-green-600">{countdowns[lottery.id] || "..."}</span></p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-gray-100">
              <button onClick={() => setShowLotteryModal(false)} className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700">
                {selectedLotteries.length} loteria(s) seleccionada(s) - Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="font-bold text-lg text-gray-900 text-center mb-3">Confirmar Ticket</h3>
            <p className="text-sm text-gray-600 text-center mb-4">{plays.length} jugada(s) por <strong className="text-green-700">${formatMoney(total)}</strong></p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
              {plays.map((p, i) => (<div key={i} className="flex justify-between text-xs py-0.5"><span className="text-gray-700">{p.number} ({p.type})</span><span className="text-green-700 font-medium">${formatMoney(p.amount)}</span></div>))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">Cancelar</button>
              <button onClick={confirmSave} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {showTicketModal && lastTicket && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3"><Check size={32} className="text-green-600" /></div>
              <h3 className="font-bold text-xl text-gray-900">Ticket Guardado!</h3>
              <p className="text-sm text-gray-500 mt-1">{lastTicket.code}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Fecha:</span><span className="font-medium">{lastTicket.date}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Hora:</span><span className="font-medium">{lastTicket.time}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Terminal:</span><span className="font-medium">{lastTicket.terminal}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Vendedor:</span><span className="font-medium">{lastTicket.seller}</span></div>
              {lastTicket.groupName && <div className="flex justify-between"><span className="text-gray-500">Grupo:</span><span className="font-medium text-green-700">{lastTicket.groupName}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Loteria:</span><span className="font-medium">{lastTicket.lottery}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="text-gray-700 font-bold">Total:</span><span className="font-bold text-green-700">${formatMoney(Number(lastTicket.total))}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => downloadPDF(lastTicket)} className="py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 flex items-center justify-center gap-2"><FileText size={16} /> PDF</button>
              <button onClick={shareWhatsApp} className="py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2"><Share2 size={16} /> WhatsApp</button>
            </div>
            <button onClick={() => setShowTicketModal(false)} className="w-full mt-2 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">Cerrar</button>
          </div>
        </div>
      )}

      {/* Quick Play Modal */}
      {showQuickPlay && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85%] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">Jugada Rapida</h3>
              <button onClick={() => { setShowQuickPlay(false); setQuickType(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-500" /></button>
            </div>

            {!quickType ? (
              <div className="p-4 grid grid-cols-2 gap-3">
                <button onClick={() => setQuickType("par")} className="flex flex-col items-center gap-2 p-4 bg-green-50 rounded-xl border border-green-200 hover:bg-green-100 transition-all">
                  <Hash size={24} className="text-green-600" />
                  <span className="text-sm font-bold text-green-700">PAR</span>
                  <span className="text-[10px] text-green-500">11,22,33...00</span>
                </button>
                <button onClick={() => setQuickType("decimal")} className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-all">
                  <Hash size={24} className="text-blue-600" />
                  <span className="text-sm font-bold text-blue-700">DECIMAL</span>
                  <span className="text-[10px] text-blue-500">02,12,22...92</span>
                </button>
                <button onClick={() => setQuickType("unidad")} className="flex flex-col items-center gap-2 p-4 bg-purple-50 rounded-xl border border-purple-200 hover:bg-purple-100 transition-all">
                  <Hash size={24} className="text-purple-600" />
                  <span className="text-sm font-bold text-purple-700">UNIDAD</span>
                  <span className="text-[10px] text-purple-500">20,21,22...29</span>
                </button>
                <button onClick={() => setQuickType("azar")} className="flex flex-col items-center gap-2 p-4 bg-orange-50 rounded-xl border border-orange-200 hover:bg-orange-100 transition-all">
                  <Dices size={24} className="text-orange-600" />
                  <span className="text-sm font-bold text-orange-700">AZAR</span>
                  <span className="text-[10px] text-orange-500">Aleatorio</span>
                </button>
                <button onClick={() => setQuickType("mezclar")} className="flex flex-col items-center gap-2 p-4 bg-pink-50 rounded-xl border border-pink-200 hover:bg-pink-100 transition-all col-span-2">
                  <Shuffle size={24} className="text-pink-600" />
                  <span className="text-sm font-bold text-pink-700">MEZCLAR</span>
                  <span className="text-[10px] text-pink-500">Todas las combinaciones</span>
                </button>
              </div>
            ) : quickType === "par" ? (
              <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">Genera todos los numeros pares: 11, 22, 33, 44, 55, 66, 77, 88, 99, 00</p>
                <p className="text-xs text-gray-500">Monto por jugada: <strong className="text-green-700">${amount || "0"}</strong></p>
                <button onClick={handlePar} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700">Generar 10 jugadas</button>
              </div>
            ) : quickType === "decimal" ? (
              <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">Elije un digito (0-9) para fijar el segundo numero.</p>
                <p className="text-xs text-gray-500">Ejemplo: 2 genera 02, 12, 22, 32, 42, 52, 62, 72, 82, 92</p>
                <input type="number" min="0" max="9" value={quickDigit} onChange={(e) => setQuickDigit(e.target.value.slice(-1))} className="w-full px-4 py-3 text-center text-2xl font-bold border-2 border-green-300 rounded-xl" placeholder="0-9" />
                <p className="text-xs text-gray-500">Monto: <strong className="text-green-700">${amount || "0"}</strong></p>
                <button onClick={handleDecimal} disabled={quickDigit === ""} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50">Generar</button>
              </div>
            ) : quickType === "unidad" ? (
              <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">Elije un digito (0-9) para fijar el primer numero.</p>
                <p className="text-xs text-gray-500">Ejemplo: 2 genera 20, 21, 22, 23, 24, 25, 26, 27, 28, 29</p>
                <input type="number" min="0" max="9" value={quickDigit} onChange={(e) => setQuickDigit(e.target.value.slice(-1))} className="w-full px-4 py-3 text-center text-2xl font-bold border-2 border-purple-300 rounded-xl" placeholder="0-9" />
                <p className="text-xs text-gray-500">Monto: <strong className="text-green-700">${amount || "0"}</strong></p>
                <button onClick={handleUnidad} disabled={quickDigit === ""} className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50">Generar</button>
              </div>
            ) : quickType === "azar" ? (
              <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">Genera jugadas aleatorias.</p>
                <select value={quickPlayType} onChange={(e) => setQuickPlayType(e.target.value as PlayType)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="directo">Directo (2 cifras)</option>
                  <option value="pale">Pale (4 cifras)</option>
                  <option value="tripleta">Tripleta (6 cifras)</option>
                </select>
                <div>
                  <label className="text-xs text-gray-500">Cantidad de jugadas</label>
                  <input type="number" min="1" max="50" value={quickCount} onChange={(e) => setQuickCount(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold" />
                </div>
                <p className="text-xs text-gray-500">Monto: <strong className="text-green-700">${amount || "0"}</strong></p>
                <button onClick={handleAzar} className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700">Generar {quickCount} jugadas {quickPlayType}</button>
              </div>
            ) : quickType === "mezclar" ? (
              <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">Introduce numeros de 2 cifras separados por coma, espacio o +.</p>
                <p className="text-xs text-gray-500">Ejemplo: 12, 34, 56, 78</p>
                <textarea value={quickNumbers} onChange={(e) => setQuickNumbers(e.target.value)} className="w-full px-3 py-2 border border-pink-300 rounded-lg text-sm font-mono" rows={3} placeholder="12, 34, 56, 78" />
                <select value={quickPlayType} onChange={(e) => setQuickPlayType(e.target.value as PlayType)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="pale">Pale (combinaciones de 2)</option>
                  <option value="tripleta">Tripleta (combinaciones de 3)</option>
                </select>
                <p className="text-xs text-gray-500">Monto: <strong className="text-green-700">${amount || "0"}</strong></p>
                <button onClick={handleMezclar} disabled={!quickNumbers.trim()} className="w-full py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 disabled:opacity-50">Mezclar</button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}