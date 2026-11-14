import { createActiveNotes } from "../midi/active-notes.js";
import { nextPitchOffset } from "../midi/pitch-offsets.js";
import { createSustainPedalState } from "../midi/sustain-pedal.js";

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
  const key = document.createElement("button");
  const name = getNoteName(noteNumber);
  key.type = "button";
  key.className = `piano-key ${isBlack ? "piano-key--black" : "piano-key--white"}`;
  key.dataset.noteNumber = String(noteNumber);
  key.dataset.pitchOffset = "0";
  key.title = `${name}: normal tuning`;
  key.setAttribute("aria-label", `${name}, normal tuning`);
  key.setAttribute("aria-pressed", "false");

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

export function createPiano(
  container,
  {
    onNoteOn = () => {},
    onNoteOff = () => {},
    onPitchOffsetChange = () => {},
    onSustainChange = () => {},
  } = {},
) {
  const keys = new Map();
  const activeNotes = new Set();
  const pitchOffsets = new Map();
  const fragment = document.createDocumentFragment();
  let whiteIndex = 0;

  for (const noteNumber of PIANO_NOTE_NUMBERS) {
    const isWhite = whitePitchClasses.has(noteNumber % 12);
    const key = createKey(noteNumber, !isWhite, whiteIndex);
    keys.set(noteNumber, key);
    pitchOffsets.set(noteNumber, 0);
    key.addEventListener("click", () => {
      const pitchOffset = nextPitchOffset(pitchOffsets.get(noteNumber));
      pitchOffsets.set(noteNumber, pitchOffset);
      key.dataset.pitchOffset = String(pitchOffset);
      key.classList.toggle("piano-key--tuned-up", pitchOffset > 0);
      key.classList.toggle("piano-key--tuned-down", pitchOffset < 0);

      const modeLabel =
        pitchOffset > 0
          ? "pitch up 50 cents"
          : pitchOffset < 0
            ? "pitch down 50 cents"
            : "normal tuning";
      key.title = `${getNoteName(noteNumber)}: ${modeLabel}`;
      key.setAttribute("aria-label", `${getNoteName(noteNumber)}, ${modeLabel}`);
      key.setAttribute("aria-pressed", String(pitchOffset !== 0));
      onPitchOffsetChange(noteNumber, pitchOffset);
    });

    fragment.append(key);
    if (isWhite) {
      whiteIndex += 1;
    }
  }

  container.replaceChildren(fragment);

  function setNoteActive(noteNumber, isActive) {
    const key = keys.get(noteNumber);
    if (!key) return;

    key.classList.toggle("is-active", isActive);
    if (isActive) {
      activeNotes.add(noteNumber);
    } else {
      activeNotes.delete(noteNumber);
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

  const tracker = createActiveNotes(setNoteActive, {
    onNoteOn: (noteNumber, source, channel, velocity) => {
      onNoteOn(
        noteNumber,
        velocity,
        pitchOffsets.get(noteNumber),
        source,
        channel,
      );
    },
    onNoteOff,
  });
  const sustainPedals = createSustainPedalState(
    (source, channel, isDown, anyPedalDown) => {
      onSustainChange(source, channel, isDown, anyPedalDown);
    },
  );

  return {
    noteOn({ noteNumber, source, channel, velocity }) {
      tracker.noteOn(noteNumber, source, channel, velocity);
    },
    noteOff({ noteNumber, source, channel }) {
      tracker.noteOff(noteNumber, source, channel);
    },
    clearSource(source) {
      tracker.clearSource(source);
      sustainPedals.clearSource(source);
    },
    sustainChange({ source, channel, isDown }) {
      sustainPedals.set(source, channel, isDown);
    },
    clear: tracker.clear,
    getPitchOffset(noteNumber) {
      return pitchOffsets.get(noteNumber) ?? 0;
    },
  };
}
