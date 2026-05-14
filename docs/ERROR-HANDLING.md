# Error Handling with node-fetch

Because `window.fetch` isn't designed to be transparent about the cause of request errors, node-fetch provides its own error hierarchy for better error handling.

## Error Types

node-fetch defines the following error types:

### FetchBaseError

The base error class for all node-fetch errors. All errors extend this class.

**Properties:**
- `name` - The error class name
- `message` - Human-readable error description
- `type` - Machine-readable error type string

### AbortError

Thrown when a request is aborted via `AbortController` or `AbortSignal`.

```javascript
import fetch from 'node-fetch';

const controller = new AbortController();
const signal = controller.signal;

fetch(url, { signal }).catch(error => {
  if (error.name === 'AbortError') {
    console.log('Request was aborted');
  }
});
```

**Properties:**
- `type` - `'aborted'`

### FetchError

Thrown for operational errors during the fetch operation.

**Properties:**
- `type` - Error type string (see below)
- `code` - System error code (when `type` is `'system'`)
- `errno` - System error number (when `type` is `'system'`)
- `erroredSysCall` - The system call that failed (when `type` is `'system'`)

## Error Types

The following `type` values are used:

| Type | Description |
|------|-------------|
| `'aborted'` | Request was aborted |
| `'system'` | Node.js system error (network, DNS, etc.) |
| `'invalid-json'` | Response body is not valid JSON |
| `'body-timeout'` | Response body timed out |
| `'request-timeout'` | Request timed out |
| `'fetch-error'` | General fetch error |

## Error Handling Examples

### Basic Error Handling

```javascript
import fetch from 'node-fetch';

try {
  const response = await fetch(url);
  const data = await response.json();
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request was aborted');
  } else if (error.name === 'FetchError') {
    console.log('Fetch error:', error.message);
    console.log('Error type:', error.type);
  } else {
    console.log('Unexpected error:', error);
  }
}
```

### System Error Handling

```javascript
import fetch from 'node-fetch';

try {
  const response = await fetch(url);
} catch (error) {
  if (error.type === 'system') {
    console.log('System error:', error.code);
    console.log('System call:', error.erroredSysCall);
  }
}
```

### Timeout Handling

```javascript
import fetch from 'node-fetch';

try {
  const response = await fetch(url, {
    timeout: 5000 // 5 second timeout
  });
} catch (error) {
  if (error.type === 'request-timeout') {
    console.log('Request timed out');
  }
}
```

## Response Errors

Note that node-fetch only throws errors for network/request failures. HTTP error status codes (4xx, 5xx) are **not** thrown as errors. You must check `response.ok` or `response.status`:

```javascript
import fetch from 'node-fetch';

const response = await fetch(url);

if (!response.ok) {
  console.log('HTTP error:', response.status, response.statusText);
  return;
}

const data = await response.json();
```

## See Also

- [README.md](../README.md) - Main documentation
- [v3-UPGRADE-GUIDE.md](./v3-UPGRADE-GUIDE.md) - Migration guide from v2 to v3
