import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { FilterChip } from './filter-chip'

const meta = {
  component: FilterChip,
  tags: ['ai-generated']
} satisfies Meta<typeof FilterChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { label: 'Status', value: 'In progress' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /status.*in progress/i })
    await expect(button).toBeEnabled()
  }
}

export const Disabled: Story = {
  args: { label: 'Sprint', value: 'All', disabled: true }
}
