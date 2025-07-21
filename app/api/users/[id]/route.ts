import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage for demo purposes (same as main users route)
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin', department: 'engineering' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'developer', department: 'product' },
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: user
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'INVALID_USER_ID',
        message: 'Invalid user ID provided'
      }
    }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      }, { status: 404 });
    }
    
    const body = await request.json();
    
    // Update only provided fields
    users[userIndex] = { ...users[userIndex], ...body };
    
    return NextResponse.json({
      success: true,
      data: users[userIndex],
      message: 'User updated successfully'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update user'
      }
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      }, { status: 404 });
    }
    
    const deletedUser = users[userIndex];
    users.splice(userIndex, 1);
    
    return NextResponse.json({
      success: true,
      data: deletedUser,
      message: 'User deleted successfully'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete user'
      }
    }, { status: 500 });
  }
} 