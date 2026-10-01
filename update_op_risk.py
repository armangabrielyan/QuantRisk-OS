import re

with open("frontend/src/pages/OperationalRisk.tsx", "r") as f:
    content = f.read()

content = content.replace(
    "import { opRiskApi } from '@/services/api'",
    "import { opRiskApi, opRiskExtendedApi } from '@/services/api'\nimport { useEffect } from 'react'"
)

# Insert state
state_insertion = """
  const [incidents, setIncidents] = useState<any[]>([])
  
  useEffect(() => {
    if (activeTab === 'cyber') {
      opRiskExtendedApi.getIncidents().then(res => setIncidents(res.data)).catch(e => setError(e.message))
    }
  }, [activeTab])
"""
content = content.replace("const [error, setError] = useState<string | null>(null)", "const [error, setError] = useState<string | null>(null)\n" + state_insertion)

# Replace cyber block
cyber_replacement = """      {activeTab === 'cyber' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3 space-y-4">
             <div className="grid grid-cols-3 gap-4">
                <MetricCard label="Active Cyber Incidents" value={incidents.length.toString()} status="warn" />
                <MetricCard label="Open Vulnerabilities" value="15" status="fail" />
                <MetricCard label="Service Availability" value="99.98%" status="pass" />
             </div>
             <Panel title="Operational Loss Events (Business Continuity)">
                <div className="text-sm text-slate-300">
                  {incidents.length > 0 ? (
                    incidents.map((inc, i) => (
                      <div key={i}>{inc.incident_type}: {inc.severity}</div>
                    ))
                  ) : "Recent IT disruption caused $50,000 operational loss."}
                </div>
             </Panel>
          </div>
        </div>
      )}"""

# We can use regex to replace the block
content = re.sub(
    r"\{activeTab === 'cyber'.*?^\s*\)\}",
    cyber_replacement,
    content,
    flags=re.DOTALL | re.MULTILINE
)

with open("frontend/src/pages/OperationalRisk.tsx", "w") as f:
    f.write(content)
print("Updated OperationalRisk.tsx")
