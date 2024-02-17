const MetadataSymbol = Symbol('Restful');

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type Requester = (options: RequestOptions) => Promise<unknown>;

export type Query = Record<string, string | number | undefined | null>;

export interface RequestOptions<Q extends Query = Query> {
  method: Method;
  endpoint: string;
  body?: unknown;
  query?: Q;
  headers?: Record<string, string>;
}

export type RemainingRequestOptions<Q extends Query = Query> = Omit<RequestOptions<Q>, 'method' | 'endpoint' | 'body'>;

export type RestResource<T> = {
  [id: string | number]: T;
};

export interface RestApiTemplate {
  [key: string | number]: RestApiTemplate | RestApiMethodTemplate;
}

export type RestApiMethodTemplate =
  | RestApiMethod<'GET', undefined, Query, any>
  | RestApiMethod<'DELETE', undefined, Query, any>
  | RestApiMethod<'POST', any, Query, any>
  | RestApiMethod<'PUT', any, Query, any>
  | RestApiMethod<'PATCH', any, Query, any>;
export type RestApiMethod<M extends Method, B, Q extends Query, R> =
  M extends 'GET' | 'DELETE' ? (method: M, options?: RemainingRequestOptions<Q>) => Promise<R> :
  (method: M, body: B, options?: RemainingRequestOptions<Q>) => Promise<R>;

/** Extracts the applicable method of this endpoint from a valid method signature. */
export type RestApiMethodMethod<Fn extends RestApiMethodTemplate> = Fn extends RestApiMethod<infer M, any, any, any> ? M : never;
/** Extracts the request body type of this endpoint from a valid method signature. */
export type RestApiMethodBody  <Fn extends RestApiMethodTemplate> = Fn extends RestApiMethod<'POST' | 'PUT' | 'PATCH', infer B, any, any> ? B : never;
/** Extracts the query of this endpoint from a valid method signature. */
export type RestApiMethodQuery <Fn extends RestApiMethodTemplate> = Fn extends RestApiMethod<any, any, infer Q, any> ? Q : never;
/** Extracts the response result type of this endpoint from a valid method signature. */
export type RestApiMethodResult<Fn extends RestApiMethodTemplate> = Fn extends RestApiMethod<any, any, any, infer R> ? R : never;

/** `restful` creates a simple interface to your RESTful web API. */
export default function restful<T extends RestApiTemplate>(request: Requester): T {
  const createEndpoint = (endpoint: string): any => new Proxy(
    async (method: Method, ...args: any[]) => {
      if (method === 'GET' || method === 'DELETE') {
        const [opts] = args;
        return await request({
          method,
          endpoint,
          ...opts,
        });
      } else {
        const [body, opts] = args;
        return await request({
          method,
          endpoint,
          body,
          ...opts,
        });
      }
    },
    {
      get(target: any, prop) {
        const meta = target[MetadataSymbol] ??= {};
        if (prop in meta) return meta[prop];
        if (typeof prop === 'symbol')
          throw Error('Invalid path part type Symbol');
        return meta[prop] = createEndpoint(`${endpoint}/${prop}`);
      },
    }
  );

  return createEndpoint('') as any;
}
export { restful };

/** Create a slightly biased but commonly encountered implementation of a RESTful API.
 *
 * The bias includes:
 * - JSON request & response bodies
 * - Normalizing endpoint URLs to the form of `${baseUrl}/${endpoint}`
 * - Throws `RestError` on non-2xx responses. `RestError` consumes the response body as raw text.
 * - Returns JSON-parsed response bodies, not the intermittent `Response` object, but the `Response` object is available on the `RestError`
 */
restful.default = <T extends RestApiTemplate>(options: DefaultRequesterOptions) => restful<T>(createDefaultRequester(options));

export interface DefaultRequesterOptions {
  baseUrl: string;
  /** Default headers to set for every request. */
  headers?: Record<string, string>;
  /** Marshalling algorithm, called like `JSON.stringify(marshal(body))` if body is truthy.
   * Marshalling can also be used to convert case. Defaults to identity.
   */
  marshal?(value: any): any;
  /** Unmarshalling algorithm, called like `unmarshal(await response.json())`.
   * Unmarshalling can be used to restore case. Defaults to identity.
   */
  unmarshal?(value: any): any;
}

export function createDefaultRequester({
  baseUrl,
  headers: baseHeaders = {},
  marshal = (value: any) => value,
  unmarshal = (value: any) => value,
}: DefaultRequesterOptions) {
  return async function({
    method,
    endpoint,
    body,
    query = {},
    headers = {},
  }: RequestOptions): Promise<any> {
    const params = new URLSearchParams(
      Object.entries(query)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, value.toString()])
    );
    const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}${params.size ? `?${params}` : ''}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...baseHeaders,
        ...headers,
      },
      body: body ? JSON.stringify(marshal(body)) : undefined,
    });

    if (!response.ok)
      throw new RestError(response, await response.text());
    return unmarshal(await response.json());
  }
}

export class RestError extends Error {
  constructor(public readonly response: Response, public readonly body: string) {
    super(`${response.url} ${response.status} ${response.statusText}: ${body}`);
    this.name = 'RestError';
  }
}
