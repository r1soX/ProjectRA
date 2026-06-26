"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8", className)}
    >
      {children}
    </motion.div>
  );
}
