'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X, ChevronLeft, ChevronRight, Check, MapPin, Users, FileUp,
  Sparkles, Building2, Search, AlertCircle, Upload, Mail, Info
} from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { Spinner } from './Spinner'

// Dynamically import map to avoid SSR issues
const LocationMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-slate-100 rounded-lg flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
})

interface ProjectData {
  name: string
  description: string
  projectType: string
  latitude: number | null
  longitude: number | null
  address: string
  geoLayers: GeoLayerData[]
  stakeholders: DetectedStakeholder[]
  emailFromName: string
  emailFromAddress: string
}

interface GeoLayerData {
  name: string
  type: string
  featureCount: number
  geojson: object
}

interface DetectedStakeholder {
  name: string
  organization: string | null
  role: string | null
  type: string
  source: string
  selected: boolean
}

interface ProjectOnboardingWizardProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (projectId: string) => void
}

const PROJECT_TYPES = [
  { value: 'planning', label: 'Planning Application', icon: Building2 },
  { value: 'infrastructure', label: 'Infrastructure Project', icon: MapPin },
  { value: 'community', label: 'Community Consultation', icon: Users },
  { value: 'other', label: 'Other', icon: FileUp },
]

const STEPS = [
  { id: 1, name: 'Basics', description: 'Project details' },
  { id: 2, name: 'Location', description: 'Set map center' },
  { id: 3, name: 'Boundary', description: 'Site boundary (optional)' },
  { id: 4, name: 'Stakeholders', description: 'Auto-detect' },
  { id: 5, name: 'Email', description: 'Sender settings (optional)' },
  { id: 6, name: 'Review', description: 'Create project' },
]

export default function ProjectOnboardingWizard({
  isOpen,
  onClose,
  onComplete
}: ProjectOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    description: '',
    projectType: 'planning',
    latitude: null,
    longitude: null,
    address: '',
    geoLayers: [],
    stakeholders: [],
    emailFromName: '',
    emailFromAddress: '',
  })

  // Address search state
  const [addressQuery, setAddressQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Array<{
    display_name: string
    lat: string
    lon: string
  }>>([])

  // Stakeholder detection state
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionRan, setDetectionRan] = useState(false)

  // File upload state
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Focus name input when wizard opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1)
      setProjectData({
        name: '',
        description: '',
        projectType: 'planning',
        latitude: null,
        longitude: null,
        address: '',
        geoLayers: [],
        stakeholders: [],
        emailFromName: '',
        emailFromAddress: '',
      })
      setError(null)
      setDetectionRan(false)
    }
  }, [isOpen])

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return projectData.name.trim().length > 0
      case 2:
        return projectData.latitude !== null && projectData.longitude !== null
      case 3:
        return true // Optional step
      case 4:
        return true // Can skip if no stakeholders
      case 5:
        return true // Email is optional
      case 6:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1)
      // Auto-run stakeholder detection when entering step 4
      if (currentStep === 3 && projectData.latitude && !detectionRan) {
        runStakeholderDetection()
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Address search using Nominatim
  const searchAddress = async () => {
    if (!addressQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&countrycodes=gb&limit=5`,
        { headers: { 'User-Agent': 'Placemaker/1.0' } }
      )
      const results = await response.json()
      setSearchResults(results)
    } catch (err) {
      console.error('Address search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }

  const selectAddress = (result: { display_name: string; lat: string; lon: string }) => {
    setProjectData({
      ...projectData,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      address: result.display_name,
    })
    setSearchResults([])
    setAddressQuery('')
  }

  // File upload handler for shapefiles/GeoJSON
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
        // Handle GeoJSON
        const text = await file.text()
        const geojson = JSON.parse(text)
        const featureCount = geojson.features?.length || 1

        setProjectData({
          ...projectData,
          geoLayers: [...projectData.geoLayers, {
            name: file.name.replace(/\.(geojson|json)$/i, ''),
            type: 'boundary',
            featureCount,
            geojson,
          }]
        })
      } else if (fileName.endsWith('.zip')) {
        // Handle shapefile - need to process on server or use shpjs
        const arrayBuffer = await file.arrayBuffer()
        const shp = (await import('shpjs')).default
        const geojson = await shp(arrayBuffer)

        const features = Array.isArray(geojson) ? geojson : [geojson]
        for (const fc of features) {
          setProjectData(prev => ({
            ...prev,
            geoLayers: [...prev.geoLayers, {
              name: file.name.replace(/\.zip$/i, ''),
              type: 'boundary',
              featureCount: fc.features?.length || 0,
              geojson: fc,
            }]
          }))
        }
      } else {
        setError('Please upload a .geojson, .json, or .zip (shapefile) file')
      }
    } catch (err) {
      console.error('File upload error:', err)
      setError('Failed to parse file. Please check the format.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeGeoLayer = (index: number) => {
    setProjectData({
      ...projectData,
      geoLayers: projectData.geoLayers.filter((_, i) => i !== index)
    })
  }

  // Stakeholder detection
  const runStakeholderDetection = async () => {
    if (!projectData.latitude || !projectData.longitude) return

    setIsDetecting(true)
    setError(null)

    try {
      // Create a temporary project to run detection
      const response = await fetch('/api/stakeholders/preview-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: projectData.latitude,
          longitude: projectData.longitude,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setProjectData({
          ...projectData,
          stakeholders: (data.stakeholders || []).map((s: DetectedStakeholder) => ({
            ...s,
            selected: true,
          })),
        })
      }
    } catch (err) {
      console.error('Stakeholder detection failed:', err)
      setError('Could not detect stakeholders. You can add them manually later.')
    } finally {
      setIsDetecting(false)
      setDetectionRan(true)
    }
  }

  const toggleStakeholder = (index: number) => {
    const updated = [...projectData.stakeholders]
    updated[index] = { ...updated[index], selected: !updated[index].selected }
    setProjectData({ ...projectData, stakeholders: updated })
  }

  // Create project
  const handleCreate = async () => {
    setIsCreating(true)
    setError(null)

    try {
      // 1. Create the project
      const projectResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectData.name,
          description: projectData.description,
          latitude: projectData.latitude,
          longitude: projectData.longitude,
          emailFromName: projectData.emailFromName || null,
          emailFromAddress: projectData.emailFromAddress || null,
        }),
      })

      if (!projectResponse.ok) {
        throw new Error('Failed to create project')
      }

      const project = await projectResponse.json()

      // 2. Add geo layers if any
      for (const layer of projectData.geoLayers) {
        await fetch(`/api/projects/${project.id}/layers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: layer.name,
            type: layer.type,
            geojson: layer.geojson,
          }),
        })
      }

      // 3. Add selected stakeholders
      const selectedStakeholders = projectData.stakeholders.filter(s => s.selected)
      for (const stakeholder of selectedStakeholders) {
        await fetch(`/api/projects/${project.id}/stakeholders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: stakeholder.name,
            organization: stakeholder.organization,
            role: stakeholder.role,
            type: stakeholder.type,
            notes: `Auto-detected from ${stakeholder.source}`,
          }),
        })
      }

      toast.success('Project created successfully!')
      onComplete(project.id)
    } catch (err) {
      console.error('Failed to create project:', err)
      setError('Failed to create project. Please try again.')
      toast.error('Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  console.log('ProjectOnboardingWizard render, isOpen:', isOpen)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Wizard Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-16 bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Create New Project</h2>
            <p className="text-sm text-slate-500">Step {currentStep} of 6: {STEPS[currentStep - 1].name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${currentStep > step.id
                      ? 'bg-green-500 text-white'
                      : currentStep === step.id
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-200 text-slate-500'}
                  `}>
                    {currentStep > step.id ? <Check size={16} /> : step.id}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${
                    currentStep >= step.id ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    {step.name}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-8 md:w-16 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Step 1: Basics */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="project-name" className="label">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    id="project-name"
                    type="text"
                    value={projectData.name}
                    onChange={e => setProjectData({ ...projectData, name: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., High Street Redevelopment"
                  />
                </div>

                <div>
                  <label htmlFor="project-description" className="label">
                    Description
                  </label>
                  <textarea
                    id="project-description"
                    value={projectData.description}
                    onChange={e => setProjectData({ ...projectData, description: e.target.value })}
                    className="input w-full min-h-[100px]"
                    placeholder="Brief description of the project..."
                  />
                </div>

                <div>
                  <label className="label mb-3">
                    Project Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {PROJECT_TYPES.map(type => {
                      const Icon = type.icon
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setProjectData({ ...projectData, projectType: type.value })}
                          className={`
                            p-4 rounded-lg border-2 text-left transition-all
                            ${projectData.projectType === type.value
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-slate-200 hover:border-slate-300'}
                          `}
                        >
                          <Icon size={24} className={projectData.projectType === type.value ? 'text-brand-600' : 'text-slate-400'} />
                          <span className={`block mt-2 font-medium ${projectData.projectType === type.value ? 'text-brand-900' : 'text-slate-700'}`}>
                            {type.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="label">
                    Search for an address
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={addressQuery}
                        onChange={e => setAddressQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchAddress()}
                        className="input w-full pl-10"
                        placeholder="Enter postcode or address..."
                      />
                    </div>
                    <button
                      onClick={searchAddress}
                      disabled={isSearching || !addressQuery.trim()}
                      className="btn-primary"
                    >
                      {isSearching ? <Spinner size="sm" /> : 'Search'}
                    </button>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {searchResults.map((result, i) => (
                        <button
                          key={i}
                          onClick={() => selectAddress(result)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                        >
                          <span className="text-sm text-slate-700">{result.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Map Preview */}
                <div>
                  <label className="label mb-2">
                    {projectData.latitude ? 'Selected Location' : 'Click on the map to set location'}
                  </label>
                  <div className="h-64 rounded-lg overflow-hidden border border-slate-200">
                    <LocationMap
                      latitude={projectData.latitude}
                      longitude={projectData.longitude}
                      onLocationChange={(lat, lng) => {
                        setProjectData({ ...projectData, latitude: lat, longitude: lng })
                      }}
                    />
                  </div>
                  {projectData.address && (
                    <p className="mt-2 text-sm text-slate-600">
                      <MapPin size={14} className="inline mr-1" />
                      {projectData.address}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Boundary */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload size={32} className="text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Upload Site Boundary</h3>
                  <p className="text-slate-600 mb-6">
                    Import a shapefile (.zip) or GeoJSON file to define your project boundary.
                    <br />
                    <span className="text-sm text-slate-500">This step is optional - you can add boundaries later.</span>
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,.geojson,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="btn-primary px-6 py-3"
                  >
                    {isUploading ? (
                      <>
                        <Spinner size="sm" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FileUp size={18} />
                        Upload File
                      </>
                    )}
                  </button>
                </div>

                {/* Uploaded Layers */}
                {projectData.geoLayers.length > 0 && (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {projectData.geoLayers.map((layer, index) => (
                      <div key={index} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                            <Check size={16} className="text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{layer.name}</p>
                            <p className="text-sm text-slate-500">{layer.featureCount} feature(s)</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeGeoLayer(index)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Stakeholders */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles size={32} className="text-brand-600" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Auto-Detect Stakeholders</h3>
                  <p className="text-slate-600 mb-4">
                    Based on your project location, we can automatically identify relevant political stakeholders.
                  </p>

                  {!detectionRan && (
                    <button
                      onClick={runStakeholderDetection}
                      disabled={isDetecting || !projectData.latitude}
                      className="btn-primary px-6 py-3"
                    >
                      {isDetecting ? (
                        <>
                          <Spinner size="sm" />
                          Detecting...
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          Detect Stakeholders
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Detected Stakeholders */}
                {projectData.stakeholders.length > 0 && (
                  <div className="border border-slate-200 rounded-lg">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <p className="text-sm font-medium text-slate-700">
                        {projectData.stakeholders.filter(s => s.selected).length} of {projectData.stakeholders.length} selected
                      </p>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                      {projectData.stakeholders.map((stakeholder, index) => (
                        <label
                          key={index}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={stakeholder.selected}
                            onChange={() => toggleStakeholder(index)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900">{stakeholder.name}</p>
                            <p className="text-sm text-slate-600">{stakeholder.role}</p>
                            {stakeholder.organization && (
                              <p className="text-xs text-slate-500">{stakeholder.organization}</p>
                            )}
                          </div>
                          <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                            {stakeholder.type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {detectionRan && projectData.stakeholders.length === 0 && (
                  <div className="text-center py-6 text-slate-500">
                    <Users size={32} className="mx-auto mb-2 text-slate-300" />
                    <p>No stakeholders detected for this location.</p>
                    <p className="text-sm">You can add them manually after creating the project.</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Email Settings */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-brand-600" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Email Sender Settings</h3>
                  <p className="text-slate-600 mb-4">
                    Configure a custom email address for this project to send notifications from your own domain.
                    <br />
                    <span className="text-sm text-slate-500">This step is optional - you can configure this later in Settings.</span>
                  </p>
                </div>

                <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Info size={18} className="text-brand-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-brand-800">
                      <p className="font-medium mb-1">Setting up project-specific email</p>
                      <p>To send emails from your own domain:</p>
                      <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>Add your domain in <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">Resend Dashboard</a></li>
                        <li>Add the DNS records Resend provides (SPF, DKIM)</li>
                        <li>Wait for verification (usually a few minutes)</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="email-from-name" className="label">
                      Sender Name
                    </label>
                    <input
                      id="email-from-name"
                      type="text"
                      value={projectData.emailFromName}
                      onChange={e => setProjectData({ ...projectData, emailFromName: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., Project ABC Team"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      The name that appears in the "From" field of sent emails
                    </p>
                  </div>

                  <div>
                    <label htmlFor="email-from-address" className="label">
                      Sender Email Address
                    </label>
                    <input
                      id="email-from-address"
                      type="email"
                      value={projectData.emailFromAddress}
                      onChange={e => setProjectData({ ...projectData, emailFromAddress: e.target.value })}
                      className="input w-full"
                      placeholder="e.g., noreply@yourproject.com"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Must be from a verified domain in Resend. Leave blank to use the default.
                    </p>
                  </div>

                  {(projectData.emailFromName || projectData.emailFromAddress) && (
                    <div className="bg-slate-50 rounded-lg p-3 text-sm">
                      <span className="text-slate-500">Preview: </span>
                      <span className="text-slate-900 font-medium">
                        {projectData.emailFromName || 'Project Team'} &lt;{projectData.emailFromAddress || 'default@example.com'}&gt;
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 6: Review */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-slate-900">Review Your Project</h3>

                <div className="space-y-4">
                  {/* Project Details */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-500 mb-2">Project Details</h4>
                    <p className="text-lg font-semibold text-slate-900">{projectData.name}</p>
                    {projectData.description && (
                      <p className="text-slate-600 mt-1">{projectData.description}</p>
                    )}
                    <span className="inline-block mt-2 text-xs px-2 py-1 bg-brand-100 text-brand-700 rounded">
                      {PROJECT_TYPES.find(t => t.value === projectData.projectType)?.label}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-500 mb-2">Location</h4>
                    {projectData.address ? (
                      <p className="text-slate-700">{projectData.address}</p>
                    ) : projectData.latitude ? (
                      <p className="text-slate-700">
                        {projectData.latitude.toFixed(6)}, {projectData.longitude?.toFixed(6)}
                      </p>
                    ) : (
                      <p className="text-slate-400">No location set</p>
                    )}
                  </div>

                  {/* Boundary Files */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-500 mb-2">Site Boundaries</h4>
                    {projectData.geoLayers.length > 0 ? (
                      <ul className="text-slate-700">
                        {projectData.geoLayers.map((layer, i) => (
                          <li key={i}>• {layer.name} ({layer.featureCount} features)</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-400">No boundaries uploaded</p>
                    )}
                  </div>

                  {/* Stakeholders */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-500 mb-2">Stakeholders</h4>
                    {projectData.stakeholders.filter(s => s.selected).length > 0 ? (
                      <p className="text-slate-700">
                        {projectData.stakeholders.filter(s => s.selected).length} stakeholder(s) will be added
                      </p>
                    ) : (
                      <p className="text-slate-400">No stakeholders selected</p>
                    )}
                  </div>

                  {/* Email Settings */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-500 mb-2">Email Settings</h4>
                    {projectData.emailFromAddress ? (
                      <p className="text-slate-700">
                        {projectData.emailFromName || 'Project Team'} &lt;{projectData.emailFromAddress}&gt;
                      </p>
                    ) : (
                      <p className="text-slate-400">Using default sender (can configure later)</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={currentStep === 1 ? onClose : handleBack}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            <ChevronLeft size={18} />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          {currentStep < 6 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="btn-primary"
            >
              {(currentStep === 3 && projectData.geoLayers.length === 0) ||
               (currentStep === 5 && !projectData.emailFromAddress) ? 'Skip' : 'Next'}
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <Spinner size="sm" />
                  Creating...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Create Project
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
