export class UploadCounter {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/init') {
      const { count } = (await request.json()) as { count: number };
      await this.state.storage.put('count', count);
      return new Response('OK');
    }

    if (url.pathname === '/decrement') {
      const current = (await this.state.storage.get<number>('count')) ?? 0;
      if (current <= 0) {
        return Response.json(
          { ok: false, remaining: 0 },
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
      }
      await this.state.storage.put('count', current - 1);
      return Response.json(
        { ok: true, remaining: current - 1 },
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not found', { status: 404 });
  }
}
