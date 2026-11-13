import assert from "node:assert/strict";
import test from "node:test";
import { createActiveNotes } from "../src/midi/active-notes.js";
import { clampMidiValue } from "../src/midi/midi-utils.js";
import { PIANO_NOTE_NUMBERS } from "../src/ui/piano.js";

test("clampMidiValue rounds and clamps values to the MIDI range", () => {
  assert.equal(clampMidiValue(63.6), 64);
  assert.equal(clampMidiValue(-1), 0);
  assert.equal(clampMidiValue(128), 127);
});

test("piano covers the standard 88-key range from A0 through C8", () => {
  assert.equal(PIANO_NOTE_NUMBERS.length, 88);
  assert.equal(PIANO_NOTE_NUMBERS[0], 21);
  assert.equal(PIANO_NOTE_NUMBERS.at(-1), 108);
});

test("active notes remain lit until every source releases the same pitch", () => {
  const changes = [];
  const notes = createActiveNotes((noteNumber, isActive) => {
    changes.push([noteNumber, isActive]);
  });

  notes.noteOn(60, "keyboard-a", 1);
  notes.noteOn(60, "keyboard-b", 1);
  notes.noteOff(60, "keyboard-a", 1);
  assert.deepEqual(changes, [
    [60, true],
    [60, true],
  ]);

  notes.noteOff(60, "keyboard-b", 1);
  assert.deepEqual(changes.at(-1), [60, false]);
});

test("duplicate note-on and unmatched note-off events do not corrupt held state", () => {
  const changes = [];
  const notes = createActiveNotes((noteNumber, isActive) => {
    changes.push([noteNumber, isActive]);
  });

  notes.noteOn(64, "keyboard-a", 2);
  notes.noteOn(64, "keyboard-a", 2);
  notes.noteOff(64, "keyboard-b", 2);
  notes.noteOff(64, "keyboard-a", 2);

  assert.deepEqual(changes, [
    [64, true],
    [64, false],
  ]);
});

test("clear deactivates every held pitch", () => {
  const changes = [];
  const notes = createActiveNotes((noteNumber, isActive) => {
    changes.push([noteNumber, isActive]);
  });

  notes.noteOn(60, "keyboard-a", 1);
  notes.noteOn(67, "keyboard-a", 1);
  notes.clear();

  assert.deepEqual(changes.slice(-2), [
    [60, false],
    [67, false],
  ]);
});

test("disconnecting an input releases its held notes only", () => {
  const changes = [];
  const notes = createActiveNotes((noteNumber, isActive) => {
    changes.push([noteNumber, isActive]);
  });

  notes.noteOn(60, "keyboard-a", 1);
  notes.noteOn(60, "keyboard-b", 1);
  notes.noteOn(67, "keyboard-a", 1);
  notes.clearSource("keyboard-a");

  assert.deepEqual(changes.slice(-1), [[67, false]]);
  notes.noteOff(60, "keyboard-b", 1);
  assert.deepEqual(changes.slice(-1), [[60, false]]);
});
