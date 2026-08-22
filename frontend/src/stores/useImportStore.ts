import { create } from 'zustand'

export interface NextStepSuggestion {
  id: string
  title: string
  description: string
  category: 'analysis' | 'action' | 'export' | 'review'
  confidence: number
  action_type: string
  action_payload: Record<string, any>
  auto_triggered: boolean
}

export type SuggestionDecision = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'already_processed'

export interface DefectVisualization {
  viz_id: string
  asset_type: 'track' | 'signal' | 'train' | 'platform' | 'ohe' | 'bridge' | string
  asset_id: string
  defect: {
    type: string
    position: { x: number; y: number; z: number }
    confidence: number
    severity: string
    label: string
  }
  evidence: {
    description: string
    sensor_source: string
    position_accuracy: 'precise' | 'estimated'
    chainage_m?: number
    latitude?: number
    longitude?: number
    [key: string]: any
  }
}

export interface ImportPreview {
  filename: string
  total_records: number
  valid_records: number
  has_errors: boolean
  errors: string[]
  summary: {
    by_severity: Record<string, number>
    by_type: Record<string, number>
    total_affected_passengers: number
    total_estimated_delay_minutes: number
  }
  events: any[]
  visualizations?: DefectVisualization[]
}

export interface ImportResult {
  imported_count: number
  error_count: number
  errors: string[]
  event_ids: number[]
}

type ImportStep = 'upload' | 'preview' | 'results'

interface ImportStore {
  // Flow state
  step: ImportStep
  setStep: (step: ImportStep) => void

  // Upload
  uploading: boolean
  uploadError: string | null
  setUploading: (v: boolean) => void
  setUploadError: (e: string | null) => void

  // Preview
  preview: ImportPreview | null
  suggestions: NextStepSuggestion[]
  setPreview: (p: ImportPreview) => void
  setSuggestions: (s: NextStepSuggestion[]) => void

  // Confirm / Results
  importing: boolean
  result: ImportResult | null
  postSuggestions: NextStepSuggestion[]
  setImporting: (v: boolean) => void
  setResult: (r: ImportResult) => void
  setPostSuggestions: (s: NextStepSuggestion[]) => void

  // 3D Inspection
  selectedVizId: string | null
  setSelectedVizId: (id: string | null) => void
  inspectionDecisions: Record<string, SuggestionDecision>
  setInspectionDecision: (vizId: string, decision: SuggestionDecision) => void

  // Reset
  reset: () => void
}

const initialState = {
  step: 'upload' as ImportStep,
  uploading: false,
  uploadError: null,
  preview: null,
  suggestions: [],
  importing: false,
  result: null,
  postSuggestions: [],
  selectedVizId: null as string | null,
  inspectionDecisions: {} as Record<string, SuggestionDecision>,
}

export const useImportStore = create<ImportStore>((set) => ({
  ...initialState,

  setStep: (step) => set({ step }),
  setUploading: (uploading) => set({ uploading }),
  setUploadError: (uploadError) => set({ uploadError }),
  setPreview: (preview) => set({ preview }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setImporting: (importing) => set({ importing }),
  setResult: (result) => set({ result }),
  setPostSuggestions: (postSuggestions) => set({ postSuggestions }),
  setSelectedVizId: (selectedVizId) => set({ selectedVizId }),
  setInspectionDecision: (vizId, decision) =>
    set((state) => ({
      inspectionDecisions: { ...state.inspectionDecisions, [vizId]: decision },
    })),

  reset: () => set(initialState),
}))
