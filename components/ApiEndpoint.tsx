// components/ApiEndpoint.tsx
'use client'

import { useState } from 'react'
import { useApiCaller } from './api-caller';

interface ApiEndpointProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  defaultBody?: Record<string, any>
  description?: string
}

export function ApiEndpoint({
  method,
  path,
  defaultBody,
  description,
}: ApiEndpointProps) {
  const [bodyText, setBodyText] = useState(
    defaultBody ? JSON.stringify(defaultBody, null, 2) : ''
  )
  const { callApi, response, error, loading } = useApiCaller()

  return (
    <div className="border p-4 rounded-lg mb-6">
      <div className="flex justify-between mb-2">
        <span className="font-mono font-bold">{method}</span>
        <span className="font-mono">{path}</span>
      </div>
      {description && <p className="mb-2 text-gray-600">{description}</p>}
      {/* Only show request body for methods that support it */}
      {!['GET', 'HEAD'].includes(method.toUpperCase()) && (
        <textarea
          className="w-full p-2 font-mono bg-gray-100 dark:bg-gray-800 rounded text-gray-900 dark:text-gray-100"
          rows={defaultBody ? 8 : 4}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
        />
      )}
      <button
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => {
          let body: any = undefined
          // Only try to parse body for methods that support it
          if (!['GET', 'HEAD'].includes(method.toUpperCase()) && bodyText) {
            try {
              body = JSON.parse(bodyText)
            } catch {
              return alert('Invalid JSON body')
            }
          }
          callApi({ method, url: path, body })
        }}
        disabled={loading}
      >
        {loading ? 'Sending...' : 'Try It Out'}
      </button>

      {error && <pre className="mt-4 text-red-600">{error}</pre>}
      {response && (
        <div className="mt-4">
          <div>Status: {response.status}</div>
          <pre className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-gray-900 dark:text-gray-100">
            <code className="text-gray-900 dark:text-gray-100">
              {typeof response.data === 'object'
                ? JSON.stringify(response.data, null, 2)
                : response.data}
            </code>
          </pre>
        </div>
      )}
    </div>
  )
}

