// Next.js runs this once per server start — the hook that gives the in-process
// job worker a lifecycle independent of any request.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startJobSweeper } = await import('@/lib/jobs/sweeper');
    startJobSweeper();
  }
}
