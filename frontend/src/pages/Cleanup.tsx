import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GetBrowserCaches,
  CleanBrowserCaches,
  GetAICaches,
  CleanAICaches,
  GetAppCaches,
  CleanAppCaches,
} from '../../wailsjs/go/main/DevCacheService'

// ---- Types ----
interface CacheTarget {
  id: string
  name: string
  category: string
  exists: boolean
  size_mb: number
  safety_level: string
  unavailable: boolean
  unavailable_reason: string
}

interface CleanResult {
  id: string
  success: boolean
  freed: string
  error: string
}

// ---- SafetyBadge ----
function SafetyBadge({ level }: { level: string }) {
  const { t } = useTranslation('common')
  const map: Record<string, { icon: string; className: string; label: string }> = {
    safe: { icon: '✅', className: 'text-green-400', label: t('badge.safe') },
    caution: { icon: '⚠️', className: 'text-amber-400', label: t('badge.caution') },
    manual: { icon: '🔴', className: 'text-red-400', label: t('badge.manual') },
  }
  const badge = map[level] ?? map['manual']
  return (
    <span className={`text-xs font-medium ${badge.className}`}>
      {badge.icon} {badge.label}
    </span>
  )
}

// ---- fmtMB ----
function fmtMB(mb: number): string {
  if (mb <= 0) return '—'
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

// ---- CacheItem ----
interface CacheItemProps {
  target: CacheTarget
  selected: boolean
  onToggle: (id: string) => void
  safetyNote: string
}

function CacheItem({ target, selected, onToggle, safetyNote }: CacheItemProps) {
  const { t } = useTranslation('cleanup')
  if (target.unavailable) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-3 opacity-60">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">{target.name}</span>
          <span className="text-xs text-white/30">{t('unavailable')}</span>
        </div>
        <p className="mt-1 text-xs text-white/40">{target.unavailable_reason}</p>
      </div>
    )
  }
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        selected ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(target.id)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-blue-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-white">{target.name}</span>
            <span className="shrink-0 text-xs text-white/60 font-mono">{fmtMB(target.size_mb)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <SafetyBadge level={target.safety_level} />
          </div>
          <p className="mt-1 text-xs text-white/50 leading-relaxed">{safetyNote}</p>
        </div>
      </div>
    </div>
  )
}

// ---- SelectiveCleanTab ----
type TabType = 'browser' | 'ai' | 'app'

interface SelectiveCleanTabProps {
  tabKey: TabType
  targets: CacheTarget[]
  selected: Set<string>
  onToggle: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onPreview: () => void
}

function SelectiveCleanTab({
  tabKey,
  targets,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onPreview,
}: SelectiveCleanTabProps) {
  const { t } = useTranslation(['cleanup', 'common'])
  const visible = targets.filter((tgt) => tgt.exists || tgt.unavailable)

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-white/40">
        {t(`cleanup:empty.${tabKey}`)}
      </div>
    )
  }

  const selectedCount = visible.filter((tgt) => selected.has(tgt.id) && !tgt.unavailable).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('common:button.selectAll')}
          </button>
          <span className="text-white/20">|</span>
          <button
            onClick={onDeselectAll}
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            {t('common:button.deselectAll')}
          </button>
        </div>
        <button
          onClick={onPreview}
          disabled={selectedCount === 0}
          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t('common:button.preview')} →
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {visible.map((target) => {
          const noteKey = `cleanup:targets.${tabKey}.${target.id}.safetyNote`
          const safetyNote = t(noteKey)
          return (
            <CacheItem
              key={target.id}
              target={target}
              selected={selected.has(target.id)}
              onToggle={onToggle}
              safetyNote={safetyNote === noteKey ? '' : safetyNote}
            />
          )
        })}
      </div>
    </div>
  )
}

// ---- PreviewDialog ----
interface PreviewDialogProps {
  tabKey: TabType
  selectedTargets: CacheTarget[]
  onConfirm: () => void
  onCancel: () => void
  cleaning: boolean
  results: CleanResult[]
}

function PreviewDialog({
  selectedTargets,
  onConfirm,
  onCancel,
  cleaning,
  results,
}: PreviewDialogProps) {
  const { t } = useTranslation(['cleanup', 'common'])
  const totalMB = selectedTargets.reduce((sum, tgt) => sum + tgt.size_mb, 0)
  const count = selectedTargets.length
  const isDone = results.length > 0 && !cleaning

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1a1a2e] p-6 shadow-2xl">
        {!isDone ? (
          <>
            <h2 className="text-base font-semibold text-white">{t('cleanup:dialog.title')}</h2>
            <p className="mt-1 text-xs text-white/50">{t('cleanup:dialog.subtitle')}</p>
            <div className="mt-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
              {selectedTargets.map((tgt) => (
                <div key={tgt.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/80">{tgt.name}</span>
                  <span className="text-white/40 font-mono">{fmtMB(tgt.size_mb)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-amber-400">{t('cleanup:dialog.warning')}</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={onCancel}
                disabled={cleaning}
                className="rounded px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors disabled:opacity-30"
              >
                {t('common:button.cancel')}
              </button>
              <button
                onClick={onConfirm}
                disabled={cleaning}
                className="rounded bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {cleaning
                  ? t('common:status.loading')
                  : t('cleanup:dialog.confirm', { count, size: fmtMB(totalMB) })}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-white">{t('common:status.success')}</h2>
            <div className="mt-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
              {results.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/80">{r.id}</span>
                  {r.success ? (
                    <span className="text-green-400">{t('cleanup:result.freed', { size: r.freed })}</span>
                  ) : (
                    <span className="text-red-400">{t('cleanup:result.error', { message: r.error })}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={onCancel}
                className="rounded bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
              >
                {t('common:button.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---- Main Cleanup Page ----
export default function Cleanup() {
  const { t } = useTranslation(['cleanup', 'common'])

  const [activeTab, setActiveTab] = useState<TabType>('browser')
  const [browserTargets, setBrowserTargets] = useState<CacheTarget[]>([])
  const [aiTargets, setAiTargets] = useState<CacheTarget[]>([])
  const [appTargets, setAppTargets] = useState<CacheTarget[]>([])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDialog, setShowDialog] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [results, setResults] = useState<CleanResult[]>([])
  const [loadError, setLoadError] = useState('')

  const loadAll = useCallback(() => {
    setLoadError('')
    Promise.all([GetBrowserCaches(), GetAICaches(), GetAppCaches()])
      .then(([browser, ai, app]) => {
        setBrowserTargets(browser as CacheTarget[])
        setAiTargets(ai as CacheTarget[])
        setAppTargets(app as CacheTarget[])
      })
      .catch((err: unknown) => {
        setLoadError(String(err))
      })
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const tabTargets: Record<TabType, CacheTarget[]> = {
    browser: browserTargets,
    ai: aiTargets,
    app: appTargets,
  }

  const currentTargets = tabTargets[activeTab]
  const selectableIds = currentTargets.filter((tgt) => tgt.exists && !tgt.unavailable).map((tgt) => tgt.id)

  const handleToggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    setSelected((prev) => new Set([...prev, ...selectableIds]))
  }

  const handleDeselectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      selectableIds.forEach((id) => next.delete(id))
      return next
    })
  }

  const handlePreview = () => {
    setResults([])
    setShowDialog(true)
  }

  const handleConfirm = () => {
    const ids = currentTargets
      .filter((tgt) => selected.has(tgt.id) && !tgt.unavailable)
      .map((tgt) => tgt.id)
    if (ids.length === 0) return
    setCleaning(true)
    const cleanFn =
      activeTab === 'browser'
        ? CleanBrowserCaches
        : activeTab === 'ai'
        ? CleanAICaches
        : CleanAppCaches
    cleanFn(ids)
      .then((res) => {
        setResults(res as CleanResult[])
        // Remove cleaned items from selection
        setSelected((prev) => {
          const next = new Set(prev)
          ids.forEach((id) => next.delete(id))
          return next
        })
        loadAll()
      })
      .catch((err: unknown) => {
        setResults([{ id: 'error', success: false, freed: '', error: String(err) }])
      })
      .finally(() => {
        setCleaning(false)
      })
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setResults([])
  }

  const tabList: { key: TabType; label: string }[] = [
    { key: 'browser', label: t('cleanup:tabs.browser') },
    { key: 'ai', label: t('cleanup:tabs.ai') },
    { key: 'app', label: t('cleanup:tabs.app') },
  ]

  const totalMB = (targets: CacheTarget[]) =>
    targets.filter((tgt) => tgt.exists).reduce((sum, tgt) => sum + tgt.size_mb, 0)

  const selectedForDialog = currentTargets.filter(
    (tgt) => selected.has(tgt.id) && !tgt.unavailable
  )

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">{t('cleanup:title')}</h1>
        <button
          onClick={loadAll}
          className="rounded px-2 py-1 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {t('common:button.refresh')}
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {loadError}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-white/5 p-1">
        {tabList.map(({ key, label }) => {
          const mb = totalMB(tabTargets[key])
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-white/15 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {label}
              {mb > 0 && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                  {fmtMB(mb)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <SelectiveCleanTab
          tabKey={activeTab}
          targets={currentTargets}
          selected={selected}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onPreview={handlePreview}
        />
      </div>

      {/* Preview/Confirm dialog */}
      {showDialog && (
        <PreviewDialog
          tabKey={activeTab}
          selectedTargets={selectedForDialog}
          onConfirm={handleConfirm}
          onCancel={handleCloseDialog}
          cleaning={cleaning}
          results={results}
        />
      )}
    </div>
  )
}
