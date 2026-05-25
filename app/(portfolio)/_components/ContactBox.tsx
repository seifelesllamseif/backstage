'use client'
import { motion, Variants } from 'framer-motion'

interface ContactBoxProps {
  boxClass: string
  variants: Variants
  contactVariants: Variants
  label: string
  textSizeClass?: string
}

export default function ContactBox({
  boxClass,
  variants,
  contactVariants,
  label,
  textSizeClass = 'text-xl'
}: ContactBoxProps) {
  return (
    <motion.div
      className={`w-full ${boxClass} flex flex-col justify-end rounded-xl p-4`}
      variants={variants}
    >
      <motion.h2
        className={`${textSizeClass} font-medium`}
        variants={contactVariants}
        initial="hidden"
        animate="visible"
      >
        {label}
      </motion.h2>
    </motion.div>
  )
}
