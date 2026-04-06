export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Autenticação necessária") {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Acesso negado") {
  return new ApiError(403, "FORBIDDEN", message);
}

export function notFound(message = "Recurso não encontrado") {
  return new ApiError(404, "NOT_FOUND", message);
}

export function conflict(message: string, details?: unknown) {
  return new ApiError(409, "CONFLICT", message, details);
}

export function validationError(message: string, details?: unknown) {
  return new ApiError(422, "VALIDATION_ERROR", message, details);
}

export function internalError(message = "Erro interno do servidor", details?: unknown) {
  return new ApiError(500, "INTERNAL_ERROR", message, details);
}
