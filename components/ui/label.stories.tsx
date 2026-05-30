import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Label } from './label'
import { Input } from './input'

const meta = {
  component: Label,
  tags: ['ai-generated']
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { children: 'Email address' }
}

export const WithInput: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-1.5">
      <Label htmlFor="story-email">Email</Label>
      <Input id="story-email" type="email" placeholder="you@example.com" />
    </div>
  )
}
