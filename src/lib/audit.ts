import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/permissions'

/**
 * Append-only audit trail. `logAudit` is fire-and-forget: a failed write is
 * logged but never breaks the mutation it describes — an audit trail that can
 * take the product down would be worse than a gap in the trail.
 *
 * Action naming: "<resource>.<verb>", e.g. "pin.approve", "pin.delete",
 * "form.create", "analysis.run", "settings.update", "export.download".
 */
export interface AuditEntry {
  projectId?: string | null
  action: string
  targetType?: string
  targetId?: string
  detail?: Record<string, unknown>
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const user = await getCurrentUser()
    await prisma.auditLog.create({
      data: {
        projectId: entry.projectId ?? null,
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        detail: (entry.detail ?? undefined) as object | undefined,
      },
    })
  } catch (error) {
    console.error(`audit: failed to record ${entry.action}`, error)
  }
}
