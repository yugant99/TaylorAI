import React from 'react'

interface SelectionDrawerProps {
  count: number
  onGenerate: () => void
}

export default function SelectionDrawer({ count, onGenerate }: SelectionDrawerProps) {
  return (
    <div className="bg-white p-4 shadow-lg border-t">
      <div className="max-w-2xl mx-auto flex justify-between items-center">
        <div>
          <span className="font-medium">{count}</span> job{count !== 1 ? 's' : ''} selected
        </div>
        <button
          onClick={onGenerate}
          disabled={count === 0}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Generate Cover Letters
        </button>
      </div>
    </div>
  )
}