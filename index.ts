const MetadataSymbol = Symbol('Restful');
export const BodyMorphSymbol = Symbol('Restful.BodyMorph');
export const QueryMorphSymbol = Symbol('Restful.QueryMorph');
export const HeaderMorphSymbol = Symbol('Restful.HeaderMorph');
export const ResultMorphSymbol = Symbol('Restful.ResultMorph');

type Endpoint = EndpointPathPart[];
type EndpointPathPart = string | RestResourcePathPart;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type Requester = (options: RequestOptions) => Promise<unknown>;

export type Query = Record<string, string | number | undefined | null>;

export interface RequestOptions<Q extends Query = Query> {
  method: Method;
  endpoint: Endpoint;
  body?: unknown;
  query?: Q;
  headers?: Record<string, string>;
}

export type RemainingRequestOptions<Q extends Query = Query> = Omit<RequestOptions<Q>, 'method' | 'endpoint' | 'body'>;

export type RestResource<T> = {
  [id: string | number]: T;
};

export type RestApi<T extends RestApiTemplate | RestApiMethodTemplate> =
  & (
      T extends Record<any, any>
      ? {
          [K in keyof T]: RestApi<T[K]>;
        }
      : {}
    )
  & (
      T extends RestApiMethodTemplate
      ? T & {
          /** An optional morpher which takes the request body and changes it, e.g. changing its shape
           * when the desired library-exposed shape is different from the actual API shape.
           */
          [BodyMorphSymbol]?(endpoint: Endpoint, body: RestApiMethodBody<T>): any;
          /** An optional morpher which takes the request query and changes it, e.g. adds more
           * parameters depending on the endpoint.
           */
          [QueryMorphSymbol]?(endpoint: Endpoint, query: RestApiMethodQuery<T>): Query;
          /** An optional morpher which takes the request headers and changes them, e.g. adds more
           * headers depending on the endpoint.
           */
          [HeaderMorphSymbol]?(endpoint: Endpoint, headers: Record<string, string>): Record<string, string>;
          /** An optional morpher which takes the raw, unknown result from the response and produces
           * the desired result. Should throw `RestError` if it fails to parse the result.
           */
          [ResultMorphSymbol]?(endpoint: Endpoint, result: unknown): RestApiMethodResult<T>;
        }
      : {}
    )

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
export default function restful<T extends RestApiTemplate>(request: Requester): RestApi<T> {
  function createEndpoint(endpoint: Endpoint): any {
    const target = async (method: Method, ...args: any[]) => {
      let body: any, query: any, headers: any, opts: any;
      if (method === 'GET' || method === 'DELETE') {
        [opts] = args;
      } else {
        [body, opts] = args;
      }

      if (opts) {
        if (opts.query)
          query = target[QueryMorphSymbol] ? target[QueryMorphSymbol](endpoint, opts.query) : opts.query;
        if (opts.headers)
          headers = target[HeaderMorphSymbol] ? target[HeaderMorphSymbol](endpoint, opts.headers) : opts.headers;
      }

      const result = await request({
        method,
        endpoint,
        body: target[BodyMorphSymbol] ? target[BodyMorphSymbol](endpoint, body) : body,
        ...opts,
        headers,
        query,
      });
      if (target[ResultMorphSymbol])
        return target[ResultMorphSymbol](endpoint, result);
      return result;
    };

    return new Proxy(target, {
      get(target: any, prop) {
        const meta = target[MetadataSymbol] ??= {};
        if (prop in meta) return meta[prop];
        if (typeof prop === 'symbol')
          throw Error('Invalid path part type Symbol');
        return meta[prop] = createEndpoint([...endpoint, prop]);
      },
    });
  };

  const root = createEndpoint([]);
  root[MetadataSymbol] = { request };
  return root;
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

/** Create a new Restful API with a different definition but reusing the given `api`'s requester.
 * Useful for when it's possible to reuse an existing API implementation but with different endpoints.
 * However, all morphers of the old API are lost.
 *
 * This can be used, for example, in the Cosmos blockchain ecosystem where the REST API is generally
 * the same except for minor variations in body or result shapes and the inclusion or omission of
 * some endpoints.
 */
restful.retarget = <T extends RestApiTemplate>(api: RestApi<any>) => restful<T>(api[MetadataSymbol].request);

restful.BodyMorphSymbol = BodyMorphSymbol;
restful.QueryMorphSymbol = QueryMorphSymbol;
restful.HeaderMorphSymbol = HeaderMorphSymbol;
restful.ResultMorphSymbol = ResultMorphSymbol;
restful.isResource = (value: EndpointPathPart): value is RestResourcePathPart => value instanceof RestResourcePathPart;

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
    const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.join('/').replace(/^\//, '')}${params.size ? `?${params}` : ''}`;
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

export class RestResourcePathPart {
  constructor(public readonly value: string) {}
  toString() {
    return this.value;
  }
}
