function hasJongseong(text) {
  if (!text) return false;
  const last = text.charCodeAt(text.length - 1);
  if (last < 0xAC00 || last > 0xD7A3) return false;
  return ((last - 0xAC00) % 28) !== 0;
}

export function withParticle(name, withJong, withoutJong) {
  if (!name) return "";
  return `${name}${hasJongseong(name) ? withJong : withoutJong}`;
}
