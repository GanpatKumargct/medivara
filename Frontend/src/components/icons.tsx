// Minimal inline icon set (no icon dependency). Each is decorative unless given a
// title; callers pair icons with text so meaning never relies on the glyph alone.
import type { SVGProps } from 'react'

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></Icon>
)
export const IconDoc = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M14 3v4a1 1 0 001 1h4" /><path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" /></Icon>
)
export const IconTimeline = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><path d="M6 8v8M11 6h7M11 18h7M11 12h5" /></Icon>
)
export const IconAsk = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Icon>
)
export const IconBrief = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M9 3h6a2 2 0 012 2v0H7v0a2 2 0 012-2z" /><path d="M7 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1" /><path d="M9 12h6M9 16h4" /></Icon>
)
export const IconHand = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M7 11V6a1.5 1.5 0 013 0v4" /><path d="M10 10V4.5a1.5 1.5 0 013 0V10" /><path d="M13 10V5.5a1.5 1.5 0 013 0V12" /><path d="M16 11.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-5.2-3L4 13.5a1.5 1.5 0 012.5-1.6L8 13.5" /></Icon>
)
export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></Icon>
)
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></Icon>
)
export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 10l9-7 9 7v9a2 2 0 01-2 2h-3v-7H8v7H5a2 2 0 01-2-2z" /></Icon>
)
export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.9.68 1.65 1.65 0 01-3.16 0 1.65 1.65 0 00-2.9-.68l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.52-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.52V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.52 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></Icon>
)
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M20 6L9 17l-5-5" /></Icon>
)
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M18 6L6 18M6 6l12 12" /></Icon>
)
export const IconEdit = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" /></Icon>
)
export const IconUndo = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 7v6h6" /><path d="M3 13a9 9 0 103-7l-3 3" /></Icon>
)
export const IconWarn = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Icon>
)
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Icon>
)
export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" /></Icon>
)
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Icon>
)
export const IconSpeaker = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M11 5L6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" /></Icon>
)
export const IconPrint = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><path d="M6 14h12v8H6z" /></Icon>
)
export const IconExternal = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><path d="M15 3h6v6M10 14L21 3" /></Icon>
)
export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></Icon>
)
