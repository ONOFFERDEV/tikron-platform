export function pointerLockCapability(facts, input) {
  const request = input?.request ?? null;
  const error = request?.throwError ?? request?.rejected
    ?? (input?.events?.some((event) => event.kind === 'pointerlockerror') ? 'pointerlockerror' : null);
  return {
    supported: facts?.pointerLockSupported === true,
    acquired: input?.locked === true,
    attempted: request !== null,
    trusted: request?.event?.trusted === true,
    error: error ?? (request === null ? 'pointer_lock_request_not_observed' : null),
  };
}
