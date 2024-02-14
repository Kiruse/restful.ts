type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Requester = (options: RequestOptions) => Promise<unknown>;
export type Query = Record<string, string | number | undefined | null>;
export interface RequestOptions<Q = Query> {
    method: Method;
    endpoint: string;
    body?: unknown;
    query?: Q;
    headers?: Record<string, string>;
}
export type RemainingRequestOptions<Q = Query> = Omit<RequestOptions<Q>, 'method' | 'endpoint' | 'body'>;
export type RestResource<T> = {
    [id: string | number]: T;
};
export interface RestApiTemplate {
    [key: string | number]: RestApiTemplate | RestApiMethodTemplate;
}
export type RestApiMethodTemplate = ((method: 'GET', options?: RemainingRequestOptions) => Promise<any>) | ((method: 'DELETE', options?: RemainingRequestOptions) => Promise<any>) | ((method: 'POST', body: any, options?: RemainingRequestOptions) => Promise<any>) | ((method: 'PUT', body: any, options?: RemainingRequestOptions) => Promise<any>) | ((method: 'PATCH', body: any, options?: RemainingRequestOptions) => Promise<any>);
/** `restful` creates a simple interface to your RESTful web API. */
declare function restful<T extends RestApiTemplate>(request: Requester): T;
declare namespace restful {
    var _a: <T extends RestApiTemplate>(options: DefaultRequesterOptions) => T;
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
