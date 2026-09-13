/// <reference types="vite/client" />

interface Window {
  __HILLBOUND_TEST_API__?: import("./testApi/installTestApi").HillboundTestApi;
  __HILLBOUND_TELEMETRY__?: import("./types/game").TelemetryEvent[];
  __HILLBOUND_READY__?: boolean;
}
