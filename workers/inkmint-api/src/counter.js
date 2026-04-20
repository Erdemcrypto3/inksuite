// [CRIT-05] UploadCounter — Durable Object for atomic upload-slot decrement.
//
// Replaces the KV read-modify-write counter (subject to eventually-consistent
// race condition: parallel uploads across regions can each read "2 remaining"
// and all succeed). A Durable Object instance is single-threaded, so the
// decrement is truly atomic.
//
// Enable: see wrangler.toml for the [[durable_objects.bindings]] + [[migrations]]
// blocks. Requires Workers Paid plan (~$5/mo at time of writing).
export class UploadCounter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/init') {
      const { count } = await request.json();
      await this.state.storage.put('count', count);
      return new Response('OK');
    }

    if (url.pathname === '/decrement') {
      const current = (await this.state.storage.get('count')) ?? 0;
      if (current <= 0) {
        return new Response(
          JSON.stringify({ ok: false, remaining: 0 }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
      }
      await this.state.storage.put('count', current - 1);
      return new Response(
        JSON.stringify({ ok: true, remaining: current - 1 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not found', { status: 404 });
  }
}
