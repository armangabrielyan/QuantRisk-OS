import numpy as np

def marginal_var(weights: list[float], cov_matrix: list[list[float]], confidence: float = 0.99) -> list[float]:
    w = np.array(weights)
    cov = np.array(cov_matrix)
    sigma_p = np.sqrt(np.dot(w.T, np.dot(cov, w)))
    marginal_var = np.dot(cov, w) / sigma_p
    z_alpha = 2.3263478740408408 # stats.norm.ppf(0.99)
    return (marginal_var * z_alpha).tolist()

def component_var(weights: list[float], cov_matrix: list[list[float]], portfolio_value: float, confidence: float = 0.99) -> list[float]:
    m_var = marginal_var(weights, cov_matrix, confidence)
    c_var = np.array(weights) * np.array(m_var) * portfolio_value
    return c_var.tolist()

w = [0.5, 0.5]
cov = [[0.04, 0.01], [0.01, 0.09]]
print("Marginal:", marginal_var(w, cov))
print("Component:", component_var(w, cov, 1000))
