"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const PARTNER_TYPE_LABELS: Record<string, string> = {
  tourOperator: "Туроператор",
  hotel: "Отель",
  sanatorium: "Санаторий",
  guide: "Гид",
  photographer: "Фотограф",
  transporter: "Транспортная компания",
  excursionOrg: "Экскурсионное бюро",
};

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedPartnerType, setSelectedPartnerType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const roles = [
    { id: "buyer", label: "Покупатель", icon: "🛒", desc: "Покупаю туры и услуги" },
    { id: "partner", label: "Партнёр", icon: "🤝", desc: "Предлагаю свои услуги" },
  ];

  const partnerTypes = [
    "tourOperator",
    "hotel",
    "sanatorium",
    "guide",
    "photographer",
    "transporter",
    "excursionOrg",
  ];

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setStep(roleId === "partner" ? 2 : 3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (formData.password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          companyName: selectedRole === "partner" ? formData.companyName.trim() : undefined,
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          password: formData.password,
          role: selectedRole === "partner" ? "PARTNER" : "BUYER",
          partnerType: selectedPartnerType || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка при регистрации");

      login(data.user);
      // По роли: покупатель на главную, партнёр в админку
      router.push(data.user?.role === "BUYER" ? "/" : "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-xl">T</div>
            <span className="text-2xl font-bold text-secondary">Travel<span className="text-primary">Hub</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-secondary mt-6 mb-2">Создать аккаунт</h1>
          <p className="text-gray-500">Присоединяйтесь к TravelHub</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s ? "bg-primary text-white" : "bg-gray-200 text-gray-500"}`}>
                {step > s ? "✓" : s}
              </div>
              {s < 3 && <div className={`w-12 h-1 rounded ${step > s ? "bg-primary" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-gray-100">
          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold text-secondary mb-6 text-center">Кто вы?</h2>
              <div className="grid grid-cols-2 gap-4">
                {roles.map((role) => (
                  <button key={role.id} onClick={() => handleRoleSelect(role.id)} className="p-6 rounded-2xl border-2 border-gray-200 hover:border-primary/50 hover:shadow-lg transition-all text-center">
                    <div className="text-4xl mb-3">{role.icon}</div>
                    <h3 className="font-bold text-secondary mb-1">{role.label}</h3>
                    <p className="text-sm text-gray-500">{role.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && selectedRole === "partner" && (
            <div>
              <h2 className="text-lg font-bold text-secondary mb-6 text-center">Выберите тип партнёра</h2>
              <div className="grid grid-cols-2 gap-3">
                {partnerTypes.map((type) => (
                  <button key={type} onClick={() => { setSelectedPartnerType(type); setStep(3); }} className="p-4 rounded-xl border-2 border-gray-200 hover:border-primary/50 text-left transition-all">
                    <span className="text-sm font-medium text-secondary">{PARTNER_TYPE_LABELS[type]}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="w-full h-12 mt-4 text-gray-500 hover:text-secondary font-medium transition-colors">← Назад</button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-bold text-secondary mb-6 text-center">Заполните данные</h2>
              {error && <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  {selectedRole === "partner" && selectedPartnerType !== "guide" && (
                    <div>
                      <label className="block text-sm font-semibold text-secondary mb-2">Название компании <span className="text-gray-400 font-normal">(необязательно)</span></label>
                      <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} placeholder="ООО TravelHub" className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none text-sm bg-gray-50" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-secondary mb-2">Имя</label>
                      <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} placeholder="Иван" className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none text-sm bg-gray-50" required />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-secondary mb-2">Фамилия</label>
                      <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} placeholder="Иванов" className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none text-sm bg-gray-50" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2">Email</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="your@email.com" className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none text-sm bg-gray-50" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2">Телефон</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+994 XX XXX XX XX" className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none text-sm bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2">Пароль</label>
                    <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Минимум 8 символов" className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none text-sm bg-gray-50" required minLength={8} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2">Подтвердите пароль</label>
                    <input type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="Повторите пароль" className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none text-sm bg-gray-50" required />
                  </div>
                </div>
                <label className="flex items-start gap-2 mt-4 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary" required />
                  <span className="text-sm text-gray-600">Я принимаю условия использования и политику конфиденциальности</span>
                </label>
                <button type="submit" disabled={loading} className="w-full h-12 mt-6 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Регистрируем…" : "Зарегистрироваться"}
                </button>
              </form>
              <button onClick={() => setStep(selectedRole === "partner" ? 2 : 1)} className="w-full h-12 mt-4 text-gray-500 hover:text-secondary font-medium transition-colors">← Назад</button>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Уже есть аккаунт? <Link href="/login" className="text-primary hover:text-primary-dark font-semibold">Войти</Link>
        </p>
      </div>
    </div>
  );
}
