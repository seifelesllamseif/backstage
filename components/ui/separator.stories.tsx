import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Separator } from './separator'

const meta = {
  component: Separator,
  tags: ['ai-generated']
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-72 text-sm text-foreground">
      <p>Above the line.</p>
      <Separator {...args} className="my-3" />
      <p>Below the line.</p>
    </div>
  )
}

export const Vertical: Story = {
  render: (args) => (
    <div className="flex h-10 items-center gap-3 text-sm text-foreground">
      <span>Left</span>
      <Separator {...args} orientation="vertical" />
      <span>Right</span>
    </div>
  )
}
