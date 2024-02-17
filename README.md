# @kiruse/restful
`@kiruse/restful` is a simple but powerful & flexible RESTful API client abstraction.

## Usage
Restful wraps around an arbitrary `Requester`, but to get started quickly with JSON requests & responses you can use `restful.default` like below:

```typescript
import { restful, RestApiMethod, RestError, RestResource } from '@kiruse/restful';

interface User {
  // some user data
  uid: string;
  username: string;
  // ...
}

type MyApi = {
  // Endpoints are defined as methods.
  greet(method: 'GET'): Promise<string>;

  // You can also define them with the `RestApiMethod` like below.
  // It takes 4 parameters: method, body, query, result.
  motd: RestApiMethod<'GET', never, never, string>;

  // Paths are objects
  v2: {
    greet(method: 'GET'): Promise<{ message: string }>;
  };

  // Paths can also be endpoints themselves by combining a method with an object like below.
  foo:
    & RestApiMethod<'GET', never, never, string>
    & {
        bar(method: 'GET'): Promise<string>;
      };

  // Resources of the pattern `/user/:id/<nested>`
  // the pattern below makes `user` itself callable with additional nested routes
  user:
    & RestApiMethod<'POST', Omit<User, 'uid'>, never, User>
    & RestResource<
      & RestApiMethod<'DELETE', never, never, void>
      & RestApiMethod<'PATCH', Partial<User>, never, void>
    >;
}

const rest = restful.default<MyApi>({
  baseUrl: 'https://api.example.com/',
});

console.log(await rest.greet()); // eg: Hello, World!
console.log(await rest.v2.greet()); // eg: Hello, Version 2!
console.log(await rest.foo('GET')); // eg: Hello, foo!
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

Evidently, there are two styles in which you can define your API: Objects + Methods style, or `RestApiMethod` style.

For an example usage, see `test.ts`.

## Morphing
Endpoints can be morphed. For this purpose, `restful` exposes 4 symbols which can be used to define callbacks on the respective endpoints:
- `restful.BodyMorphSymbol`: Morph the body before it gets sent to the server. This result will be JSON-stringified.
- `restful.QueryMorphSymbol`: Morph the query before it gets attached to the URL. Expected to return a `Query`.
- `restful.HeaderMorphSymbol`: Morph the request headers object before they are sent to the server.
- `restful.ResultMorphSymbol`: Morph the response result payload after received from the server and JSON-parsed. Expected to return the user-defined result type.

All morphing methods are strictly typed where possible based on your API definition. The result morpher receives the body as `unknown` in order to require deliberacy in your typing.

**Example:**
```typescript
import { restful, RestApiMethod } from '@kiruse/restful';

type MyApi = {
  foo: RestApiMethod<'GET', never, never, string>;
}

const baseUrl = 'http://localhost:3000/api';
const api = restful.default<MyApi>({ baseUrl });

// unwrap the 'msg' property from the result object
api.foo[restful.ResultMorphSymbol] = (endpoint, result: { msg: string }) => {
  return result.msg;
};

console.log(await api.foo('GET')); // eg: bar
```

## `restful.default` Configuration
`restful.default` supports a few configuration options:

- `baseUrl` - Required. The base URL of your API.
- `headers` - Optional. Default headers to always include, such as API tokens.
- `marshal` - Optional. Used like so: `JSON.stringify(marshal(body))`. Can be used to e.g. convert casing or serialize non-DTOs. Defaults to the identity function.
- `unmarshal` - Optional. When `marshal` is provided, you'll typically also provide `unmarshal` to revert the conversion. Defaults to the identity function.

Beware that `marshal` and `unmarshal` are dangerous functions and you should thoroughly test your implementations.
