import sys
from unittest.mock import MagicMock

# Mock fastapi, yfinance, sqlalchemy, pydantic, etc.
sys.modules['fastapi'] = MagicMock()
sys.modules['yfinance'] = MagicMock()
sys.modules['sqlalchemy'] = MagicMock()
sys.modules['sqlalchemy.orm'] = MagicMock()
sys.modules['sqlalchemy.ext.declarative'] = MagicMock()
sys.modules['pydantic'] = MagicMock()
sys.modules['pandas'] = MagicMock()
sys.modules['numpy'] = MagicMock()

import os
sys.path.append(os.path.abspath('backend'))

try:
    from app.services.data_architecture import MarketDataHubService, DataQualityCenterService, PortfolioDataHubService
    from app.schemas.data import DataQualityReport
    print("Imports successful.")
except Exception as e:
    import traceback
    traceback.print_exc()

