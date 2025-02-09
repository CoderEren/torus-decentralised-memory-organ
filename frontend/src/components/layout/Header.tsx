import type { ReactNode } from 'react'

export function Header({ action }: { action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 box-border h-16 border-b-1 border-border border-solid bg-white shadow-lg">
      <div className="m-auto h-full max-w-6xl flex items-center justify-between lt-sm:px-4 sm:px-8">
        <div className="flex items-center font-bold space-x-4">
          <a href="/" className="text-2xl hover:text-gray-200 transition">
            Torus
          </a>
          <a href="/records" className="text-lg hover:text-gray-200 transition">
            Records
          </a>
          <a href="/admin" className="text-lg hover:text-gray-200 transition">
            Admin Panel
          </a>
        </div>
        <div className="flex items-center gap-2">
          {action}
        </div>
      </div>
    </header>
  )
}