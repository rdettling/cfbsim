export interface UseDomainDataOptions<T> {
  fetcher: () => Promise<T>;
  deps?: Array<unknown>;
  onData?: (data: T) => void;
}
