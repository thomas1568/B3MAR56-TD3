const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export function cropGeometry(image, state, size = 640) {
  const zoom = clamp(Number(state.zoom) || 1, 1, 4);
  const scale = Math.max(size / image.width, size / image.height) * zoom;
  const width = image.width * scale, height = image.height * scale;
  const offsetX = clamp(state.offsetX || 0, -(width - size) / 2, (width - size) / 2);
  const offsetY = clamp(state.offsetY || 0, -(height - size) / 2, (height - size) / 2);
  return { zoom, scale, width, height, offsetX, offsetY, x: (size - width) / 2 + offsetX, y: (size - height) / 2 + offsetY };
}
export function zoomCrop(image, state, zoom, anchor = { x: 320, y: 320 }) {
  const old = cropGeometry(image, state), ratio = clamp(zoom, 1, 4) / old.zoom;
  return cropGeometry(image, { zoom, offsetX: (old.offsetX - anchor.x + 320) * ratio + anchor.x - 320, offsetY: (old.offsetY - anchor.y + 320) * ratio + anchor.y - 320 });
}
