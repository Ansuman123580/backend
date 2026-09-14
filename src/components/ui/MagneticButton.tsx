"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { playSoftClick } from "@/lib/sound";
import { cn } from "@/lib/utils";

interface MagneticButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  magnetic?: boolean;
}

export function MagneticButton({
  children,
  className,
  variant = "primary",
  size = "md",
  magnetic = true,
  onClick,
  ...props
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!magnetic || !buttonRef.current) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } =
      buttonRef.current.getBoundingClientRect();
    const x = (clientX - (left + width / 2)) * 0.22;
    const y = (clientY - (top + height / 2)) * 0.22;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    playSoftClick();
    if (onClick) onClick(e);
  };

  const sizeClasses = {
    sm: "px-3.5 py-1.5 text-xs rounded-lg gap-1.5",
    md: "px-5 py-2.5 text-sm rounded-xl gap-2",
    lg: "px-7 py-3.5 text-base rounded-2xl gap-2.5 font-medium",
  }[size];

  const variantClasses = {
    primary:
      "bg-white text-zinc-950 font-medium hover:bg-zinc-100 hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.35)] active:scale-[0.98] border border-white/80",
    secondary:
      "bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] hover:text-white border border-white/10 hover:border-white/20 active:scale-[0.98]",
    ghost:
      "bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]",
    danger:
      "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30",
  }[variant];

  return (
    <motion.button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.5 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50 disabled:pointer-events-none select-none tracking-tight",
        sizeClasses,
        variantClasses,
        className
      )}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

