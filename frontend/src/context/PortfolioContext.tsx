import React, { createContext, useContext, useState, ReactNode } from 'react';

// Phase 1: Prepare architecture for a single active portfolio (Portfolio Data Hub foundation).
// This context will provide unified access to the currently active portfolio across all risk modules.

export interface Portfolio {
  id: string;
  name: string;
  value: number;
  currency: string;
  lastUpdated: string;
}

interface PortfolioContextType {
  activePortfolio: Portfolio | null;
  setActivePortfolio: (portfolio: Portfolio | null) => void;
  isLoading: boolean;
  refreshPortfolio: () => Promise<void>;
}

const defaultPortfolio: Portfolio = {
  id: 'port-10m-ref',
  name: 'Reference Portfolio 10M',
  value: 10_000_000,
  currency: 'USD',
  lastUpdated: new Date().toISOString(),
};

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [activePortfolio, setActivePortfolio] = useState<Portfolio | null>(defaultPortfolio);
  const [isLoading, setIsLoading] = useState(false);

  const refreshPortfolio = async () => {
    setIsLoading(true);
    try {
      // Future: fetch from Portfolio Data Hub API
      await new Promise(resolve => setTimeout(resolve, 500));
      setActivePortfolio(defaultPortfolio);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PortfolioContext.Provider value={{ activePortfolio, setActivePortfolio, isLoading, refreshPortfolio }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
