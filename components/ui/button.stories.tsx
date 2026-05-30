import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { Plus } from 'lucide-react'

import { Button } from './button'

const meta = {
  component: Button,
  tags: ['ai-generated'],
  parameters: {
    // --primary (#00a89e) + --primary-foreground (#ede8dc) fail WCAG AA at the
    // current button text size. Brand decision per docs/decisions/0026-verbivore-rebrand.md.
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } }
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: [
        'default',
        'outline',
        'secondary',
        'ghost',
        'destructive',
        'link'
      ]
    },
    size: {
      control: { type: 'select' },
      options: [
        'default',
        'xs',
        'sm',
        'lg',
        'icon',
        'icon-xs',
        'icon-sm',
        'icon-lg'
      ]
    },
    asChild: { control: { type: 'boolean' } },
    disabled: { control: { type: 'boolean' } }
  }
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: 'Save changes' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /save changes/i })
    await expect(button).toHaveAttribute('data-variant', 'default')
  }
}

export const Outline: Story = {
  args: { variant: 'outline', children: 'Cancel' }
}

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Continue' }
}

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Skip' }
}

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete' }
}

export const Small: Story = {
  args: { size: 'sm', children: 'Small' }
}

export const Large: Story = {
  args: { size: 'lg', children: 'Large action' }
}

export const Disabled: Story = {
  args: { disabled: true, children: 'Unavailable' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /unavailable/i })
    await expect(button).toBeDisabled()
  }
}

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus aria-hidden /> New task
      </>
    )
  }
}

// Tailwind `bg-primary` resolves to var(--primary) = #00a89e = rgb(0, 168, 158).
// Fails if the shared preview did not load styles/globals.css.
export const CssCheck: Story = {
  args: { children: 'Submit' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /submit/i })
    await expect(getComputedStyle(button).backgroundColor).toBe(
      'rgb(0, 168, 158)'
    )
  }
}
