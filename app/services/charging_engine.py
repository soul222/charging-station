import asyncio
import random
from datetime import datetime
from typing import Dict, Any, Callable, List
from ..database import SessionLocal
from .. import models
from .billing_service import BillingService

class ChargingEngine:
    _instance = None
    _active_sessions: Dict[int, bool] = {}
    _ws_listeners: List[Callable[[Dict[str, Any]], Any]] = []

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ChargingEngine, cls).__new__(cls)
        return cls._instance

    @classmethod
    def register_listener(cls, callback: Callable[[Dict[str, Any]], Any]):
        if callback not in cls._ws_listeners:
            cls._ws_listeners.append(callback)

    @classmethod
    def unregister_listener(cls, callback: Callable[[Dict[str, Any]], Any]):
        if callback in cls._ws_listeners:
            cls._ws_listeners.remove(callback)

    @classmethod
    async def broadcast(cls, message: Dict[str, Any]):
        for listener in list(cls._ws_listeners):
            try:
                await listener(message)
            except Exception:
                pass

    @classmethod
    def is_session_active(cls, session_id: int) -> bool:
        return cls._active_sessions.get(session_id, False)

    @classmethod
    def request_stop(cls, session_id: int):
        if session_id in cls._active_sessions:
            cls._active_sessions[session_id] = False

    @classmethod
    async def sync_battery_soc(cls, session_id: int, new_soc: float):
        """
        External sync from phone Web Battery API levelchange or laptop slider.
        """
        db = SessionLocal()
        try:
            session = db.query(models.ChargingSession).filter(models.ChargingSession.id == session_id).first()
            if not session or session.status != "CHARGING":
                return
            
            new_soc = min(100.0, max(session.start_soc, round(new_soc, 1)))
            session.current_soc = new_soc
            
            vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == session.vehicle_id).first()
            if vehicle:
                vehicle.current_soc = session.current_soc
                cap = vehicle.battery_capacity_kwh
            else:
                cap = 0.02

            # Recalculate energy delivered from SoC progression
            added_soc = max(0.0, session.current_soc - session.start_soc)
            energy_from_soc = round((added_soc / 100.0) * cap, 6)
            if energy_from_soc > session.energy_delivered_kwh:
                session.energy_delivered_kwh = energy_from_soc

            connector = db.query(models.Connector).filter(models.Connector.id == session.connector_id).first()
            tariff = connector.tariff_per_kwh if connector else 2466.0
            deposit = session.deposit_paid
            battery_mah = 5000.0 if cap <= 0.1 else round(cap * 250000.0, 0)
            energy_delivered_mah = round((session.energy_delivered_kwh / cap) * battery_mah, 0)

            if cap <= 0.1:
                current_cost = min(deposit, round((energy_delivered_mah / 500.0) * tariff, 0))
            else:
                current_cost = min(deposit, round(session.energy_delivered_kwh * tariff, 0))
            remaining_deposit = max(0.0, deposit - current_cost)

            db.commit()

            # Broadcast live update
            await cls.broadcast({
                "event": "TELEMETRY_UPDATE",
                "station_id": session.station_id,
                "connector_id": session.connector_id,
                "session_id": session.id,
                "session_code": session.session_code,
                "current_soc": session.current_soc,
                "target_soc": session.target_soc,
                "energy_delivered_kwh": session.energy_delivered_kwh,
                "energy_delivered_mah": energy_delivered_mah,
                "current_power_kw": session.current_power_kw,
                "voltage": 230.0,
                "current_amps": round((session.current_power_kw * 1000.0) / 230.0, 1),
                "temperature": 32.5,
                "current_cost": current_cost,
                "remaining_deposit": remaining_deposit,
                "target_kwh": session.target_kwh
            })

            if session.target_type == "FULL" and session.current_soc >= session.target_soc:
                cls.request_stop(session_id)
        finally:
            db.close()

    @classmethod
    async def run_simulation_loop(cls, session_id: int):
        cls._active_sessions[session_id] = True
        db = SessionLocal()

        try:
            session = db.query(models.ChargingSession).filter(models.ChargingSession.id == session_id).first()
            if not session:
                return

            connector = db.query(models.Connector).filter(models.Connector.id == session.connector_id).first()
            vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == session.vehicle_id).first()

            if not connector or not vehicle:
                return

            # Base parameters
            battery_cap = vehicle.battery_capacity_kwh
            tariff = connector.tariff_per_kwh
            deposit = session.deposit_paid
            is_smartphone = battery_cap <= 0.1

            if is_smartphone:
                base_kw = min(vehicle.max_dc_kw or 0.033, 0.065)
                # Real physical charging pace: ~33W = 0.000009 kWh/s
                kwh_rate_per_sec = base_kw / 3600.0
            else:
                base_kw = connector.max_power_kw
                kwh_rate_per_sec = (base_kw / 150.0) * 0.12 + 0.04

            # Broadcast session started
            await cls.broadcast({
                "event": "SESSION_STARTED",
                "station_id": session.station_id,
                "connector_id": session.connector_id,
                "session_id": session.id,
                "session_code": session.session_code,
                "payment_method": session.payment_method,
                "deposit_paid": deposit,
                "start_soc": session.start_soc,
                "target_soc": session.target_soc,
                "max_power_kw": base_kw
            })

            stop_reason = "USER_STOP"

            while cls._active_sessions.get(session_id, False):
                await asyncio.sleep(1.0)

                # Check if stop requested externally
                if not cls._active_sessions.get(session_id, False):
                    stop_reason = "USER_STOP"
                    break

                # Refresh DB object to catch any external sync
                db.refresh(session)
                current_soc = session.current_soc

                if is_smartphone:
                    actual_kw = base_kw + random.uniform(-0.001, 0.001)
                    # Progression for smartphone demo: ~5-6 mAh per second (0.000024 kWh/s)
                    kwh_step = 0.000024
                    session.energy_delivered_kwh = round(session.energy_delivered_kwh + kwh_step, 6)
                    session.current_power_kw = round(actual_kw, 3)
                    added_soc = (session.energy_delivered_kwh / battery_cap) * 100.0
                    session.current_soc = min(session.target_soc, round(session.start_soc + added_soc, 1))
                    vehicle.current_soc = session.current_soc
                else:
                    # Dynamic Power with realistic tapering above 80% SoC
                    if current_soc > 80.0:
                        taper_factor = max(0.2, (100.0 - current_soc) / 20.0)
                        actual_kw = base_kw * taper_factor
                        kwh_step = kwh_rate_per_sec * taper_factor
                    else:
                        actual_kw = base_kw + random.uniform(-1.0, 1.0)
                        kwh_step = kwh_rate_per_sec

                    actual_kw = max(3.0, round(actual_kw, 1))
                    session.energy_delivered_kwh = round(session.energy_delivered_kwh + kwh_step, 3)
                    session.current_power_kw = actual_kw
                    added_soc = (session.energy_delivered_kwh / battery_cap) * 100.0
                    session.current_soc = min(100.0, round(session.start_soc + added_soc, 1))
                    vehicle.current_soc = session.current_soc

                # Voltage & Amperage simulation
                voltage = 395.0 + random.uniform(-3.0, 3.0) if connector.type_category == "DC" else 228.0 + random.uniform(-2.0, 2.0)
                current_amps = round((actual_kw * 1000.0) / voltage, 1)

                battery_mah = 5000.0 if is_smartphone else round(battery_cap * 250000.0, 0)
                energy_delivered_mah = round((session.energy_delivered_kwh / battery_cap) * battery_mah, 0)

                if is_smartphone:
                    current_cost = min(deposit, round((energy_delivered_mah / 500.0) * tariff, 0))
                else:
                    current_cost = min(deposit, round(session.energy_delivered_kwh * tariff, 0))
                remaining_deposit = max(0.0, deposit - current_cost)

                # Update DB
                db.commit()

                # Broadcast live telemetry
                await cls.broadcast({
                    "event": "TELEMETRY_UPDATE",
                    "station_id": session.station_id,
                    "connector_id": session.connector_id,
                    "session_id": session.id,
                    "session_code": session.session_code,
                    "current_soc": session.current_soc,
                    "target_soc": session.target_soc,
                    "energy_delivered_kwh": session.energy_delivered_kwh,
                    "energy_delivered_mah": energy_delivered_mah,
                    "current_power_kw": session.current_power_kw,
                    "current_power_w": round(session.current_power_kw * 1000.0, 1),
                    "voltage": round(voltage, 1),
                    "current_amps": current_amps,
                    "temperature": round(32.0 + (session.energy_delivered_kwh * 0.8), 1),
                    "current_cost": current_cost,
                    "remaining_deposit": remaining_deposit,
                    "target_kwh": session.target_kwh
                })

                # Check Auto-Cutoff Conditions
                target_mah = round((session.target_kwh / battery_cap) * battery_mah, 0) if session.target_kwh else 0.0

                if session.target_type == "FULL" and session.current_soc >= session.target_soc and energy_delivered_mah > 0:
                    stop_reason = "FULL_TARGET_REACHED"
                    break
                elif session.target_type in ("MANUAL_KWH", "MANUAL_MAH") and energy_delivered_mah > 0 and (
                    (is_smartphone and energy_delivered_mah >= target_mah)
                    or (not is_smartphone and session.energy_delivered_kwh >= session.target_kwh)
                ):
                    stop_reason = "MANUAL_TARGET_REACHED"
                    break
                elif current_cost >= deposit and energy_delivered_mah > 0:
                    stop_reason = "DEPOSIT_LIMIT_REACHED"
                    break

            # Handle Stop and Settlement
            db.refresh(session)
            if session.status == "CHARGING":
                session.status = "COMPLETED"
                session.stop_reason = stop_reason
                connector.status = "AVAILABLE"
                connector.current_session_id = None
                connector.locked_by_user_id = None

                actual_cost, refund_amount = BillingService.settle_and_refund(db, session)
                db.commit()

                battery_mah = 5000.0 if is_smartphone else round(battery_cap * 250000.0, 0)
                total_energy_mah = round((session.energy_delivered_kwh / battery_cap) * battery_mah, 0)

                # Broadcast final receipt & refund
                await cls.broadcast({
                    "event": "SESSION_COMPLETED",
                    "station_id": session.station_id,
                    "connector_id": session.connector_id,
                    "session_id": session.id,
                    "session_code": session.session_code,
                    "stop_reason": stop_reason,
                    "final_soc": session.current_soc,
                    "total_energy_kwh": session.energy_delivered_kwh,
                    "total_energy_mah": total_energy_mah,
                    "deposit_paid": deposit,
                    "actual_cost": actual_cost,
                    "refund_amount": refund_amount,
                    "payment_method": session.payment_method
                })
        except Exception:
            try:
                db.refresh(session)
                if session.status == "CHARGING":
                    session.status = "COMPLETED"
                    session.stop_reason = "SYSTEM_ERROR"
                    connector.status = "AVAILABLE"
                    connector.current_session_id = None
                    connector.locked_by_user_id = None
                    BillingService.settle_and_refund(db, session)
                    db.commit()
            except Exception:
                pass

        finally:
            cls._active_sessions.pop(session_id, None)
            db.close()
