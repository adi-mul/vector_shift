import json
import secrets
from fastapi import Request, HTTPException
from fastapi.responses import HTMLResponse
import httpx
import asyncio
import base64
import requests
from integrations.integration_item import IntegrationItem

from redis_client import add_key_value_redis, get_value_redis, delete_key_redis

CLIENT_ID = "YOUR_HUBSPOT_CLIENT_ID"
CLIENT_SECRET = "YOUR_HUBSPOT_CLIENT_SECRET"

REDIRECT_URI = "http://localhost:8000/integrations/hubspot/oauth2callback"

SCOPES = "crm.objects.contacts.read crm.objects.companies.read"


async def authorize_hubspot(user_id, org_id):
    state_data = {
        "state": secrets.token_urlsafe(32),
        "user_id": user_id,
        "org_id": org_id,
    }
    encoded_state = base64.urlsafe_b64encode(
        json.dumps(state_data).encode("utf-8")
    ).decode("utf-8")
    await add_key_value_redis(
        f"hubspot_state:{org_id}:{user_id}", json.dumps(state_data), expire=600
    )

    auth_url = (
        f"https://app.hubspot.com/oauth/authorize"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&scope={SCOPES}"
        f"&state={encoded_state}"
    )
    return auth_url


async def oauth2callback_hubspot(request: Request):
    if request.query_params.get("error"):
        raise HTTPException(
            status_code=400, detail=request.query_params.get("error_description")
        )

    code = request.query_params.get("code")
    encoded_state = request.query_params.get("state")

    try:
        state_data = json.loads(base64.urlsafe_b64decode(encoded_state).decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid state format.")

    user_id = state_data.get("user_id")
    org_id = state_data.get("org_id")

    saved_state_raw = await get_value_redis(f"hubspot_state:{org_id}:{user_id}")
    if not saved_state_raw:
        raise HTTPException(status_code=400, detail="State expired or not found.")

    saved_state = json.loads(saved_state_raw)
    if state_data.get("state") != saved_state.get("state"):
        raise HTTPException(status_code=400, detail="State does not match.")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.hubapi.com/oauth/v1/token",
            data={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "code": code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        await delete_key_redis(f"hubspot_state:{org_id}:{user_id}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code, detail="Failed to fetch access token."
        )

    await add_key_value_redis(
        f"hubspot_credentials:{org_id}:{user_id}",
        json.dumps(response.json()),
        expire=600,
    )

    close_window_script = "<html><script>window.close();</script></html>"
    return HTMLResponse(content=close_window_script)


async def get_hubspot_credentials(user_id, org_id):
    credentials = await get_value_redis(f"hubspot_credentials:{org_id}:{user_id}")
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials found.")

    await delete_key_redis(f"hubspot_credentials:{org_id}:{user_id}")
    return json.loads(credentials)


def create_integration_item_metadata_object(item_json, item_type) -> IntegrationItem:

    name = (
        item_json.get("properties", {}).get("name")
        or item_json.get("properties", {}).get("firstname", "")
        + " "
        + item_json.get("properties", {}).get("lastname", "")
    ).strip()

    return IntegrationItem(
        id=item_json.get("id"),
        name=name or f"{item_type} {item_json.get('id')}",
        type=item_type,
        creation_time=item_json.get("createdAt"),
        last_modified_time=item_json.get("updatedAt"),
    )


async def get_items_hubspot(credentials) -> list[IntegrationItem]:
    if isinstance(credentials, str):
        credentials = json.loads(credentials)

    access_token = credentials.get("access_token")
    headers = {"Authorization": f"Bearer {access_token}"}
    list_of_integration_item_metadata = []

    endpoints = [
        ("https://api.hubapi.com/crm/v3/objects/contacts", "Contact"),
        ("https://api.hubapi.com/crm/v3/objects/companies", "Company"),
    ]

    async with httpx.AsyncClient() as client:
        for url, item_type in endpoints:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                results = response.json().get("results", [])
                for item in results:
                    list_of_integration_item_metadata.append(
                        create_integration_item_metadata_object(item, item_type)
                    )

    return list_of_integration_item_metadata
