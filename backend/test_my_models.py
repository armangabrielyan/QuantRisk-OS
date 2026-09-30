import os
import sys

# Add the app to PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.database.session import init_db
from app.models.orm_models import RiskLimit, RiskAlert, RiskAppetite
from sqlalchemy.orm import Session
from app.database.session import SessionLocal

def test_models():
    init_db()
    db: Session = SessionLocal()
    try:
        # Create a limit
        limit = RiskLimit(entity_id="port_1", limit_type="VaR", warning_limit=100.0, hard_limit=200.0)
        db.add(limit)
        db.commit()
        
        # Query it
        l = db.query(RiskLimit).filter(RiskLimit.entity_id == "port_1").first()
        print("Created RiskLimit:", l.entity_id, l.limit_type)
        
        # Create an alert
        alert = RiskAlert(alert_level="WARNING", message="Test alert")
        db.add(alert)
        db.commit()
        
        a = db.query(RiskAlert).first()
        print("Created RiskAlert:", a.alert_level, a.message)
        
        # Create an appetite
        appetite = RiskAppetite(statement="We accept moderate risk")
        db.add(appetite)
        db.commit()
        
        ap = db.query(RiskAppetite).first()
        print("Created RiskAppetite:", ap.statement)
        
    finally:
        db.close()

if __name__ == "__main__":
    test_models()
