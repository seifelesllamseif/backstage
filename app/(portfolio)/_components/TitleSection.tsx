'use client'
import { motion, Variants } from 'framer-motion'

interface TitleSectionProps {
  titleLine1: string
  titleLine2: string
  boxClass: string
  variants: Variants
  textSizeClass?: string
}

export default function TitleSection({
  titleLine1,
  titleLine2,
  boxClass,
  variants,
  textSizeClass = 'text-2xl'
}: TitleSectionProps) {
  return (
    <motion.div
      className={`w-full ${boxClass} flex flex-col justify-end rounded-xl p-4`}
      variants={variants}
    >
      <h1 className={`${textSizeClass} leading-tight font-bold`}>
        {titleLine1}
        <span className="font-normal italic"> with</span>
        <br />
        {titleLine2}
      </h1>
    </motion.div>
  )
}
