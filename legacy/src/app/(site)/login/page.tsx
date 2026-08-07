"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка при входе");

      login(data.user);
      // Покупатель на главную, но уважает не-админский redirect (например /profile);
      // админ/партнёр — на redirect или в /admin.
      // redirect санируем: только внутренние пути (без внешних и protocol-relative URL).
      const role = data.user?.role;
      const requested = searchParams.get("redirect");
      const safe = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : null;
      const redirect =
        role === "BUYER" ? (safe && !safe.startsWith("/admin") ? safe : "/") : safe || "/admin";
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  const quickAccounts = [
    { label: "Администратор", email: "admin@travelhub.az", pwd: "admin123" },
    { label: "Партнёр", email: "info@navitravel.az", pwd: "partner123" },
    { label: "Покупатель", email: "buyer@mail.com", pwd: "buyer123" },
  ];

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-xl">T</div>
            <span className="text-2xl font-bold text-secondary">Travel<span className="text-primary">Hub</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-secondary mt-6 mb-2">С возвращением!</h1>
          <p className="text-gray-500">Войдите в свой аккаунт TravelHub</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
          {error && <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-secondary mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-0 outline-none transition-colors text-sm bg-gray-50" required />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-secondary mb-2">Пароль</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full h-12 px-4 pr-12 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-0 outline-none transition-colors text-sm bg-gray-50" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-secondary">{showPassword ? "🙈" : "👁"}</button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                <span className="text-sm text-gray-600">Запомнить меня</span>
              </label>
              <span className="text-sm text-gray-400 font-medium" title="Восстановление пароля скоро будет доступно">Забыли пароль?</span>
            </div>

            <button type="submit" disabled={loading} className="w-full h-12 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-base transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Входим…" : "Войти"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Нет аккаунта? <Link href="/register" className="text-primary hover:text-primary-dark font-semibold">Зарегистрироваться</Link>
          </p>
        </div>

        {/* Тестовые учётки для быстрого входа */}
        <div className="mt-6 bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
          <p className="text-xs text-gray-400 text-center mb-3">Быстрый вход (тестовые данные)</p>
          <div className="grid grid-cols-1 gap-2">
            {quickAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => { setEmail(acc.email); setPassword(acc.pwd); setError(""); }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 hover:bg-primary/5 text-sm text-gray-600 hover:text-primary transition-colors flex items-center justify-between"
              >
                <span>{acc.label}</span>
                <span className="text-xs text-gray-400 font-mono">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50"><div className="w-12 h-12 border-4 border-gray-200 border-t-primary rounded-full animate-spin" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
