import type { Metadata } from "next";
import "./globals.css";
import { ChatProvider } from "@/context/ChatContext";
import { AtmosphereBackground } from "@/components/ui/AtmosphereBackground";
import { ToastContainer } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "5MIN — Talk. Then disappear.",
  description: "Private conversations designed to last five minutes. Ephemeral, minimalist, confidential.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⏳</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-zinc-100 min-h-screen antialiased selection:bg-white/20 selection:text-white">
        <ChatProvider>
          {/* Subtle noise texture */}
          <div className="noise-overlay" />

          {/* Dynamic atmospheric cursor & motes layer */}
          <AtmosphereBackground />

          {/* Core Content */}
          <div className="relative z-10">{children}</div>

          {/* Global Floating Toasts */}
          <ToastContainer />
        </ChatProvider>
      </body>
    </html>
  );
}
