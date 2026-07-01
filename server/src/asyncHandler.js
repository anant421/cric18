// Express 4 does not catch rejected promises from async route handlers -
// an unhandled rejection would otherwise crash the whole process. Wrapping
// every handler with this ensures errors are forwarded to the error
// middleware and turned into a proper JSON response instead of an outage.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
