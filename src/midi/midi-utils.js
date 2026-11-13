export function clampMidiValue(value) {
  return Math.max(0, Math.min(127, Math.round(value)));
}
