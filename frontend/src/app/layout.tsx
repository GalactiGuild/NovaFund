import type { Metadata } from "next";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { NotificationProvider } from "../contexts/NotificationContext";
import { SocialProvider } from "../contexts/SocialContext";
import { LiveNotificationToast } from "../components/notifications/LiveNotificationToast";
import { PageTransition } from "../components/layout/PageTransition";
import { ThemeProvider } from "../contexts/ThemeProvider";
import "../styles/globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground min-h-screen flex flex-col transition-colors duration-300`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NotificationProvider>
            <SocialProvider>
              <Header />
              <LiveNotificationToast />
              <PageTransition className="flex-1 max-w-7xl mx-auto px-4 py-6 pt-16">
                {children}
              </PageTransition>
              <Footer />
            </SocialProvider>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
