import { useState, type FormEvent } from 'react'
import { useToast } from '../components/Toasts'
import { Button, Field, Page, TextLink } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { isConfigured } from '../lib/config'
import { errorCopy } from '../lib/errors'
import { REPORT_CATEGORIES, type ReportCategory } from '../lib/types'

export default function Report() {
  const toast = useToast()
  const [link, setLink] = useState('')
  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!category) {
      toast('Pick what kind of problem it is.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.reportLink(link.trim(), category, description.trim())
      setSent(true)
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError('unknown')
      toast(errorCopy(e.code, e.retryAfter), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <p className="eyebrow">Report</p>
      <h1 className="headline mt-4 text-[clamp(2.8rem,13vw,5rem)]">Something not okay?</h1>
      <p className="mt-5 text-lg text-[#cfccc4]">
        If you're in a game, use <strong className="text-bone">Report</strong> in the game menu. It saves a copy of the
        conversation. Otherwise tell us about a link here.
      </p>
      <p className="mt-3 text-sm text-mute">If anyone is in immediate danger, contact your local emergency services.</p>

      {sent ? (
        <div className="card mt-10 p-6" role="status">
          <p className="text-2xl font-black uppercase">Thanks. We'll look into it.</p>
          <p className="mt-2 text-mute">
            You can also read the <TextLink to="/rules">rules</TextLink>.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10 flex flex-col gap-7">
          <Field
            label="Game link"
            optional
            placeholder="anonymass.com/g/7XK29FQ"
            value={link}
            maxLength={200}
            autoComplete="off"
            onChange={(e) => setLink(e.target.value)}
          />
          <fieldset>
            <legend className="text-sm font-extrabold uppercase tracking-tight">What happened?</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {REPORT_CATEGORIES.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="chip !min-h-11 justify-center"
                  aria-pressed={category === id}
                  onClick={() => setCategory(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-2">
            <label htmlFor="report-description" className="text-sm font-extrabold uppercase tracking-tight">
              Details
            </label>
            <textarea
              id="report-description"
              className="input min-h-32 resize-y !py-3 !text-base"
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should we know?"
            />
          </div>
          <Button type="submit" disabled={busy || !isConfigured}>
            {busy ? 'Sending...' : 'Send report'}
          </Button>
        </form>
      )}
    </Page>
  )
}
