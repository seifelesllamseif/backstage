'use client'

import { motion } from 'framer-motion'

export function LoginWordmark() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 80, damping: 18 }}
    >
      <span className="text-muted-foreground/10 text-[clamp(6rem,18vw,18rem)] leading-none font-black tracking-tighter">
        VERBIVORE
      </span>
    </motion.div>
  )
}
