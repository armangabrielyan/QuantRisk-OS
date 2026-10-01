def calculate_waci(positions: list[dict]) -> float:
    """
    Weighted Average Carbon Intensity (WACI).
    positions: list of dicts with 'weight' (float), 'carbon_emissions' (float), 'revenue' (float)
    """
    waci = 0.0
    for pos in positions:
        if pos.get('revenue', 0) > 0:
            intensity = pos.get('carbon_emissions', 0) / pos['revenue']
            waci += pos.get('weight', 0) * intensity
    return waci

def calculate_carbon_exposure(positions: list[dict]) -> float:
    return sum(pos.get('carbon_emissions', 0) * pos.get('weight', 0) for pos in positions)
