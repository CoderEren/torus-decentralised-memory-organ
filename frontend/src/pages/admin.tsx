import React, { useState, useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import axios from 'axios'
import { shorten } from '@did-network/dapp-sdk'

// Example layout components
import { Header } from '@/components/layout/Header'
import { NetworkSwitcher } from '@/components/SwitchNetworks'
import { WalletModal } from '@/components/WalletModal'

export default function AdminPanel() {
  const { address } = useAccount()

  // Local form states
  const [show, setShow] = useState(false)
  const [targetWallet, setTargetWallet] = useState('')
  const [newRole, setNewRole] = useState('viewer')
  const [messageStatus, setMessageStatus] = useState<string | null>(null)
  const [apiResponse, setApiResponse] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])

  // Wagmi signMessage
  const { signMessageAsync, error } = useSignMessage()

  // Toggle the Connect Wallet modal
  const toggleModal = (open: boolean) => {
    setShow(open)
  }

  // UI for header: connect wallet, switch network, etc.
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

  // Fetch the latest roles from the API
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await axios.get('http://localhost:3000/roles?limit=50')
        setRoles(response.data)
      }
      catch (err: any) {
        console.error('Failed to fetch roles:', err)
      }
    }

    fetchRoles()
  }, [])

  // Handler: sign a message, then POST /setRole
  const handleSetRole = async () => {
    setApiResponse(null)
    if (!address) {
      setMessageStatus('Please connect an admin wallet first.')
      return
    }
    if (!targetWallet) {
      setMessageStatus('Please enter a target wallet address.')
      return
    }

    try {
      // 1) Prompt admin to sign a message
      const signature = await signMessageAsync({ message: 'I am admin setting roles' })

      // 2) Make the request to /setRole (assuming your server runs at localhost:3000)
      const response = await axios.post('http://localhost:3000/setRole', {
        adminWallet: address,
        signature,
        message: 'I am admin setting roles',
        targetWallet,
        newRole,
      })

      setApiResponse(response.data)
      setMessageStatus(`Role assigned successfully: ${targetWallet} → ${newRole}`)
    }
    catch (err: any) {
      console.error(err)
      setMessageStatus('Role assignment failed.')
      setApiResponse(err.message || err.toString())
    }
  }

  return (
    <>
      <Header action={<Action />} />

      <main className="min-h-screen flex flex-col items-center bg-gradient-to-br from-purple-500 to-indigo-600 p-4">
        <h1 className="text-3xl font-bold text-white my-8">Admin Panel</h1>

        <div className="bg-white p-6 rounded shadow max-w-md w-full mb-8">
          <label htmlFor="targetWallet" className="block mb-2 font-bold">Target Wallet Address</label>
          <input
            id="targetWallet"
            type="text"
            value={targetWallet}
            onChange={e => setTargetWallet(e.target.value)}
            placeholder="0x..."
            className="block w-full border border-gray-300 rounded p-2 mb-4"
          />

          <label htmlFor="roleSelect" className="block mb-2 font-bold">Select New Role</label>
          <select
            id="roleSelect"
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            className="block w-full border border-gray-300 rounded p-2 mb-4"
          >
            <option value="admin">admin</option>
            <option value="contributor">contributor</option>
            <option value="viewer">viewer</option>
          </select>

          <button
            type="button"
            onClick={handleSetRole}
            className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition w-full"
          >
            Set Role
          </button>
        </div>

        {/* Wagmi signMessage error, if any */}
        {error && (
          <p className="mt-4 text-red-500">Signature Error: {error.message}</p>
        )}

        {/* Status message */}
        {messageStatus && <p className="mt-4 text-white">{messageStatus}</p>}

        {/* Show API response */}
        {apiResponse && (
          <div className="mt-4 p-4 bg-white text-gray-800 rounded shadow max-w-md w-full">
            <p className="font-bold mb-2">API Response</p>
            <pre className="text-sm whitespace-pre-wrap break-all">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          </div>
        )}

        {/* Display the latest roles */}
        <div className="bg-white p-6 rounded shadow max-w-4xl w-full mt-8">
          <h2 className="text-2xl font-bold mb-4">Latest Roles</h2>
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">Wallet Address</th>
                <th className="py-2 px-4 border-b">Role</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr>
                  <td className="py-2 px-4 border-b">{shorten(role.id)}</td>
                  <td className="py-2 px-4 border-b">{role.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
