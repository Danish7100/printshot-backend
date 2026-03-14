const WebSocket = require('ws');

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> ws connection
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server });
    
    this.wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        try {
          const rawMessage = typeof message === 'string' ? message : message.toString();
          if (rawMessage.length > 4096) {
            ws.close();
            return;
          }

          const data = JSON.parse(rawMessage);
          
          if (data.type === 'register') {
            if (typeof data.userId !== 'string' || data.userId.length > 320 || data.userId.length === 0) {
              ws.close();
              return;
            }

            this.clients.set(data.userId, ws);
            
            // Send confirmation
            ws.send(JSON.stringify({
              type: 'registered',
              message: 'Connected to real-time updates'
            }));
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        // Remove client when disconnected
          for (const [userId, client] of this.clients.entries()) {
            if (client === ws) {
              this.clients.delete(userId);
              break;
            }
          }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  // Broadcast queue update to all connected clients
  broadcastQueueUpdate(piId, printerId, queueData) {
    const message = JSON.stringify({
      type: 'queueUpdate',
      piId,
      printerId,
      queue: queueData,
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;
    this.clients.forEach((ws, userId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    });
    return sentCount;
  }

  // Send message to specific user
  notifyUser(userId, message) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }));
      return true;
    }
    return false;
  }

  // Get connected clients count
  getConnectedCount() {
    return this.clients.size;
  }
}

// Export singleton instance
module.exports = new WebSocketManager();
