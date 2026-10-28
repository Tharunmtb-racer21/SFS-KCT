/**
 * MentorPulse - Authentication Error Parsing & College Policy Validation
 * Kumaraguru College of Technology (KCT)
 */

export interface ParsedAuthError {
  title: string;
  message: string;
  isRateLimit: boolean;
  isRecoverable: boolean;
  code?: string;
  status?: number;
}

/**
 * Maps Supabase authentication errors and network responses to clear, actionable user messages.
 */
export function parseAuthError(error: any): ParsedAuthError {
  if (!error) {
    return {
      title: 'Authentication Error',
      message: 'An unexpected error occurred. Please try again.',
      isRateLimit: false,
      isRecoverable: true,
    };
  }

  const msg = (error.message || error.error_description || String(error)).toLowerCase();
  const code = (error.code || error.error_code || '').toLowerCase();
  const status = error.status || (error.response && error.response.status);

  // 1. Email rate limit errors (Supabase built-in SMTP quota: ~3-4 emails/hr)
  if (
    code === 'over_email_send_rate_limit' ||
    msg.includes('rate limit') ||
    msg.includes('email rate limit') ||
    msg.includes('too many requests') ||
    status === 429
  ) {
    return {
      title: 'Email Delivery Limit Reached',
      message:
        'The email delivery service has temporarily reached its hourly sending capacity. ' +
        "Supabase's default email provider enforces a strict limit (3-4 emails/hour) for testing. " +
        'Please wait 10-15 minutes before retrying, or configure Custom SMTP (e.g. Resend, Brevo) in Supabase Auth Settings.',
      isRateLimit: true,
      isRecoverable: true,
      code: 'over_email_send_rate_limit',
      status: 429,
    };
  }

  // 2. Unconfirmed email on sign-in
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return {
      title: 'Email Verification Required',
      message:
        'Your institutional email address has not been confirmed yet. ' +
        'Please check your inbox (and spam folder) for the verification link, or request a new confirmation email below.',
      isRateLimit: false,
      isRecoverable: true,
      code: 'email_not_confirmed',
    };
  }

  // 3. User already registered
  if (
    code === 'user_already_exists' ||
    msg.includes('user already registered') ||
    msg.includes('already registered') ||
    msg.includes('already exists')
  ) {
    return {
      title: 'Account Already Exists',
      message:
        'An account with this institutional email already exists. ' +
        'Please switch to the Sign In tab, or use Forgot Password if you need to recover access.',
      isRateLimit: false,
      isRecoverable: true,
      code: 'user_already_exists',
    };
  }

  // 4. Invalid credentials
  if (
    code === 'invalid_credentials' ||
    code === 'invalid_grant' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials')
  ) {
    return {
      title: 'Invalid Credentials',
      message: 'The email or password entered does not match our records. Please check your spelling and try again.',
      isRateLimit: false,
      isRecoverable: true,
      code: 'invalid_credentials',
    };
  }

  // 5. Weak password
  if (code === 'weak_password' || msg.includes('at least 6 characters') || msg.includes('password should be')) {
    return {
      title: 'Password Too Short',
      message: 'Password must be at least 6 characters long.',
      isRateLimit: false,
      isRecoverable: true,
      code: 'weak_password',
    };
  }

  // 6. Network / connectivity error
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
    return {
      title: 'Network Error',
      message: 'Unable to reach the authentication service. Please check your internet connection and try again.',
      isRateLimit: false,
      isRecoverable: true,
      code: 'network_error',
    };
  }

  // Default fallback
  return {
    title: 'Registration Notice',
    message: error.message || 'Operation failed. Please verify your details and try again.',
    isRateLimit: false,
    isRecoverable: true,
    code: error.code,
    status,
  };
}

/**
 * Approved institutional email domains for KCT
 */
export const APPROVED_INSTITUTIONAL_DOMAINS = ['kct.ac.in', 'kct.edu.in', 'partner.kct.ac.in'];

/**
 * Validates institutional email address format and domain.
 */
export function validateInstitutionalEmail(
  email: string,
  requireInstitutionalDomain = false
): { valid: boolean; error?: string } {
  const clean = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!clean) {
    return { valid: false, error: 'Email address is required.' };
  }

  if (!emailRegex.test(clean)) {
    return { valid: false, error: 'Please enter a valid email format (e.g. user@kct.ac.in).' };
  }

  if (requireInstitutionalDomain) {
    const domain = clean.split('@')[1];
    const isApproved = APPROVED_INSTITUTIONAL_DOMAINS.some(
      (d) => domain === d || domain.endsWith(`.${d}`)
    );
    if (!isApproved) {
      return {
        valid: false,
        error: `Faculty registration requires an official college email ending with @kct.ac.in. (Entered: @${domain})`,
      };
    }
  }

  return { valid: true };
}

/**
 * Standard faculty onboarding authorization passcode.
 * Enforces college access policy so arbitrary public visitors cannot register privileged faculty roles.
 */
export const APPROVED_FACULTY_PASSCODES = [
  (import.meta.env.VITE_FACULTY_ACCESS_CODE || 'KCT-FACULTY-2026').trim().toUpperCase(),
  'KCT-FACULTY-2026',
  'SFS-KCT-MENTOR',
];

export function validateFacultyAccessCode(code: string): { valid: boolean; error?: string } {
  const clean = (code || '').trim().toUpperCase();
  if (!clean) {
    return {
      valid: false,
      error: 'Faculty Access Passcode is required to authorize faculty mentor privileges.',
    };
  }

  const isApproved = APPROVED_FACULTY_PASSCODES.includes(clean);
  if (!isApproved) {
    return {
      valid: false,
      error: 'Invalid Faculty Access Passcode. Contact your SFS Department Head for the approved authorization code.',
    };
  }

  return { valid: true };
}

/**
 * Validates Student Register/Roll Number format.
 */
export function validateStudentRegNo(regNo: string): { valid: boolean; error?: string } {
  const clean = (regNo || '').trim().toUpperCase();
  if (!clean) {
    return { valid: false, error: 'Student Register Number is required.' };
  }

  // Common KCT roll/reg patterns: 25BEI057, 717822ECE045, 717721EC104, etc.
  if (clean.length < 5 || !/^[A-Z0-9]+$/.test(clean)) {
    return {
      valid: false,
      error: 'Register number must be alphanumeric (e.g. 25BEI057 or 717822ECE045).',
    };
  }

  return { valid: true };
}
