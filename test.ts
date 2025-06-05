import { afterAll, expect, test } from 'bun:test';
import restful, { RestApiMethod, RestMethods, RestResource } from './index';
import { Foo, mockServer } from './mock';

type MockApi = {
  'hello-world'(method: 'GET'): Promise<string>;
  echo<T>(method: 'POST', body: T): Promise<T>;

  foo: RestMethods<{
    post(): Foo;
  }> & RestResource<{
      (method: 'GET'): Promise<Foo>;
      (method: 'PUT', body: Omit<Foo, 'id'>): Promise<Foo>;
      name: RestApiMethod<'PUT', { value: string }, undefined, Foo>;
    }>;

  bar: RestMethods<{
    get(options: { a: number }): Promise<Foo>;
  }>;

  morphing: RestMethods<{
    get(query: { a: bigint }): Promise<string>;
  }>;
};

const mockApi = restful.default<MockApi>({
  baseUrl: 'http://localhost:3034/api',
});

mockApi.morphing[restful.ResultMorphSymbol] = (endpoint, result: any) => {
  return result.msg;
};
mockApi.morphing[restful.QueryMorphSymbol] = (endpoint, query) => {
  query.set('a', query.get('a')!.toString());
  return query;
};

test('hello-world', async () => {
  expect(await mockApi['hello-world']('GET')).toBe('Hello, World!');
});

test('echo', async () => {
  expect(await mockApi.echo('POST', { msg: 'Hello, World!' })).toEqual({ msg: 'Hello, World!' });
  expect(await mockApi.echo('POST', { data: 'Goodbye, World!' })).toEqual({ data: 'Goodbye, World!' });
});

test('nesting', async () => {
  expect(await mockApi.foo[1]('GET')).toEqual({ id: 1, name: 'Foo 1' });
  expect(await mockApi.foo[1]('PUT', { name: 'Bar' })).toEqual({ id: 1, name: 'Bar' });
  expect(await mockApi.foo[1].name('PUT', { value: 'Bar' })).toEqual({ id: 1, name: 'Bar' });
});

test('query', async () => {
  expect(await mockApi.bar('GET', { query: { a: 1 } })).toEqual({ id: 1, a: 'Foo 1' });
});

test('morphing', async () => {
  expect(await mockApi.morphing('GET', { query: { a: 1n } })).toBe('Hello, 1!');
});

test('instance stability', () => {
  expect(mockApi.foo).toBe(mockApi.foo);
  expect(mockApi.foo[1]).toBe(mockApi.foo[1]);
});

afterAll(() => {
  mockServer.close();
});
