import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell/app-shell";
import { getActiveTeacher } from "@/lib/auth";
import { getUserContextRepository } from "@/lib/db/repositories/user-context.pg";

export const dynamic = "force-dynamic";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Unterrichtsassistenz LSA",
    template: "%s · Unterrichtsassistenz LSA",
  },
  description:
    "Datenschutzsensibler, quellengebundener KI-Assistent für Lehrkräfte in Sachsen-Anhalt. UI-Prototyp.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [teacher, userContext] = await Promise.all([
    getActiveTeacher(),
    getUserContextRepository().current(),
  ]);
  return (
    <html
      lang="de"
      className={`${inter.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell teacherName={teacher?.displayName ?? null} userContext={userContext}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}