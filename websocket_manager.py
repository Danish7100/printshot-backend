import asyncio
import json
import websockets
from typing import Dict, Set
from datetime import datetime

class WebSocketManager:
    def __init__(self):
        self.clients: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.server = None

    async def register_client(self, websocket: websockets.WebSocketServerProtocol, user_id: str):
        """Register a new WebSocket client"""
        self.clients[user_id] = websocket
        print(f"User {user_id} registered for real-time updates")
        
        # Send confirmation
        await websocket.send(json.dumps({
            "type": "registered",
            "message": "Connected to real-time updates"
        }))

    async def unregister_client(self, user_id: str):
        """Unregister a WebSocket client"""
        if user_id in self.clients:
            del self.clients[user_id]
            print(f"User {user_id} disconnected")

    async def broadcast_queue_update(self, pi_id: str, printer_id: str, queue_data: list):
        """Broadcast queue update to all connected clients"""
        message = json.dumps({
            "type": "queueUpdate",
            "piId": pi_id,
            "printerId": printer_id,
            "queue": queue_data,
            "timestamp": datetime.now().isoformat()
        })

        sent_count = 0
        disconnected_clients = []
        
        for user_id, websocket in self.clients.items():
            try:
                await websocket.send(message)
                sent_count += 1
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.append(user_id)
            except Exception as e:
                print(f"Error sending to {user_id}: {e}")
                disconnected_clients.append(user_id)
        
        # Clean up disconnected clients
        for user_id in disconnected_clients:
            await self.unregister_client(user_id)
        
        print(f"Queue update sent to {sent_count} clients")

    async def notify_user(self, user_id: str, message: dict) -> bool:
        """Send message to specific user"""
        if user_id in self.clients:
            try:
                await self.clients[user_id].send(json.dumps({
                    **message,
                    "timestamp": datetime.now().isoformat()
                }))
                return True
            except websockets.exceptions.ConnectionClosed:
                await self.unregister_client(user_id)
            except Exception as e:
                print(f"Error notifying user {user_id}: {e}")
        return False

    def get_connected_count(self) -> int:
        """Get number of connected clients"""
        return len(self.clients)

    async def handle_client(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle WebSocket client connection"""
        user_id = None
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    
                    if data.get("type") == "register":
                        user_id = data.get("userId")
                        if user_id:
                            await self.register_client(websocket, user_id)
                        
                except json.JSONDecodeError:
                    print("Invalid JSON received from client")
                except Exception as e:
                    print(f"WebSocket message error: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"WebSocket error: {e}")
        finally:
            if user_id:
                await self.unregister_client(user_id)

    async def start_server(self, host: str = "localhost", port: int = 8765):
        """Start WebSocket server"""
        self.server = await websockets.serve(self.handle_client, host, port)
        print(f"WebSocket server started on ws://{host}:{port}")
        return self.server

# Global WebSocket manager instance
ws_manager = WebSocketManager()