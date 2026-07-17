interface Window {
  desktopApp?: {
    platform: string;
    forecastStorage: {
      load(): Promise<string | null>;
      save(value: string): Promise<void>;
    };
  };
}
