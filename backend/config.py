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
    cors_origins: str = "https://aurexviper.pro"
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440
    default_admin_username: str = ""
    default_input_price_per_1k: float = 0.005
    default_output_price_per_1k: float = 0.015
    # Google service account used to write to profiles' job sheets (path to key file, or the JSON itself)
    google_service_account_file: str = ""
    google_service_account_json: str = ""
    # Timezone for the Date written on appended sheet rows
    sheet_timezone: str = "America/New_York"
    # How many queue tasks may be generated at once (one resume API key each).
    queue_max_workers: int = 4
    # Rate-limited AI calls (429 / overloaded) wait and retry this many times, sleeping
    # for the API's Retry-After (or 5s, 10s, 20s...) and never longer than the max.
    llm_rate_limit_retries: int = 5
    llm_rate_limit_max_wait: int = 60
    # Public address of the web app; used for links written into job sheets
    public_base_url: str = "https://aurexviper.pro"

    model_config = {"env_file": str(_env_file), "env_file_encoding": "utf-8"}


settings = Settings()
