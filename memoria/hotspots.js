// Labels follow projected world points. Space them for touch without changing 3D poses.
// Leaders reconnect displaced labels to their actual world projection.
export function layoutHotspots(points, { width, top = 12, bottom }) {
  const gap = 8, margin = 10;
  const available = Math.max(0, bottom - top);
  let chosen = points.filter(point => point.visible);
  const capacity = Math.floor((available + gap) / (Math.max(44, ...chosen.map(point => point.height)) + gap));
  if (chosen.length > capacity) {
    chosen = chosen.sort((a,b) => Math.abs(a.y - (top + bottom)/2) - Math.abs(b.y - (top + bottom)/2)).slice(0,capacity);
  }
  chosen.sort((a,b) => a.y - b.y);
  const total = chosen.reduce((sum,point) => sum + point.height, 0) + Math.max(0,chosen.length-1)*gap;
  let cursor = top, remaining = total;
  const positions = new Map();
  for (const point of chosen) {
    const labelTop = Math.min(Math.max(cursor, point.y - point.height), bottom - remaining);
    const x = Math.max(margin + point.width/2, Math.min(width - margin - point.width/2, point.x));
    positions.set(point.id, { x, y: labelTop + point.height, anchorX: point.x, anchorY: point.y });
    cursor = labelTop + point.height + gap; remaining -= point.height + gap;
  }
  return positions;
}
