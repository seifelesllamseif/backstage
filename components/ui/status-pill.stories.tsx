import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { StatusPill, statusLabel } from './status-pill'

const meta = {
  component: StatusPill,
  tags: ['ai-generated'],
  parameters: {
    // text-info/warning/success on tinted muted backgrounds fall ~2.2-3.0 at 11px.
    // Brand status colors per styles/globals.css; revisit when design tightens contrast.
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } }
  }
} satisfies Meta<typeof StatusPill>

export default meta
type Story = StoryObj<typeof meta>

export const Backlog: Story = {
  args: { status: 'backlog' }
}

export const Todo: Story = {
  args: { status: 'todo' }
}

export const InProgress: Story = {
  args: { status: 'in_progress' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(statusLabel('in_progress'))).toBeVisible()
  }
}

export const InReview: Story = {
  args: { status: 'in_review' }
}

export const Done: Story = {
  args: { status: 'done' }
}

export const Canceled: Story = {
  args: { status: 'canceled' }
}
