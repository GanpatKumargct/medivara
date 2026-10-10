// Create a profile you manage for a family member (a child, an elderly parent) who
// doesn't have their own account. You become its owner and can share it later.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api/endpoints'
import { ApiError } from '../../api/types'
import type { Relationship, Sex } from '../../api/types'
import { useToast } from '../../context/ToastContext'
import { RELATIONSHIP_LABELS } from '../../lib/format'
import { Button, Dialog, Field, Input } from '../ui'

const RELATIONSHIPS: Relationship[] = ['parent', 'child', 'spouse', 'sibling', 'grandparent', 'other']

export function AddFamilyMemberDialog({
  open,
  onClose,
  defaultRelationship = 'parent',
}: {
  open: boolean
  onClose: () => void
  defaultRelationship?: Relationship
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [relationship, setRelationship] = useState<Relationship>(defaultRelationship)
  const [sex, setSex] = useState<Sex | ''>('')
  const [error, setError] = useState<string | null>(null)

  const ageNum = age.trim() === '' ? null : Number(age)
  const ageInvalid = ageNum !== null && (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 130)

  const create = useMutation({
    mutationFn: () => api.createPatient({ display_name: name.trim(), age_years: ageNum, relationship, sex: sex || null }),
    onSuccess: (patient) => {
      void qc.invalidateQueries({ queryKey: ['patients'] })
      toast(`${patient.display_name} added`)
      setName('')
      setAge('')
      setSex('')
      onClose()
      navigate(`/p/${patient.id}`)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'PROFILE_LIMIT') setError('You can manage up to 10 profiles.')
      else setError('Couldn’t add this family member. Try again.')
    },
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a family member"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={create.isPending} disabled={!name.trim() || ageInvalid} onClick={() => create.mutate()}>
            Add profile
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-muted">
        Keep records for someone who doesn’t use MediVara themselves — a child or an elderly parent. You manage this profile.
        To give another adult access to records, invite them by email from Family &amp; sharing instead.
      </p>
      <div className="space-y-3">
        <Field label="Name" htmlFor="fm-name">
          <Input id="fm-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lakshmi Raman" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Relationship to you" htmlFor="fm-rel">
            <select
              id="fm-rel"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as Relationship)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>
              ))}
            </select>
          </Field>
          <Field label="Age (optional)" htmlFor="fm-age" error={ageInvalid ? 'Enter a whole number from 0 to 130' : undefined}>
            <Input id="fm-age" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 72" />
          </Field>
        </div>
        <Field label="Sex (optional)" htmlFor="fm-sex" hint="Used for health tools such as Women’s health, and the app’s colour theme.">
          <select
            id="fm-sex"
            value={sex}
            onChange={(e) => setSex(e.target.value as Sex | '')}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">Not specified</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
        {error && <p className="text-sm font-medium text-danger-fg" role="alert">{error}</p>}
      </div>
    </Dialog>
  )
}
