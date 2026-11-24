"""Convert supported source formats into a consistent Pandas representation."""

from io import BytesIO

import pandas as pd


def clean_columns(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    frame.columns = [str(column).strip() for column in frame.columns]
    return frame


def from_csv(content: bytes) -> pd.DataFrame:
    try:
        return clean_columns(pd.read_csv(BytesIO(content)))
    except UnicodeDecodeError:
        return clean_columns(pd.read_csv(BytesIO(content), encoding="latin-1"))


def from_excel(content: bytes) -> dict[str, pd.DataFrame]:
    """One workbook becomes several tables, one per sheet."""
    workbook = pd.read_excel(BytesIO(content), sheet_name=None)
    return {str(name): clean_columns(frame) for name, frame in workbook.items()}


def from_records(records: list[dict]) -> pd.DataFrame:
    return clean_columns(pd.DataFrame(records))
