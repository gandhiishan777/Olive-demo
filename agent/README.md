# Agent

ElevenLabs Conversational AI configuration for Olive.

## Files

| File | What |
|---|---|
| [`system_prompt.md`](system_prompt.md) | Full system prompt. Pre-rendered for Paradise Biryani. Paste into ElevenLabs **System Prompt** field. |
| [`tools.json`](tools.json) | 10 server tools. Add each in the ElevenLabs **Tools** panel, replacing `${BASE_URL}` with your ngrok URL. |
| [`SETUP.md`](SETUP.md) | Step-by-step wiring guide. |
| `transcripts/` | Drop call transcripts here as you iterate. |

## Tools (10)

`get_menu`, `get_item_details`, `search_menu`, `create_order`, `add_item`, `update_item`, `remove_item`, `get_order`, `submit_order`, `cancel_order`.

All hit `${BASE_URL}/...` with no auth headers — the backend trusts the tunnel.

## Iterating on the prompt

Edit `system_prompt.md` in a branch, run a few test calls, A/B vs `main`, commit when better. Save the call transcripts ElevenLabs gives you into `transcripts/` for reference.

## Retargeting to another restaurant

Search-and-replace in `system_prompt.md`:
- `Paradise Biryani` → new name
- `5 Bay Area locations (...)` → new location string
- The greeting line
- Update example dialogues / hard rules if cuisine differs (e.g. drop spice-level rules for a pizza shop)

Do **not** use `${VAR}` shell syntax — ElevenLabs ships placeholders literally.
