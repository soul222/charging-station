import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
from ..services.charging_engine import ChargingEngine

router = APIRouter(tags=["WebSockets"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_connections = []
        payload = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

manager = ConnectionManager()

# Hook charging engine broadcaster into WebSocket manager
ChargingEngine.register_listener(manager.broadcast)

@router.websocket("/ws/station/{station_code}")
async def websocket_station_endpoint(websocket: WebSocket, station_code: str):
    await manager.connect(websocket)
    try:
        # Welcome event
        await websocket.send_text(json.dumps({
            "event": "CONNECTED",
            "station_code": station_code,
            "message": f"Terhubung ke live stream SPKLU '{station_code}'"
        }))
        while True:
            # Keep connection alive and listen for any ping / client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
