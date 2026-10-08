/**
 * An error that carries an HTTP status. Services throw it, the error-handling middleware
 * turns it into a JSON response. (Equivalent of Spring's ResponseStatusException.)
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
