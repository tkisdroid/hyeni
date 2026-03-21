import { haversineM } from "./utils.js";

/**
 * GeofenceEngine — deep module for arrival/departure detection.
 *
 * Like a security gate at a building entrance: it watches who crosses
 * the geofence boundary and reports entries/exits, but does not decide
 * what happens next (stickers, points, notifications). The caller
 * (App.jsx) decides the reaction.
 *
 * Manages internal state (arrived set, departure alerts) so the caller
 * does not need React refs to prevent stale closures.
 */
export class GeofenceEngine {
  /** @type {number} metres — radius for arrival/departure detection */
  #arrivalRadius;

  /** @type {number} ms — timeout before departure alert (reserved for future use) */
  #departureTimeoutMs;

  /** @type {Set<string>} event IDs that have been marked as arrived */
  #arrivedSet;

  /** @type {Set<string>} event IDs that have already triggered departure alert */
  #departedAlerts;

  /**
   * @param {{ arrivalRadius: number, departureTimeoutMs: number }} options
   */
  constructor({ arrivalRadius, departureTimeoutMs }) {
    this.#arrivalRadius = arrivalRadius;
    this.#departureTimeoutMs = departureTimeoutMs;
    this.#arrivedSet = new Set();
    this.#departedAlerts = new Set();
  }

  /**
   * Check all events against the child's current position.
   *
   * Time window: event is eligible when now is between -90 min and +60 min
   * of the event's scheduled time (boundaries inclusive).
   *
   * @param {{ lat: number, lng: number }} childPos
   * @param {Array<{ id: string, time: string, location?: { lat: number, lng: number } }>} events
   * @param {Date} now
   * @returns {{ arrivals: Array, departures: Array }}
   */
  check(childPos, events, now = new Date()) {
    const arrivals = [];
    const departures = [];

    for (const event of events) {
      // Skip events without a location
      if (!event.location || event.location.lat == null || event.location.lng == null) {
        continue;
      }

      const distance = haversineM(
        childPos.lat,
        childPos.lng,
        event.location.lat,
        event.location.lng,
      );
      const isInside = distance <= this.#arrivalRadius;

      // Parse event time → today's Date
      const [hours, minutes] = event.time.split(":").map(Number);
      const eventTime = new Date(now);
      eventTime.setHours(hours, minutes, 0, 0);

      // diff in minutes: negative = early, positive = late
      const diffMs = now.getTime() - eventTime.getTime();
      const diff = Math.round(diffMs / 60_000);

      // Time window: -90 to +60 inclusive
      const inWindow = diff >= -90 && diff <= 60;

      if (this.#arrivedSet.has(event.id)) {
        // Already arrived → check for departure
        if (!isInside && !this.#departedAlerts.has(event.id)) {
          departures.push({ event });
        }
      } else if (isInside && inWindow) {
        // New arrival detected
        const isEarly = diff <= -10;
        const isLate = diff > 0;
        const isOnTime = !isEarly && !isLate; // -10 < diff <= 0 → actually -9..0

        arrivals.push({
          event,
          isEarly,
          isOnTime,
          isLate,
          diff,
          msg: this.#buildMessage(event, diff, isEarly, isOnTime, isLate),
        });
      }
    }

    return { arrivals, departures };
  }

  /**
   * Mark an event as arrived (prevents re-detection).
   * @param {string} eventId
   */
  markArrived(eventId) {
    this.#arrivedSet = new Set([...this.#arrivedSet, eventId]);
  }

  /**
   * Mark an event as departure-alerted (prevents re-alerting).
   * @param {string} eventId
   */
  markDepartureAlerted(eventId) {
    this.#departedAlerts = new Set([...this.#departedAlerts, eventId]);
  }

  /**
   * Get a copy of the current arrived set.
   * @returns {Set<string>}
   */
  getArrivedSet() {
    return new Set(this.#arrivedSet);
  }

  /**
   * Reset all internal state for a new day.
   */
  reset() {
    this.#arrivedSet = new Set();
    this.#departedAlerts = new Set();
  }

  /**
   * Build a human-readable arrival message.
   * @param {object} event
   * @param {number} diff - minutes difference (negative = early)
   * @param {boolean} isEarly
   * @param {boolean} isOnTime
   * @param {boolean} isLate
   * @returns {string}
   */
  #buildMessage(event, diff, isEarly, isOnTime, isLate) {
    const name = event.emoji ? `${event.emoji} ${event.title}` : event.title;

    if (isEarly) {
      return `${name}에 ${Math.abs(diff)}분 일찍 도착했어요!`;
    }
    if (isLate) {
      return `${name}에 ${diff}분 늦게 도착했어요`;
    }
    return `${name}에 정시 도착! 잘했어요!`;
  }
}
