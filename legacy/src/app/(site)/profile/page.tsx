import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "Личный кабинет — TravelHub",
};

export default async function ProfilePage() {
  // Defense in depth: proxy уже защищает /profile, но проверяем и здесь
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/profile");

  const roleLabel =
    user.role === "ADMIN" ? "Администратор" : user.role === "PARTNER" ? "Партнёр" : "Покупатель";

  return (
    <main className="min-h-[70vh] bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/25">
              {(user.firstName || "U")[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-secondary">
                {user.firstName} {user.lastName ?? ""}
              </h1>
              <p className="text-gray-500 text-sm">{user.email}</p>
            </div>
          </div>

          <dl className="space-y-4 text-sm">
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <dt className="text-gray-500">Роль</dt>
              <dd className="font-semibold text-secondary">{roleLabel}</dd>
            </div>
            {user.companyName && (
              <div className="flex justify-between border-b border-gray-100 pb-3">
                <dt className="text-gray-500">Компания</dt>
                <dd className="font-semibold text-secondary">{user.companyName}</dd>
              </div>
            )}
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-semibold text-secondary">{user.email}</dd>
            </div>
          </dl>

          <div className="mt-8 flex gap-3">
            <Link
              href={user.role === "BUYER" ? "/" : "/admin"}
              className="flex-1 text-center px-4 h-11 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 inline-flex items-center justify-center"
            >
              {user.role === "BUYER" ? "На главную" : "В админку"}
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Раздел «Бронирования» и другие возможности личного кабинета появятся в следующей версии.
        </p>
      </div>
    </main>
  );
}
