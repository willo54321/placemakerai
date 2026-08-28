import { randomBytes } from 'crypto'
import { prisma } from './db'

// Token lifetimes: invites give people a week to get set up; self-service
// resets are short-lived since the user is actively waiting for the email.
export const INVITE_TOKEN_TTL_HOURS = 24 * 7
export const RESET_TOKEN_TTL_HOURS = 2

/**
 * Generate a single-use set-password token for a user and store it (with
 * expiry) on the User record. Returns the raw token to embed in the emailed
 * link. Issuing a new token invalidates any previous one.
 */
export async function issuePasswordToken(userId: string, ttlHours: number): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetToken: token,
      passwordResetExpires: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    },
  })
  return token
}

export function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3002').replace(/\/$/, '')
}
