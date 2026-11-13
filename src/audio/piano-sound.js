import Soundfont from "soundfont-player";

export function createPianoSound() {
  let audioContext;
  let instrument;
  let loading = null;
  const heldNotes = new Map();
  const playingNotes = new Map();

  function startHeldNote(midi, { velocity, pitchOffset }) {
    if (!instrument || playingNotes.has(midi)) return;

    const node = instrument.play(midi, audioContext.currentTime, {
      gain: velocity,
      release: 0.35,
      cents: pitchOffset,
    });
    playingNotes.set(midi, node);
    node.source.addEventListener("ended", () => {
      if (playingNotes.get(midi) === node) {
        playingNotes.delete(midi);
      }
    });
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

          for (const [midi, note] of heldNotes) {
            startHeldNote(midi, note);
          }
        })
        .catch((error) => {
          loading = null;
          throw error;
        });

      return loading;
    },

    noteOn(midi, velocity, pitchOffset) {
      const note = { velocity, pitchOffset };
      heldNotes.set(midi, note);
      startHeldNote(midi, note);
    },

    setPitchOffset(midi, pitchOffset) {
      const note = heldNotes.get(midi);
      if (!note) return;

      note.pitchOffset = pitchOffset;
      const playingNote = playingNotes.get(midi);
      if (playingNote) {
        const playbackRate = 2 ** (pitchOffset / 1200);
        playingNote.source.playbackRate.setTargetAtTime(
          playbackRate,
          audioContext.currentTime,
          0.02,
        );
      }
    },

    noteOff(midi) {
      heldNotes.delete(midi);
      const node = playingNotes.get(midi);
      if (node) {
        node.stop(audioContext.currentTime);
        playingNotes.delete(midi);
      }
    },
  };
}
