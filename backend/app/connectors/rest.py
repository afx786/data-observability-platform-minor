"""Pull-based REST connector.

The API shape is intentionally generic: the operator supplies the URL, optional
Authorization header and a dot path to the records array. No raw rows are stored.
"""

import json
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd

from app.processing.normalize import from_records


def _extract_records(payload: Any, json_path: str) -> list[dict]:
    node = payload
    if json_path:
        for part in json_path.split("."):
            if not isinstance(node, dict):
                raise ValueError(f"JSON path '{json_path}' does not point to an object")
            node = node.get(part)
            if node is None:
                return []

    if isinstance(node, list):
        records = node
    elif isinstance(node, dict):
        # A single object, or the first array value in a wrapper object.
        records = next(
            (value for value in node.values() if isinstance(value, list)),
            [node],
        )
    else:
        records = [node] if node is not None else []

    if not all(isinstance(item, dict) for item in records):
        raise ValueError("REST response must contain JSON objects")
    return records


def fetch_rest(config: dict) -> pd.DataFrame:
    url = str(config.get("url") or "").strip()
    if not url:
        raise ValueError("REST source requires a url")

    method = str(config.get("method") or "GET").upper()
    headers = dict(config.get("headers") or {})
    auth_header = config.get("auth_header")
    if auth_header:
        headers["Authorization"] = str(auth_header)

    records: list[dict] = []
    pages = int(config.get("max_pages") or 1) if config.get("paginated") else 1
    json_path = str(config.get("json_path") or "")

    for page in range(1, pages + 1):
        page_url = url
        if config.get("paginated"):
            separator = "&" if "?" in page_url else "?"
            page_url = f"{page_url}{separator}{urlencode({config.get('page_param', 'page'): page})}"

        request = Request(page_url, headers=headers, method=method)
        with urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))

        page_records = _extract_records(payload, json_path)
        if not page_records:
            break
        records.extend(page_records)

    return from_records(records)
