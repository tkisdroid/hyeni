// Shared formatters for child device telemetry. Extracted from App.jsx so
// HomeDashboard's per-child summary cards can show the same screen-on
// label the parent sees inside the child tracker / device-safety section
// without duplicating the conversion logic.

export function formatDeviceDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0분";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${Math.max(1, minutes)}분`;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}
