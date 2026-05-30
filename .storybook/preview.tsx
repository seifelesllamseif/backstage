import type { Preview } from '@storybook/nextjs-vite'
import * as React from 'react'

import { TooltipProvider } from '../components/ui/tooltip'
import '../styles/globals.css'

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    a11y: {
      test: 'error'
    },
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app', value: '#ede8dc' },
        { name: 'dark', value: '#0e1414' }
      ]
    }
  },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme === 'dark' ? 'dark' : 'light'
      React.useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
      }, [theme])
      return (
        <TooltipProvider delayDuration={250}>
          <div className="font-sans text-foreground antialiased">
            <Story />
          </div>
        </TooltipProvider>
      )
    }
  ],
  globalTypes: {
    theme: {
      description: 'Color scheme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' }
        ],
        dynamicTitle: true
      }
    }
  }
}

export default preview
