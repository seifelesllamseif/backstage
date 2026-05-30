import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from './card'
import { Button } from './button'

const meta = {
  component: Card,
  tags: ['ai-generated']
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    className: 'w-80',
    children: (
      <>
        <CardHeader>
          <CardTitle>Sprint 4 retro</CardTitle>
          <CardDescription>
            Three takeaways from the last cycle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          We shipped 12 of 15 planned issues, with the remainder rolled into
          the carry-over column.
        </CardContent>
      </>
    )
  }
}

export const Small: Story = {
  args: {
    size: 'sm',
    className: 'w-72',
    children: (
      <>
        <CardHeader>
          <CardTitle>Compact</CardTitle>
          <CardDescription>Reduced padding for dense surfaces.</CardDescription>
        </CardHeader>
        <CardContent>Body text.</CardContent>
      </>
    )
  }
}

export const WithActionAndFooter: Story = {
  args: {
    className: 'w-96',
    children: (
      <>
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
          <CardDescription>Visa ending in 4242.</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>Billed on the 1st of each month.</CardContent>
        <CardFooter>
          <Button variant="outline" size="sm">
            Remove card
          </Button>
        </CardFooter>
      </>
    )
  }
}
