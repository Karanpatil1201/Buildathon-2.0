import pytest
import os
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app
from app.database import engine, Base, SessionLocal
from app.seed import seed_database

@pytest.fixture(scope="session")
def client():
    # Make sure schema and seed data are ready
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
    
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="session")
def admin_token(client):
    res = client.post("/api/v1/auth/login", data={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    return res.json()["access_token"]

@pytest.fixture(scope="session")
def qm_token(client):
    res = client.post("/api/v1/auth/login", data={"username": "qm_elena", "password": "qm123"})
    assert res.status_code == 200
    return res.json()["access_token"]

@pytest.fixture(scope="session")
def inspector_token(client):
    res = client.post("/api/v1/auth/login", data={"username": "inspector_marcus", "password": "insp123"})
    assert res.status_code == 200
    return res.json()["access_token"]

@pytest.fixture(scope="session")
def operator_token(client):
    res = client.post("/api/v1/auth/login", data={"username": "op_alex", "password": "op123"})
    assert res.status_code == 200
    return res.json()["access_token"]

