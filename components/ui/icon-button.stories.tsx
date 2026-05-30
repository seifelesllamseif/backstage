import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { X } from 'lucide-react'

import { IconButton } from './icon-button'

const meta = {
  component: IconButton,
  tags: ['ai-generated']
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: 'Close panel',
    children: <X aria-hidden />
  },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /close panel/i })
    await expect(button).toBeEnabled()
  }
}

export const Disabled: Story = {
  args: {
    label: 'Close panel',
    disabled: true,
    children: <X aria-hidden />
  }
}
