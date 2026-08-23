from collections.abc import AsyncGenerator

from typing import TypeVar
from pydantic import BaseModel 
from app.integrations.openai import client
from .base import LLMProvider
import openai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
T = TypeVar("T", bound=BaseModel)


def return_fallback_message(retry_state):
    """Called if OpenAI completely fails after all 3 retries"""
    return "I apologize, but our AI support system is currently experiencing high traffic. Please email support@company.com for immediate assistance."
    
class OpenAIProvider(LLMProvider):
    MODEL = "gpt-4.1-mini"
    # Wait 2s, then 4s, up to 3 attempts. Only retry for connection/server/rate-limit issues.
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((openai.RateLimitError, openai.APIConnectionError, openai.InternalServerError)),
        reraise=return_fallback_message
    )
    async def complete(self, *, messages: list[dict], temperature: float = 0) -> tuple[str, int, int]:
        response = await client.chat.completions.create(
            model = self.MODEL,
            messages=messages,
            temperature=temperature
        )
        content = response.choices[0].message.content or ""
        prompt_tokens = response.usage.prompt_tokens if response.usage else 0
        completion_tokens = response.usage.completion_tokens if response.usage else 0
        return content, prompt_tokens, completion_tokens

    async def stream(self, *, messages: list[dict], temperature: float = 0) -> AsyncGenerator[str | dict, None]:
        try:
            stream_response = await client.chat.completions.create(
                model = self.MODEL,
                messages=messages,
                temperature=temperature,
                stream=True,
                stream_options={"include_usage": True}
            )
            async for chunk in stream_response:
                if len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        yield delta
                
                # Check for usage on the final chunk
                if chunk.usage is not None:
                    yield {
                        "prompt_tokens": chunk.usage.prompt_tokens,
                        "completion_tokens": chunk.usage.completion_tokens
                    }
                    
        except (openai.RateLimitError, openai.APIConnectionError, openai.InternalServerError, openai.OpenAIError):
            # Graceful Degradation: Yield a polite fallback string instead of crashing!
            error_message = "I apologize, but our AI support system is currently experiencing high traffic. Please email support@company.com for immediate assistance."
            words = error_message.split(" ")
            for i, word in enumerate(words):
                yield word + (" " if i < len(words) - 1 else "")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((openai.RateLimitError, openai.APIConnectionError, openai.InternalServerError)),
        reraise=return_fallback_message
    )
    async def complete_structured(self, *, messages: list[dict], response_model: type[T]) -> T:
        response = await client.beta.chat.completions.parse(
            model=self.MODEL,
            messages=messages,
            response_format=response_model,
        )
        return response.choices[0].message.parsed