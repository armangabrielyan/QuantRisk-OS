from app.quant.esg import calculate_waci, calculate_carbon_exposure

def test_waci():
    positions = [
        {"weight": 0.5, "revenue": 100, "carbon_emissions": 50},
        {"weight": 0.5, "revenue": 200, "carbon_emissions": 50}
    ]
    assert calculate_waci(positions) == (0.5 * 0.5) + (0.5 * 0.25)
