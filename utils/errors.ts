export class TrelloError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'TrelloError';
  }
}

export class TrelloBadRequestError extends TrelloError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'TrelloBadRequestError';
  }
}

export class TrelloAuthError extends TrelloError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'TrelloAuthError';
  }
}

export class TrelloNotFoundError extends TrelloError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'TrelloNotFoundError';
  }
}

export class TrelloRateLimitError extends TrelloError {
  retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message, 429);
    this.name = 'TrelloRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class TrelloServerError extends TrelloError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'TrelloServerError';
  }
}
