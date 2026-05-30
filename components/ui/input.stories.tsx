import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'

import { Input } from './input'

const meta = {
  component: Input,
  tags: ['ai-generated']
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Email address', className: 'w-72' }
}

export const Disabled: Story = {
  args: { placeholder: 'Cannot edit', disabled: true, className: 'w-72' }
}

export const Invalid: Story = {
  args: {
    'aria-invalid': true,
    'aria-label': 'Email address',
    defaultValue: 'not-an-email',
    className: 'w-72'
  },
  play: async ({ canvas }) => {
    const input = canvas.getByDisplayValue('not-an-email')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
  }
}

export const Typed: Story = {
  args: { placeholder: 'Type here', className: 'w-72' },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByPlaceholderText('Type here')
    await userEvent.type(input, 'hello')
    await expect(input).toHaveValue('hello')
  }
}
