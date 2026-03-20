# 500 Error Debugging (API)

The API now supports optional detailed 500 responses in `src/app.js`.

## Default behavior

- Production (default):
  - Response: `{ "error": "internal_error", "requestId": <id|null> }`
- Non-production:
  - Includes extra fields like `message`, optional `code`, and `stack`.

## Enable detailed 500s in production

Set:

```bash
SHOW_ERROR_DETAILS=true
```

Then restart the API process.

When enabled, 500 responses include:

- `error`
- `requestId`
- `message`
- optional `code` (if error object has one)
- optional `stack`

## Safe usage pattern

1. Enable detailed errors temporarily:

```bash
SHOW_ERROR_DETAILS=true
```

2. Reproduce the failing request.
3. Capture `requestId` and response details.
4. Correlate with server logs (`req.id` / request logs).
5. Fix issue.
6. Disable detailed errors:

```bash
SHOW_ERROR_DETAILS=false
```

(or unset the variable) and restart API.

## Example quick check

```bash
curl -i https://<host>/api/boards
```

If a 500 occurs, inspect payload and correlate by `requestId`.
