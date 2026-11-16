"""Runs one agent as an independent ClaudeSDKClient and returns its final result."""

from typing import Protocol

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, ResultMessage

from atlas.agents.infrastructure.agent_run import AgentRun, AgentRunError


class AgentRunner(Protocol):
    async def __call__(self, options: ClaudeAgentOptions, prompt: str) -> AgentRun: ...


async def run_agent(options: ClaudeAgentOptions, prompt: str) -> AgentRun:
    async with ClaudeSDKClient(options=options) as client:
        await client.query(prompt)
        async for message in client.receive_response():
            if isinstance(message, ResultMessage):
                if message.is_error:
                    detail = "; ".join(message.errors or []) or message.subtype
                    raise AgentRunError(f"{message.subtype}: {detail}")
                return AgentRun(message.result, message.structured_output, message.total_cost_usd)
    raise AgentRunError("el agente terminó sin ResultMessage")
