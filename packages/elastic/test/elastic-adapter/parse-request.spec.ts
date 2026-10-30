import { ElasticAdapter } from '@opra/elastic';
import { expect } from 'expect';

/** A FindMany request as parseRequest sees it: only the operation and the query parameters. */
function findManyContext(queryParams: Record<string, any>) {
  return {
    transport: 'http',
    queryParams,
    __oprDef: {
      composition: 'Entity.FindMany',
      compositionOptions: {
        type: 'Customer',
        defaultLimit: 25,
        defaultSort: ['-createdAt'],
        defaultProjection: ['givenName', 'familyName'],
      },
      owner: {},
    },
  } as any;
}

describe('elastic:ElasticAdapter.parseRequest', () => {
  it('Should apply the operation defaults to a "findMany" request that gives none', async () => {
    const o = await ElasticAdapter.parseRequest(findManyContext({}));
    expect(o.method).toStrictEqual('findMany');
    expect(o.options).toMatchObject({
      limit: 25,
      sort: ['-createdAt'],
      projection: ['givenName', 'familyName'],
    });
  });

  it('Should let the request override the operation defaults', async () => {
    const o = await ElasticAdapter.parseRequest(
      findManyContext({
        limit: 5,
        sort: ['givenName'],
        projection: ['uid'],
        skip: 10,
        count: true,
      }),
    );
    expect(o.options).toMatchObject({
      limit: 5,
      sort: ['givenName'],
      projection: ['uid'],
      skip: 10,
      count: true,
    });
  });
});
