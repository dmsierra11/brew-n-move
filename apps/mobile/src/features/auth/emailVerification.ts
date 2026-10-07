import { supabase } from './supabase';

type RequestResult = {
  error?: string;
  ok?: boolean;
  reason?: string;
  sent?: boolean;
};

type FunctionErrorContext = {
  json?: () => Promise<unknown>;
};

export type EmailVerificationRequest = {
  error: string | null;
  sent: boolean;
};

async function readFunctionError(error: unknown) {
  const context =
    error && typeof error === 'object' && 'context' in error
      ? (error as { context?: FunctionErrorContext }).context
      : undefined;

  if (context && typeof context.json === 'function') {
    try {
      const body = (await context.json()) as RequestResult;
      if (body.error) {
        return body.error;
      }
    } catch {
      // Use the fallback below when the function body is not JSON.
    }
  }

  return 'The verification email could not be sent. Try again in a minute.';
}

export async function requestEmailVerification(): Promise<EmailVerificationRequest> {
  const { data, error } = await supabase.functions.invoke<RequestResult>('request-email-verification');
  if (error) {
    return { error: await readFunctionError(error), sent: false };
  }

  if (data?.reason === 'throttled') {
    return {
      error: 'Check your inbox. You can request another email in a minute.',
      sent: false,
    };
  }

  if (data?.reason === 'already_verified') {
    return { error: null, sent: false };
  }

  if (data?.sent) {
    return { error: null, sent: true };
  }

  return {
    error: data?.error ?? 'The verification email could not be sent.',
    sent: false,
  };
}
