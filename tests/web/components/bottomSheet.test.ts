// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'

const { default: BottomSheet } = await import(
  '../../../web/src/lib/components/BottomSheet.svelte'
)

describe('BottomSheet — backdrop, keyboard, and focus behavior', () => {
  afterEach(() => {
    cleanup()
    ;((globalThis as unknown) as { document: { body: { innerHTML: string } } }).document.body.innerHTML = ''
  })

  it('clicking the backdrop closes the sheet', async () => {
    const onclose = vi.fn()
    const { container } = render(BottomSheet, {
      props: { open: true, title: 'Test Sheet', onclose },
    })

    const backdrop = container.querySelector('.sheet-backdrop') as { click: () => void }
    await fireEvent.click(backdrop)

    expect(onclose).toHaveBeenCalledTimes(1)
  })

  it('clicking inside the sheet does not close it', async () => {
    const onclose = vi.fn()
    render(BottomSheet, {
      props: { open: true, title: 'Test Sheet', onclose },
    })

    await fireEvent.click(screen.getByRole('dialog', { name: 'Test Sheet' }))

    expect(onclose).not.toHaveBeenCalled()
  })

  it('pressing Escape closes the sheet', async () => {
    const onclose = vi.fn()
    render(BottomSheet, {
      props: { open: true, title: 'Test Sheet', onclose },
    })

    await fireEvent.keyDown(((globalThis as unknown) as { window: unknown }).window, { key: 'Escape' })

    expect(onclose).toHaveBeenCalledTimes(1)
  })

  it('focuses the dialog on open and restores prior focus after close', async () => {
    const doc = ((globalThis as unknown) as { document: { createElement: (tag: string) => { textContent: string | null; focus: () => void }; body: { appendChild: (node: unknown) => void }; activeElement: unknown } }).document
    const opener = doc.createElement('button')
    opener.textContent = 'Open sheet'
    doc.body.appendChild(opener)
    opener.focus()
    expect(doc.activeElement).toBe(opener)

    const onclose = vi.fn()
    const view = render(BottomSheet, {
      props: { open: true, title: 'Test Sheet', onclose },
    })
    await tick()
    await Promise.resolve()

    const dialog = screen.getByRole('dialog', { name: 'Test Sheet' })
    expect(doc.activeElement).toBe(dialog)

    await view.rerender({ open: false, title: 'Test Sheet', onclose })
    await tick()

    expect(doc.activeElement).toBe(opener)
  })
})
