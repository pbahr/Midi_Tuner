export function createActiveNotes(
  onChange,
  { onNoteOn = () => {}, onNoteOff = () => {} } = {},
) {
  const heldNotes = new Map();
  const noteCounts = new Map();

  function getNoteId(noteNumber, source, channel) {
    return JSON.stringify([noteNumber, source, channel]);
  }

  function release(noteId, heldNote) {
    onNoteOff(heldNote.noteNumber, heldNote.source, heldNote.channel);
    heldNotes.delete(noteId);
    const count = noteCounts.get(heldNote.noteNumber) - 1;
    if (count === 0) {
      noteCounts.delete(heldNote.noteNumber);
      onChange(heldNote.noteNumber, false);
    } else {
      noteCounts.set(heldNote.noteNumber, count);
    }
  }

  return {
    noteOn(noteNumber, source, channel, velocity = 1) {
      const noteId = getNoteId(noteNumber, source, channel);
      if (heldNotes.has(noteId)) return;

      const wasActive = noteCounts.has(noteNumber);
      const heldNote = { noteNumber, source, channel };
      heldNotes.set(noteId, heldNote);
      noteCounts.set(noteNumber, (noteCounts.get(noteNumber) ?? 0) + 1);
      onNoteOn(noteNumber, source, channel, velocity);
      if (!wasActive) onChange(noteNumber, true, velocity);
    },

    noteOff(noteNumber, source, channel) {
      const noteId = getNoteId(noteNumber, source, channel);
      const heldNote = heldNotes.get(noteId);
      if (!heldNote) return;
      release(noteId, heldNote);
    },

    clearSource(source) {
      for (const [noteId, heldNote] of heldNotes) {
        if (heldNote.source === source) {
          release(noteId, heldNote);
        }
      }
    },

    clear() {
      for (const [noteId, heldNote] of heldNotes) {
        release(noteId, heldNote);
      }
    },
  };
}
