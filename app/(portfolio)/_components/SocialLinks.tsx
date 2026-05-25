'use client'

import React, { JSX } from 'react'
import { motion, Variants } from 'framer-motion'
import { Globe, AtSign, Hash, User } from 'lucide-react'

interface SocialLinksProps {
  links: { [key: string]: string }
  boxClass: string
  variants: Variants
  contactVariants: Variants
}

const platformIcons: Record<string, JSX.Element> = {
  instagram: <AtSign className="size-8 text-black" />,
  twitter: <Hash className="size-8 text-black" />,
  linkedin: <User className="size-8 text-black" />
}

export default function SocialLinks({
  links,
  boxClass,
  variants,
  contactVariants
}: SocialLinksProps) {
  return (
    <motion.div
      className={`w-full ${boxClass} flex items-center justify-around rounded-xl p-3`}
      variants={variants}
    >
      {Object.entries(links).map(([platform, url]) => (
        <motion.a
          key={platform}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative overflow-hidden text-xs font-medium"
          variants={contactVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Text */}
          <span className="relative z-10">{platform.toUpperCase()}</span>

          {/* Icon on hover behind text */}
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileHover={{ opacity: 0.2, y: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-0 flex items-center justify-center"
          >
            {platformIcons[platform.toLowerCase()] || (
              <Globe className="size-8 bg-amber-400 text-black" />
            )}
          </motion.span>
        </motion.a>
      ))}
    </motion.div>
  )
}
