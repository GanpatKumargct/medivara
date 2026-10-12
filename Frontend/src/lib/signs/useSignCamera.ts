// Camera + on-device hand and body tracking for sign-assisted questions (DEC-28).
// The video never leaves the browser: MediaPipe runs here (files served from /mediapipe/),
// and only the confirmed question text is ever sent. The camera stops when the panel closes,
// the page is hidden, or the user presses Stop.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision'
import { SignSegmenter, frameFeatures, type FrameInput } from './recognizer'
import { t } from '../i18n'

export type CameraStatus = 'idle' | 'starting' | 'running' | 'error'

const BASE = '/mediapipe'

async function createTrackers(): Promise<{ hands: HandLandmarker; pose: PoseLandmarker }> {
  // Loaded only when the camera is first used, so other pages don't download it.
  const { FilesetResolver, HandLandmarker, PoseLandmarker } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks(`${BASE}/wasm`)
  const make = async (delegate: 'GPU' | 'CPU') => ({
    hands: await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: `${BASE}/models/hand_landmarker.task`, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    }),
    pose: await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: `${BASE}/models/pose_landmarker_lite.task`, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    }),
  })
  try {
    return await make('GPU')
  } catch {
    return make('CPU') // no WebGL: slower but works
  }
}

function cameraError(err: unknown): string {
  const name = (err as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return t('Camera access was blocked. You can allow it in your browser settings, or type your question instead.')
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return t("No camera was found on this device.")
  if (name === 'NotReadableError') return t("The camera is being used by another app. Close it and try again.")
  return t("The camera could not be started. You can type your question instead.")
}

export function useSignCamera(onSign: (frames: number[][]) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [handsVisible, setHandsVisible] = useState(false)
  const [collecting, setCollecting] = useState(false)

  const onSignRef = useRef(onSign)
  onSignRef.current = onSign
  const stream = useRef<MediaStream | null>(null)
  const trackers = useRef<{ hands: HandLandmarker; pose: PoseLandmarker } | null>(null)
  const raf = useRef<number | null>(null)
  const segmenter = useRef(new SignSegmenter())
  const lastTime = useRef(-1)

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    segmenter.current.reset()
    setHandsVisible(false)
    setCollecting(false)
    setStatus((s) => (s === 'error' ? s : 'idle'))
  }, [])

  const loop = useCallback(() => {
    const video = videoRef.current
    const t = trackers.current
    if (!video || !t || !stream.current) return
    if (video.readyState >= 2 && video.currentTime !== lastTime.current) {
      lastTime.current = video.currentTime
      const now = performance.now()
      const h = t.hands.detectForVideo(video, now)
      const p = t.pose.detectForVideo(video, now)
      const frame: FrameInput = {
        hands: h.landmarks.map((points, i) => ({
          label: (h.handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right') as 'Left' | 'Right',
          points,
        })),
        pose: p.landmarks[0] ?? null,
      }
      const sign = segmenter.current.push(frameFeatures(frame))
      setHandsVisible(frame.hands.length > 0)
      setCollecting(segmenter.current.collecting)
      if (sign) onSignRef.current(sign)
      draw(canvasRef.current, video, frame)
    }
    raf.current = requestAnimationFrame(loop)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError(t("This browser can’t use the camera. Try Chrome or Edge, or type your question instead."))
      return
    }
    setStatus('starting')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
    } catch (err) {
      setStatus('error')
      setError(cameraError(err))
      return
    }
    try {
      trackers.current ??= await createTrackers()
    } catch {
      stream.current.getTracks().forEach((tr) => tr.stop())
      stream.current = null
      setStatus('error')
      setError(t("The sign models could not be loaded. Ask the team to run `npm run dev` with internet access once, then reload."))
      return
    }
    const video = videoRef.current
    if (!video || !stream.current) return
    video.srcObject = stream.current
    await video.play().catch(() => undefined)
    setStatus('running')
    raf.current = requestAnimationFrame(loop)
  }, [loop])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') stop()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      stop()
      trackers.current?.hands.close()
      trackers.current?.pose.close()
      trackers.current = null
    }
  }, [stop])

  return { videoRef, canvasRef, status, error, handsVisible, collecting, start, stop }
}

/** Dots on the hands so the user can see they are being tracked (drawn mirrored, like the video). */
function draw(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, frame: FrameInput) {
  if (!canvas) return
  const w = video.videoWidth || 640
  const h = video.videoHeight || 480
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  for (const hand of frame.hands) {
    ctx.fillStyle = hand.label === 'Left' ? '#10B981' : '#0284F7'
    for (const p of hand.points) {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
