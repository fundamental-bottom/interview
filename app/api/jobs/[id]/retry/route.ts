import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActiveJobError, retryJob } from '@/lib/jobs/runner';
import { jsonError } from '@/lib/api';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const retried = await retryJob(id);
    if (!retried) {
      const job = await prisma.transcriptJob.findUnique({ where: { id }, select: { status: true } });
      if (!job) return jsonError(404, 'Job not found');
      return jsonError(409, `Only FAILED jobs can be retried (job is ${job.status})`);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ActiveJobError) return jsonError(409, err.message);
    throw err;
  }
}
