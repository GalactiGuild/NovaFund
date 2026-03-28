'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface FundingProgressProps {
  initialCurrentAmount: number
  targetAmount: number
  wsUrl?: string
  currencySymbol?: string
  projectId?: string
}

export function calculateProgress(currentAmount: number, targetAmount: number) {
  if (!Number.isFinite(currentAmount) || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round((currentAmount / targetAmount) * 100)))
}

export function formatFundingAmount(value: number, currencySymbol = 'ETH') {
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  })

  return `${formatter.format(value)} ${currencySymbol}`
}

export function parseInvestmentMessage(raw: string) {
  try {
    const payload = JSON.parse(raw) as { type?: string; amount?: unknown }

    if (payload?.type === 'NEW_INVESTMENT' && typeof payload.amount === 'number') {
      return payload.amount
    }
  } catch {
    // Ignore invalid JSON.
  }

  return null
}

const MILESTONES = [25, 50, 75] as const
const BATCH_WINDOW_MS = 80
const PULSE_DURATION_MS = 700
const TOAST_DURATION_MS = 3200
const RECONNECT_MS = 1000

export default function FundingProgress({
  initialCurrentAmount,
  targetAmount,
  wsUrl,
  currencySymbol = 'ETH',
}: FundingProgressProps) {
  const [currentAmount, setCurrentAmount] = useState(initialCurrentAmount)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(
    wsUrl ? 'connecting' : 'connected',
  )
  const [latestInvestment, setLatestInvestment] = useState<number | null>(null)
  const [pulse, setPulse] = useState(false)

  const pendingInvestments = useRef<number[]>([])
  const batchTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const pulseTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const reconnectDelay = useRef(RECONNECT_MS)
  const socketRef = useRef<WebSocket | null>(null)

  const progress = useMemo(
    () => calculateProgress(currentAmount, targetAmount),
    [currentAmount, targetAmount],
  )
  const displayProgress = Math.min(Math.max(progress, 0), 100)
  const formattedCurrent = formatFundingAmount(currentAmount, currencySymbol)
  const formattedTarget = formatFundingAmount(targetAmount, currencySymbol)

  const connectionLabel = useMemo(() => {
    if (!wsUrl) {
      return 'Real-time disabled'
    }

    switch (status) {
      case 'connected':
        return 'Live updates'
      case 'connecting':
        return 'Connecting...'
      case 'disconnected':
        return 'Disconnected'
      case 'error':
        return 'Offline'
      default:
        return 'Status unknown'
    }
  }, [status, wsUrl])

  const scheduleBatchUpdate = useCallback(() => {
    if (batchTimer.current) {
      return
    }

    batchTimer.current = window.setTimeout(() => {
      setCurrentAmount(prev => {
        const total = pendingInvestments.current.reduce((sum, value) => sum + value, 0)
        pendingInvestments.current = []
        return prev + total
      })
      batchTimer.current = null
    }, BATCH_WINDOW_MS)
  }, [])

  const handleInvestment = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) {
        return
      }

      pendingInvestments.current.push(amount)
      setLatestInvestment(amount)
      setPulse(true)

      window.clearTimeout(pulseTimer.current as number)
      pulseTimer.current = window.setTimeout(() => setPulse(false), PULSE_DURATION_MS)

      window.clearTimeout(toastTimer.current as number)
      toastTimer.current = window.setTimeout(() => setLatestInvestment(null), TOAST_DURATION_MS)

      scheduleBatchUpdate()
    },
    [scheduleBatchUpdate],
  )

  useEffect(() => {
    if (!wsUrl || typeof window === 'undefined') {
      return
    }

    let mounted = true

    const connect = () => {
      setStatus('connecting')

      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onopen = () => {
        if (!mounted) {
          return
        }

        reconnectDelay.current = RECONNECT_MS
        setStatus('connected')
      }

      socket.onmessage = event => {
        const payload = typeof event.data === 'string' ? event.data : String(event.data)
        const amount = parseInvestmentMessage(payload)

        if (amount !== null) {
          handleInvestment(amount)
        }
      }

      socket.onclose = () => {
        if (!mounted) {
          return
        }

        setStatus('disconnected')
        reconnectTimer.current = window.setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 1.7, 15000)
          connect()
        }, reconnectDelay.current)
      }

      socket.onerror = () => {
        if (!mounted) {
          return
        }

        setStatus('error')
        socket.close()
      }
    }

    connect()

    return () => {
      mounted = false
      socketRef.current?.close()
      if (batchTimer.current) {
        window.clearTimeout(batchTimer.current)
      }
      if (pulseTimer.current) {
        window.clearTimeout(pulseTimer.current)
      }
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current)
      }
      if (reconnectTimer.current) {
        window.clearTimeout(reconnectTimer.current)
      }
    }
  }, [handleInvestment, wsUrl])

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Funding progress</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-semibold text-slate-950">
              {formattedCurrent}
              <span className="text-base font-medium text-slate-500"> / {formattedTarget}</span>
            </h2>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
              {displayProgress}%
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm">
          {connectionLabel}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Goal progress</span>
          <span>{formattedCurrent} raised</span>
        </div>

        <div className="relative rounded-full bg-slate-200/80 p-1">
          <div className="absolute inset-x-0 top-1/2 h-px bg-slate-300" />

          {MILESTONES.map(milestone => (
            <div
              key={milestone}
              className="absolute top-0 h-full"
              style={{ left: `${milestone}%`, transform: 'translateX(-50%)' }}
              aria-hidden="true"
            >
              <div className="h-3 w-0.5 bg-slate-400" />
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.3em] text-slate-400">
                {milestone}%
              </div>
            </div>
          ))}

          <div className="h-4 overflow-hidden rounded-full bg-slate-200">
            <motion.div
              className={clsx(
                'h-full rounded-full bg-emerald-500',
                pulse && 'shadow-[0_0_0_8px_rgba(16,185,129,0.12)]',
              )}
              initial={false}
              animate={{ width: `${displayProgress}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              aria-label={`Funding progress ${displayProgress} percent`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 shadow-inner">
          <span className="font-medium">Target: {formattedTarget}</span>
          {currentAmount >= targetAmount ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Goal reached</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {formatFundingAmount(Math.max(targetAmount - currentAmount, 0), currencySymbol)} to go
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {latestInvestment !== null ? (
          <motion.div
            key={latestInvestment}
            role="status"
            data-testid="investment-notification"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mt-5 rounded-3xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm"
          >
            <span className="font-semibold">+{formatFundingAmount(latestInvestment, currencySymbol)}</span> just invested
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
