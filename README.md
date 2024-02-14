# @kiruse/restful
`@kiruse/restful` is a simple but powerful & flexible RESTful API client abstraction.

## Usage
Restful wraps around an arbitrary `Requester`, but to get started quickly with JSON requests & responses you can use `restful.default` like below:

```typescript
import { restful, RestError, RestResource } from '@kiruse/restful';

interface User {
  // some user data
  uid: string;
  username: string;
  // ...
}

type MyApi = {
  /** Simple greeting getter, perhaps for liveness checks */
  greet(method: 'GET'): Promise<string>;

  /** Server's message of the day, because why not */
  motd(method: 'GET'): Promise<string>;

  /** ISO timestamp of server's current time */
  'server-time'(method: 'GET'): Promise<string>;

  // simple nested paths
  v2: {
    greet(method: 'GET'): Promise<{ message: string }>;
  };

  // Resources of the pattern `/user/:id/<nested>`
  // the pattern below makes `user` itself callable with additional nested routes
  user: {
    /** Create a new user */
    (method: 'POST', Omit<User, 'uid'>): Promise<User>;
  } & RestResource<{
    /** Delete this user. */
    (method: 'DELETE'): Promise<void>;
    /** Update some properties of this user. */
    (method: 'PATCH', body: Partial<User>): Promise<void>;
  }>;
}

const rest = restful.default<MyApi>({
  baseUrl: 'https://api.example.com/',
});

console.log(await rest.greet()); // eg: Hello, World!
console.log(await rest.v2.greet()); // eg: Hello, Version 2!
console.log(await rest.user('POST', { username: 'foobar' })); // eg: { id: 42, username: 'foobar' }
console.log(await rest.user[42]('DELETE')); // void - success

// if response not ok (status isn't 2xx) throws `RestError` which has `response: Response` and `body: string` properties
try {
  await rest.user[43]('DELETE');
} catch (err) {
  if (err instanceof RestError) {
    console.error(`${err.response.url} status ${err.response.status}: ${err.body}`);
  }
}
```

For an example usage, see `test.ts`.

## `restful.default` Configuration
`restful.default` supports a few configuration options:

- `baseUrl` - Required. The base URL of your API.
- `headers` - Optional. Default headers to always include, such as API tokens.
- `marshal` - Optional. Used like so: `JSON.stringify(marshal(body))`. Can be used to e.g. convert casing or serialize non-DTOs. Defaults to the identity function.
- `unmarshal` - Optional. When `marshal` is provided, you'll typically also provide `unmarshal` to revert the conversion. Defaults to the identity function.

Beware that `marshal` and `unmarshal` are dangerous functions and you should thoroughly test your implementations.
