import os


class ModelRouter:
    """Route LLM calls to appropriate models based on agent type."""

    @classmethod
    def get_default_model(cls) -> str:
        env_model = os.getenv('OPENROUTER_MODEL')
        if env_model and env_model.strip():
            return env_model.strip()
        return 'meta-llama/llama-3.3-70b-instruct:free'

    @classmethod
    def get_model(cls, agent_type: str) -> str:
        return cls.get_default_model()

    @classmethod
    def get_temperature(cls, agent_type: str) -> float:
        return cls.TEMPERATURES.get(agent_type, 0.5)
