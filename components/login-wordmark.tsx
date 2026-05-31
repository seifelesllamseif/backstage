'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const WORDS = ['VERBIVORE', 'BACKSTAGE'] as const
const CYCLE_MS = 3600

export function LoginWordmark() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % WORDS.length)
    }, CYCLE_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={WORDS[index]}
          className="text-muted-foreground/10 text-[clamp(6rem,18vw,18rem)] leading-none font-black tracking-tighter"
          initial={{ opacity: 0, y: 12, scale: 1.02 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{
            opacity: { duration: 0.55, ease: 'easeOut' },
            y: { type: 'spring', stiffness: 90, damping: 18 },
            scale: { type: 'spring', stiffness: 90, damping: 18 }
          }}
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
