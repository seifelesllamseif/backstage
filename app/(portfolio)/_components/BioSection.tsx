'use client'
import { motion, Variants } from 'framer-motion'

interface BioSectionProps {
  bio: string
  boxClass: string
  variants: Variants
  textSizeClass?: string
}

export default function BioSection({
  bio,
  boxClass,
  variants,
  textSizeClass = 'text-sm'
}: BioSectionProps) {
  return (
    <motion.div
      className={`w-full ${boxClass} rounded-xl p-4`}
      variants={variants}
    >
      <p className={textSizeClass}>{bio}</p>
    </motion.div>
  )
}
