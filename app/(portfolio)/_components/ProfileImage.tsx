// components/portfolio/ProfileImage.tsx

'use client'

import { motion, AnimatePresence, Variants } from 'framer-motion'
import React, { useState, useRef } from 'react'

interface ProfileImageProps {
  imageSrc: string
  imageAlt: string
  boxClass: string
  variants: Variants
  layout?: 'center' | 'final'
  delay?: number
  quoteText?: string
}

export default function ProfileImage({
  imageSrc,
  imageAlt,
  boxClass,
  variants,
  layout = 'final',
  delay = 1.3,
  quoteText
}: ProfileImageProps) {
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [canShow, setCanShow] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setCanShow(true), 400) // delay
  }

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current!)
    setCanShow(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    setCursor({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })
  }

  const handleTouchStart = () => {
    setCanShow((prev) => !prev) // toggle on tap
  }

  return (
    <div
      className="relative h-full w-full touch-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
    >
      <motion.div
        className={`h-full w-full ${boxClass} overflow-hidden rounded-xl`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: 0.5 }}
      >
        <motion.img
          key={layout}
          src={imageSrc}
          alt={imageAlt}
          className="h-full w-full object-cover object-center select-none"
          initial="center"
          animate={layout}
          draggable={false}
          variants={variants}
        />
      </motion.div>

      {quoteText && (
        <AnimatePresence>
          {canShow && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="pointer-events-none absolute z-50 max-w-xs rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-sm"
              style={{
                top: cursor.y + 20,
                left: cursor.x + 20,
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.3)' // blurred border glow
              }}
            >
              {quoteText}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
