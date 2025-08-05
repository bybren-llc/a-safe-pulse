import { debug, info, warn, error } from '../../src/utils/logger';

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log debug messages with correct format', () => {
    debug('Test debug message');
    
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
    
    expect(loggedData.level).toBe('DEBUG');
    expect(loggedData.message).toBe('Test debug message');
    expect(loggedData.timestamp).toBeDefined();
  });

  it('should log info messages with metadata', () => {
    const metadata = { userId: 123, action: 'login' };
    info('User logged in', metadata);
    
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
    
    expect(loggedData.level).toBe('INFO');
    expect(loggedData.message).toBe('User logged in');
    expect(loggedData.metadata).toEqual(metadata);
  });

  it('should log warning messages', () => {
    warn('This is a warning');
    
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
    
    expect(loggedData.level).toBe('WARN');
    expect(loggedData.message).toBe('This is a warning');
  });

  it('should log error messages', () => {
    error('This is an error');
    
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
    
    expect(loggedData.level).toBe('ERROR');
    expect(loggedData.message).toBe('This is an error');
  });

  it('should include timestamp in all log entries', () => {
    const beforeTime = new Date();
    info('Test message');
    const afterTime = new Date();

    const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
    const loggedTime = new Date(loggedData.timestamp);

    expect(loggedData.timestamp).toBeDefined();
    expect(loggedTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(loggedTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });
});
