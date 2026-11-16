
from fastapi import FastAPI, HTTPException
from app.database import check_database

app = FastAPI(
    title="Smart City Digital Twin",
    description="Smart City Waterlogging Monitoring and Digital Twin System",
    version="1.0.0"
)


@app.get("/")
def home():
    return {
        "message": "Smart City Digital Twin API is running!",
        "status": "success"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "application": "Smart City Digital Twin"
    }


@app.get("/database-test")
def database_test():
    try:
        check_database()
        return {
            "status": "connected",
            "database": "PostgreSQL",
            "extension": "PostGIS"
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(error)}"
        )
