"use client";

import { motion } from "motion/react";

/**
 * Re-mounted on every navigation — gives each page a soft materialize-in.
 * Only opacity/translate are animated: a lingering `filter` would turn this
 * wrapper into a backdrop root and flatten every glass panel inside it.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
