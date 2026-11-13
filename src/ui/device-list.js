export function renderDevices(listElement, devices) {
  listElement.replaceChildren();

  if (devices.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No devices found.";
    listElement.append(emptyItem);
    return;
  }

  for (const device of devices) {
    const item = document.createElement("li");
    item.textContent = device.name;
    listElement.append(item);
  }
}
