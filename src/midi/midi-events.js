export function formatNoteEvent({ note, octave, velocity, input }) {
  return `${note}${octave} - velocity ${Math.round(velocity * 127)} - ${input}`;
}
