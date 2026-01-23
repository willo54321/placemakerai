'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Shield,
  User as UserIcon,
  Eye,
  X,
  Check,
  FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'

interface ProjectAccess {
  projectId: string
  role: 'ADMIN' | 'CLIENT'
  project: {
    id: string
    name: string
  }
}

interface User {
  id: string
  name: string | null
  email: string
  systemRole: 'SUPER_ADMIN' | 'USER'
  createdAt: string
  projectAccess: ProjectAccess[]
}

interface Project {
  id: string
  name: string
}

const ROLE_CONFIG = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-purple-600', icon: Shield },
  USER: { label: 'User', color: 'bg-slate-500', icon: UserIcon },
}

const PROJECT_ROLE_CONFIG = {
  ADMIN: { label: 'Project Admin', color: 'bg-green-600' },
  CLIENT: { label: 'Client (View Only)', color: 'bg-blue-600' },
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => fetch('/api/admin/users').then((r) => r.json()),
    enabled: status === 'authenticated',
  })

  // Fetch all projects for assignment
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => fetch('/api/projects').then((r) => r.json()),
    enabled: status === 'authenticated',
  })

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/admin/users/${userId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Failed to delete user')
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User deleted')
    },
    onError: () => {
      toast.error('Failed to delete user')
    },
  })

  if (status === 'loading' || usersLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="skeleton h-8 w-48 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    redirect('/login')
  }

  // Check if user is super admin (from session)
  if (session?.user?.systemRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-4">You don't have permission to access this page.</p>
          <Link href="/projects" className="btn-primary">
            <ArrowLeft size={18} />
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="text-slate-500 hover:text-slate-900">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
              <p className="text-sm text-slate-500">Manage users and their project access</p>
            </div>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus size={18} />
            Add User
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {users && users.length > 0 ? (
          <div className="space-y-4">
            {users.map((user) => {
              const roleConfig = ROLE_CONFIG[user.systemRole]
              const Icon = roleConfig.icon

              return (
                <div
                  key={user.id}
                  className="card p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-full ${roleConfig.color} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900">
                          {user.name || 'Unnamed User'}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            user.systemRole === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {roleConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">{user.email}</p>

                      {/* Project access */}
                      {user.projectAccess.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {user.projectAccess.map((access) => (
                            <span
                              key={access.projectId}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-600"
                            >
                              <FolderOpen size={12} />
                              {access.project.name}
                              <span className="text-slate-400">
                                ({access.role === 'ADMIN' ? 'Admin' : 'Client'})
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit user"
                    >
                      <Pencil size={16} />
                    </button>
                    {user.email !== session?.user?.email && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this user?')) {
                            deleteUserMutation.mutate(user.id)
                          }
                        }}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <UserIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No users yet</h3>
            <p className="text-slate-500 mb-4">Add users to give them access to projects</p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              <Plus size={18} />
              Add First User
            </button>
          </div>
        )}
      </main>

      {/* Add/Edit User Modal */}
      {(showAddModal || editingUser) && (
        <UserModal
          user={editingUser}
          projects={projects || []}
          onClose={() => {
            setShowAddModal(false)
            setEditingUser(null)
          }}
        />
      )}
    </div>
  )
}

interface UserModalProps {
  user: User | null
  projects: Project[]
  onClose: () => void
}

function UserModal({ user, projects, onClose }: UserModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!user

  const [email, setEmail] = useState(user?.email || '')
  const [name, setName] = useState(user?.name || '')
  const [systemRole, setSystemRole] = useState<'SUPER_ADMIN' | 'USER'>(
    user?.systemRole || 'USER'
  )
  const [projectAccess, setProjectAccess] = useState<
    { projectId: string; role: 'ADMIN' | 'CLIENT' }[]
  >(user?.projectAccess?.map((pa) => ({ projectId: pa.projectId, role: pa.role })) || [])

  const mutation = useMutation({
    mutationFn: (data: {
      email: string
      name: string
      systemRole: string
      projectAccess: { projectId: string; role: string }[]
    }) => {
      const url = isEditing ? `/api/admin/users/${user.id}` : '/api/admin/users'
      const method = isEditing ? 'PATCH' : 'POST'
      return fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to save user')
        return r.json()
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(isEditing ? 'User updated' : 'User created')
      onClose()
    },
    onError: () => {
      toast.error(isEditing ? 'Failed to update user' : 'Failed to create user')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({ email, name, systemRole, projectAccess })
  }

  const toggleProjectAccess = (projectId: string, role: 'ADMIN' | 'CLIENT') => {
    setProjectAccess((prev) => {
      const existing = prev.find((pa) => pa.projectId === projectId)
      if (existing) {
        if (existing.role === role) {
          // Remove access
          return prev.filter((pa) => pa.projectId !== projectId)
        } else {
          // Change role
          return prev.map((pa) =>
            pa.projectId === projectId ? { ...pa, role } : pa
          )
        }
      } else {
        // Add access
        return [...prev, { projectId, role }]
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditing ? 'Edit User' : 'Add New User'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEditing}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-slate-100"
              placeholder="user@example.com"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="John Doe"
            />
          </div>

          {/* System Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              System Role
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSystemRole('USER')}
                className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                  systemRole === 'USER'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <UserIcon className="w-5 h-5 mx-auto mb-1 text-slate-600" />
                <p className="text-sm font-medium">User</p>
                <p className="text-xs text-slate-500">Access assigned projects only</p>
              </button>
              <button
                type="button"
                onClick={() => setSystemRole('SUPER_ADMIN')}
                className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                  systemRole === 'SUPER_ADMIN'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Shield className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                <p className="text-sm font-medium">Super Admin</p>
                <p className="text-xs text-slate-500">Full access to everything</p>
              </button>
            </div>
          </div>

          {/* Project Access - only show for regular users */}
          {systemRole === 'USER' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Project Access
              </label>
              {projects.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-auto border border-slate-200 rounded-lg p-3">
                  {projects.map((project) => {
                    const access = projectAccess.find((pa) => pa.projectId === project.id)
                    return (
                      <div
                        key={project.id}
                        className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg"
                      >
                        <span className="text-sm font-medium text-slate-700">
                          {project.name}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => toggleProjectAccess(project.id, 'ADMIN')}
                            className={`text-xs px-2 py-1 rounded ${
                              access?.role === 'ADMIN'
                                ? 'bg-green-600 text-white'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            Admin
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleProjectAccess(project.id, 'CLIENT')}
                            className={`text-xs px-2 py-1 rounded ${
                              access?.role === 'CLIENT'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            Client
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">No projects available</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? (
                'Saving...'
              ) : isEditing ? (
                <>
                  <Check size={18} />
                  Save Changes
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Create User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
