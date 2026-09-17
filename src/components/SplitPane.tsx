import { useCallback, useRef, type ReactNode } from 'react'

const MIN_PERCENT = 15
const MAX_PERCENT = 85
const KEYBOARD_STEP = 2

interface SplitPaneProps {
  /** Left pane width as a percentage of the container. */
  splitPercent: number
  onSplitChange: (percent: number) => void
  left: ReactNode
  right: ReactNode
}

const clamp = (value: number) =>
  Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value))

export function SplitPane({
  splitPercent,
  onSplitChange,
  left,
  right,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current
      if (!container) return

      const divider = event.currentTarget
      divider.setPointerCapture(event.pointerId)

      const move = (moveEvent: PointerEvent) => {
        const bounds = container.getBoundingClientRect()
        if (bounds.width === 0) return
        const percent = ((moveEvent.clientX - bounds.left) / bounds.width) * 100
        onSplitChange(clamp(percent))
      }

      const up = () => {
        divider.removeEventListener('pointermove', move)
        divider.removeEventListener('pointerup', up)
        divider.removeEventListener('pointercancel', up)
        document.body.classList.remove('is-resizing')
      }

      divider.addEventListener('pointermove', move)
      divider.addEventListener('pointerup', up)
      divider.addEventListener('pointercancel', up)
      document.body.classList.add('is-resizing')
    },
    [onSplitChange],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        onSplitChange(clamp(splitPercent - KEYBOARD_STEP))
      } else if (event.key === 'ArrowRight') {
        onSplitChange(clamp(splitPercent + KEYBOARD_STEP))
      } else if (event.key === 'Home') {
        onSplitChange(MIN_PERCENT)
      } else if (event.key === 'End') {
        onSplitChange(MAX_PERCENT)
      } else {
        return
      }
      event.preventDefault()
    },
    [onSplitChange, splitPercent],
  )

  return (
    <div className="split-pane" ref={containerRef}>
      <div className="split-panel" style={{ width: `${splitPercent}%` }}>
        {left}
      </div>
      <div
        className="split-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor and preview panels"
        aria-valuenow={Math.round(splitPercent)}
        aria-valuemin={MIN_PERCENT}
        aria-valuemax={MAX_PERCENT}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        onDoubleClick={() => onSplitChange(50)}
      />
      <div className="split-panel split-panel-grow">{right}</div>
    </div>
  )
}
