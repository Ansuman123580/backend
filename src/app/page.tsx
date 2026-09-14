"use client";

import React from "react";
import { useChat } from "@/context/ChatContext";
import { Navbar } from "@/components/navigation/Navbar";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PrivacySection } from "@/components/landing/PrivacySection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { CreateRoomView } from "@/components/room/CreateRoomView";
import { RoomCreatedView } from "@/components/room/RoomCreatedView";
import { JoinRoomView } from "@/components/room/JoinRoomView";
import { ChatRoomView } from "@/components/room/ChatRoomView";
import { RoomExpiredView } from "@/components/room/RoomExpiredView";
import { InvalidRoomView } from "@/components/room/InvalidRoomView";
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const { screen } = useChat();

  return (
    <div className="min-h-screen flex flex-col justify-between overflow-x-hidden">
      <Navbar />

      <AnimatePresence mode="wait">
        {screen === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            <Hero />
            <HowItWorks />
            <PrivacySection />
            <CTASection />
            <Footer />
          </motion.div>
        )}

        {screen === "create" && (
          <motion.div
            key="create"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            <CreateRoomView />
            <Footer />
          </motion.div>
        )}

        {screen === "created" && (
          <motion.div
            key="created"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            <RoomCreatedView />
            <Footer />
          </motion.div>
        )}

        {screen === "join" && (
          <motion.div
            key="join"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            <JoinRoomView />
            <Footer />
          </motion.div>
        )}

        {screen === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            <ChatRoomView />
          </motion.div>
        )}

        {screen === "expired" && (
          <motion.div
            key="expired"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            <RoomExpiredView />
          </motion.div>
        )}

        {screen === "invalid" && (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col"
          >
            <InvalidRoomView />
            <Footer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

