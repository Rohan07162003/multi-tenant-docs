import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage for demo purposes
let suppliers = [
  { 
    id: 'SUP-12345', 
    company_name: 'Acme Parts LLC', 
    contact_email: 'contact@acmeparts.com',
    country: 'USA',
    status: 'active',
    certifications: ['ISO 9001', 'TS 16949'],
    created_at: '2024-01-15T10:30:00Z'
  },
  { 
    id: 'SUP-67890', 
    company_name: 'Global Components Inc', 
    contact_email: 'info@globalcomponents.com',
    country: 'Canada',
    status: 'active',
    certifications: ['ISO 9001'],
    created_at: '2024-01-20T14:15:00Z'
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  
  return NextResponse.json({
    success: true,
    data: suppliers,
    meta: {
      total: suppliers.length,
      page,
      limit,
      pages: Math.ceil(suppliers.length / limit)
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simple validation
    if (!body.company_name || !body.contact_email || !body.country) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: company_name, contact_email, country'
        }
      }, { status: 400 });
    }
    
    const newSupplier = {
      id: `SUP-${Date.now()}`,
      company_name: body.company_name,
      contact_email: body.contact_email,
      country: body.country,
      status: 'pending',
      certifications: body.certifications || [],
      created_at: new Date().toISOString()
    };
    
    suppliers.push(newSupplier);
    
    return NextResponse.json({
      success: true,
      data: newSupplier,
      message: 'Supplier created successfully'
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: 'Failed to create supplier'
      }
    }, { status: 500 });
  }
} 