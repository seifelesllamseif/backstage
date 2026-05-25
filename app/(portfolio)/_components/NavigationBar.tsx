'use client'
import { motion } from 'framer-motion'
import Image from 'next/image'

interface NavigationBarProps {
  name: string
  navigationClass: string
  textClass: string
  message: string
  navbar: {
    logo?: {
      src: string
      alt: string
    }
    name: string
  }
}

export default function NavigationBar({
  navigationClass,
  textClass,
  message,
  navbar
}: NavigationBarProps) {
  return (
    <motion.nav
      className={`flex flex-col justify-between sm:flex-row ${navigationClass} ${textClass} items-center rounded-md px-2 py-1`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2.2, duration: 0.5 }}
    >
      <div className="mb-2 flex items-center gap-2 text-base font-medium sm:mb-0 sm:text-lg">
        {navbar.logo?.src ? (
          <Image
            src={navbar.logo.src}
            alt={navbar.logo.alt || navbar.name}
            width={36}
            height={36}
            className="rounded-sm object-contain"
          />
        ) : (
          <span>{navbar.name}</span>
        )}
      </div>

      <div className="flex gap-3 text-xs sm:gap-6 sm:text-sm">
        <span className="font-semibold uppercase">{message}</span>
      </div>
    </motion.nav>
  )
}
