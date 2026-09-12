from sqlalchemy.orm import Session
from fastapi import HTTPException
from .. import models

class StationManager:
    @staticmethod
    def get_station_with_connectors(db: Session, station_code: str):
        station = db.query(models.Station).filter(models.Station.code == station_code).first()
        if not station:
            raise HTTPException(status_code=404, detail=f"Stasiun '{station_code}' tidak ditemukan.")
        return station

    @staticmethod
    def plug_connector(db: Session, connector_id: int):
        connector = db.query(models.Connector).filter(models.Connector.id == connector_id).first()
        if not connector:
            raise HTTPException(status_code=404, detail="Konektor tidak ditemukan.")
        if connector.status == "CHARGING":
            raise HTTPException(status_code=400, detail="Konektor sedang dalam proses pengisian!")
        
        connector.status = "CONNECTED"
        db.commit()
        db.refresh(connector)
        return connector

    @staticmethod
    def unplug_connector(db: Session, connector_id: int):
        connector = db.query(models.Connector).filter(models.Connector.id == connector_id).first()
        if not connector:
            raise HTTPException(status_code=404, detail="Konektor tidak ditemukan.")
        if connector.status == "CHARGING":
            raise HTTPException(status_code=400, detail="Harap hentikan pengisian terlebih dahulu sebelum mencabut kabel!")
        
        connector.status = "AVAILABLE"
        connector.current_session_id = None
        connector.locked_by_user_id = None
        db.commit()
        db.refresh(connector)
        return connector
