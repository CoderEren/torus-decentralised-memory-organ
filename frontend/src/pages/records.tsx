import { useEffect, useState } from 'react'
import axios from 'axios'
import { shorten } from '@did-network/dapp-sdk'
import { useAccount } from 'wagmi'

import { Header } from '@/components/layout/Header'
import { NetworkSwitcher } from '@/components/SwitchNetworks'
import { WalletModal } from '@/components/WalletModal'

function Records() {
  const { address } = useAccount()
  const [show, setShow] = useState(false)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Toggle the Connect Wallet modal
  const toggleModal = (open: boolean) => {
    setShow(open)
  }

  // Minimal "Connect Wallet" action for the header
  const Action = () => (
    <>
      <NetworkSwitcher />
      <WalletModal
        open={show}
        onOpenChange={toggleModal}
        close={() => setShow(false)}
      >
        {({ isLoading }) => (
          <button className="mr-4 flex items-center px-4 py-2 bg-indigo-600 text-white rounded">
            {isLoading && (
              <span className="i-line-md:loading-twotone-loop mr-1 h-4 w-4 inline-flex text-white" />
            )}
            {address ? shorten(address) : 'Connect Wallet'}
          </button>
        )}
      </WalletModal>
    </>
  )

  // Fetch all records on component mount
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true)
        const response = await axios.get('http://localhost:3000/records')
        setRecords(response.data)
      }
      catch (err: any) {
        setError(err.message || 'Failed to fetch records.')
      }
      finally {
        setLoading(false)
      }
    }
    fetchRecords()
  }, [])

  return (
    <>
      {/* Reuse your project’s Header */}
      <Header action={<Action />} />

      <main className="min-h-screen flex flex-col items-center bg-gradient-to-br from-purple-500 to-indigo-600 p-4">
        <h1 className="text-4xl font-bold text-white mt-8 mb-6">
          All Decentralized Records
        </h1>

        {/* Loading & Error states */}
        {loading && <p className="text-white">Loading records...</p>}
        {error && <p className="text-red-300 mb-4">Error: {error}</p>}

        {/* Display records in a responsive grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            {records.map((record: any) => (
              <div key={record.id} className="bg-white p-6 rounded shadow">
                <h2 className="text-xl font-bold mb-2">
                  ID: <span className="font-mono">{record.id}</span>
                </h2>
                <p className="text-gray-600">
                  <strong>Wallet:</strong> {shorten(record.wallet)}
                </p>
                <p className="text-gray-600">
                  <strong>Timestamp:</strong> {record.timestamp}
                </p>
                <p className="text-gray-600">
                  <strong>Data:</strong> {record.data}
                </p>
                {record.deleted && (
                  <p className="text-red-500 font-semibold mt-2">
                    This record has been marked as deleted.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}

export default Records
