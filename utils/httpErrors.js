/**
 * Safe HTTP error helpers — never leak SQL, stack traces, or infrastructure
 * details to API clients. Always log the real error server-side.
 */

const GENERIC_SERVER_ERROR = 'Server error. Please try again.';

/**
 * @param {import('express').Response} res
 * @param {unknown} error
 * @param {string} [clientMessage]
 * @param {number} [status]
 */
export function sendServerError(
  res,
  error,
  clientMessage = GENERIC_SERVER_ERROR,
  status = 500
) {
  if (error) {
    console.error('[API]', clientMessage, error);
  } else {
    console.error('[API]', clientMessage);
  }

  return res.status(status).json({
    success: false,
    message: clientMessage,
  });
}

export { GENERIC_SERVER_ERROR };
