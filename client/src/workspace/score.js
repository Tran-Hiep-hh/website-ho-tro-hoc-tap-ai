// Quiz results store percentages; present grades consistently on a 10-point scale.
export function scoreOnTen(percent) {
  return Math.round(percent) / 10;
}

export function scoreLabel(percent) {
  return `${scoreOnTen(percent).toLocaleString("vi-VN")}/10`;
}
