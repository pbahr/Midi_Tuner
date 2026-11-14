export const SUSTAIN_PEDAL_CONTROLLER = 64;
export const SUSTAIN_PEDAL_THRESHOLD = 64;

export function isSustainPedalDown(value) {
  return value >= SUSTAIN_PEDAL_THRESHOLD;
}

export function createSustainPedalState(onChange = () => {}) {
  const activePedals = new Set();

  function getPedalId(source, channel) {
    return JSON.stringify([source, channel]);
  }

  return {
    set(source, channel, isDown) {
      const pedalId = getPedalId(source, channel);
      const wasDown = activePedals.has(pedalId);
      if (isDown === wasDown) return;

      if (isDown) {
        activePedals.add(pedalId);
      } else {
        activePedals.delete(pedalId);
      }

      onChange(source, channel, isDown, activePedals.size > 0);
    },

    clearSource(source) {
      for (const pedalId of activePedals) {
        const [pedalSource, channel] = JSON.parse(pedalId);
        if (pedalSource === source) {
          activePedals.delete(pedalId);
          onChange(source, channel, false, activePedals.size > 0);
        }
      }
    },
  };
}
