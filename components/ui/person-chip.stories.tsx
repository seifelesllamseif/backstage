import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { PersonChip } from './person-chip'

const meta = {
  component: PersonChip,
  tags: ['ai-generated']
} satisfies Meta<typeof PersonChip>

export default meta
type Story = StoryObj<typeof meta>

export const Small: Story = {
  args: { name: 'Ada Lovelace', size: 'sm' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Ada Lovelace')).toBeVisible()
  }
}

export const Medium: Story = {
  args: { name: 'Grace Hopper', size: 'md' }
}

export const Large: Story = {
  args: { name: 'Linus Torvalds', size: 'lg' }
}

export const Self: Story = {
  args: { name: 'Seif Elesllam', size: 'md', self: true }
}

export const NameOnly: Story = {
  args: { name: 'Margaret Hamilton', size: 'md', nameOnly: true }
}

export const OverriddenInitials: Story = {
  args: { name: 'Ada Lovelace', initials: 'AL', size: 'md' }
}
