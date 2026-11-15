export function getPitchBendForCents(cents) {
  if (![-50, 0, 50].includes(cents)) {
    throw new RangeError("Pitch bend offset must be -50, 0, or 50 cents.");
  }

  return cents / 100;
}
