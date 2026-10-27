/**
 * URL Utilities for MentorPulse
 */

export function getInviteUrl(inviteCode: string): string {
  if (typeof window !== 'undefined') {
    // If testing locally, preserve local port
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.origin}/invite/${inviteCode}`;
    }
  }

  // In production or on any Vercel preview, always generate the clean public production domain
  // to avoid Vercel preview authentication walls
  return `https://sfs-kct-tharun.vercel.app/invite/${inviteCode}`;
}
