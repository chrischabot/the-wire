/**
 * WebSocket Durable Object for real-time updates
 * Manages WebSocket connections for a single user across multiple devices/tabs
 */

interface WebSocketConnection {
  webSocket: WebSocket;
  connectionId: string;
  connectedAt: number;
  lastPing: number;
}

export class WebSocketDO implements DurableObject {
  private connections: Map<string, WebSocketConnection> = new Map();
  private heartbeatInterval: number | null = null;

  constructor() {
    // Start heartbeat checker
    this.startHeartbeat();
  }

  /**
   * Start heartbeat interval to check for stale connections
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleTimeout = 60000; // 60 seconds
      
      for (const [id, conn] of this.connections) {
        if (now - conn.lastPing > staleTimeout) {
          try {
            conn.webSocket.close(1000, 'Connection timeout');
          } catch {
            // Already closed
          }
          this.connections.delete(id);
        }
      }
    }, 30000) as unknown as number; // Check every 30 seconds
  }

  /**
   * Broadcast message to all connections
   */
  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    
    for (const [id, conn] of this.connections) {
      try {
        conn.webSocket.send(messageStr);
      } catch (error) {
        console.error(`Error sending to connection ${id}:`, error);
        this.connections.delete(id);
      }
    }
  }

  /**
   * Handle incoming HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade request
    if (path === '/connect') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = [webSocketPair[0]!, webSocketPair[1]!];

      const connectionId = crypto.randomUUID();
      const connection: WebSocketConnection = {
        webSocket: server,
        connectionId,
        connectedAt: Date.now(),
        lastPing: Date.now(),
      };

      this.connections.set(connectionId, connection);

      // Accept the WebSocket connection
      server.accept();

      // Handle messages
      server.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data as string);
          
          // Handle ping/pong for keep-alive
          if (data.type === 'ping') {
            connection.lastPing = Date.now();
            server.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      });

      // Handle close
      server.addEventListener('close', () => {
        this.connections.delete(connectionId);
      });

      // Handle errors
      server.addEventListener('error', (event) => {
        console.error('WebSocket error:', event);
        this.connections.delete(connectionId);
      });

      // Send connection confirmation
      server.send(JSON.stringify({
        type: 'connected',
        connectionId,
        timestamp: Date.now(),
      }));

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Broadcast new post to this user's connections
    if (path === '/broadcast-post' && request.method === 'POST') {
      const body = await request.json() as { post: any };
      this.broadcast({
        type: 'new_post',
        post: body.post,
        timestamp: Date.now(),
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Broadcast notification to this user's connections
    if (path === '/broadcast-notification' && request.method === 'POST') {
      const body = await request.json() as { notification: any };
      this.broadcast({
        type: 'notification',
        notification: body.notification,
        timestamp: Date.now(),
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get connection count
    if (path === '/connections' && request.method === 'GET') {
      return new Response(JSON.stringify({
        count: this.connections.size,
        connections: Array.from(this.connections.values()).map(c => ({
          id: c.connectionId,
          connectedAt: c.connectedAt,
          lastPing: c.lastPing,
        })),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Cleanup on DO deletion
   */
  async alarm(): Promise<void> {
    // Close all connections
    for (const [_id, conn] of this.connections) {
      try {
        conn.webSocket.close(1000, 'Server shutdown');
      } catch {
        // Already closed
      }
    }
    this.connections.clear();
  }
}