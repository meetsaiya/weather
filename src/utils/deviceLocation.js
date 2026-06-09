/**
 * Wrapped browser Geolocation API. Resolves with { latitude, longitude,
 * accuracyMeters }; rejects with a friendly error on denial, unavailability,
 * or timeout.
 */
export function getDeviceLocation({ timeoutMs = 10000, enableHighAccuracy = false } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        }),
      (err) => {
        const msg =
          err.code === 1
            ? 'Permission denied'
            : err.code === 2
              ? 'Position unavailable'
              : err.code === 3
                ? 'Timed out'
                : err.message || 'Geolocation failed';
        reject(new Error(msg));
      },
      { timeout: timeoutMs, enableHighAccuracy }
    );
  });
}
