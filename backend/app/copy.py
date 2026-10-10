"""Copy deck strings the backend returns (SRD 10 §19). Used verbatim; Person C owns the wording."""

COPY_02 = "MediVara organises what your documents say. It is not medical advice. Check important information with your doctor."
COPY_05 = (
    "If you or someone else may be in danger or need urgent medical help, call 112 (emergency) or 108 (ambulance) "
    "now, or go to the nearest emergency department. If you are thinking about harming yourself, call Tele-MANAS on "
    "14416 (free, 24×7). MediVara cannot help in an emergency."
)
COPY_06 = (
    "I can't advise you to start, stop or change any medicine or dose. Only your doctor can decide that with you. "
    "Here is what your documents say, so you can discuss it with them."
)
COPY_07 = "I couldn't find this in your documents. If you have a report that mentions it, you can upload it, or ask your doctor."
COPY_07B = "I can only help with questions about the documents in this MediVara profile."
COPY_08 = "Some content was withheld because MediVara couldn't check it against your documents."
COPY_08B = "MediVara couldn't check an answer against your documents, so here are the most relevant lines instead."
COPY_09A = "The AI summary isn't available right now. Everything below comes directly from your documents."
COPY_09B = "The AI assistant isn't available right now. These lines from your documents match your question."
COPY_12B = "Some of this comes from information you haven't reviewed yet."
OLDER_NOT_SEARCHED = "Older documents were not searched."
# Placeholder wording, pending the copy deck (Person C).
NO_AI_CONSENT = "AI processing is switched off for this profile, so nothing was sent to the AI service. Here is what your documents say."


def notice(code: str, text: str) -> dict:
    return {"code": code, "text": text}
