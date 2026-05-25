'use client'

import { motion } from 'framer-motion'
import NavigationBar from '../_components/NavigationBar'
import TitleSection from '../_components/TitleSection'
import BioSection from '../_components/BioSection'
import ProfileImage from '../_components/ProfileImage'
import ProjectList from '../_components/ProjectList'
import SocialLinks from '../_components/SocialLinks'
import ContactBox from '../_components/ContactBox'
import { portfolioData } from '../_components/data'

// Theme config
const theme = {
  bg: 'bg-black',
  text: 'text-white',
  box: 'bg-white/5 border border-white/10',
  nav: 'bg-white/5'
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.5
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const }
  }
}

const contactVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.8, ease: 'easeOut' as const }
  }
}

const imageVariants = {
  center: {
    scale: 1.4,
    x: 0,
    y: 0,
    transition: { duration: 1.2, ease: 'easeInOut' as const }
  },
  final: {
    scale: 1,
    x: 0,
    y: 0,
    transition: { duration: 1.2, ease: 'easeInOut' as const }
  }
}

export default function PortfolioPage() {
  const profileImageSrc =
    typeof portfolioData.profileImage === 'string'
      ? portfolioData.profileImage
      : portfolioData.profileImage.src

  const quoteText =
    typeof portfolioData.profileImage === 'string'
      ? undefined
      : portfolioData.profileImage.quoteText

  return (
    <div
      className={`min-h-screen w-full ${theme.bg} ${theme.text} flex flex-col items-center px-4 py-4 sm:px-6 lg:px-8`}
    >
      <div className="w-full max-w-6xl">
        {/* Navigation */}
        <NavigationBar
          name={portfolioData.navbar.name}
          navigationClass={theme.nav}
          textClass={theme.text}
          message={portfolioData.message}
          navbar={portfolioData.navbar}
        />

        {/* Main Bento Grid */}
        <motion.div
          className="mt-6 grid auto-rows-[180px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Title Section */}
          <motion.div className="lg:col-span-2" variants={itemVariants}>
            <TitleSection
              titleLine1="One mind"
              titleLine2="Infinite Masks"
              boxClass={theme.box}
              variants={itemVariants}
              textSizeClass="text-2xl sm:text-3xl"
            />
          </motion.div>

          {/* Bio Section */}
          <motion.div className="lg:col-span-2" variants={itemVariants}>
            <BioSection
              bio={portfolioData.bio}
              boxClass={theme.box}
              variants={itemVariants}
              textSizeClass="text-sm"
            />
          </motion.div>

          {/* Profile Image */}
          <motion.div
            className="lg:col-span-2 lg:row-span-2"
            variants={itemVariants}
          >
            <ProfileImage
              imageSrc={profileImageSrc}
              imageAlt="Profile"
              boxClass={theme.box}
              variants={imageVariants}
              layout="final"
              delay={1.3}
              quoteText={quoteText}
            />
          </motion.div>

          {/* Projects */}
          <motion.div
            className="lg:col-span-2 lg:row-span-2"
            variants={itemVariants}
          >
            <ProjectList
              projects={portfolioData.projects}
              boxClass={theme.box}
              variants={itemVariants}
              heading={portfolioData.heading}
              textSizeClass="text-sm"
            />
          </motion.div>

          {/* Social Links */}
          <motion.div className="lg:col-span-2" variants={itemVariants}>
            <SocialLinks
              links={portfolioData.socialLinks}
              boxClass={theme.box}
              variants={itemVariants}
              contactVariants={contactVariants}
            />
          </motion.div>

          {/* Contact Box */}
          <motion.div className="lg:col-span-2" variants={itemVariants}>
            <ContactBox
              boxClass={theme.box}
              variants={itemVariants}
              contactVariants={contactVariants}
              label={portfolioData.contactLabel}
              textSizeClass="text-xl"
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
