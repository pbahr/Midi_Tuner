const pitchOffsets = [0, 50, -50];

export function nextPitchOffset(currentOffset) {
  const currentIndex = pitchOffsets.indexOf(currentOffset);
  return pitchOffsets[(currentIndex + 1) % pitchOffsets.length];
}
