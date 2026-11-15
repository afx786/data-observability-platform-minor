from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from the environment (and an optional .env file)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Data Observability Platform"
    api_prefix: str = "/api"

    # Platform database
    database_url: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/data_observability"
    )

    # Allowed browser origin for the React static site
    frontend_origin: str = "http://localhost:5173"

    # SMTP alerting
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True


settings = Settings()
