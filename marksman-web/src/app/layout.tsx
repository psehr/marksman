import type { Metadata } from "next";
import { Anonymous_Pro, Encode_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";
import { base_font } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Marksman",
  description:
    "Create and complete osu! beatmap bounties to earn Bounty Points.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className={`bg-background text-foreground flex flex-col ${base_font.className}`}
      >
        <AuthProvider>
          <NavBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
