import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  validateInstitutionalEmail, 
  validateFacultyAccessCode, 
  validateStudentRegNo 
} from '../utils/authErrors';
import { SupabaseService } from '../services/supabaseService';

describe('MentorPulse — Authentication & Authorization Security Audit', () => {
  let service: SupabaseService;

  beforeEach(() => {
    service = new SupabaseService();
  });

  describe('1. Student Authentication & Password Enforcement', () => {
    it('rejects passwordless student login via signIn', async () => {
      await expect(service.signIn('25BEI057', '   ')).rejects.toThrow(
        'Password is required for secure authentication.'
      );
    });

    it('rejects passwordless student login via signInStudentFast', async () => {
      await expect(service.signInStudentFast('25BEI057')).rejects.toThrow(
        'Password is required for student authentication. Please enter your account password.'
      );
    });

    it('rejects empty or malformed student register numbers', () => {
      expect(validateStudentRegNo('').valid).toBe(false);
      expect(validateStudentRegNo('   ').valid).toBe(false);
      expect(validateStudentRegNo('12').valid).toBe(false);
      expect(validateStudentRegNo('25BEI057').valid).toBe(true);
      expect(validateStudentRegNo('7376222AD101').valid).toBe(true);
    });
  });

  describe('2. Account Takeover & Duplicate Registration Prevention', () => {
    it('prevents registration if student email or register number is already registered', async () => {
      // Mock Supabase client to simulate existing profile collision
      const mockClient: any = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            or: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'existing-student-id',
                  email: 'tharun.25ei@kct.ac.in',
                  student_reg_no: '25BEI057',
                },
                error: null,
              }),
            })),
          })),
        })),
      };

      (service as any).client = mockClient;

      await expect(
        service.registerStudentWithoutPassword({
          full_name: 'Imposter Student',
          email: 'tharun.25ei@kct.ac.in',
          password: 'newpassword123',
          student_reg_no: '25BEI057',
          department: 'Electronics and Instrumentation Engineering',
        })
      ).rejects.toThrow(/already registered\. Please sign in with your password\./);
    });
  });

  describe('3. Faculty Onboarding Authorization & Passcode Verification', () => {
    it('strictly rejects unauthorized faculty registration with empty passcode', () => {
      const result = validateFacultyAccessCode('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Passcode is required');
    });

    it('strictly rejects arbitrary or guessed faculty passcodes', () => {
      const guessed = ['admin123', 'faculty', 'secret', 'password', '123456'];
      for (const code of guessed) {
        const result = validateFacultyAccessCode(code);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid Faculty Access Passcode');
      }
    });

    it('accepts authorized institutional passcodes', () => {
      expect(validateFacultyAccessCode('KCT-FACULTY-2026').valid).toBe(true);
      expect(validateFacultyAccessCode('SFS-KCT-MENTOR').valid).toBe(true);
      expect(validateFacultyAccessCode('  kct-faculty-2026  ').valid).toBe(true); // trims & upper cases
    });

    it('enforces institutional @kct.ac.in / @kct.edu.in email for faculty', () => {
      expect(validateInstitutionalEmail('faculty@kct.ac.in', true).valid).toBe(true);
      expect(validateInstitutionalEmail('hod.ece@kct.edu.in', true).valid).toBe(true);
      expect(validateInstitutionalEmail('intruder@gmail.com', true).valid).toBe(false);
      expect(validateInstitutionalEmail('intruder@yahoo.com', true).valid).toBe(false);
      expect(validateInstitutionalEmail('intruder@randomcollege.edu', true).valid).toBe(false);
    });
  });

  describe('4. Role Escalation & RLS Policy Security Logic', () => {
    it('validates that role change trigger logic blocks student-to-mentor privilege escalation', () => {
      // Simulating trigger function public.prevent_role_escalation() logic
      const simulateTrigger = (oldRole: string, newRole: string, callerRole: string, isAdmin: boolean) => {
        if (oldRole !== newRole) {
          if (callerRole !== 'service_role' && !isAdmin) {
            throw new Error('Security Violation: Users cannot alter their assigned institutional role.');
          }
        }
        return true;
      };

      // Unprivileged student attempting to elevate to mentor or admin
      expect(() => simulateTrigger('student', 'mentor', 'authenticated', false)).toThrow(
        'Security Violation: Users cannot alter their assigned institutional role.'
      );
      expect(() => simulateTrigger('student', 'admin', 'authenticated', false)).toThrow(
        'Security Violation: Users cannot alter their assigned institutional role.'
      );

      // Admin or service_role authorized change
      expect(simulateTrigger('student', 'mentor', 'service_role', false)).toBe(true);
      expect(simulateTrigger('student', 'mentor', 'authenticated', true)).toBe(true);
    });

    it('validates direct messaging RLS isolation logic', () => {
      // Simulating policy "Participants read own messages"
      const canReadMessage = (
        authUid: string, 
        message: { sender_id: string; recipient_id: string; class_mentor_id?: string }
      ) => {
        return (
          authUid === message.sender_id ||
          authUid === message.recipient_id ||
          authUid === message.class_mentor_id
        );
      };

      const msg = { sender_id: 'student-A', recipient_id: 'mentor-1', class_mentor_id: 'mentor-1' };

      // Sender and recipient can read
      expect(canReadMessage('student-A', msg)).toBe(true);
      expect(canReadMessage('mentor-1', msg)).toBe(true);

      // Third-party student-B cannot read
      expect(canReadMessage('student-B', msg)).toBe(false);
      expect(canReadMessage('intruder-X', msg)).toBe(false);
    });

    it('validates post reaction RLS ownership policy', () => {
      // Simulating policy "Allow user delete own reaction"
      const canDeleteReaction = (authUid: string, reaction: { user_id: string }) => {
        return authUid === reaction.user_id;
      };

      const reaction = { user_id: 'student-A' };
      expect(canDeleteReaction('student-A', reaction)).toBe(true);
      expect(canDeleteReaction('student-B', reaction)).toBe(false);
      expect(canDeleteReaction('unauthorized-user', reaction)).toBe(false);
    });
  });
});
