type AuthFailure = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
};

function readFailure(error: unknown): AuthFailure {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
    name: typeof record.name === 'string' ? record.name : undefined,
    status: typeof record.status === 'number' ? record.status : undefined,
  };
}

const revokedCodes = new Set([
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
  'user_banned',
  'user_not_found',
]);

export function isRecoverableAuthFailure(error: unknown) {
  const failure = readFailure(error);
  const message = failure.message?.toLowerCase() ?? '';

  if (failure.name === 'AuthRetryableFetchError') {
    return true;
  }

  if (failure.status === 0 || failure.status === 502 || failure.status === 503 || failure.status === 504) {
    return true;
  }

  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('network request failed')
  );
}

export function isRevokedAuthFailure(error: unknown) {
  if (isRecoverableAuthFailure(error)) {
    return false;
  }

  const failure = readFailure(error);
  const message = failure.message?.toLowerCase() ?? '';

  if (failure.code && revokedCodes.has(failure.code)) {
    return true;
  }

  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('session expired') ||
    message.includes('user is banned')
  );
}
