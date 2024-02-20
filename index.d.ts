export declare const BodyMorphSymbol: unique symbol;
export declare const QueryMorphSymbol: unique symbol;
export declare const HeaderMorphSymbol: unique symbol;
export declare const ResultMorphSymbol: unique symbol;
type Endpoint = EndpointPathPart[];
type EndpointPathPart = string | RestResourcePathPart;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Requester = (options: RequestOptions) => Promise<unknown>;
export type Query = Record<string, string | number | undefined | null>;
export interface RequestOptions<Q = Query> {
    method: Method;
    endpoint: Endpoint;
    body?: unknown;
    query?: Q & Query;
    headers?: Record<string, string>;
}
export type RemainingRequestOptions<Q = Query> = Omit<RequestOptions<Q>, 'method' | 'endpoint' | 'body'>;
export type RestResource<T> = {
    [id: string | number]: T;
};
export type RestApi<T extends RestApiTemplate | RestApiMethodTemplate> = (T extends Record<any, any> ? {
    [K in keyof T]: RestApi<T[K]>;
} : {}) & (T extends RestApiMethodTemplate ? T & {
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
} : {});
export interface RestApiTemplate {
    [key: string | number]: RestApiTemplate | RestApiMethodTemplate;
}
export type RestApiMethodTemplate = RestApiMethod<'GET', undefined, any, any> | RestApiMethod<'DELETE', undefined, any, any> | RestApiMethod<'POST', any, any, any> | RestApiMethod<'PUT', any, any, any> | RestApiMethod<'PATCH', any, any, any>;
export type RestApiMethod<M extends Method, B, Q, R> = M extends 'GET' | 'DELETE' ? (method: M, options?: RemainingRequestOptions<Q>) => Promise<R> : (method: M, body: B, options?: RemainingRequestOptions<Q>) => Promise<R>;
type RestMethodsTemplate = {
    get?(options?: any): any;
    delete?(options?: any): any;
    post?(body: any, options?: any): any;
    put?(body: any, options?: any): any;
    patch?(body: any, options?: any): any;
};
/** This is a utility type to help create more legible `RestApiMethod`s.
 *
 * Example usage:
 * ```typescript
 * import { RestMethods, RestResource } from '@kiruse/restful';
 *
 * type MyApi = {
 *   users: RestMethods<{
 *     get(): User[];
 *   }> & {
 *     [userId: string | number]: RestMethods<{
 *       get(query: { name: string }): User;
 *       post(body: { name: string }): User;
 *       delete(query: { id: string }): boolean;
 *     }>
 *   >;
 * };
 *
 * // creates API:
 * let api: MyApi;
 * api.users('GET'); // Promise<User[]>
 * api.users['123']('GET', { query: { name: 'John Doe' } }); // Promise<User>
 * api.users['123']('POST', { name: 'John Doe' }); // Promise<User>
 * api.users['123']('DELETE', { query: { id: '123' } }); // Promise<boolean>
 * ```
 */
export type RestMethods<T extends RestMethodsTemplate> = (T['get'] extends RestMethods.Bodyless<infer O, infer R> ? RestApiMethod<'GET', never, O, R> : {}) & (T['delete'] extends RestMethods.Bodyless<infer O, infer R> ? RestApiMethod<'DELETE', never, O, R> : {}) & (T['post'] extends RestMethods.WithBody<infer B, infer O, infer R> ? RestApiMethod<'POST', B, O, R> : {}) & (T['put'] extends RestMethods.WithBody<infer B, infer O, infer R> ? RestApiMethod<'PUT', B, O, R> : {}) & (T['patch'] extends RestMethods.WithBody<infer B, infer O, infer R> ? RestApiMethod<'PATCH', B, O, R> : {});
export declare namespace RestMethods {
    type Bodyless<Q, R> = (query?: Q) => R;
    type WithBody<B, Q, R> = (body: B, query?: Q) => R;
}
/** Extracts the applicable method of this endpoint from a valid method signature. */
export type RestApiMethodMethod<Fn extends RestApiMethodTemplate> = Fn extends RestApiMethod<infer M, any, any, any> ? M : never;
/** Extracts the request body type of this endpoint from a valid method signature. */
export type RestApiMethodBody<Fn extends RestApiMethodTemplate> = Fn extends RestApiMethod<'POST' | 'PUT' | 'PATCH', infer B, any, any> ? B : never;
/** Extracts the query of this endpoint from a valid method signature. */
export type RestApiMethodQuery<Fn extends RestApiMethodTemplate> = Fn extends RestApiMethod<any, any, infer Q, any> ? Q : never;
/** Extracts the response result type of this endpoint from a valid method signature. */
export type RestApiMethodResult<Fn extends RestApiMethodTemplate> = Fn extends RestApiMethod<any, any, any, infer R> ? R : never;
/** `restful` creates a simple interface to your RESTful web API. */
declare function restful<T extends RestApiTemplate>(request: Requester): RestApi<T>;
declare namespace restful {
    var _a: <T extends RestApiTemplate>(options: DefaultRequesterOptions) => RestApi<T>;
    export var retarget: <T extends RestApiTemplate>(api: any) => RestApi<T>;
    export var BodyMorphSymbol: typeof import(".").BodyMorphSymbol;
    export var QueryMorphSymbol: typeof import(".").QueryMorphSymbol;
    export var HeaderMorphSymbol: typeof import(".").HeaderMorphSymbol;
    export var ResultMorphSymbol: typeof import(".").ResultMorphSymbol;
    export var isResource: (value: EndpointPathPart) => value is RestResourcePathPart;
    export { _a as default };
}
export default restful;
export { restful };
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
export declare function createDefaultRequester({ baseUrl, headers: baseHeaders, marshal, unmarshal, }: DefaultRequesterOptions): ({ method, endpoint, body, query, headers, }: RequestOptions) => Promise<any>;
export declare class RestError extends Error {
    readonly response: Response;
    readonly body: string;
    constructor(response: Response, body: string);
}
export declare class RestResourcePathPart {
    readonly value: string;
    constructor(value: string);
    toString(): string;
}
