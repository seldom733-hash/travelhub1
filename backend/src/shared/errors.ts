/** Базовый доменный ошибка: перехватывается глобальным фильтром. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export class ValidationDomainError extends DomainError {
  constructor(message: string) {
    super(message, 422);
    this.name = "ValidationDomainError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class TooManyRequestsError extends DomainError {
  constructor(message: string) {
    super(message, 429);
    this.name = "TooManyRequestsError";
  }
}
