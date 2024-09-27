"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestResourcePathPart = exports.RestError = exports.createDefaultRequester = exports.restful = exports.ResultMorphSymbol = exports.HeaderMorphSymbol = exports.QueryMorphSymbol = exports.BodyMorphSymbol = void 0;
const MetadataSymbol = Symbol('Restful');
exports.BodyMorphSymbol = Symbol('Restful.BodyMorph');
exports.QueryMorphSymbol = Symbol('Restful.QueryMorph');
exports.HeaderMorphSymbol = Symbol('Restful.HeaderMorph');
exports.ResultMorphSymbol = Symbol('Restful.ResultMorph');
/** `restful` creates a simple interface to your RESTful web API. */
function restful(request) {
    function createEndpoint(endpoint) {
        const target = async (method, ...args) => {
            let body, query, headers, opts;
            if (method === 'GET' || method === 'DELETE') {
                [opts] = args;
            }
            else {
                [body, opts] = args;
            }
            query = target[exports.QueryMorphSymbol] ? target[exports.QueryMorphSymbol](endpoint, opts?.query) : opts?.query;
            headers = target[exports.HeaderMorphSymbol] ? target[exports.HeaderMorphSymbol](endpoint, opts?.headers) : opts?.headers;
            const result = await request({
                method,
                endpoint,
                body: target[exports.BodyMorphSymbol] ? target[exports.BodyMorphSymbol](endpoint, body) : body,
                ...opts,
                headers,
                query,
            });
            if (target[exports.ResultMorphSymbol])
                return target[exports.ResultMorphSymbol](endpoint, result);
            return result;
        };
        return new Proxy(target, {
            get(target, prop) {
                const meta = target[MetadataSymbol] ?? (target[MetadataSymbol] = {});
                if (prop in meta)
                    return meta[prop];
                if (typeof prop === 'symbol')
                    throw Error('Invalid path part type Symbol');
                return meta[prop] = createEndpoint([...endpoint, prop]);
            },
        });
    }
    ;
    const root = createEndpoint([]);
    root[MetadataSymbol] = { request };
    return root;
}
exports.default = restful;
exports.restful = restful;
/** Create a slightly biased but commonly encountered implementation of a RESTful API.
 *
 * The bias includes:
 * - JSON request & response bodies
 * - Normalizing endpoint URLs to the form of `${baseUrl}/${endpoint}`
 * - Throws `RestError` on non-2xx responses. `RestError` consumes the response body as raw text.
 * - Returns JSON-parsed response bodies, not the intermittent `Response` object, but the `Response` object is available on the `RestError`
 */
restful.default = (options) => restful(createDefaultRequester(options));
/** Create a new Restful API with a different definition but reusing the given `api`'s requester.
 * Useful for when it's possible to reuse an existing API implementation but with different endpoints.
 * However, all morphers of the old API are lost.
 *
 * This can be used, for example, in the Cosmos blockchain ecosystem where the REST API is generally
 * the same except for minor variations in body or result shapes and the inclusion or omission of
 * some endpoints.
 */
restful.retarget = (api) => restful(api[MetadataSymbol].request);
restful.BodyMorphSymbol = exports.BodyMorphSymbol;
restful.QueryMorphSymbol = exports.QueryMorphSymbol;
restful.HeaderMorphSymbol = exports.HeaderMorphSymbol;
restful.ResultMorphSymbol = exports.ResultMorphSymbol;
restful.isResource = (value) => value instanceof RestResourcePathPart;
function createDefaultRequester({ baseUrl: _baseUrl, headers: baseHeaders = {}, marshal = (value) => value, unmarshal = (value) => value, }) {
    return async function ({ method, endpoint, body, query = {}, headers = {}, }) {
        const entries = query instanceof URLSearchParams ? Array.from(query.entries()) : Object.entries(marshal(query));
        const params = new URLSearchParams(entries
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => [key, value.toString()]));
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
    };
}
exports.createDefaultRequester = createDefaultRequester;
class RestError extends Error {
    constructor(response, body) {
        super(`${response.url} ${response.status} ${response.statusText}: ${body}`);
        this.response = response;
        this.body = body;
        this.name = 'RestError';
    }
}
exports.RestError = RestError;
class RestResourcePathPart {
    constructor(value) {
        this.value = value;
    }
    toString() {
        return this.value;
    }
}
exports.RestResourcePathPart = RestResourcePathPart;
//# sourceMappingURL=index.js.map