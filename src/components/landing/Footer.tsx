"use client";

import React from "react";
import { useChat } from "@/context/ChatContext";

export function Footer() {
  const { resetToHome, goToScreen } = useChat();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="py-14 px-6 sm:px-10 border-t border-white/[0.06] relative z-10 bg-[#060709]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <span className="font-mono font-bold tracking-tight text-white text-sm">
            5MIN
          </span>
          <span className="hidden sm:inline text-zinc-700">•</span>
          <span className="text-xs text-zinc-400 font-light">
            Talk. Then disappear.
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs text-zinc-400">
          <button
            onClick={() => scrollTo("privacy")}
            className="hover:text-white transition-colors"
          >
            Privacy
          </button>
          <button
            onClick={() => scrollTo("how-it-works")}
            className="hover:text-white transition-colors"
          >
            How it works
          </button>
          <button
            onClick={() => goToScreen("join")}
            className="hover:text-white transition-colors"
          >
            Join room
          </button>
        </div>
      </div>
    </footer>
  );
}

