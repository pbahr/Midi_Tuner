import Soundfont from "soundfont-player";

export function createPianoSound() {
  let audioContext;
  let instrument;
  let loading = null;
  const heldNotes = new Map();
  const playingNotes = new Map();

  function startHeldNote(midi, velocity) {
    if (!instrument || playingNotes.has(midi)) return;

    const node = instrument.play(midi, audioContext.currentTime, {
      gain: velocity,
      release: 0.35,
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

          for (const [midi, velocity] of heldNotes) {
            startHeldNote(midi, velocity);
          }
        })
        .catch((error) => {
          loading = null;
          throw error;
        });

      return loading;
    },

    noteOn(midi, velocity) {
      heldNotes.set(midi, velocity);
      startHeldNote(midi, velocity);
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
