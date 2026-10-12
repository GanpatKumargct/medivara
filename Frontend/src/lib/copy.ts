import { t } from './i18n'
// Copy deck — verbatim from docs/srd/10-ui-screen-spec.md §19 (FE-1.5, FR-102).
// Safety and disclaimer text is NEVER typed inline in screens; it comes from here.
// Placeholders in {braces} are filled with fill().

export const COPY = {
  'COPY-01':
    t("MediVara helps you organise your medical documents, see your history on a timeline, and prepare questions for your doctor. It shows where every piece of information came from. MediVara does not diagnose, treat or give medical advice, and it can make mistakes. Always check important information with a qualified healthcare professional. In an emergency, call 112."),
  'COPY-02':
    t("MediVara organises what your documents say. It is not medical advice. Check important information with your doctor."),
  'COPY-03':
    t("This is a hackathon prototype. Use only the synthetic sample documents provided by the team. Do not upload real medical records — yours or anyone else’s."),
  'COPY-04':
    t("To read your documents, MediVara sends the text of each document to an AI model (Google Gemini) through the OpenRouter service. When you ask a question, the text of this profile’s documents is sent too. MediVara asks OpenRouter to use only AI providers that don’t store or train on these requests, but their terms may allow limited logging to prevent abuse. Use synthetic documents only. You can withdraw this consent in Settings."),
  'COPY-05':
    t("If you or someone else may be in danger or need urgent medical help, call 112 (emergency) or 108 (ambulance) now, or go to the nearest emergency department. If you are thinking about harming yourself, call Tele-MANAS on 14416 (free, 24×7). MediVara cannot help in an emergency."),
  'COPY-06':
    t("I can’t advise you to start, stop or change any medicine or dose. Only your doctor can decide that with you. Here is what your documents say, so you can discuss it with them."),
  'COPY-07':
    t("I couldn’t find this in your documents. If you have a report that mentions it, you can upload it, or ask your doctor."),
  'COPY-07b': t("I can only help with questions about the documents in this MediVara profile."),
  'COPY-08':
    t("Some content was withheld because MediVara couldn’t check it against your documents."),
  'COPY-08b':
    t("MediVara couldn’t check an answer against your documents, so here are the most relevant lines instead."),
  'COPY-09':
    t("AI features are unavailable right now. You can still view your documents, timeline and brief."),
  'COPY-09a':
    t("The AI summary isn’t available right now. Everything below comes directly from your documents."),
  'COPY-09b':
    t("The AI assistant isn’t available right now. These lines from your documents match your question."),
  'COPY-09c':
    t("MediVara couldn’t read this document right now because the AI service didn’t respond. Try again in a minute."),
  'COPY-10': t("Lines from your documents that match your question"),
  'COPY-11':
    t("The AI service didn’t respond, so MediVara used a saved reading of this same file from earlier testing."),
  'COPY-11-label': t("Cached result"),
  'COPY-12': t("MediVara read this from your document, but you haven’t checked it yet."),
  'COPY-12-label': t("Unverified"),
  'COPY-12b': t("Some of this comes from information you haven’t reviewed yet."),
  'COPY-13':
    t("This document contains text that looks like instructions to an AI system. MediVara ignored those instructions and treated the document as information only. Please check that the document is genuine."),
  'COPY-14':
    t("This looks like a scanned image. Reading scanned documents isn’t available in this prototype yet."),
  'COPY-15': t("Not a real provider. Shown for demonstration only."),
  'COPY-15-label': t("Simulated"),
  'COPY-16':
    t("Simulated booking for demonstration only. No appointment has been made with a real healthcare provider, and no provider has been contacted."),
  'COPY-16b':
    t("These are general categories based on what your documents mention. They are not a diagnosis or a referral. Providers shown are simulated for this demo."),
  'COPY-17':
    t("MediVara does not translate between Indian Sign Language and text or speech. The ISL glossary shows official sign videos for selected health terms from the ISLRTC Indian Sign Language dictionary. For conversations with healthcare staff, please ask for a qualified ISL interpreter."),
  'COPY-18':
    t("Sign video: Indian Sign Language Research and Training Centre (ISLRTC), ISL Dictionary. Shown for learning and communication support. Videos load from YouTube."),
  'COPY-18b':
    t("ISL video not available here. You can look up this term in the ISLRTC ISL Dictionary."),
  'COPY-19': [
    t("I am Deaf. I use Indian Sign Language (ISL)."),
    t("Please arrange a qualified ISL interpreter for my appointment."),
    t("Please write things down or type on my phone."),
    t("Please look at me when you speak."),
    t("I am hard of hearing."),
    t("Please give me a little extra time."),
  ],
  'COPY-20':
    t("Voice input uses your browser’s speech recognition. In Chrome, your voice may be sent to Google’s speech service to turn it into text. MediVara never receives or stores your audio — only the text you choose to send. You can always type instead."),
  'COPY-21':
    t("Read-aloud uses your device’s voices. Some voices work online, which means the text is sent to a speech service. MediVara uses on-device voices when available."),
  'COPY-22':
    t("MediVara can’t use your microphone. You can allow it in your browser settings, or type your question instead."),
  'COPY-23':
    t("MediVara can show reminders while this app is open in your browser. Reminders may not appear if the app or browser is closed, your device is asleep, or notifications are blocked. Don’t rely on MediVara alone for important medicines or appointments."),
  'COPY-24':
    t("I am entering this schedule exactly as my doctor or pharmacist told me. MediVara will not change my medicines or doses."),
  'COPY-25':
    t("I agree to share {patient}’s MediVara records with {name} ({email}) with the permissions ticked above. I can remove their access at any time, and they will lose access immediately."),
  'COPY-26':
    t("Remove {name}’s access to {patient}’s records? They will lose access immediately. You can share again later."),
  'COPY-26b':
    t("Delete “{title}” from {patient}’s records? It is hidden from Records, the timeline, briefs and Ask at once. You can restore it from Recently deleted for 30 days."),
  'COPY-26c':
    t("Delete “{title}” permanently? The file, everything read from it and its history are removed now. This can’t be undone."),
  'COPY-27-title': t("You don’t have access to this profile."),
  'COPY-27':
    t("This profile hasn’t been shared with you, or access was removed. Ask the profile owner to share it with you."),
  'COPY-28': t("The date {as_written} was read as {parsed} (day first). Please check it."),
  'COPY-29':
    t("Your documents list different strengths for {medicine}: {strengthA} ({documentA}, {dateA}) and {strengthB} ({documentB}, {dateB}). The most recent document lists {latest}. Please confirm your current dose with your doctor."),
  'COPY-29b':
    t("Your documents list different instructions for how often to take {medicine}. Please confirm with your doctor."),
  'COPY-29c':
    t("Your documents differ on allergies. Please confirm your allergies with your doctor."),
  'COPY-30a': t("None of your documents mention allergies."),
  'COPY-30b': t("{title} has no date we could read."),
  'COPY-30c': t("{test} ({date}) has no reference range printed on the report."),
  'COPY-30d':
    t("Your {documentType} from {date} says “{instruction}”. No later visit, appointment or reminder was found in MediVara."),
  'COPY-31':
    t("Your documents changed after this brief was created. Create a new brief to include the changes."),
  'COPY-32': t("MOCK DATA — not connected to the server"),
  'COPY-33': t("Your session ended. Please sign in again."),
  'COPY-34a': t("That email and password don’t match a MediVara account."),
  'COPY-34b': t("This file is larger than 10 MB. Please choose a smaller file."),
  'COPY-34c': t("Only PDF files can be added in this prototype."),
  'COPY-34d': t("This file is already in {patient}’s records."),
  'COPY-34e': t("This PDF has more than 10 pages. Please split it into smaller files."),
  'COPY-34f': t("Too many sign-in attempts. Please wait a few minutes and try again."),
  'COPY-47':
    t("Signing uses your camera. The video stays on this device: MediVara looks only for hand and body positions here and never sends or saves the video. Only the question you confirm is sent. You can turn this off at any time in Settings."),
  'COPY-48':
    t("Experimental: sign to choose a question. MediVara knows only a few signs it has been shown and can be wrong, so check the question before you send it. It does not translate sign language."),
  'COPY-35': t("Synthetic sample"),
  'COPY-37': t("General information — not from your documents"),
  'COPY-38': t("AI-generated, checked against your documents"),
  // Redesign additions (not yet in the SRD copy deck).
  'COPY-39':
    t("Voice conversation streams your microphone audio to ElevenLabs, a third-party voice AI service, which turns your speech into text and speaks answers back. ElevenLabs also receives your first names, a list of this profile’s documents (type, clinic and date — not their contents) and the answers it reads out. Answers about your records still come only from MediVara’s checked answers, and each one is saved to this chat. Use synthetic data only. In an emergency, call 112."),
  'COPY-40':
    t("Voice conversation isn’t set up on this server yet. An administrator needs to add the ElevenLabs agent settings (see the backend README). You can still dictate with the microphone button and use Read aloud."),
  'COPY-41':
    t("Readings you enter yourself. MediVara doesn’t judge whether a value is normal — discuss your readings with your doctor."),
  'COPY-43':
    t("Predictions are estimates from the dates you log. They aren’t medical advice and must not be used as contraception or to plan a pregnancy — talk to your doctor."),
  'COPY-44':
    t("If you have bleeding, severe pain, a severe headache or blurred vision, fits, a fever, leaking fluid, or your baby is moving less than usual, call 108 or go to the nearest hospital now. MediVara doesn’t give pregnancy advice — follow the check-up schedule your doctor or health worker gives you."),
  'COPY-45':
    t("Feeling low, anxious or overwhelmed for more than two weeks after birth is common and treatable — tell your doctor. If you have thoughts of harming yourself or your baby, call Tele-MANAS on 14416 (free, 24×7) or 112 now. For heavy bleeding, fever or severe pain, call 108."),
  'COPY-46':
    t("This is sensitive information. Everyone you’ve shared this profile with can see it — manage who has access in Family & sharing."),
  'COPY-42':
    t("Not available in this prototype. This service needs a partner integration, so nothing here books, orders or links anything for real."),
} as const

export const PROCESSING_STAGE_LABELS: Record<string, string> = {
  queued: t("Waiting to be read"),
  reading_text: t("Reading text"),
  screening: t("Checking content"),
  extracting: t("Extracting information"),
  validating: t("Checking results"),
  done: t("Ready — please review"),
  no_text_layer: t("Could not read"),
}

/** Fill {placeholders} in a copy string. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}
