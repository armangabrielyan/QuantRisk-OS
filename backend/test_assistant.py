import asyncio
from app.api.assistant import ask_assistant, AssistantRequest

queries = [
    "Calculate 99% VaR.",
    "Show me my biggest risk.",
    "Open liquidity analysis.",
    "Which positions contribute most to VaR?",
    "Stress the portfolio by +200 bp rates.",
    "Show counterparties close to their limits.",
    "Compare today's VaR with last week.",
    "Prepare a Risk Committee Report.",
    "Where can I calculate Monte Carlo VaR?",
    "Run Full Risk Check"
]

async def main():
    for q in queries:
        req = AssistantRequest(query=q)
        resp = await ask_assistant(req)
        print(f"Q: {q}")
        print(f"A: {resp.message}")
        print(f"Actions: {[a.label for a in resp.actions]}")
        print("-" * 20)

asyncio.run(main())
