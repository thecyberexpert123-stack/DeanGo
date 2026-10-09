import { NextRequest, NextResponse } from 'next/server';
import { deangoFetch } from '@/lib/deango';

export const dynamic = 'force-dynamic';

async function handle(req: NextRequest, ctx: { params: Promise<{ parts: string[] }> }) {
  const { parts } = await ctx.params;
  const url = new URL(req.url);
  const path = '/' + parts.join('/') + url.search;
  const body = req.method === 'POST' || req.method === 'PUT' ? await req.json().catch(() => ({})) : undefined;
  const data = await deangoFetch(path, { method: req.method, body });
  return NextResponse.json(data);
}

export { handle as GET, handle as POST };
