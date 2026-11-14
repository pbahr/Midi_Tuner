import Soundfont from "soundfont-player";

export function createPianoSound() {
  let audioContext;
  let instrument;
  let loading = null;
  const heldNotes = new Map();
  const playingNotes = new Map();
  const activePedals = new Set();
  let nextVoiceId = 0;

  function getNoteId(midi, source, channel) {
    return JSON.stringify([midi, source, channel]);
  }

  function getPedalId(source, channel) {
    return JSON.stringify([source, channel]);
  }

  function startNote(voiceId, note) {
    if (!instrument || note.node) return;

    note.node = instrument.play(note.midi, audioContext.currentTime, {
      gain: note.velocity,
      release: 0.35,
      cents: note.pitchOffset,
    });
    note.node.source.addEventListener("ended", () => {
      if (playingNotes.get(voiceId) === note) {
        playingNotes.delete(voiceId);
      }
    });
    playingNotes.set(voiceId, note);
  }

  function releaseNote(voiceId, note) {
    if (heldNotes.get(note.key) === note) {
      heldNotes.delete(note.key);
    }
    playingNotes.delete(voiceId);
    if (note.node) {
      note.node.stop(audioContext.currentTime);
    }
  }

  return {
    enable() {
      if (instrument) return Promise.resolve();
      if (loading) return loading;

      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) {
        return Promise.reject(new Error("This browser does not support Web Audio."));
      }

      audioContext ??= new AudioContextConstructor();
      const resumePromise = audioContext.resume();
      loading = Promise.all([
        resumePromise,
        Soundfont.instrument(audioContext, "acoustic_grand_piano", {
          soundfont: "MusyngKite",
        }),
      ])
        .then(([, loadedInstrument]) => {
          instrument = loadedInstrument;

          for (const [voiceId, note] of playingNotes) {
            startNote(voiceId, note);
          }
        })
        .catch((error) => {
          loading = null;
          throw error;
        });

      return loading;
    },

    noteOn(midi, velocity, pitchOffset, source, channel) {
      const noteId = getNoteId(midi, source, channel);
      if (heldNotes.has(noteId)) return;

      const voiceId = nextVoiceId++;
      const note = {
        key: noteId,
        voiceId,
        midi,
        source,
        channel,
        velocity,
        pitchOffset,
        node: null,
        held: true,
      };
      heldNotes.set(noteId, note);
      playingNotes.set(voiceId, note);
      startNote(voiceId, note);
    },

    setPitchOffset(midi, pitchOffset) {
      for (const note of playingNotes.values()) {
        if (note.midi === midi) {
          note.pitchOffset = pitchOffset;
          note.node?.source.playbackRate.setTargetAtTime(
            2 ** (pitchOffset / 1200),
            audioContext.currentTime,
            0.02,
          );
        }
      }
    },

    noteOff(midi, source, channel) {
      const noteId = getNoteId(midi, source, channel);
      const note = heldNotes.get(noteId);
      if (!note) return;

      heldNotes.delete(noteId);
      note.held = false;
      if (activePedals.has(getPedalId(source, channel))) {
        note.sustained = true;
      } else {
        releaseNote(note.voiceId, note);
      }
    },

    setSustain(source, channel, isDown) {
      const pedalId = getPedalId(source, channel);
      if (isDown) {
        activePedals.add(pedalId);
        return;
      }

      activePedals.delete(pedalId);
      for (const [voiceId, note] of playingNotes) {
        if (
          note.source === source &&
          note.channel === channel &&
          !note.held
        ) {
          releaseNote(voiceId, note);
        }
      }
    },

    clearSource(source) {
      for (const [voiceId, note] of playingNotes) {
        if (note.source === source) {
          releaseNote(voiceId, note);
        }
      }

      for (const pedalId of activePedals) {
        const [pedalSource] = JSON.parse(pedalId);
        if (pedalSource === source) activePedals.delete(pedalId);
      }
    },
  };
}
