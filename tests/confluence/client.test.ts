import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import axios from 'axios';
import { ConfluenceClient } from '../../src/confluence/client';
import { RateLimiter } from '../../src/confluence/rate-limiter';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock rate limiter - fix hoisting issue by using factory function
jest.mock('../../src/confluence/rate-limiter', () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    acquire: jest.fn().mockImplementation(() => Promise.resolve())
  }))
}));

describe('ConfluenceClient', () => {
  const baseUrl = 'https://example.atlassian.net';
  const accessToken = 'test-access-token';
  let client: ConfluenceClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup axios create mock
    mockedAxios.create.mockReturnValue(mockedAxios as any);
    
    // Setup RateLimiter mock - already configured in mockRateLimiterInstance
    
    // Create client instance
    client = new ConfluenceClient(baseUrl, accessToken);
  });

  describe('getPage', () => {
    it('should retrieve a page by ID', async () => {
      const pageId = '123456';
      const mockResponse = {
        data: {
          id: pageId,
          title: 'Test Page',
          body: {
            storage: {
              value: '<p>Test content</p>'
            }
          }
        }
      };
      
      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      
      const result = await client.getPage(pageId);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(`/content/${pageId}`, {
        params: {
          expand: 'body.storage,version,space'
        }
      });
      
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should handle errors when retrieving a page', async () => {
      const pageId = '123456';
      const error = new Error('API error');
      
      mockedAxios.get.mockRejectedValueOnce(error);
      
      await expect(client.getPage(pageId)).rejects.toThrow();
    });
  });

  describe('getPageByUrl', () => {
    it('should retrieve a page by URL', async () => {
      const pageUrl = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123456';
      const pageId = '123456';
      const mockResponse = {
        data: {
          id: pageId,
          title: 'Test Page'
        }
      };
      
      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      
      const result = await client.getPageByUrl(pageUrl);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(`/content/${pageId}`, {
        params: {
          expand: 'body.storage,version,space'
        }
      });
      
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should throw an error for invalid URLs', async () => {
      const invalidUrl = 'https://example.atlassian.net/invalid';
      
      await expect(client.getPageByUrl(invalidUrl)).rejects.toThrow('Invalid Confluence URL');
    });
  });

  describe('getAttachments', () => {
    it('should retrieve attachments for a page', async () => {
      const pageId = '123456';
      const mockResponse = {
        data: {
          results: [
            { id: 'att1', title: 'Attachment 1' },
            { id: 'att2', title: 'Attachment 2' }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      
      const result = await client.getAttachments(pageId);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(`/content/${pageId}/child/attachment`, {
        params: {
          expand: 'version'
        }
      });
      
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('downloadAttachment', () => {
    it('should download an attachment', async () => {
      const attachmentId = 'att1';
      const mockData = Buffer.from('test attachment data');
      const mockResponse = {
        data: mockData
      };
      
      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      
      const result = await client.downloadAttachment(attachmentId);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(`/content/${attachmentId}/download`, {
        responseType: 'arraybuffer'
      });
      
      expect(result).toEqual(mockData);
    });
  });

  describe('search', () => {
    it('should search for content using CQL', async () => {
      const cql = 'type=page AND space=SPACE';
      const mockResponse = {
        data: {
          results: [
            { id: 'page1', title: 'Page 1' },
            { id: 'page2', title: 'Page 2' }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      
      const result = await client.search(cql);
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/content/search', {
        params: {
          cql,
          limit: 25,
          start: 0,
          expand: 'space,version'
        }
      });
      
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should support pagination parameters', async () => {
      const cql = 'type=page AND space=SPACE';
      const limit = 10;
      const start = 20;
      const mockResponse = {
        data: {
          results: [
            { id: 'page1', title: 'Page 1' },
            { id: 'page2', title: 'Page 2' }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      
      const result = await client.search(cql, limit, start);
      
      expect(mockedAxios.get).toHaveBeenCalledWith('/content/search', {
        params: {
          cql,
          limit,
          start,
          expand: 'space,version'
        }
      });
      
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getSpaceContent', () => {
    it('should retrieve content for a space', async () => {
      const spaceKey = 'SPACE';
      const mockResponse = {
        data: {
          results: [
            { id: 'page1', title: 'Page 1' },
            { id: 'page2', title: 'Page 2' }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      
      const result = await client.getSpaceContent(spaceKey);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(`/space/${spaceKey}/content`, {
        params: {
          limit: 25,
          start: 0,
          expand: 'version'
        }
      });
      
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should support pagination parameters', async () => {
      const spaceKey = 'SPACE';
      const limit = 10;
      const start = 20;
      const mockResponse = {
        data: {
          results: [
            { id: 'page1', title: 'Page 1' },
            { id: 'page2', title: 'Page 2' }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      
      const result = await client.getSpaceContent(spaceKey, limit, start);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(`/space/${spaceKey}/content`, {
        params: {
          limit,
          start,
          expand: 'version'
        }
      });
      
      expect(result).toEqual(mockResponse.data);
    });
  });
});
