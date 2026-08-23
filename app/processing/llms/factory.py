from .base import LLMProvider
from .openai import OpenAIProvider

class LLMFactory:
    @staticmethod
    def get_provider() -> LLMProvider:
        return OpenAIProvider()