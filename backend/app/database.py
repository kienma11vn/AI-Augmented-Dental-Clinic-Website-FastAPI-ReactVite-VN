from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Engine ghi chính (Primary)
engine = create_engine(settings.database_url, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Engine đọc phụ (Read Replica cho AI Chatbot)
engine_replica = create_engine(settings.read_database_url, future=True)
SessionReplicaLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_replica)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

    
def get_read_db():
    """Session chuyên dụng kết nối tới Read Replica để truy vấn an toàn"""
    db = SessionReplicaLocal()
    try:
        yield db
    finally:
        db.close()