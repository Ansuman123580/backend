"use client";

import React from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function CTASection() {
  const { goToScreen } = useChat();

  return (
    <section className="py-28 sm:py-36 px-6 sm:px-8 relative z-10 border-t border-white/[0.05] overflow-hidden">
      {/* Soft background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-sky-500/[0.03] blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto text-center relative z-10 flex flex-col items-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-6xl font-semibold tracking-tight text-white mb-8"
        >
          Ready when you are.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <MagneticButton
            onClick={() => goToScreen("create")}
            size="lg"
            variant="primary"
            className="group"
          >
            <span>Create a Private Room</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </MagneticButton>
        </motion.div>
      </div>
    </section>
  );
}

