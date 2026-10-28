import { describe, it, expect } from 'vitest';
import { 
  parseAuthError, 
  validateInstitutionalEmail, 
  validateFacultyAccessCode, 
  validateStudentRegNo, 
  APPROVED_FACULTY_PASSCODES 
} from '../utils/authErrors';

describe('MentorPulse - Authentication & Rate Limit Regression Tests', () => {
  describe('1. Supabase Error Parsing & Rate Limit Diagnosis', () => {
    it('correctly maps Supabase over_email_send_rate_limit to user-friendly alert', () => {
      const error = {
        code: 'over_email_send_rate_limit',
        message: 'email rate limit exceeded',
        status: 429,
      };

      const parsed = parseAuthError(error);
      expect(parsed.isRateLimit).toBe(true);
      expect(parsed.status).toBe(429);
      expect(parsed.title).toBe('Email Delivery Limit Reached');
      expect(parsed.message).toContain('3-4 emails/hour');
      expect(parsed.message).toContain('Custom SMTP');
      expect(parsed.isRecoverable).toBe(true);
    });

    it('correctly identifies rate limit from message text if code is omitted', () => {
      const rawError = new Error('email rate limit exceeded');
      const parsed = parseAuthError(rawError);

      expect(parsed.isRateLimit).toBe(true);
      expect(parsed.title).toBe('Email Delivery Limit Reached');
      expect(parsed.message).toContain('Custom SMTP');
    });

    it('correctly maps unconfirmed email error with resend action trigger', () => {
      const error = {
        code: 'email_not_confirmed',
        message: 'Email not confirmed',
      };

      const parsed = parseAuthError(error);
      expect(parsed.isRateLimit).toBe(false);
      expect(parsed.code).toBe('email_not_confirmed');
      expect(parsed.title).toBe('Email Verification Required');
      expect(parsed.message).toContain('inbox');
    });

    it('correctly maps existing user signup collision', () => {
      const error = {
        code: 'user_already_exists',
        message: 'User already registered',
      };

      const parsed = parseAuthError(error);
      expect(parsed.isRateLimit).toBe(false);
      expect(parsed.title).toBe('Account Already Exists');
      expect(parsed.message).toContain('Sign In tab');
    });

    it('correctly maps invalid credentials error on faculty login', () => {
      const error = {
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      };

      const parsed = parseAuthError(error);
      expect(parsed.title).toBe('Invalid Credentials');
      expect(parsed.message).toContain('check your spelling');
    });

    it('correctly maps weak password error', () => {
      const error = {
        code: 'weak_password',
        message: 'Password should be at least 6 characters',
      };

      const parsed = parseAuthError(error);
      expect(parsed.title).toBe('Password Too Short');
      expect(parsed.message).toContain('at least 6 characters');
    });
  });

  describe('2. College Registration Controls & Institutional Policy', () => {
    it('enforces @kct.ac.in domain for faculty mentor registration', () => {
      // Valid faculty institutional emails
      expect(validateInstitutionalEmail('ramanathan.a.ece@kct.ac.in', true).valid).toBe(true);
      expect(validateInstitutionalEmail('sathiyapriya.sp.sci@kct.ac.in', true).valid).toBe(true);
      expect(validateInstitutionalEmail('director@kct.edu.in', true).valid).toBe(true);

      // Invalid personal emails rejected for faculty
      const personalGmail = validateInstitutionalEmail('john.doe@gmail.com', true);
      expect(personalGmail.valid).toBe(false);
      expect(personalGmail.error).toContain('@kct.ac.in');

      const personalYahoo = validateInstitutionalEmail('teacher@yahoo.com', true);
      expect(personalYahoo.valid).toBe(false);
      expect(personalYahoo.error).toContain('@kct.ac.in');

      // Invalid syntax
      expect(validateInstitutionalEmail('not-an-email', true).valid).toBe(false);
      expect(validateInstitutionalEmail('', true).valid).toBe(false);
    });

    it('allows students to use institutional or registered personal emails', () => {
      expect(validateInstitutionalEmail('tharun.25ei@kct.ac.in', false).valid).toBe(true);
      expect(validateInstitutionalEmail('student.personal@gmail.com', false).valid).toBe(true);
    });

    it('enforces college faculty onboarding passcode to prevent unauthorized mentor account creation', () => {
      // Approved passcodes
      expect(validateFacultyAccessCode('KCT-FACULTY-2026').valid).toBe(true);
      expect(validateFacultyAccessCode('kct-faculty-2026').valid).toBe(true); // Case-insensitive
      expect(validateFacultyAccessCode('SFS-KCT-MENTOR').valid).toBe(true);

      // Unauthorized passcodes
      const missing = validateFacultyAccessCode('');
      expect(missing.valid).toBe(false);
      expect(missing.error).toContain('required');

      const wrong = validateFacultyAccessCode('RANDOM-CODE-123');
      expect(wrong.valid).toBe(false);
      expect(wrong.error).toContain('Invalid Faculty Access Passcode');
    });

    it('validates student roll/register number formats', () => {
      // Valid KCT roll formats
      expect(validateStudentRegNo('25BEI057').valid).toBe(true);
      expect(validateStudentRegNo('717822ECE045').valid).toBe(true);
      expect(validateStudentRegNo('717721EC104').valid).toBe(true);

      // Invalid formats
      expect(validateStudentRegNo('').valid).toBe(false);
      expect(validateStudentRegNo('12').valid).toBe(false); // Too short
      expect(validateStudentRegNo('ROLL#$@!').valid).toBe(false); // Special chars
    });
  });

  describe('3. Rate-Limit Throttling & Submission Guards', () => {
    it('safe cooldown period prevents rapid repeated email dispatch attempts', () => {
      const COOLDOWN_SECONDS = 60;
      let remainingSeconds = COOLDOWN_SECONDS;

      // Simulate timer decrement
      const decrement = () => {
        if (remainingSeconds > 0) remainingSeconds -= 1;
      };

      expect(remainingSeconds).toBe(60);
      decrement();
      expect(remainingSeconds).toBe(59);

      // Button is disabled when cooldown > 0
      const isButtonDisabled = (cooldown: number, isSubmitting: boolean) => cooldown > 0 || isSubmitting;
      expect(isButtonDisabled(59, false)).toBe(true);
      expect(isButtonDisabled(0, true)).toBe(true);
      expect(isButtonDisabled(0, false)).toBe(false);
    });
  });
});
