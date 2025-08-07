import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { functions } from '@/lib/inngest-functions';

// Create the Inngest serve handler for Next.js API routes
// This handles communication between your app and Inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  
  // Optional: Configure Inngest serve options
  streaming: false, // Disable streaming for better compatibility
}); 