export function createActiveNotes(onChange) {
  const heldNotes = new Map();
  const noteCounts = new Map();

  function getNoteId(noteNumber, source, channel) {
    return JSON.stringify([noteNumber, source, channel]);
  }

  function release(noteId, noteNumber) {
    heldNotes.delete(noteId);
    const count = noteCounts.get(noteNumber) - 1;
    if (count === 0) {
      noteCounts.delete(noteNumber);
      onChange(noteNumber, false);
    } else {
      noteCounts.set(noteNumber, count);
    }
  }

  return {
    noteOn(noteNumber, source, channel, velocity = 1) {
      const noteId = getNoteId(noteNumber, source, channel);
      if (heldNotes.has(noteId)) return;

      const wasActive = noteCounts.has(noteNumber);
      heldNotes.set(noteId, { noteNumber, source });
      noteCounts.set(noteNumber, (noteCounts.get(noteNumber) ?? 0) + 1);
      if (!wasActive) onChange(noteNumber, true, velocity);
    },

    noteOff(noteNumber, source, channel) {
      const noteId = getNoteId(noteNumber, source, channel);
      if (!heldNotes.has(noteId)) return;
      release(noteId, noteNumber);
    },

    clearSource(source) {
      for (const [noteId, heldNote] of heldNotes) {
        if (heldNote.source === source) {
          release(noteId, heldNote.noteNumber);
        }
      }
    },

    clear() {
      for (const noteNumber of noteCounts.keys()) {
        onChange(noteNumber, false);
      }

      heldNotes.clear();
      noteCounts.clear();
    },
  };
}
