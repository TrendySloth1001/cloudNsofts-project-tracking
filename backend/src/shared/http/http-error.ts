/** An error carrying an HTTP status code, handled by the central error middleware. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, message, details);
  }
  static unauthorized(message = 'Unauthorized'): HttpError {
    return new HttpError(401, message);
  }
  static notFound(message = 'Not found'): HttpError {
    return new HttpError(404, message);
  }
  static conflict(message: string): HttpError {
    return new HttpError(409, message);
  }
}
