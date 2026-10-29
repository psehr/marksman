import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import NavBar from "@/components/layout/NavBar";
import { base_font } from "@/lib/fonts";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "🎯 Marksman - osu! bounties",
  description:
    "Create and complete osu! bounties, earn Bounty Points and compete against other hunters.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className={`bg-background text-foreground flex flex-col ${base_font.className} min-h-screen`}
      >
        <AuthProvider>
          <NavBar />
          <div className="flex-1">{children}</div>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
