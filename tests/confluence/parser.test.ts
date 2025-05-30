import { describe, it, expect } from '@jest/globals';
import { ConfluenceParser, ConfluenceElementType } from '../../src/confluence/parser';

describe('ConfluenceParser', () => {
  describe('parse', () => {
    it('should parse a simple document', () => {
      const storageFormat = `
        <h1>Heading 1</h1>
        <p>This is a paragraph</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;
      
      const parser = new ConfluenceParser(storageFormat, 'Test Document');
      const document = parser.parse();
      
      expect(document.title).toBe('Test Document');
      expect(document.elements.length).toBe(3);
      
      // Check heading
      expect(document.elements[0].type).toBe(ConfluenceElementType.HEADING);
      expect(document.elements[0].content).toBe('Heading 1');
      expect(document.elements[0].attributes?.level).toBe(1);
      
      // Check paragraph
      expect(document.elements[1].type).toBe(ConfluenceElementType.PARAGRAPH);
      expect(document.elements[1].content).toBe('This is a paragraph');
      
      // Check list
      expect(document.elements[2].type).toBe(ConfluenceElementType.LIST);
      expect(document.elements[2].children?.length).toBe(2);
      expect(document.elements[2].children?.[0].type).toBe(ConfluenceElementType.LIST_ITEM);
      expect(document.elements[2].children?.[0].content).toBe('Item 1');
      expect(document.elements[2].children?.[1].type).toBe(ConfluenceElementType.LIST_ITEM);
      expect(document.elements[2].children?.[1].content).toBe('Item 2');
    });
    
    it('should extract sections based on headings', () => {
      const storageFormat = `
        <h1>Section 1</h1>
        <p>Section 1 content</p>
        <h2>Subsection 1.1</h2>
        <p>Subsection 1.1 content</p>
        <h1>Section 2</h1>
        <p>Section 2 content</p>
      `;
      
      const parser = new ConfluenceParser(storageFormat, 'Test Document');
      const document = parser.parse();
      
      expect(document.sections.length).toBe(2);
      
      // Check section 1
      expect(document.sections[0].title).toBe('Section 1');
      expect(document.sections[0].level).toBe(1);
      expect(document.sections[0].elements.length).toBe(1);
      expect(document.sections[0].subsections.length).toBe(1);
      
      // Check subsection 1.1
      expect(document.sections[0].subsections[0].title).toBe('Subsection 1.1');
      expect(document.sections[0].subsections[0].level).toBe(2);
      expect(document.sections[0].subsections[0].elements.length).toBe(1);
      
      // Check section 2
      expect(document.sections[1].title).toBe('Section 2');
      expect(document.sections[1].level).toBe(1);
      expect(document.sections[1].elements.length).toBe(1);
      expect(document.sections[1].subsections.length).toBe(0);
    });
    
    it('should parse a table', () => {
      const storageFormat = `
        <table>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
          </tr>
        </table>
      `;
      
      const parser = new ConfluenceParser(storageFormat, 'Test Document');
      const document = parser.parse();
      
      expect(document.elements.length).toBe(1);
      
      // Check table
      const table = document.elements[0];
      expect(table.type).toBe(ConfluenceElementType.TABLE);
      expect(table.children?.length).toBe(2);

      // Check header row
      const headerRow = table.children?.[0];
      expect(headerRow?.type).toBe(ConfluenceElementType.TABLE_ROW);
      expect(headerRow?.children?.length).toBe(2);
      expect(headerRow?.children?.[0].type).toBe(ConfluenceElementType.TABLE_CELL);
      expect(headerRow?.children?.[0].content).toBe('Header 1');
      expect(headerRow?.children?.[0].attributes?.isHeader).toBe(true);

      // Check data row
      const dataRow = table.children?.[1];
      expect(dataRow?.type).toBe(ConfluenceElementType.TABLE_ROW);
      expect(dataRow?.children?.length).toBe(2);
      expect(dataRow?.children?.[0].type).toBe(ConfluenceElementType.TABLE_CELL);
      expect(dataRow?.children?.[0].content).toBe('Cell 1');
      expect(dataRow?.children?.[0].attributes?.isHeader).toBe(false);
    });
    
    it('should parse a link', () => {
      const storageFormat = `
        <p>This is a <a href="https://example.com" title="Example">link</a></p>
      `;
      
      const parser = new ConfluenceParser(storageFormat, 'Test Document');
      const document = parser.parse();
      
      expect(document.elements.length).toBe(1);
      
      // Check paragraph
      const paragraph = document.elements[0];
      expect(paragraph.type).toBe(ConfluenceElementType.PARAGRAPH);
      
      // Check link
      const link = paragraph.children?.[0];
      expect(link?.type).toBe(ConfluenceElementType.LINK);
      expect(link?.content).toBe('link');
      expect(link?.attributes?.href).toBe('https://example.com');
      expect(link?.attributes?.title).toBe('Example');
    });
    
    it('should parse a macro', () => {
      const storageFormat = `
        <ac:structured-macro ac:name="info">
          <ac:parameter ac:name="title">Info Title</ac:parameter>
          <ac:rich-text-body>
            <p>This is an info macro</p>
          </ac:rich-text-body>
        </ac:structured-macro>
      `;
      
      const parser = new ConfluenceParser(storageFormat, 'Test Document');
      const document = parser.parse();
      
      expect(document.elements.length).toBe(1);
      
      // Check macro
      const macro = document.elements[0];
      expect(macro.type).toBe(ConfluenceElementType.MACRO);
      expect(macro.attributes?.name).toBe('info');
      expect(macro.attributes?.parameters?.title).toBe('Info Title');
      expect(macro.content).toBe('This is an info macro');
    });
  });
});

describe('ContentExtractor', () => {
  it('should extract text from a document', () => {
    // This test will be implemented in content-extractor.test.ts
  });
});

describe('StructureAnalyzer', () => {
  it('should analyze document structure', () => {
    // This test will be implemented in structure-analyzer.test.ts
  });
});

describe('MacroHandlers', () => {
  it('should handle macros', () => {
    // This test will be implemented in macro-handlers.test.ts
  });
});
