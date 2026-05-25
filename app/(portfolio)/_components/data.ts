import { PortfolioProps } from './types'

export const portfolioData: PortfolioProps = {
  navbar: {
    logo: {
      src: '/images/katana-logo.png',
      alt: 'katana'
    },
    name: 'katana'
  },
  title: 'One mind with Infinite Masks',
  bio: "It's not the world that's messed up it's those of us in it. Driven by emotion",
  profileImage: {
    src: '/images/profile-main.jpg',
    quoteText:
      "Sometimes good people make bad choices. It doesn't mean they are bad people. It means they are human. - Ken Kaneki"
  },
  projects: [
    {
      name: 'Musea',
      image:
        'https://i.pinimg.com/736x/f1/c8/4d/f1c84d0040a599f5554aa6e78b7b42fa.jpg'
    },
    {
      name: 'Elara',
      image:
        'https://i.pinimg.com/736x/e0/bc/2c/e0bc2ca32f3a712f2a6963d94f12b8df.jpg'
    },
    {
      name: 'Verve',
      image:
        'https://i.pinimg.com/736x/4e/33/c1/4e33c1f7eb315b53f3f9cbdc28ffbb83.jpg'
    },
    {
      name: 'Zephyr',
      image:
        'https://i.pinimg.com/736x/9f/0e/63/9f0e639c1634c1c837cf3e8b7e4d8b7f.jpg'
    }
  ],
  socialLinks: {
    instagram: 'https://instagram.com/',
    twitter: 'https://twitter.com/',
    linkedin: 'https://linkedin.com/in/'
  },

  message:
    "I'm not the protagonist of a story. I'm just a guy who's lost his way",
  contactLabel: 'Whisper to me',
  heading: 'In this world, the weak are devoured.'
}
