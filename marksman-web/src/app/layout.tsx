import type { Metadata } from "next";
import { Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";

const scp = Source_Code_Pro({
  subsets: ["latin"],
  weight: "500",
});

export const metadata: Metadata = {
  title: "Marksman",
  description:
    "Create and complete osu! beatmap bounties to earn Bounty Points.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className={`bg-slate-950 text-white min-h-full flex flex-col ${scp.className}`}
      >
        <AuthProvider>
          <NavBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
