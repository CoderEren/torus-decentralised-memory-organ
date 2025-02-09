import React, { useState } from 'react'
import { shorten } from '@did-network/dapp-sdk'
import { useAccount, useSignMessage } from 'wagmi'
import axios from 'axios'

import { Header } from '@/components/layout/Header'
import { NetworkSwitcher } from '@/components/SwitchNetworks'
import { WalletModal } from '@/components/WalletModal'

function Home() {
  const { address } = useAccount()

  // Track the selected action, record ID, and record data
  const [action, setAction] = useState('create')
  const [recordId, setRecordId] = useState('')
  const [recordData, setRecordData] = useState('')

  // For UI feedback
  const [show, setShow] = useState(false)
  const [apiStatus, setApiStatus] = useState<string | null>(null)
  const [apiResponse, setApiResponse] = useState<any>(null)
  const [userSignature, setUserSignature] = useState<string | null>(null)

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
              <span className="i-line-md:loading-twotone-loop mr-1 h-4 w-4 text-white" />
            )}
            {address ? shorten(address) : 'Connect Wallet'}
          </button>
        )}
      </WalletModal>
    </>
  )

  // Wagmi hook for signing a message (using the async approach)
  const { signMessageAsync, error: signError } = useSignMessage()

  // Helper: sign a message, then call the correct API endpoint
  const handleSignedRequest = async (
    method: 'POST' | 'PUT' | 'DELETE',
    url: string,
    payloadMessage: string,
    dataPayload?: { data?: string }  // optional record data
  ) => {
    try {
      // 1) Prompt the user to sign a message
      const signature = await signMessageAsync({ message: payloadMessage })
      setUserSignature(signature)

      // 2) Send the correct request type
      let response
      if (method === 'POST') {
        response = await axios.post(url, {
          wallet: address,
          signature,
          message: payloadMessage,
          data: dataPayload?.data || '',
        })
      } else if (method === 'PUT') {
        response = await axios.put(url, {
          wallet: address,
          signature,
          message: payloadMessage,
          data: dataPayload?.data || '',
        })
      } else {
        // DELETE
        response = await axios.delete(url, {
          data: {
            wallet: address,
            signature,
            message: payloadMessage,
          },
        })
      }

      setApiStatus('Request successful!')
      setApiResponse(response.data)
    } catch (err: any) {
      setApiStatus('Request failed.')
      setApiResponse(err.message)
      console.error(err)
    }
  }

  // Handle form submission for each action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Reset status
    setApiStatus(null)
    setApiResponse(null)
    setUserSignature(null)

    switch (action) {
      case 'create': {
        // Create requires a signature with a default message
        if (!address) {
          setApiStatus('Please connect your wallet first for create.')
          return
        }
        await handleSignedRequest('POST', 'http://localhost:3000/record', 'I authorize this write', {
          data: recordData,
        })
        break
      }

      case 'read': {
        // Read = GET /record/:id (no signature needed)
        if (!recordId) {
          setApiStatus('Please provide an ID to read.')
          return
        }
        try {
          const response = await axios.get(`http://localhost:3000/record/${recordId}`)
          setApiStatus(`Record ${recordId} fetched successfully.`)
          setApiResponse(response.data)
        } catch (err: any) {
          setApiStatus('Request failed.')
          setApiResponse(err.message)
          console.error(err)
        }
        break
      }

      case 'update': {
        // Update requires wallet + signature
        if (!address) {
          setApiStatus('Please connect your wallet first for update.')
          return
        }
        if (!recordId) {
          setApiStatus('Please provide an ID to update.')
          return
        }
        await handleSignedRequest('PUT', `http://localhost:3000/record/${recordId}`, 'I authorize this write', {
          data: recordData,
        })
        break
      }

      case 'delete': {
        // Delete requires wallet + signature
        if (!address) {
          setApiStatus('Please connect your wallet first for delete.')
          return
        }
        if (!recordId) {
          setApiStatus('Please provide an ID to delete.')
          return
        }
        await handleSignedRequest('DELETE', `http://localhost:3000/record/${recordId}`, 'I authorize this write')
        break
      }
    }
  }

  return (
    <>
      <Header action={<Action />} />

      <main className="min-h-screen flex flex-col items-center bg-gradient-to-br from-purple-500 to-indigo-600 p-4">
        <h1 className="text-4xl font-bold text-white mt-8 mb-6">
          Decentralized Memory Organ
        </h1>
        <p className="text-lg text-gray-100 mb-6">
          Choose an action and enter your info:
        </p>

        {/* Action Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded shadow max-w-md w-full"
        >
          <label className="block mb-2 font-bold" htmlFor="action">
            Action
          </label>
          <select
            id="action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="block w-full border border-gray-300 rounded p-2 mb-4"
          >
            <option value="create">Create</option>
            <option value="read">Read</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>

          {/* Conditionally show inputs based on action */}
          {action === 'create' && (
            <>
              <label className="block mb-2 font-bold" htmlFor="create-data">
                Record Data
              </label>
              <input
                id="create-data"
                type="text"
                value={recordData}
                onChange={(e) => setRecordData(e.target.value)}
                className="block w-full border border-gray-300 rounded p-2 mb-4"
                placeholder="Data for the new record"
              />
            </>
          )}

          {(action === 'read' || action === 'delete') && (
            <>
              <label className="block mb-2 font-bold" htmlFor="record-id">
                Record ID
              </label>
              <input
                id="record-id"
                type="text"
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
                className="block w-full border border-gray-300 rounded p-2 mb-4"
                placeholder="Enter record ID"
              />
            </>
          )}

          {action === 'update' && (
            <>
              <label className="block mb-2 font-bold" htmlFor="update-id">
                Record ID
              </label>
              <input
                id="update-id"
                type="text"
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
                className="block w-full border border-gray-300 rounded p-2 mb-4"
                placeholder="Enter record ID"
              />

              <label className="block mb-2 font-bold" htmlFor="update-data">
                Record Data
              </label>
              <input
                id="update-data"
                type="text"
                value={recordData}
                onChange={(e) => setRecordData(e.target.value)}
                className="block w-full border border-gray-300 rounded p-2 mb-4"
                placeholder="Updated data"
              />
            </>
          )}

          <button
            type="submit"
            className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition w-full"
          >
            Submit
          </button>
        </form>

        {/* Error from wagmi signMessage (if any) */}
        {signError && (
          <p className="mt-4 text-red-500">Signature Error: {signError.message}</p>
        )}

        {/* Display the signature (if any) */}
        {userSignature && (
          <p className="mt-4 text-white">
            Signature: {shorten(userSignature)}
          </p>
        )}

        {/* Status & API Response */}
        {apiStatus && (
          <p className="mt-4 px-4 py-2 bg-green-600 text-white rounded">
            {apiStatus}
          </p>
        )}

        {apiResponse && (
          <div className="mt-4 p-4 bg-white text-gray-800 rounded shadow max-w-md w-full">
            <p className="font-bold mb-2">API Response</p>
            <pre className="text-sm whitespace-pre-wrap break-all">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </>
  )
}

export default Home
