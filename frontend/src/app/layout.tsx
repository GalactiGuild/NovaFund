import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { NotificationProvider } from "../contexts/NotificationContext";
import { SocialProvider } from "../contexts/SocialContext";
import { LiveNotificationToast } from "../components/notifications/LiveNotificationToast";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NovaFund | Decentralized Micro-Investment",
  description: "The decentralized micro-investment platform on Stellar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen flex flex-col">
        <NotificationProvider>
          <SocialProvider>
            <Header />
            <LiveNotificationToast />
            <main className="flex-1 max-w-7xl mx-auto px-4 py-6 pt-16">
              {children}
            </main>
            <Footer />
          </SocialProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
