// components/portfolio/ProjectList.tsx

'use client'
import { motion, Variants } from 'framer-motion'
import Image from 'next/image'

interface ProjectListProps {
  projects: { name: string; image: string }[]
  boxClass: string
  variants: Variants
  heading: string
  textSizeClass?: string
}

export default function ProjectList({
  projects,
  boxClass,
  variants,
  heading,
  textSizeClass = 'text-sm'
}: ProjectListProps) {
  return (
    <motion.div
      className={`w-full ${boxClass} flex flex-col rounded-xl p-4`}
      variants={variants}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium uppercase">{heading}</h2>
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeWidth={2} />
        </svg>
      </div>

      <div className="mb-3 h-48 overflow-hidden rounded-lg bg-gray-200">
        <Image
          src={projects[0]?.image || 'https://via.placeholder.com/400x300'}
          alt={projects[0]?.name || 'Project'}
          width={400}
          height={300}
          className="h-full w-full object-cover select-none"
        />
      </div>

      {projects.slice(1).map((project, index) => (
        <motion.div
          key={index}
          className="flex items-center justify-between border-t border-gray-300/30 py-2"
          variants={variants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 2 + index * 0.2 }}
        >
          <h2 className="font-medium">{project.name}</h2>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeWidth={2} />
          </svg>
        </motion.div>
      ))}
    </motion.div>
  )
}
