"use client";

import React, { useState } from "react";
import { useChat } from "@/context/ChatContext";
import { Volume2, VolumeX, Menu, X, ArrowUpRight } from "lucide-react";
import { MagneticButton } from "@/components/ui/MagneticButton";

export function Navbar() {
  const {
    screen,
    goToScreen,
    initiateCreateRoom,
    soundEnabled,
    toggleSound,
    resetToHome,
  } = useChat();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    if (screen !== "landing") {
      resetToHome();
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  // When inside a room/chat, show minimal header indicator
  if (screen === "chat" || screen === "expired") {
    return null; // The chat view provides its own dedicated secure header
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-6 sm:px-10 py-5 transition-all duration-300">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand Monogram */}
        <button
          onClick={resetToHome}
          className="group flex items-center gap-2.5 focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center group-hover:border-white/30 transition-colors">
            <span className="text-xs font-mono font-bold tracking-tighter text-white">
              5M
            </span>
          </div>
          <span className="text-base font-medium tracking-tight text-white/90 group-hover:text-white transition-colors">
            5MIN
          </span>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection("how-it-works")}
            className="text-xs tracking-wider uppercase text-zinc-400 hover:text-white transition-colors focus:outline-none"
          >
            How it works
          </button>
          <button
            onClick={() => scrollToSection("privacy")}
            className="text-xs tracking-wider uppercase text-zinc-400 hover:text-white transition-colors focus:outline-none"
          >
            Privacy
          </button>
          <button
            onClick={() => {
              goToScreen("join");
              setMobileMenuOpen(false);
            }}
            className="text-xs tracking-wider uppercase text-zinc-400 hover:text-white transition-colors focus:outline-none"
          >
            Join Room
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-label={soundEnabled ? "Mute audio cues" : "Unmute audio cues"}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors focus:outline-none"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-600" />
            )}
          </button>

          {/* Primary CTA */}
          <MagneticButton
            onClick={() => initiateCreateRoom()}
            size="sm"
            variant="primary"
            className="gap-1.5"
          >
            <span>Create Room</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
          </MagneticButton>
        </nav>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-3">
          <button
            onClick={toggleSound}
            aria-label="Toggle audio"
            className="p-2 text-zinc-400 hover:text-white focus:outline-none"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-600" />
            )}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-zinc-400 hover:text-white focus:outline-none"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 p-5 rounded-2xl bg-[#0e1015]/95 border border-white/10 backdrop-blur-xl flex flex-col gap-4 shadow-2xl animate-fade-in">
          <button
            onClick={() => scrollToSection("how-it-works")}
            className="text-left py-2 text-sm text-zinc-300 hover:text-white"
          >
            How it works
          </button>
          <button
            onClick={() => scrollToSection("privacy")}
            className="text-left py-2 text-sm text-zinc-300 hover:text-white"
          >
            Privacy
          </button>
          <button
            onClick={() => {
              goToScreen("join");
              setMobileMenuOpen(false);
            }}
            className="text-left py-2 text-sm text-zinc-300 hover:text-white"
          >
            Join Room
          </button>
          <div className="pt-2 border-t border-white/[0.08]">
            <button
              onClick={() => {
                initiateCreateRoom();
                setMobileMenuOpen(false);
              }}
              className="w-full py-3 rounded-xl bg-white text-zinc-950 font-medium text-sm text-center"
            >
              Create Room
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

