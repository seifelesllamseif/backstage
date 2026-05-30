import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Skeleton } from './skeleton'

const meta = {
  component: Skeleton,
  tags: ['ai-generated']
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { className: 'h-4 w-48' }
}

export const Avatar: Story = {
  args: { className: 'h-9 w-9 rounded-full' }
}

export const Block: Story = {
  args: { className: 'h-24 w-72 rounded-lg' }
}
