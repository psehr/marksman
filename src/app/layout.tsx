import "./globals.css";
import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import { BasicButton } from "@components/buttons";
import Nav from "@components/nav";

export const metadata: Metadata = {
  title: "Marksman 🎯",
  description: "An osu! bounty system",
};

const inter = Comfortaa({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="w-screen h-screen bg-slate-900 text-white p-0 m-0 overflow-x-hidden "
    >
      <body
        className={`flex flex-col w-full h-full ${inter.className} relative`}
      >
        <Nav />
        <main className="absolute flex w-full h-[calc(100%_-_6rem)] place-content-center items-center mt-24 mb-24">
          {children}
        </main>
      </body>
    </html>
  );
}
