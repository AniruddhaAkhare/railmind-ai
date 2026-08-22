import React, { useCallback, useState, useRef } from 'react'
import {
  Upload, FileText, AlertTriangle, CheckCircle, Download,
  Zap, BarChart2, Eye, RefreshCw, ChevronRight, X, ArrowRight,
  Activity, Shield, Wrench, Radio, Users, MapPin
} from 'lucide-react'
import { api } from '../config/api'
import { useImportStore, NextStepSuggestion } from '../stores/useImportStore'

/* ─── Category + severity helpers ─── */
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  analysis: <BarChart2 size={16} />,
  action: <Zap size={16} />,
  export: <Download size={16} />,
  review: <Eye size={16} />,
}
const CATEGORY_COLOR: Record<string, string> = {
  analysis: '#3b82f6',
  action: '#f59e0b',
  export: '#10b981',
  review: '#8b5cf6',
}
const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#6b7280',
}

/* ─── Suggestion Card ─── */
function SuggestionCard({
  suggestion,
  onAccept,
  accepted,
}: {
  suggestion: NextStepSuggestion
  onAccept: (s: NextStepSuggestion) => void
  accepted: boolean
}) {
  const cat = suggestion.category
  return (
    <div
      style={{
        background: accepted ? 'rgba(16,185,129,0.08)' : 'var(--color-bg-surface)',
        border: `1px solid ${accepted ? '#10b981' : 'var(--color-border)'}`,
        borderRadius: 10,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        opacity: accepted ? 0.85 : 1,
        transition: 'all 0.25s',
      }}
    >
      {/* Confidence ring */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: `conic-gradient(${CATEGORY_COLOR[cat]} ${suggestion.confidence * 360}deg, var(--color-border) 0deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--color-bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: CATEGORY_COLOR[cat],
          }}
        >
          {CATEGORY_ICON[cat]}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: CATEGORY_COLOR[cat],
              background: `${CATEGORY_COLOR[cat]}18`,
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {cat}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            {Math.round(suggestion.confidence * 100)}% relevance
          </span>
          {suggestion.auto_triggered && (
            <span
              style={{
                fontSize: '0.6rem',
                color: '#f59e0b',
                background: '#f59e0b18',
                padding: '1px 6px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              AUTO-TRIGGERED
            </span>
          )}
        </div>
        <h4
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: '4px 0',
          }}
        >
          {suggestion.title}
        </h4>
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {suggestion.description}
        </p>
      </div>

      <button
        onClick={() => onAccept(suggestion)}
        disabled={accepted}
        style={{
          background: accepted ? '#10b981' : 'transparent',
          color: accepted ? '#fff' : CATEGORY_COLOR[cat],
          border: `1px solid ${accepted ? '#10b981' : CATEGORY_COLOR[cat]}`,
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: '0.7rem',
          fontWeight: 700,
          cursor: accepted ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
      >
        {accepted ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={12} /> Done
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Accept <ChevronRight size={12} />
          </span>
        )}
      </button>
    </div>
  )
}

/* ─── Main Page ─── */
export default function ImportExport() {
  const {
    step, setStep, uploading, uploadError, setUploading, setUploadError,
    preview, suggestions, setPreview, setSuggestions,
    importing, result, postSuggestions,
    setImporting, setResult, setPostSuggestions, reset,
  } = useImportStore()

  const [dragOver, setDragOver] = useState(false)
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const fileRef = useRef<HTMLInputElement>(null)

  /* ─── Upload handler ─── */
  const handleUpload = useCallback(async (file: File) => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res: any = await api.post('/imports/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(res.preview)
      setSuggestions(res.suggestions)
      setStep('preview')
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  /* ─── Confirm import ─── */
  const handleConfirm = useCallback(async () => {
    if (!preview) return
    setImporting(true)
    try {
      const res: any = await api.post('/imports/confirm', {
        events: preview.events,
        trigger_agents: true,
      })
      setResult(res.result)
      setPostSuggestions(res.suggestions)
      setStep('results')
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || 'Import failed')
    } finally {
      setImporting(false)
    }
  }, [preview])

  /* ─── Accept suggestion ─── */
  const handleAccept = useCallback((s: NextStepSuggestion) => {
    setAcceptedIds((prev) => new Set(prev).add(s.id))
    // In a full implementation, this would trigger the actual action
    // via the API. For now we mark it as accepted.
  }, [])

  /* ─── Export handler ─── */
  const handleExport = useCallback(async (endpoint: string) => {
    try {
      const res = await api.get(endpoint, {
        params: { format: exportFormat },
        responseType: 'blob',
      } as any)
      const blob = new Blob([res as any], {
        type: exportFormat === 'csv' ? 'text/csv' : 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = endpoint.split('/').pop()?.split('?')[0] || `export.${exportFormat}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setUploadError('Export failed. Try again.')
    }
  }, [exportFormat])

  /* ─── Drag & drop ─── */
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg-base)' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-surface)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Upload size={24} color="#0284c7" />
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              Import / Export Data
            </h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Upload CSV or JSON event data · Get AI-powered next-step suggestions · Export reports
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Step indicator */}
          {(['upload', 'preview', 'results'] as const).map((s, i) => (
            <div
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.7rem',
                fontWeight: step === s ? 800 : 500,
                color: step === s ? '#0284c7' : 'var(--color-text-muted)',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: step === s ? '#0284c7' : 'var(--color-border)',
                  color: step === s ? '#fff' : 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                }}
              >
                {i + 1}
              </span>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s}</span>
              {i < 2 && <ChevronRight size={12} style={{ margin: '0 2px', opacity: 0.4 }} />}
            </div>
          ))}
          <button
            onClick={reset}
            style={{
              marginLeft: 16,
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: '0.7rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RefreshCw size={12} /> Reset
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* ─── STEP 1: Upload ─── */}
        {step === 'upload' && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#0284c7' : 'var(--color-border)'}`,
                borderRadius: 16,
                padding: '60px 40px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(2,132,199,0.05)' : 'var(--color-bg-surface)',
                transition: 'all 0.25s',
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <Upload
                size={48}
                color={dragOver ? '#0284c7' : 'var(--color-text-muted)'}
                style={{ marginBottom: 16 }}
              />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
                Drop your event data here
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
                Supports CSV and JSON formats
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <span style={formatBadgeStyle('#3b82f6')}>CSV</span>
                <span style={formatBadgeStyle('#f59e0b')}>JSON</span>
              </div>
              {uploading && (
                <div style={{ marginTop: 20, color: '#0284c7', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Analyzing file...
                </div>
              )}
            </div>
            {uploadError && (
              <div style={errorBannerStyle}>
                <AlertTriangle size={16} /> {uploadError}
              </div>
            )}

            {/* Sample data hint */}
            <div style={{ marginTop: 24, padding: 16, background: 'var(--color-bg-surface)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
                Expected Format
              </h4>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                CSV columns or JSON objects should include: <code style={{ color: '#0284c7' }}>event_type</code>, <code style={{ color: '#0284c7' }}>severity</code>, <code style={{ color: '#0284c7' }}>description</code>, <code style={{ color: '#0284c7' }}>affected_passengers</code>, <code style={{ color: '#0284c7' }}>estimated_delay_minutes</code>
              </p>
              <pre style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-base)', padding: 10, borderRadius: 6, overflow: 'auto', margin: 0 }}>
{`event_type,severity,description,affected_passengers,estimated_delay_minutes,priority
track_defect,critical,Major rail fracture near Howrah junction,2500,120,9
train_delay,high,Express delayed due to signal failure,800,45,7
platform_overcrowding,medium,Platform 3 overcrowded during rush hour,1200,10,5`}
              </pre>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Preview + Suggestions ─── */}
        {step === 'preview' && preview && (
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total Records', value: preview.total_records, color: '#3b82f6' },
                { label: 'Critical', value: preview.summary.by_severity.critical || 0, color: '#dc2626' },
                { label: 'Affected Passengers', value: preview.summary.total_affected_passengers.toLocaleString(), color: '#f59e0b' },
                { label: 'Est. Delay (min)', value: preview.summary.total_estimated_delay_minutes, color: '#8b5cf6' },
              ].map((card) => (
                <div key={card.label} className="stat-card" style={{ '--stat-color': card.color, padding: 14, borderRadius: 10 } as React.CSSProperties}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8 }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Errors */}
            {preview.has_errors && (
              <div style={{ ...errorBannerStyle, marginBottom: 20 }}>
                <AlertTriangle size={16} />
                <div>
                  <strong>{preview.errors.length} validation issue(s):</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    {preview.errors.slice(0, 5).map((e, i) => (
                      <li key={i} style={{ fontSize: '0.7rem' }}>{e}</li>
                    ))}
                    {preview.errors.length > 5 && (
                      <li style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                        ...and {preview.errors.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* ─── Next Step Suggestions ─── */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="#f59e0b" />
                Suggested Next Steps
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  — you decide which to execute
                </span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {suggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    onAccept={handleAccept}
                    accepted={acceptedIds.has(s.id)}
                  />
                ))}
              </div>
            </div>

            {/* Event preview table */}
            <div className="card" style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Event Preview ({preview.events.length} rows)
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(preview.summary.by_severity).map(([sev, count]) => (
                    <span
                      key={sev}
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: SEVERITY_COLOR[sev] || '#888',
                        background: `${SEVERITY_COLOR[sev] || '#888'}18`,
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {sev}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 300 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-base)' }}>
                      {['Type', 'Severity', 'Priority', 'Passengers', 'Delay (min)', 'Description'].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.events.slice(0, 20).map((e, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td style={tdStyle}>
                          <code style={{ color: '#0284c7', fontSize: '0.68rem' }}>{e.event_type}</code>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            color: SEVERITY_COLOR[e.severity] || '#888',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            fontSize: '0.65rem',
                          }}>
                            {e.severity}
                          </span>
                        </td>
                        <td style={tdStyle}>{e.priority}</td>
                        <td style={tdStyle}>{e.affected_passengers?.toLocaleString()}</td>
                        <td style={tdStyle}>{e.estimated_delay_minutes}</td>
                        <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.description || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => { reset() }} style={btnSecondaryStyle}>
                <X size={14} /> Cancel
              </button>
              <button onClick={handleConfirm} disabled={importing || preview.has_errors} style={btnPrimaryStyle}>
                {importing ? (
                  <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <CheckCircle size={14} />
                )}
                {importing ? 'Importing...' : `Import ${preview.total_records} Events`}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Results + Post-Import Suggestions ─── */}
        {step === 'results' && result && (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* Success banner */}
            <div
              style={{
                background: '#d1fae5',
                border: '1px solid #6ee7b7',
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <CheckCircle size={32} color="#059669" />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#065f46', margin: 0 }}>
                  Import Complete
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#047857', margin: '4px 0 0' }}>
                  {result.imported_count} event(s) imported successfully.
                  {result.error_count > 0 && ` ${result.error_count} error(s) occurred.`}
                  {' '}Agent pipeline triggered for critical events.
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div style={{ ...errorBannerStyle, marginBottom: 20 }}>
                <AlertTriangle size={16} />
                <div>
                  <strong>Import errors:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    {result.errors.map((e, i) => (
                      <li key={i} style={{ fontSize: '0.7rem' }}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Post-import suggestions */}
            {postSuggestions.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={18} color="#8b5cf6" />
                  What to do next
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {postSuggestions.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onAccept={handleAccept}
                      accepted={acceptedIds.has(s.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Export panel */}
            <div
              className="card"
              style={{ borderRadius: 12, padding: 20, marginBottom: 20 }}
            >
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Download size={18} color="#10b981" />
                Export Data
              </h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Format:</span>
                {(['csv', 'json'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setExportFormat(f)}
                    style={{
                      background: exportFormat === f ? '#0284c7' : 'transparent',
                      color: exportFormat === f ? '#fff' : 'var(--color-text-secondary)',
                      border: `1px solid ${exportFormat === f ? '#0284c7' : 'var(--color-border)'}`,
                      borderRadius: 6,
                      padding: '4px 12px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'Events Report', endpoint: '/imports/export/events', icon: <FileText size={14} /> },
                  { label: 'Agent Report', endpoint: '/imports/export/agents', icon: <Shield size={14} /> },
                  { label: 'Stations', endpoint: '/imports/export/stations', icon: <MapPin size={14} /> },
                ].map((exp) => (
                  <button
                    key={exp.endpoint}
                    onClick={() => handleExport(exp.endpoint)}
                    style={btnSecondaryStyle}
                  >
                    {exp.icon} {exp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Imported event IDs */}
            {result.event_ids.length > 0 && (
              <div
                className="card"
                style={{ borderRadius: 12, padding: 16, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}
              >
                <strong>Imported Event IDs:</strong>{' '}
                {result.event_ids.join(', ')}
              </div>
            )}

            {/* New import button */}
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button onClick={reset} style={btnPrimaryStyle}>
                <Upload size={14} /> Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Shared inline styles ─── */
const formatBadgeStyle = (color: string): React.CSSProperties => ({
  fontSize: '0.65rem',
  fontWeight: 700,
  color,
  background: `${color}18`,
  padding: '3px 10px',
  borderRadius: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

const errorBannerStyle: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  padding: '12px 16px',
  borderRadius: 8,
  color: '#b91c1c',
  fontSize: '0.75rem',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 12px',
  color: 'var(--color-text-primary)',
  fontSize: '0.72rem',
}

const btnPrimaryStyle: React.CSSProperties = {
  background: '#0284c7',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 18px',
  fontSize: '0.75rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'all 0.2s',
}

const btnSecondaryStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}
