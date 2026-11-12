// A fresh one-shot request is made synchronously from each Start/Retry action.
// Do not gate access on Permissions API state: Safari change events can be stale.
export function createLocationSession({ geolocation, onPosition, onError }) {
  let generation = 0, active = false, watch = null;
  function stop() {
    generation++; active = false;
    if (watch !== null) geolocation.clearWatch(watch);
    watch = null;
  }
  function start() {
    stop(); active = true; const own = generation;
    const current = () => active && own === generation;
    const fail = error => {
      if (!current()) return;
      const normalized = error?.name === 'SecurityError' ? { code: 1 } : error;
      stop(); onError(normalized);
    };
    const receive = position => { if (current()) onPosition(position); };
    const follow = () => {
      if (!current()) return;
      try {
        const id = geolocation.watchPosition(receive, fail, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
        if (current()) watch = id; else geolocation.clearWatch(id);
      } catch (error) { fail(error); }
    };
    try {
      geolocation.getCurrentPosition(position => {
        if (!current()) return;
        receive(position);
        follow();
      }, fail, { enableHighAccuracy: false, maximumAge: 0, timeout: 20000 });
    } catch (error) { fail(error); }
  }
  return { start, stop, get active() { return active; } };
}
