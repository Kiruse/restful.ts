const MetadataSymbol = Symbol('Restful');
export const BodyMorphSymbol = Symbol('Restful.BodyMorph');
export const QueryMorphSymbol = Symbol('Restful.QueryMorph');
export const HeaderMorphSymbol = Symbol('Restful.HeaderMorph');
export const ResultMorphSymbol = Symbol('Restful.ResultMorph');

type Endpoint = EndpointPathPart[];
type EndpointPathPart = string | RestResourcePathPart;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type Requester = (options: RequestOptions) => Promise<unknown>;
type Fn<Args extends any[] = any[], R = any> = (...args: Args) => R;

export type Query = Record<string, string | number | undefined | null>;

export interface RequestOptions {
  method: Method;
  endpoint: Endpoint;
  body?: unknown;
  query?: URLSearchParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type RemainingRequestOptions<Q = Query> =
  & Omit<RequestOptions, 'method' | 'endpoint' | 'body' | 'query'>
  & (undefined extends Q
      ? { query?: URLSearchParams | Q }
      : { query:  URLSearchParams | Q }
    );

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
      ? (T & {
          /** An optional morpher which takes the request body and changes it, e.g. changing its shape
           * when the desired library-exposed shape is different from the actual API shape.
           */
          [BodyMorphSymbol]?(endpoint: Endpoint, body: RestApiMethodBody<T>): any;
          /** An optional morpher which takes the request query and changes it, e.g. adds more
           * parameters depending on the endpoint.
           */
          [QueryMorphSymbol]?(endpoint: Endpoint, query: URLSearchParams): URLSearchParams;
          /** An optional morpher which takes the request headers and changes them, e.g. adds more
           * headers depending on the endpoint.
           */
          [HeaderMorphSymbol]?(endpoint: Endpoint, headers: Record<string, string>): Record<string, string>;
          /** An optional morpher which takes the raw, unknown result from the response and produces
           * the desired result. Should throw `RestError` if it fails to parse the result.
           */
          [ResultMorphSymbol]?(endpoint: Endpoint, result: unknown): RestApiMethodResult<T>;
        })
      : {}
    )

export interface RestApiTemplate {
  [key: string | number]: RestApiTemplate | RestApiMethodTemplate;
}

export type RestApiMethodTemplate = {
  [M in Method]: (method: M, ...args: any[]) => Promise<any>;
}[Method];
export type RestApiMethod<M extends Method, B, Q, R> =
  M extends 'GET' | 'DELETE'
  ? (undefined extends Q
    ? ((method: M, options?: RemainingRequestOptions<Q>) => Promise<R>)
    : ((method: M, options: RemainingRequestOptions<Q>) => Promise<R>)
    )
  : (undefined extends Q
    ? ((method: M, body: B, options?: RemainingRequestOptions<Q>) => Promise<R>)
    : ((method: M, body: B, options: RemainingRequestOptions<Q>) => Promise<R>)
    );

type RestMethodsTemplate = {
  get?(options?: any): any;
  delete?(options?: any): any;
  post?(body: any, options?: any): any;
  put?(body: any, options?: any): any;
  patch?(body: any, options?: any): any;
}

/** A utility type to help increase legibility of REST API definitions */
export type RestMethods<T extends RestMethodsTemplate> =
  & (T['get']    extends Fn ? RestApiMethod<'GET',    never,                      RestMethodQuery<T['get'], true>,    RestMethodResult<T['get']>>    : {})
  & (T['delete'] extends Fn ? RestApiMethod<'DELETE', never,                      RestMethodQuery<T['delete'], true>, RestMethodResult<T['delete']>> : {})
  & (T['post']   extends Fn ? RestApiMethod<'POST',   RestMethodBody<T['post']>,  RestMethodQuery<T['post']>,         RestMethodResult<T['post']>>   : {})
  & (T['put']    extends Fn ? RestApiMethod<'PUT',    RestMethodBody<T['put']>,   RestMethodQuery<T['put']>,          RestMethodResult<T['put']>>    : {})
  & (T['patch']  extends Fn ? RestApiMethod<'PATCH',  RestMethodBody<T['patch']>, RestMethodQuery<T['patch']>,        RestMethodResult<T['patch']>>  : {})
  ;
type RestMethodBody<T> = T extends (body: infer B, ...args: any[]) => any ? B : never;
type RestMethodQuery<T extends Fn, IsBodyless extends boolean = false> =
  IsBodyless extends true ? Parameters<T>[0] : Parameters<T>[1];
type RestMethodResult<T> = T extends Fn<any[], infer R> ? R : never;

export namespace RestMethods {
  export type Bodyless<Q, R> = (query?: Q) => R;
  export type WithBody<B, Q, R> = (body: B, query?: Q) => R;
}

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
    const target: any = async (method: Method, ...args: any[]) => {
      let body: any, headers: any, opts: RemainingRequestOptions | undefined;
      if (method === 'GET' || method === 'DELETE') {
        [opts] = args;
      } else {
        [body, opts] = args;
      }

      let query = new URLSearchParams();
      if (opts?.query) {
        if (opts.query instanceof URLSearchParams) {
          query = opts.query;
        } else {
          Object.entries(opts.query)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]: [string, any]) => [key, value.toString()] as [string, string])
            .forEach(([key, value]) => query.append(key, value));
        }
      }

      query = target[QueryMorphSymbol] ? target[QueryMorphSymbol](endpoint, query) : query;
      headers = target[HeaderMorphSymbol] ? target[HeaderMorphSymbol](endpoint, opts?.headers) : opts?.headers;

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
  baseUrl: string | (() => string | Promise<string>);
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
  baseUrl: _baseUrl,
  headers: baseHeaders = {},
  marshal = (value: any) => value,
  unmarshal = (value: any) => value,
}: DefaultRequesterOptions) {
  return async function({
    method,
    endpoint,
    body,
    query = new URLSearchParams(),
    headers = {},
  }: RequestOptions): Promise<any> {
    const entries = query instanceof URLSearchParams ? Array.from(query.entries()) : Object.entries(marshal(query));
    const params = new URLSearchParams(
      entries
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]: [string, any]) => [key, value.toString()] as [string, string])
    );
    const baseUrl = typeof _baseUrl === 'function' ? await _baseUrl() : _baseUrl;
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
