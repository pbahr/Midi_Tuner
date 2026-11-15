import assert from "node:assert/strict";
import test from "node:test";
import { createActiveNotes } from "../src/midi/active-notes.js";
import { createMidiOutputRouter } from "../src/midi/midi-output.js";
import { getPitchBendForCents } from "../src/midi/midi-tuning.js";
import { clampMidiValue } from "../src/midi/midi-utils.js";
import { nextPitchOffset } from "../src/midi/pitch-offsets.js";
import {
  createSustainPedalState,
  isSustainPedalDown,
  SUSTAIN_PEDAL_CONTROLLER,
} from "../src/midi/sustain-pedal.js";
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

test("pitch offset mode cycles from normal to up, down, and normal", () => {
  assert.equal(nextPitchOffset(0), 50);
  assert.equal(nextPitchOffset(50), -50);
  assert.equal(nextPitchOffset(-50), 0);
});

test("sustain pedal uses MIDI controller 64 and the standard half-value threshold", () => {
  assert.equal(SUSTAIN_PEDAL_CONTROLLER, 64);
  assert.equal(isSustainPedalDown(63), false);
  assert.equal(isSustainPedalDown(64), true);
});

test("sustain pedal state is tracked per source and channel", () => {
  const changes = [];
  const pedal = createSustainPedalState((...change) => changes.push(change));

  pedal.set("keyboard-a", 1, true);
  pedal.set("keyboard-a", 1, true);
  pedal.set("keyboard-b", 1, true);
  pedal.set("keyboard-a", 1, false);
  pedal.clearSource("keyboard-b");

  assert.deepEqual(changes, [
    ["keyboard-a", 1, true, true],
    ["keyboard-b", 1, true, true],
    ["keyboard-a", 1, false, true],
    ["keyboard-b", 1, false, false],
  ]);
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

test("first active note forwards its MIDI velocity to the sound callback", () => {
  const changes = [];
  const notes = createActiveNotes((...change) => {
    changes.push(change);
  });

  notes.noteOn(69, "keyboard-a", 1, 0.72);
  notes.noteOn(69, "keyboard-b", 1, 0.3);

  assert.deepEqual(changes, [[69, true, 0.72]]);
});

test("note callbacks retain source and channel for sustain handling", () => {
  const noteOns = [];
  const noteOffs = [];
  const notes = createActiveNotes(
    () => {},
    {
      onNoteOn: (...event) => noteOns.push(event),
      onNoteOff: (...event) => noteOffs.push(event),
    },
  );

  notes.noteOn(60, "keyboard-a", 3, 0.8);
  notes.noteOff(60, "keyboard-a", 3);

  assert.deepEqual(noteOns, [[60, "keyboard-a", 3, 0.8]]);
  assert.deepEqual(noteOffs, [[60, "keyboard-a", 3]]);
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

test("MIDI output forwards notes with their velocity and channel only when enabled", () => {
  const sent = [];
  const output = {
    sendPitchBendRange: (...message) => sent.push(["range", ...message]),
    sendPitchBend: (...message) => sent.push(["bend", ...message]),
    sendNoteOn: (...message) => sent.push(["on", ...message]),
    sendNoteOff: (...message) => sent.push(["off", ...message]),
    sendControlChange: (...message) => sent.push(["control", ...message]),
  };
  const router = createMidiOutputRouter();

  router.setOutput(output);
  router.noteOn(60, 0.8, "keyboard-a", 3);
  router.setEnabled(true);
  router.noteOn(60, 0.8, "keyboard-a", 3);
  router.noteOff(60, "keyboard-a", 3);

  assert.deepEqual(sent, [
    ["range", 1, 0, { channels: 3 }],
    ["bend", 0, { channels: 3 }],
    ["on", 60, { channels: 3, attack: 0.8 }],
    ["off", 60, { channels: 3 }],
    ["bend", 0, { channels: 3 }],
  ]);
});

test("disabling MIDI output releases held notes, sustain, and pitch bend", () => {
  const sent = [];
  const output = {
    sendPitchBendRange: (...message) => sent.push(["range", ...message]),
    sendPitchBend: (...message) => sent.push(["bend", ...message]),
    sendNoteOn: (...message) => sent.push(["on", ...message]),
    sendNoteOff: (...message) => sent.push(["off", ...message]),
    sendControlChange: (...message) => sent.push(["control", ...message]),
  };
  const router = createMidiOutputRouter();

  router.setOutput(output);
  router.setEnabled(true);
  router.noteOn(64, 0.5, "keyboard-a", 2);
  router.sustainChange("keyboard-a", 2, true);
  router.setEnabled(false);

  assert.deepEqual(sent, [
    ["range", 1, 0, { channels: 2 }],
    ["bend", 0, { channels: 2 }],
    ["on", 64, { channels: 2, attack: 0.5 }],
    ["control", 64, 127, { channels: 2 }],
    ["off", 64, { channels: 2 }],
    ["control", 64, 0, { channels: 2 }],
    ["bend", 0, { channels: 2 }],
  ]);
});

test("MIDI output sustain is aggregated across inputs on the same channel", () => {
  const sent = [];
  const output = {
    sendPitchBendRange: () => {},
    sendPitchBend: () => {},
    sendNoteOn: (...message) => sent.push(["on", ...message]),
    sendNoteOff: (...message) => sent.push(["off", ...message]),
    sendControlChange: (...message) => sent.push(["control", ...message]),
  };
  const router = createMidiOutputRouter();

  router.setOutput(output);
  router.setEnabled(true);
  router.sustainChange("keyboard-a", 1, true);
  router.sustainChange("keyboard-b", 1, true);
  router.sustainChange("keyboard-a", 1, false);
  router.sustainChange("keyboard-b", 1, false);

  assert.deepEqual(sent, [
    ["control", 64, 127, { channels: 1 }],
    ["control", 64, 0, { channels: 1 }],
  ]);
});

test("pitch bend encodes -50, zero, and +50 cents for a one-semitone range", () => {
  assert.equal(getPitchBendForCents(-50), -0.5);
  assert.equal(getPitchBendForCents(0), 0);
  assert.equal(getPitchBendForCents(50), 0.5);
});

test("MIDI output sends the tuning bend before forwarded notes", () => {
  const sent = [];
  const output = {
    sendPitchBendRange: (...message) => sent.push(["range", ...message]),
    sendPitchBend: (...message) => sent.push(["bend", ...message]),
    sendNoteOn: (...message) => sent.push(["on", ...message]),
    sendNoteOff: (...message) => sent.push(["off", ...message]),
    sendControlChange: (...message) => sent.push(["control", ...message]),
  };
  const router = createMidiOutputRouter();

  router.setPitchOffset(60, 50);
  router.setOutput(output);
  router.setEnabled(true);
  router.noteOn(60, 0.8, "keyboard-a", 3);

  assert.deepEqual(sent, [
    ["range", 1, 0, { channels: 3 }],
    ["bend", 0.5, { channels: 3 }],
    ["on", 60, { channels: 3, attack: 0.8 }],
  ]);
});

test("changing tuning of a held note updates bend and note-off resets it", () => {
  const sent = [];
  const output = {
    sendPitchBendRange: () => {},
    sendPitchBend: (...message) => sent.push(["bend", ...message]),
    sendNoteOn: (...message) => sent.push(["on", ...message]),
    sendNoteOff: (...message) => sent.push(["off", ...message]),
    sendControlChange: () => {},
  };
  const router = createMidiOutputRouter();

  router.setOutput(output);
  router.setEnabled(true);
  router.noteOn(60, 0.7, "keyboard-a", 1);
  router.setPitchOffset(60, 50);
  router.noteOff(60, "keyboard-a", 1);

  assert.deepEqual(sent, [
    ["bend", 0, { channels: 1 }],
    ["on", 60, { channels: 1, attack: 0.7 }],
    ["bend", 0.5, { channels: 1 }],
    ["off", 60, { channels: 1 }],
    ["bend", 0, { channels: 1 }],
  ]);
});
