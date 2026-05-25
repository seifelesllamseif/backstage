export type ThemeKey = 'black'

export interface NavbarLogo {
  src: string
  alt: string
}

export interface Navbar {
  logo: NavbarLogo
  name: string
}

export interface ProfileImageData {
  src: string
  quoteText?: string
}

export interface ProjectData {
  name: string
  image: string
}

export interface PortfolioProps {
  navbar: Navbar
  title: string
  bio: string
  theme?: ThemeKey
  profileImage: ProfileImageData | string
  projects: ProjectData[]
  socialLinks: { [key: string]: string }
  message: string
  contactLabel: string
  heading: string
}
