"""Model routing — maps agent types to appropriate LLM models."""


class ModelRouter:
    """Route LLM calls to appropriate models based on agent type."""

    # Using google/gemini-2.0-flash-001 — fast, reliable, excellent reasoning
    # This model is well-supported on OpenRouter and cost-effective
    DEFAULT_MODEL = 'google/gemini-2.5-flash'

    MODELS = {
        'observation':   DEFAULT_MODEL,
        'understanding': DEFAULT_MODEL,
        'prediction':    DEFAULT_MODEL,
        'risk':          DEFAULT_MODEL,
        'impact':        DEFAULT_MODEL,
        'simulation':    DEFAULT_MODEL,
        'decision':      DEFAULT_MODEL,
        'coordination':  DEFAULT_MODEL,
        'communication': DEFAULT_MODEL,
        'knowledge':     DEFAULT_MODEL,
        'safety':        DEFAULT_MODEL,
        'maintenance':   DEFAULT_MODEL,
        'operations':    DEFAULT_MODEL,
        'passenger':     DEFAULT_MODEL,
        'emergency':     DEFAULT_MODEL,
    }

    TEMPERATURES = {
        'observation':   0.2,
        'understanding': 0.3,
        'prediction':    0.5,
        'risk':          0.3,
        'impact':        0.4,
        'decision':      0.6,
        'coordination':  0.4,
        'safety':        0.2,
        'emergency':     0.2,
        'maintenance':   0.3,
        'passenger':     0.5,
    }

    @classmethod
    def get_model(cls, agent_type: str) -> str:
        return cls.MODELS.get(agent_type, cls.DEFAULT_MODEL)

    @classmethod
    def get_temperature(cls, agent_type: str) -> float:
        return cls.TEMPERATURES.get(agent_type, 0.5)
