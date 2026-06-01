'use client'

import { useEffect } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import type { useRouter } from 'next/navigation'

// 5-step intro for new members landing on the dashboard. Targets stable
// data-tour attributes added on the sidebar, project switcher, board
// column, first task card, and New Task button. The first task-card
// selector resolves to the first element matching, which is enough for
// a single-step highlight; if no card exists yet we fall back to the
// whole board column.
//
// Trigger paths:
// - Auto: first visit (localStorage 'dashboard.tour.seen' missing) and
//   the user is on /dashboard*. Runs once.
// - Manual: window 'dashboard:tour' CustomEvent (dispatched from the
//   sidebar 'Take a tour' button). Always runs.

const STORAGE_KEY = 'dashboard.tour.seen.v1'
const BOARD_ROUTE = '/dashboard/board'

// Soft-navigates to the board if we're not there, then dispatches the manual
// trigger event once the board page elements (the tour's data-tour targets)
// have mounted. Callers pass router so we don't hard-reload the page.
export function startDashboardTour(router: ReturnType<typeof useRouter>) {
  if (typeof window === 'undefined') return
  if (window.location.pathname === BOARD_ROUTE) {
    window.dispatchEvent(new CustomEvent('dashboard:tour'))
    return
  }
  router.push(BOARD_ROUTE)
  // Wait long enough for the route swap + DashboardChrome / board to paint.
  // The DashboardTour listener stays mounted across /dashboard/* navigation
  // so the dispatched event is caught on the new route.
  window.setTimeout(() => {
    if (document.querySelector(selector('sidebar'))) {
      window.dispatchEvent(new CustomEvent('dashboard:tour'))
    }
  }, 600)
}

function selector(name: string): string {
  return `[data-tour="${name}"]`
}

function makeDriver() {
  return driver({
    showProgress: true,
    overlayOpacity: 0.55,
    smoothScroll: true,
    allowClose: true,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    steps: [
      {
        element: selector('sidebar'),
        popover: {
          title: 'Your nav',
          description:
            'All Tasks, your tasks, inbox, mentions. The status chips below filter the board. Projects, Updates, Symbols, Settings, Archive live further down.'
        }
      },
      {
        element: selector('project-switcher'),
        popover: {
          title: 'Switch project',
          description:
            'Click here to pin the dashboard to a single project, or pick "All Projects" to see everything. Saved in the URL so the view sticks.'
        }
      },
      {
        element: selector('board-column'),
        popover: {
          title: 'The board',
          description:
            'Drag a card between columns to change its status. Right-click a card for more actions, or click it to open the detail.',
          side: 'right'
        }
      },
      {
        element: selector('task-card'),
        popover: {
          title: 'Task cards',
          description:
            'Ref, status pill, priority icon, due date, and assignee at a glance. Click to open the full detail with comments, links, and handoff.',
          side: 'right'
        }
      },
      {
        element: selector('new-task'),
        popover: {
          title: 'New task',
          description:
            'Drop something new on the board. The form prefills the column you opened from (Group: Status / Priority / Assignee). Pasting structured input opens an AI-bulk path.'
        }
      }
    ],
    onDestroyed: () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1')
      } catch {}
    }
  })
}

// Mounted once at the dashboard layout level. Auto-runs the tour on
// first visit, listens for the manual replay event.
export function DashboardTour() {
  useEffect(() => {
    const handler = () => {
      const d = makeDriver()
      d.drive()
    }
    window.addEventListener('dashboard:tour', handler)

    // First-visit auto-trigger. The dashboard shell renders behind a
    // skeleton until React Query resolves fetchInitial, so on a cold
    // cache the sidebar can take a couple of seconds to paint. Poll
    // until it appears (capped at MAX_WAIT_MS) instead of a single
    // fixed-delay setTimeout that fired too early for new users.
    let interval: number | undefined
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        const POLL_MS = 250
        const MAX_WAIT_MS = 10_000
        const startedAt = Date.now()
        interval = window.setInterval(() => {
          if (document.querySelector(selector('sidebar'))) {
            window.clearInterval(interval)
            interval = undefined
            makeDriver().drive()
            return
          }
          if (Date.now() - startedAt >= MAX_WAIT_MS) {
            window.clearInterval(interval)
            interval = undefined
          }
        }, POLL_MS)
      }
    } catch {}

    return () => {
      window.removeEventListener('dashboard:tour', handler)
      if (interval) window.clearInterval(interval)
    }
  }, [])

  return null
}
