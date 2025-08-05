import ClientIngestor from '@/components/ClientIngestor';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Manage document ingestion and client collections
          </p>
        </div>
        
        <ClientIngestor />
      </div>
    </div>
  );
} 