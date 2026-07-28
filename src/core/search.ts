export type SearchSortItem = { [field: string]: 'asc' | 'desc' };

export type SearchOptions = {
  collection: string;
  q?: string;
  filter?: object;
  sort?: SearchSortItem[];
  from?: number;
  size?: number;
  body?: object;
};

export type SearchResultHit = {
  _id: string;
  _source: object;
};

export type SearchResult = {
  hits: SearchResultHit[];
};

export abstract class EnduranceSearchProvider {
  abstract isSearchEnabled(): boolean;
  abstract search(collection: string, options: SearchOptions): Promise<SearchResult>;
}

class NoOpSearchProvider extends EnduranceSearchProvider {
  isSearchEnabled(): boolean {
    return false;
  }

  async search(_collection: string, _options: SearchOptions): Promise<SearchResult> {
    return { hits: [] };
  }
}

class EnduranceSearchMiddlewareHolder {
  private static instance: EnduranceSearchProvider = new NoOpSearchProvider();

  public static getInstance(): EnduranceSearchProvider {
    return EnduranceSearchMiddlewareHolder.instance;
  }

  public static setInstance(provider: EnduranceSearchProvider): void {
    EnduranceSearchMiddlewareHolder.instance = provider;
  }
}

export const EnduranceSearchMiddleware = {
  getInstance: EnduranceSearchMiddlewareHolder.getInstance.bind(EnduranceSearchMiddlewareHolder),
  setInstance: EnduranceSearchMiddlewareHolder.setInstance.bind(EnduranceSearchMiddlewareHolder)
};
