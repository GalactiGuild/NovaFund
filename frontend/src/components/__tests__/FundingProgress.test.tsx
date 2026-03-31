import * as React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FundingProgress, {
  calculateProgress,
  formatFundingAmount,
  parseInvestmentMessage,
} from '../FundingProgress'

class MockWebSocket {
  static instances: MockWebSocket[] = []

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
  }

  close() {
    this.onclose?.()
  }
}

describe('FundingProgress utilities', () => {
  it('calculates a capped progress percentage', () => {
    expect(calculateProgress(50, 200)).toBe(25)
    expect(calculateProgress(300, 200)).toBe(100)
    expect(calculateProgress(-20, 100)).toBe(0)
    expect(calculateProgress(10, 0)).toBe(0)
  })

  it('formats funding amounts with currency symbol', () => {
    expect(formatFundingAmount(12, 'ETH')).toBe('12 ETH')
    expect(formatFundingAmount(12.3456, 'ETH')).toBe('12.35 ETH')
  })

  it('parses valid NEW_INVESTMENT messages', () => {
    expect(parseInvestmentMessage(JSON.stringify({ type: 'NEW_INVESTMENT', amount: 4.2 }))).toBe(4.2)
    expect(parseInvestmentMessage(JSON.stringify({ type: 'OTHER', amount: 5 }))).toBeNull()
    expect(parseInvestmentMessage('not-json')).toBeNull()
  })
})

describe('FundingProgress component', () => {
  beforeEach(() => {
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    MockWebSocket.instances = []
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as any).WebSocket
  })

  it('renders initial funding and target amounts', () => {
    render(<FundingProgress initialCurrentAmount={20} targetAmount={100} />)

    expect(screen.getByText('20 ETH')).toBeDefined()
    expect(screen.getByText('/ 100 ETH')).toBeDefined()
    expect(screen.getByText('20%')).toBeDefined()
  })

  it('updates when WebSocket NEW_INVESTMENT events arrive', async () => {
    await act(async () => {
      render(<FundingProgress initialCurrentAmount={20} targetAmount={100} wsUrl="ws://localhost" />)
    })

    const socket = MockWebSocket.instances[0]
    expect(socket).toBeDefined()

    act(() => {
      socket.onmessage?.({ data: JSON.stringify({ type: 'NEW_INVESTMENT', amount: 15 }) })
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 120))
    })

    const notification = await screen.findByRole('status')
    expect(notification.textContent).toMatch(/\+\s*15 ETH\s*just invested/)
    expect(await screen.findByText('35 ETH')).toBeDefined()
  })
})
