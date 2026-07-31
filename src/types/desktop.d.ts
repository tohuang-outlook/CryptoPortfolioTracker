interface Window {
  desktopApp?: {
    platform: string;
    forecastStorage: {
      load(): Promise<string | null>;
      save(value: string): Promise<void>;
    };
    microstructureStorage: {
      load(): Promise<string | null>;
      save(value: string): Promise<void>;
    };
    candleHistoryStorage: {
      load(): Promise<string | null>;
      save(value: string): Promise<void>;
    };
  };
}
