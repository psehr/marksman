import "./globals.css";
import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import { BasicButton } from "@components/buttons";
import Nav from "@components/nav";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Marksman 🎯",
  description: "An osu! bounty system",
};

const inter = Comfortaa({ subsets: ["latin"] });

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html
      lang="en"
      className="w-screen h-screen bg-slate-900 text-white p-0 m-0 overflow-x-hidden "
    >
      <body
        className={`flex flex-col w-full h-full ${inter.className} relative`}
      >
        <SessionProvider session={session}>
          <Nav />
          <main className="absolute flex w-full h-[calc(100%_-_6rem)] place-content-center items-center mt-24 mb-24">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
