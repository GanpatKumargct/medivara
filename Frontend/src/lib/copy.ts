// Copy deck — verbatim from docs/srd/10-ui-screen-spec.md §19 (FE-1.5, FR-102).
// Safety and disclaimer text is NEVER typed inline in screens; it comes from here.
// Placeholders in {braces} are filled with fill().

export const COPY = {
  'COPY-01':
    'MediVara helps you organise your medical documents, see your history on a timeline, and prepare questions for your doctor. It shows where every piece of information came from. MediVara does not diagnose, treat or give medical advice, and it can make mistakes. Always check important information with a qualified healthcare professional. In an emergency, call 112.',
  'COPY-02':
    'MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.',
  'COPY-03':
    'This is a hackathon prototype. Use only the synthetic sample documents provided by the team. Do not upload real medical records — yours or anyone else’s.',
  'COPY-04':
    'To read your documents, MediVara sends the text of each document to an AI model (Google Gemini) through the OpenRouter service. When you ask a question, the text of this profile’s documents is sent too. MediVara asks OpenRouter to use only AI providers that don’t store or train on these requests, but their terms may allow limited logging to prevent abuse. Use synthetic documents only. You can withdraw this consent in Settings.',
  'COPY-05':
    'If you or someone else may be in danger or need urgent medical help, call 112 (emergency) or 108 (ambulance) now, or go to the nearest emergency department. If you are thinking about harming yourself, call Tele-MANAS on 14416 (free, 24×7). MediVara cannot help in an emergency.',
  'COPY-06':
    'I can’t advise you to start, stop or change any medicine or dose. Only your doctor can decide that with you. Here is what your documents say, so you can discuss it with them.',
  'COPY-07':
    'I couldn’t find this in your documents. If you have a report that mentions it, you can upload it, or ask your doctor.',
  'COPY-07b': 'I can only help with questions about the documents in this MediVara profile.',
  'COPY-08':
    'Some content was withheld because MediVara couldn’t check it against your documents.',
  'COPY-08b':
    'MediVara couldn’t check an answer against your documents, so here are the most relevant lines instead.',
  'COPY-09':
    'AI features are unavailable right now. You can still view your documents, timeline and brief.',
  'COPY-09a':
    'The AI summary isn’t available right now. Everything below comes directly from your documents.',
  'COPY-09b':
    'The AI assistant isn’t available right now. These lines from your documents match your question.',
  'COPY-09c':
    'MediVara couldn’t read this document right now because the AI service didn’t respond. Try again in a minute.',
  'COPY-10': 'Lines from your documents that match your question',
  'COPY-11':
    'The AI service didn’t respond, so MediVara used a saved reading of this same file from earlier testing.',
  'COPY-11-label': 'Cached result',
  'COPY-12': 'MediVara read this from your document, but you haven’t checked it yet.',
  'COPY-12-label': 'Unverified',
  'COPY-12b': 'Some of this comes from information you haven’t reviewed yet.',
  'COPY-13':
    'This document contains text that looks like instructions to an AI system. MediVara ignored those instructions and treated the document as information only. Please check that the document is genuine.',
  'COPY-14':
    'This looks like a scanned image. Reading scanned documents isn’t available in this prototype yet.',
  'COPY-15': 'Not a real provider. Shown for demonstration only.',
  'COPY-15-label': 'Simulated',
  'COPY-16':
    'Simulated booking for demonstration only. No appointment has been made with a real healthcare provider, and no provider has been contacted.',
  'COPY-16b':
    'These are general categories based on what your documents mention. They are not a diagnosis or a referral. Providers shown are simulated for this demo.',
  'COPY-17':
    'MediVara does not translate between Indian Sign Language and text or speech. The ISL glossary shows official sign videos for selected health terms from the ISLRTC Indian Sign Language dictionary. For conversations with healthcare staff, please ask for a qualified ISL interpreter.',
  'COPY-18':
    'Sign video: Indian Sign Language Research and Training Centre (ISLRTC), ISL Dictionary. Shown for learning and communication support. Videos load from YouTube.',
  'COPY-18b':
    'ISL video not available here. You can look up this term in the ISLRTC ISL Dictionary.',
  'COPY-19': [
    'I am Deaf. I use Indian Sign Language (ISL).',
    'Please arrange a qualified ISL interpreter for my appointment.',
    'Please write things down or type on my phone.',
    'Please look at me when you speak.',
    'I am hard of hearing.',
    'Please give me a little extra time.',
  ],
  'COPY-20':
    'Voice input uses your browser’s speech recognition. In Chrome, your voice may be sent to Google’s speech service to turn it into text. MediVara never receives or stores your audio — only the text you choose to send. You can always type instead.',
  'COPY-21':
    'Read-aloud uses your device’s voices. Some voices work online, which means the text is sent to a speech service. MediVara uses on-device voices when available.',
  'COPY-22':
    'MediVara can’t use your microphone. You can allow it in your browser settings, or type your question instead.',
  'COPY-23':
    'MediVara can show reminders while this app is open in your browser. Reminders may not appear if the app or browser is closed, your device is asleep, or notifications are blocked. Don’t rely on MediVara alone for important medicines or appointments.',
  'COPY-24':
    'I am entering this schedule exactly as my doctor or pharmacist told me. MediVara will not change my medicines or doses.',
  'COPY-25':
    'I agree to share {patient}’s MediVara records with {name} ({email}) with the permissions ticked above. I can remove their access at any time, and they will lose access immediately.',
  'COPY-26':
    'Remove {name}’s access to {patient}’s records? They will lose access immediately. You can share again later.',
  'COPY-27-title': 'You don’t have access to this profile.',
  'COPY-27':
    'This profile hasn’t been shared with you, or access was removed. Ask the profile owner to share it with you.',
  'COPY-28': 'The date {as_written} was read as {parsed} (day first). Please check it.',
  'COPY-30a': 'None of your documents mention allergies.',
  'COPY-31':
    'Your documents changed after this brief was created. Create a new brief to include the changes.',
  'COPY-32': 'MOCK DATA — not connected to the server',
  'COPY-33': 'Your session ended. Please sign in again.',
  'COPY-34a': 'That email and password don’t match a MediVara account.',
  'COPY-34b': 'This file is larger than 10 MB. Please choose a smaller file.',
  'COPY-34c': 'Only PDF files can be added in this prototype.',
  'COPY-34d': 'This file is already in {patient}’s records.',
  'COPY-34e': 'This PDF has more than 10 pages. Please split it into smaller files.',
  'COPY-35': 'Synthetic sample',
  'COPY-37': 'General information — not from your documents',
  'COPY-38': 'AI-generated, checked against your documents',
} as const

export const PROCESSING_STAGE_LABELS: Record<string, string> = {
  queued: 'Waiting to be read',
  reading_text: 'Reading text',
  screening: 'Checking content',
  extracting: 'Extracting information',
  validating: 'Checking results',
  done: 'Ready — please review',
  no_text_layer: 'Could not read',
}

/** Fill {placeholders} in a copy string. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}
