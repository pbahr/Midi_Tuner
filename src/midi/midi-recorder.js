import { getPitchBendForCents } from "./midi-tuning.js";
import { SUSTAIN_PEDAL_CONTROLLER } from "./sustain-pedal.js";

const TICKS_PER_QUARTER = 480;
const MICROSECONDS_PER_QUARTER = 500_000;
const MIDI_NOTE_OFF_VELOCITY = 64;

function getNoteId(noteNumber, source, channel) {
  return JSON.stringify([noteNumber, source, channel]);
}

function getPedalId(source, channel) {
  return JSON.stringify([source, channel]);
}

function getMidiChannel(channel, event) {
  if (!Number.isInteger(channel) || channel < 0 || channel > 16) {
    throw new RangeError(
      `MIDI ${event.type} event #${event.index + 1} at ${event.time} ms has invalid channel "${channel}". Expected a channel from 0 to 16.`,
    );
  }
  return channel === 0 ? 0 : channel - 1;
}

function toPitchBendBytes(value) {
  const rawValue =
    value < 0
      ? 8192 + Math.round(value * 8192)
      : 8192 + Math.round(value * 8191);
  return [rawValue & 0x7f, (rawValue >> 7) & 0x7f];
}

function encodeVariableLength(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) {
    throw new RangeError("MIDI event delta is outside the supported range.");
  }

  const bytes = [value & 0x7f];
  while ((value >>= 7) > 0) bytes.unshift((value & 0x7f) | 0x80);
  return bytes;
}

function encodeTrackEvents(event) {
  const channel = getMidiChannel(event.channel, event);
  switch (event.type) {
    case "noteOn":
      return [[0x90 | channel, event.noteNumber, event.velocity]];
    case "noteOff":
      return [[0x80 | channel, event.noteNumber, MIDI_NOTE_OFF_VELOCITY]];
    case "controlChange":
      return [[0xb0 | channel, event.controller, event.value]];
    case "pitchBend":
      return [[0xe0 | channel, ...toPitchBendBytes(event.value)]];
    case "pitchBendRange": {
      const status = 0xb0 | channel;
      return [
        [status, 101, 0],
        [status, 100, 0],
        [status, 6, 1],
        [status, 38, 0],
        [status, 101, 127],
        [status, 100, 127],
      ];
    }
    default:
      throw new Error(`Unsupported MIDI recording event: ${event.type}`);
  }
}

export function encodeMidiFile(events) {
  const sortedEvents = events
    .map((event, index) => ({ ...event, index }))
    .sort((left, right) => left.time - right.time || left.index - right.index);
  const track = [
    0x00, 0xff, 0x51, 0x03,
    (MICROSECONDS_PER_QUARTER >> 16) & 0xff,
    (MICROSECONDS_PER_QUARTER >> 8) & 0xff,
    MICROSECONDS_PER_QUARTER & 0xff,
  ];
  const pitchBendRangeEvents = new Map();
  for (const event of sortedEvents) {
    if (event.type === "pitchBendRange") {
      pitchBendRangeEvents.set(event.channel, event);
    }
  }
  for (const event of pitchBendRangeEvents.values()) {
    for (const message of encodeTrackEvents(event)) {
      track.push(0x00, ...message);
    }
  }

  let previousTick = 0;

  for (const event of sortedEvents) {
    if (event.type === "pitchBendRange") continue;

    const tick = Math.max(
      previousTick,
      Math.round(
        (event.time * TICKS_PER_QUARTER) /
          (MICROSECONDS_PER_QUARTER / 1000),
      ),
    );
    const messages = encodeTrackEvents(event);
    messages.forEach((message, index) => {
      track.push(...encodeVariableLength(index === 0 ? tick - previousTick : 0));
      track.push(...message);
    });
    previousTick = tick;
  }

  track.push(0x00, 0xff, 0x2f, 0x00);
  const header = [
    0x4d, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,
    0x00, 0x01,
    (TICKS_PER_QUARTER >> 8) & 0xff,
    TICKS_PER_QUARTER & 0xff,
  ];
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b,
    (track.length >> 24) & 0xff,
    (track.length >> 16) & 0xff,
    (track.length >> 8) & 0xff,
    track.length & 0xff,
  ];

  return Uint8Array.from([...header, ...trackHeader, ...track]);
}

export function createMidiRecorder({ now = () => performance.now() } = {}) {
  let events = [];
  let recording = false;
  let startTime = 0;
  let eventOrder = 0;
  const heldNotes = new Map();
  const activePedals = new Set();
  const pitchOffsets = new Map();
  const configuredChannels = new Set();
  const channelPitchBends = new Map();

  function record(event) {
    if (!recording) return;
    events.push({
      ...event,
      time: Math.max(0, now() - startTime),
      order: eventOrder++,
    });
  }

  function sendPitchBend(channel, noteNumber) {
    if (!configuredChannels.has(channel)) {
      record({ type: "pitchBendRange", channel });
      configuredChannels.add(channel);
    }
    const value = getPitchBendForCents(pitchOffsets.get(noteNumber) ?? 0);
    record({
      type: "pitchBend",
      channel,
      value,
    });
    channelPitchBends.set(channel, value);
  }

  function restoreChannelPitchBend(channel) {
    const remainingNote = [...heldNotes.values()].find(
      (note) => note.channel === channel,
    );
    if (remainingNote) {
      sendPitchBend(channel, remainingNote.noteNumber);
    } else {
      record({ type: "pitchBend", channel, value: 0 });
      channelPitchBends.set(channel, 0);
    }
  }

  function isChannelPedalDown(channel) {
    for (const pedalId of activePedals) {
      if (JSON.parse(pedalId)[1] === channel) return true;
    }
    return false;
  }

  return {
    start() {
      if (recording) return false;
      events = [];
      eventOrder = 0;
      configuredChannels.clear();
      channelPitchBends.clear();
      startTime = now();
      recording = true;
      const pedalChannels = new Set(
        [...activePedals].map((pedalId) => JSON.parse(pedalId)[1]),
      );
      for (const channel of pedalChannels) {
        record({
          type: "controlChange",
          channel,
          controller: SUSTAIN_PEDAL_CONTROLLER,
          value: 127,
        });
      }
      for (const note of heldNotes.values()) {
        sendPitchBend(note.channel, note.noteNumber);
        record({
          type: "noteOn",
          noteNumber: note.noteNumber,
          velocity: Math.max(1, Math.min(127, Math.round(note.velocity * 127))),
          channel: note.channel,
        });
      }
      return true;
    },

    stop() {
      if (!recording) return false;

      for (const [noteId, note] of heldNotes) {
        record({ type: "noteOff", noteNumber: note.noteNumber, channel: note.channel });
        heldNotes.delete(noteId);
      }
      for (const pedalId of activePedals) {
        const [, channel] = JSON.parse(pedalId);
        activePedals.delete(pedalId);
        if (!isChannelPedalDown(channel)) {
          record({
            type: "controlChange",
            channel,
            controller: SUSTAIN_PEDAL_CONTROLLER,
            value: 0,
          });
        }
      }
      for (const channel of configuredChannels) {
        if (channelPitchBends.get(channel) !== 0) {
          record({ type: "pitchBend", channel, value: 0 });
          channelPitchBends.set(channel, 0);
        }
      }

      recording = false;
      return true;
    },

    noteOn(noteNumber, velocity, source, channel) {
      const noteId = getNoteId(noteNumber, source, channel);
      if (heldNotes.has(noteId)) return;

      heldNotes.set(noteId, { noteNumber, source, channel, velocity });
      if (recording) {
        sendPitchBend(channel, noteNumber);
        record({
          type: "noteOn",
          noteNumber,
          velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))),
          channel,
        });
      }
    },

    noteOff(noteNumber, source, channel) {
      const noteId = getNoteId(noteNumber, source, channel);
      const note = heldNotes.get(noteId);
      if (!note) return;

      heldNotes.delete(noteId);
      if (recording) {
        record({ type: "noteOff", noteNumber: note.noteNumber, channel });
        restoreChannelPitchBend(channel);
      }
    },

    setPitchOffset(noteNumber, cents) {
      pitchOffsets.set(noteNumber, cents);
      if (!recording) return;

      const channels = new Set();
      for (const note of heldNotes.values()) {
        if (note.noteNumber === noteNumber) channels.add(note.channel);
      }
      for (const channel of channels) {
        sendPitchBend(channel, noteNumber);
      }
    },

    sustainChange(source, channel, isDown) {
      const pedalId = getPedalId(source, channel);
      if (activePedals.has(pedalId) === isDown) return;
      const channelWasDown = isChannelPedalDown(channel);
      if (isDown) {
        activePedals.add(pedalId);
      } else {
        activePedals.delete(pedalId);
      }

      if (!recording) return;
      const channelIsDown = isChannelPedalDown(channel);
      if (channelIsDown === channelWasDown) return;

      record({
        type: "controlChange",
        channel,
        controller: SUSTAIN_PEDAL_CONTROLLER,
        value: channelIsDown ? 127 : 0,
      });
    },

    clearSource(source) {
      for (const [noteId, note] of heldNotes) {
        if (note.source === source) {
          this.noteOff(note.noteNumber, source, note.channel);
        }
      }
      for (const pedalId of activePedals) {
        const [pedalSource, channel] = JSON.parse(pedalId);
        if (pedalSource === source) {
          this.sustainChange(source, channel, false);
        }
      }
    },

    isRecording() {
      return recording;
    },

    hasRecording() {
      return events.length > 0 && !recording;
    },

    getMidiFile() {
      if (!this.hasRecording()) {
        throw new Error("Stop a recording with MIDI events before downloading.");
      }
      return encodeMidiFile(events);
    },

    getEvents() {
      return events.map(({ order, ...event }) => ({ ...event }));
    },
  };
}
