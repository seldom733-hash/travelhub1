import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/lib/auth-context";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Header />
      {children}
      <Footer />
    </AuthProvider>
  );
}
