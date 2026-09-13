import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from sqlalchemy import event

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "charging_station.db")
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def migrate_db():
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if 'connectors' in tables:
            columns = [col['name'] for col in inspector.get_columns('connectors')]
            if 'locked_by_user_id' not in columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE connectors ADD COLUMN locked_by_user_id INTEGER REFERENCES users(id)"))
        if 'vehicles' in tables:
            v_columns = [col['name'] for col in inspector.get_columns('vehicles')]
            if 'efficiency_km_kwh' not in v_columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE vehicles ADD COLUMN efficiency_km_kwh FLOAT DEFAULT 6.8"))
            if 'architecture_voltage' not in v_columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE vehicles ADD COLUMN architecture_voltage FLOAT DEFAULT 400.0"))
    except Exception:
        pass

migrate_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
