import { createActiveNotes } from "../midi/active-notes.js";

const firstNote = 21;
const lastNote = 108;
const whitePitchClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const whiteKeyCount = 52;
export const PIANO_NOTE_NUMBERS = Array.from(
  { length: lastNote - firstNote + 1 },
  (_, index) => firstNote + index,
);

function getNoteName(noteNumber) {
  const pitchClass = noteNumber % 12;
  const octave = Math.floor(noteNumber / 12) - 1;
  return `${noteNames[pitchClass]}${octave}`;
}

function createKey(noteNumber, isBlack, whiteIndex) {
  const key = document.createElement("div");
  const name = getNoteName(noteNumber);
  key.className = `piano-key ${isBlack ? "piano-key--black" : "piano-key--white"}`;
  key.dataset.noteNumber = String(noteNumber);
  key.title = name;

  if (isBlack) {
    key.style.left = `${(whiteIndex / whiteKeyCount) * 100}%`;
  } else {
    key.style.gridColumn = String(whiteIndex + 1);
    if (noteNumber % 12 === 0) {
      const label = document.createElement("span");
      label.className = "piano-key-label";
      label.textContent = name;
      key.append(label);
    }
  }

  return key;
}

export function createPiano(container, { onNoteOn = () => {}, onNoteOff = () => {} } = {}) {
  const keys = new Map();
  const activeNotes = new Set();
  const fragment = document.createDocumentFragment();
  let whiteIndex = 0;

  for (const noteNumber of PIANO_NOTE_NUMBERS) {
    const isWhite = whitePitchClasses.has(noteNumber % 12);
    const key = createKey(noteNumber, !isWhite, whiteIndex);
    keys.set(noteNumber, key);

    fragment.append(key);
    if (isWhite) {
      whiteIndex += 1;
    }
  }

  container.replaceChildren(fragment);

  function setNoteActive(noteNumber, isActive, velocity) {
    const key = keys.get(noteNumber);
    if (!key) return;

    key.classList.toggle("is-active", isActive);
    if (isActive) {
      activeNotes.add(noteNumber);
    } else {
      activeNotes.delete(noteNumber);
    }

    if (isActive) {
      onNoteOn(noteNumber, velocity);
    } else {
      onNoteOff(noteNumber);
    }

    const activeNames = [...activeNotes]
      .sort((a, b) => a - b)
      .map(getNoteName);
    container.setAttribute(
      "aria-label",
      activeNames.length > 0
        ? `88-key piano. Active notes: ${activeNames.join(", ")}.`
        : "88-key piano. No keys are currently active.",
    );
  }

  const tracker = createActiveNotes(setNoteActive);

  return {
    noteOn({ noteNumber, source, channel, velocity }) {
      tracker.noteOn(noteNumber, source, channel, velocity);
    },
    noteOff({ noteNumber, source, channel }) {
      tracker.noteOff(noteNumber, source, channel);
    },
    clearSource(source) {
      tracker.clearSource(source);
    },
    clear: tracker.clear,
  };
}
