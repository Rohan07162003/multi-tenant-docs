import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage for demo purposes
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin', department: 'engineering' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'developer', department: 'product' },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: users,
    meta: {
      total: users.length,
      page: 1,
      limit: 20
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simple validation
    if (!body.name || !body.email) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name and email are required',
          details: {
            name: !body.name ? 'Name is required' : undefined,
            email: !body.email ? 'Email is required' : undefined,
          }
        }
      }, { status: 400 });
    }

    // Create new user
    const newUser = {
      id: Math.max(...users.map(u => u.id), 0) + 1,
      name: body.name,
      email: body.email,
      role: body.role || 'user',
      department: body.department || 'general',
    };

    users.push(newUser);

    return NextResponse.json({
      success: true,
      data: newUser,
      message: 'User created successfully'
    }, { status: 201 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    }, { status: 500 });
  }
} 