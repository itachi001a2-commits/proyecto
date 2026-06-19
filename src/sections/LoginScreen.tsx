import { useState } from "react";
import { saveSession } from "@/store";
import type { SessionUser } from "@/store";
import { trpc } from "@/providers/trpc";
import { Eye, EyeOff } from "lucide-react";

interface LoginScreenProps {
  onLogin: (user: SessionUser) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loginMut = trpc.lotteryUser.login.useMutation({
    onSuccess: (data) => {
      if (data.success && data.user) {
        const user: SessionUser = {
          id: data.user.id,
          bankNumber: data.user.bankNumber,
          name: data.user.name,
          username: data.user.username,
          role: data.user.role as "admin" | "supervisor" | "collector" | "user",
          credit: String(data.user.credit),
          commission: String(data.user.commission || "0"),
          groupId: data.user.groupId,
        };
        saveSession(user);
        onLogin(user);
      } else {
        setError(data.error || "Usuario o contrasena incorrectos");
        setLoading(false);
      }
    },
    onError: (err) => {
      setError("Error de conexion: " + err.message);
      setLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Ingrese usuario y contrasena");
      return;
    }

    setLoading(true);
    loginMut.mutate({ username: username.trim(), password: password.trim() });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-600 via-green-700 to-green-800 p-4">
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto bg-white rounded-2xl flex items-center justify-center shadow-2xl mb-4">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <path d="M7 7h.01" /><path d="M17 7h.01" /><path d="M7 11h.01" /><path d="M17 11h.01" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">BANCA VICTORIA</h1>
        <p className="text-green-200 text-sm mt-1">Sistema de Gestion de Loteria</p>
      </div>

      <div className="w-full max-w-sm bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-white/20">
        <h2 className="text-xl font-bold text-white text-center mb-5">Iniciar Sesion</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-green-100 text-sm font-medium mb-1.5">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-200/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/30 transition-all"
              placeholder="Nombre de usuario"
              autoCapitalize="none"
            />
          </div>

          <div>
            <label className="block text-green-100 text-sm font-medium mb-1.5">Contrasena</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-200/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/30 transition-all"
                placeholder="Contrasena"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-green-200 hover:text-white transition-colors"
              >
                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/40 rounded-lg px-3 py-2 text-red-100 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-white text-green-700 font-bold text-base hover:bg-green-50 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Conectando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-green-200/60 text-xs">Credenciales por defecto:</p>
          <p className="text-green-100/80 text-xs mt-1">admin / admin123</p>
        </div>
      </div>

      <p className="text-green-200/40 text-xs mt-6 text-center">Banca Victoria v2.0 - Online</p>
    </div>
  );
}
