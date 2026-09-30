import React, { useState, useEffect } from 'react';

interface Limit {
    id: number;
    entity_id: string;
    limit_type: string;
    warning_limit: number;
    hard_limit: number;
    current_value: number;
    utilization_pct: number;
    status: string;
}

interface Alert {
    id: number;
    alert_level: string;
    message: string;
    source: string;
    status: string;
}

export default function RiskLimits() {
    const [limits, setLimits] = useState<Limit[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    
    useEffect(() => {
        fetch('http://localhost:8000/api/risk-limits/limits')
            .then(res => res.json())
            .then(data => setLimits(data))
            .catch(console.error);
            
        fetch('http://localhost:8000/api/risk-limits/alerts')
            .then(res => res.json())
            .then(data => setAlerts(data))
            .catch(console.error);
    }, []);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white mb-6">Risk Limits & Alerts</h1>
            
            <div className="bg-[#1a1d24] p-6 rounded-xl border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4">Risk Limits</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                        <thead className="bg-[#242830] text-gray-300">
                            <tr>
                                <th className="p-3">Entity</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">Warning</th>
                                <th className="p-3">Hard Limit</th>
                                <th className="p-3">Current</th>
                                <th className="p-3">Utilization</th>
                                <th className="p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {limits.map(limit => (
                                <tr key={limit.id} className="border-b border-gray-800">
                                    <td className="p-3">{limit.entity_id}</td>
                                    <td className="p-3">{limit.limit_type}</td>
                                    <td className="p-3">{limit.warning_limit}</td>
                                    <td className="p-3">{limit.hard_limit}</td>
                                    <td className="p-3">{limit.current_value}</td>
                                    <td className="p-3">{limit.utilization_pct.toFixed(2)}%</td>
                                    <td className={`p-3 font-bold ${
                                        limit.status === 'RED' ? 'text-red-500' :
                                        limit.status === 'YELLOW' ? 'text-yellow-500' : 'text-green-500'
                                    }`}>{limit.status}</td>
                                </tr>
                            ))}
                            {limits.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-3 text-center">No limits configured</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="bg-[#1a1d24] p-6 rounded-xl border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4">Alert Center</h2>
                <div className="space-y-4">
                    {alerts.map(alert => (
                        <div key={alert.id} className={`p-4 rounded-lg border ${
                            alert.alert_level === 'CRITICAL' ? 'border-red-500 bg-red-900/20' :
                            alert.alert_level === 'WARNING' ? 'border-yellow-500 bg-yellow-900/20' :
                            alert.alert_level === 'HIGH' ? 'border-orange-500 bg-orange-900/20' :
                            'border-blue-500 bg-blue-900/20'
                        }`}>
                            <div className="flex justify-between">
                                <span className="font-bold text-white">{alert.alert_level}</span>
                                <span className="text-sm text-gray-400">{alert.status}</span>
                            </div>
                            <p className="text-gray-300 mt-2">{alert.message}</p>
                            <div className="text-xs text-gray-500 mt-2">Source: {alert.source}</div>
                        </div>
                    ))}
                    {alerts.length === 0 && (
                        <div className="text-center text-gray-500">No active alerts</div>
                    )}
                </div>
            </div>
        </div>
    );
}
