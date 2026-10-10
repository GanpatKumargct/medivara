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
export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Icon>
)
export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Icon>
)
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M9 18l6-6-6-6" /></Icon>
)
export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Icon>
)
export const IconTrendDown = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 7l6 6 4-4 8 8" /><path d="M21 17v-4h-4" /></Icon>
)
export const IconTrendUp = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v4h-4" /></Icon>
)
export const IconMic = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></Icon>
)
export const IconKeyboard = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></Icon>
)
export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></Icon>
)
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
)
export const IconPaperclip = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M21.4 11.1l-9.2 9.2a6 6 0 01-8.5-8.5l9.2-9.2a4 4 0 015.7 5.7l-9.2 9.2a2 2 0 01-2.8-2.8l8.5-8.5" /></Icon>
)
export const IconWaveform = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 6v12M23 11v2" /></Icon>
)
export const IconSidebar = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></Icon>
)
export const IconSidebarLeft = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></Icon>
)
export const IconPencil = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5z" /></Icon>
)
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></Icon>
)
export const IconDots = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></Icon>
)
export const IconHeartPulse = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" /><path d="M3.5 12h4l2-3 3 6 2-3h6" /></Icon>
)
export const IconPill = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M10.5 20.5a5 5 0 01-7-7l6-6a5 5 0 017 7z" /><path d="M8.5 8.5l7 7" /></Icon>
)
export const IconIdCard = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M5 16a3 3 0 016 0M14 10h5M14 14h3" /></Icon>
)
export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>
)
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></Icon>
)
export const IconArrowUp = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>
)
export const IconMicOff = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M2 2l20 20" /><path d="M9 9v2a3 3 0 005.1 2.1M15 9.3V6a3 3 0 00-5.9-.7" /><path d="M5 11a7 7 0 0011.9 4.9M19 11a7 7 0 01-.4 2.3M12 18v3" /></Icon>
)
export const IconPhoneOff = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M10.7 13.3a16 16 0 003.4 2.6l1.3-1.3a2 2 0 012.1-.4c.8.3 1.7.5 2.6.6a2 2 0 011.7 2v3a2 2 0 01-2.2 2A19.8 19.8 0 013 4.2 2 2 0 015 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.4 2.1L8.9 9.7" /><path d="M22 2L2 22" /></Icon>
)
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>
)
export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></Icon>
)
export const IconUserPlus = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></Icon>
)
export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>
)
export const IconLink = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" /></Icon>
)
export const IconStethoscope = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M5 3v6a5 5 0 0010 0V3" /><path d="M10 14v2a5 5 0 0010 0v-2" /><circle cx="20" cy="12" r="2" /></Icon>
)
export const IconFlask = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 006.2 21.5h11.6a2 2 0 001.7-3L14 9V3" /><path d="M7 15h10" /></Icon>
)
export const IconCalculator = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" /></Icon>
)
export const IconCart = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" /></Icon>
)
