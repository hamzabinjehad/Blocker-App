jest.mock('expo', () => ({
  requireNativeModule: jest.fn(() => ({})),
}));
