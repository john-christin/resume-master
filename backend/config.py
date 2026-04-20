from pathlib import Path

from pydantic_settings import BaseSettings

# Look for .env in the current dir first, then parent (project root)
_env_file = Path(".env")
if not _env_file.exists():
    _env_file = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    database_url: str
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = "gpt-4o"
    azure_openai_api_version: str = "2024-10-21"
    upload_dir: str = "./uploads"
    cors_origins: str = "http://localhost:5173"
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440
    default_admin_username: str = ""
    default_input_price_per_1k: float = 0.005
    default_output_price_per_1k: float = 0.015

    model_config = {"env_file": str(_env_file), "env_file_encoding": "utf-8"}


settings = Settings()
