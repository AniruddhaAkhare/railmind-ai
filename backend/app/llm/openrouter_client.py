import requests
import json
import re
from app.config.settings import get_config


class OpenRouterClient:
    """Synchronous OpenRouter API client for LLM inference."""

    def __init__(self):
        config = get_config()
        self.api_key = config.OPENROUTER_API_KEY
        self.base_url = config.OPENROUTER_BASE_URL
        self.default_model = config.OPENROUTER_DEFAULT_MODEL

    def query(self, prompt: str, model: str = None,
              temperature: float = 0.7, max_tokens: int = 1000) -> dict:
        """Send a chat completion request to OpenRouter (synchronous)."""
        if not self.api_key:
            return {"error": "OPENROUTER_API_KEY not configured", "response": None}

        model = model or self.default_model

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://railmind.ai",
            "X-Title": "RailMind AI",
        }

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            return {"response": content, "error": None}
        except requests.exceptions.Timeout:
            return {"error": "LLM request timed out", "response": None}
        except requests.exceptions.HTTPError as e:
            return {"error": f"HTTP error: {e}", "response": None}
        except (KeyError, IndexError) as e:
            return {"error": f"Unexpected response format: {e}", "response": None}
        except Exception as e:
            return {"error": str(e), "response": None}

    def query_stream(self, prompt: str, model: str = None,
                     temperature: float = 0.7, max_tokens: int = 1000):
        """Send a chat completion request to OpenRouter and yield chunks as they arrive."""
        if not self.api_key:
            yield {"error": "OPENROUTER_API_KEY not configured"}
            return

        model = model or self.default_model

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://railmind.ai",
            "X-Title": "RailMind AI",
        }

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        try:
            with requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30,
                stream=True,
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        if line_str.startswith('data: '):
                            data_str = line_str[6:]
                            if data_str == '[DONE]':
                                break
                            try:
                                data = json.loads(data_str)
                                choices = data.get('choices', [])
                                if choices:
                                    delta = choices[0].get('delta', {})
                                    content = delta.get('content')
                                    if content:
                                        yield {"chunk": content}
                            except json.JSONDecodeError:
                                pass
        except requests.exceptions.Timeout:
            yield {"error": "LLM request timed out"}
        except requests.exceptions.HTTPError as e:
            yield {"error": f"HTTP error: {e}"}
        except Exception as e:
            yield {"error": str(e)}

    def parse_json_response(self, response_text: str) -> dict:
        """Extract JSON object from an LLM response string."""
        try:
            # Try direct parse first
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        # Try to find JSON block in markdown code fences
        fence_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if fence_match:
            try:
                return json.loads(fence_match.group(1))
            except json.JSONDecodeError:
                pass

        # Fallback: find first {...} block
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        return {"raw_response": response_text}
