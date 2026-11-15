import { getPitchBendForCents } from "./midi-tuning.js";
import { SUSTAIN_PEDAL_CONTROLLER } from "./sustain-pedal.js";

export function createMidiOutputRouter() {
  const activeNotes = new Map();
  const activePedals = new Set();
  const outputPedals = new Set();
  const pitchOffsets = new Map();
  const configuredChannels = new Set();
  let output = null;
  let enabled = false;

  function getNoteId(noteNumber, source, channel) {
    return JSON.stringify([noteNumber, source, channel]);
  }

  function getPedalId(source, channel) {
    return JSON.stringify([source, channel]);
  }

  function isChannelPedalDown(channel) {
    for (const pedalId of activePedals) {
      if (JSON.parse(pedalId)[1] === channel) return true;
    }

    return false;
  }

  function sendPedal(channel, isDown) {
    output.sendControlChange(SUSTAIN_PEDAL_CONTROLLER, isDown ? 127 : 0, {
      channels: channel,
    });
    if (isDown) {
      outputPedals.add(channel);
    } else {
      outputPedals.delete(channel);
    }
  }

  function configurePitchBendRange(channel) {
    if (configuredChannels.has(channel)) return;
    output.sendPitchBendRange(1, 0, { channels: channel });
    configuredChannels.add(channel);
  }

  function sendPitchBend(channel, noteNumber) {
    configurePitchBendRange(channel);
    output.sendPitchBend(
      getPitchBendForCents(pitchOffsets.get(noteNumber) ?? 0),
      { channels: channel },
    );
  }

  function restoreChannelPitchBend(channel) {
    const remainingNote = [...activeNotes.values()].find(
      (note) => note.channel === channel,
    );
    if (remainingNote) {
      sendPitchBend(channel, remainingNote.noteNumber);
    } else {
      output.sendPitchBend(0, { channels: channel });
    }
  }

  function sendActivePedals() {
    const channels = new Set(
      [...activePedals].map((pedalId) => JSON.parse(pedalId)[1]),
    );
    for (const channel of channels) {
      sendPedal(channel, true);
    }
  }

  function sustainChange(source, channel, isDown) {
    const pedalId = getPedalId(source, channel);
    const wasDown = activePedals.has(pedalId);
    if (wasDown === isDown) return;

    if (isDown) {
      activePedals.add(pedalId);
    } else {
      activePedals.delete(pedalId);
    }

    if (!enabled || !output) return;
    const channelIsDown = isChannelPedalDown(channel);
    if (channelIsDown !== outputPedals.has(channel)) {
      sendPedal(channel, channelIsDown);
    }
  }

  function releaseOutputNotes() {
    if (!output) return;

    let firstError;
    const activeChannels = new Set();
    for (const { noteNumber, channel } of activeNotes.values()) {
      activeChannels.add(channel);
      try {
        output.sendNoteOff(noteNumber, { channels: channel });
      } catch (error) {
        firstError ??= error;
      }
    }
    for (const channel of outputPedals) {
      try {
        output.sendControlChange(SUSTAIN_PEDAL_CONTROLLER, 0, {
          channels: channel,
        });
      } catch (error) {
        firstError ??= error;
      }
    }
    for (const channel of activeChannels) {
      try {
        output.sendPitchBend(0, { channels: channel });
      } catch (error) {
        firstError ??= error;
      }
    }

    activeNotes.clear();
    outputPedals.clear();
    if (firstError) throw firstError;
  }

  return {
    noteOn(noteNumber, velocity, source, channel) {
      if (!enabled || !output) return;

      const noteId = getNoteId(noteNumber, source, channel);
      if (activeNotes.has(noteId)) return;

      sendPitchBend(channel, noteNumber);
      output.sendNoteOn(noteNumber, {
        channels: channel,
        attack: velocity,
      });
      activeNotes.set(noteId, { noteNumber, channel });
    },

    noteOff(noteNumber, source, channel) {
      const noteId = getNoteId(noteNumber, source, channel);
      const activeNote = activeNotes.get(noteId);
      if (!output || !activeNote) return;

      output.sendNoteOff(activeNote.noteNumber, {
        channels: activeNote.channel,
      });
      activeNotes.delete(noteId);
      restoreChannelPitchBend(activeNote.channel);
    },

    sustainChange,

    setEnabled(isEnabled) {
      if (enabled === isEnabled) return;

      if (!isEnabled) {
        enabled = false;
        releaseOutputNotes();
        return;
      }

      enabled = true;
      if (output) sendActivePedals();
    },

    setOutput(nextOutput) {
      if (output === nextOutput) return;

      releaseOutputNotes();
      output = nextOutput;
      configuredChannels.clear();
      if (enabled && output) {
        sendActivePedals();
      }
    },

    setPitchOffset(noteNumber, cents) {
      const previousOffset = pitchOffsets.get(noteNumber) ?? 0;
      pitchOffsets.set(noteNumber, cents);
      if (enabled && output && cents !== previousOffset) {
        for (const note of activeNotes.values()) {
          if (note.noteNumber === noteNumber) {
            sendPitchBend(note.channel, noteNumber);
          }
        }
      }
    },

    getOutput() {
      return output;
    },
  };
}
