export interface WearableAdapter {
  available(): boolean;
  watchInstalled(): boolean;
  connect(): Promise<void>;
  latest(): Promise<unknown>;
  launchWatch(): Promise<void>;
  stopWatch(): Promise<void>;
  subscribe(listener: (sample: unknown) => void): () => void;
}
