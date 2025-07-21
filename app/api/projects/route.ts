import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage for demo purposes
let projects = [
  { 
    id: 1, 
    name: 'Website Redesign', 
    description: 'Complete overhaul of company website',
    owner_id: 1,
    team_members: [1, 2],
    deadline: '2024-06-15',
    status: 'active',
    created_at: '2024-01-10T10:00:00Z'
  },
  { 
    id: 2, 
    name: 'Mobile App Development', 
    description: 'Native mobile application for iOS and Android',
    owner_id: 2,
    team_members: [2, 3],
    deadline: '2024-08-30',
    status: 'active',
    created_at: '2024-01-15T14:30:00Z'
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');

  // Filter by status if provided
  let filteredProjects = projects;
  if (status) {
    filteredProjects = projects.filter(p => p.status === status);
  }

  // Simple pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

  return NextResponse.json({
    success: true,
    data: paginatedProjects,
    meta: {
      total: filteredProjects.length,
      page,
      limit,
      total_pages: Math.ceil(filteredProjects.length / limit)
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simple validation
    if (!body.name || !body.owner_id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name and owner_id are required',
          details: {
            name: !body.name ? 'Project name is required' : undefined,
            owner_id: !body.owner_id ? 'Owner ID is required' : undefined,
          }
        }
      }, { status: 400 });
    }

    // Create new project
    const newProject = {
      id: Math.max(...projects.map(p => p.id), 0) + 1,
      name: body.name,
      description: body.description || '',
      owner_id: body.owner_id,
      team_members: body.team_members || [],
      deadline: body.deadline || null,
      status: 'active',
      created_at: new Date().toISOString()
    };

    projects.push(newProject);

    return NextResponse.json({
      success: true,
      data: newProject,
      message: 'Project created successfully'
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