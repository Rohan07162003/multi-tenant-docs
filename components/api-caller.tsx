// components/api-caller.tsx
'use client'

import { useState } from 'react'

export function useApiCaller() {
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function callApi({ method, url, body }: { method: string; url: string; body?: any }) {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      // GET and HEAD requests cannot have a body
      const canHaveBody = !['GET', 'HEAD'].includes(method.toUpperCase());
      
      const fetchOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      
      // Only add body for methods that allow it
      if (canHaveBody && body) {
        fetchOptions.body = JSON.stringify(body);
      }
      
      const res = await fetch(url, fetchOptions);
      const data = await res.json();
      setResponse({ status: res.status, data });
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return { callApi, response, error, loading };
}


