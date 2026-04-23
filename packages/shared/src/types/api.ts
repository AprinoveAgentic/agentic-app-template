// ── Shared API types ───────────────────────────────────────────────────────────
// Imported by both apps/api (Fastify response shapes) and apps/web (fetch types)

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// [Build Agent: add shared request/response types below this line]
