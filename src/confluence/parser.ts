/**
 * Confluence Document Parser
 *
 * This module provides a parser for Confluence documents in storage format (XHTML-based).
 * It converts the storage format into a structured representation that can be used for
 * extracting planning information.
 */

import * as cheerio from 'cheerio';
import * as logger from '../utils/logger';

/**
 * Types of Confluence elements
 */
export enum ConfluenceElementType {
  HEADING = 'heading',
  PARAGRAPH = 'paragraph',
  LIST = 'list',
  LIST_ITEM = 'list-item',
  TABLE = 'table',
  TABLE_ROW = 'table-row',
  TABLE_CELL = 'table-cell',
  LINK = 'link',
  IMAGE = 'image',
  CODE = 'code',
  MACRO = 'macro',
  SECTION = 'section',
  TEXT = 'text',
  UNKNOWN = 'unknown'
}

/**
 * Interface for a parsed Confluence element
 */
export interface ConfluenceElement {
  type: ConfluenceElementType;
  content?: string;
  children?: ConfluenceElement[];
  attributes?: Record<string, any>;
}

/**
 * Interface for a parsed Confluence document
 */
export interface ConfluenceDocument {
  title: string;
  elements: ConfluenceElement[];
  sections: ConfluenceSection[];
  metadata: Record<string, any>;
}

/**
 * Interface for a Confluence document section
 */
export interface ConfluenceSection {
  id: string;
  title: string;
  level: number;
  elements: ConfluenceElement[];
  subsections: ConfluenceSection[];
  parent?: ConfluenceSection;
}

/**
 * Confluence document parser class
 */
export class ConfluenceParser {
  private $: cheerio.CheerioAPI;
  private document: ConfluenceDocument;

  /**
   * Creates a new Confluence parser
   *
   * @param storageFormat The Confluence storage format (XHTML)
   * @param title The title of the document
   */
  constructor(storageFormat: string, title: string) {
    this.$ = cheerio.load(storageFormat, {
      xmlMode: true,
      decodeEntities: true
    }) as cheerio.CheerioAPI;

    this.document = {
      title,
      elements: [],
      sections: [],
      metadata: {}
    };
  }

  /**
   * Parses the Confluence document
   *
   * @returns The parsed document
   */
  parse(): ConfluenceDocument {
    try {
      // Parse the document elements
      // In xmlMode, cheerio doesn't create a <body> wrapper, so use root children
      const body = this.$('body');
      const root = body.length > 0 ? body.children() : this.$.root().children();
      this.document.elements = this.parseElements(root);

      // Extract sections based on headings
      this.document.sections = this.extractSections(this.document.elements);

      // Extract metadata
      this.document.metadata = this.extractMetadata();

      return this.document;
    } catch (error) {
      logger.error('Error parsing Confluence document', { error });
      throw error;
    }
  }

  /**
   * Parses Confluence elements
   *
   * @param elements The cheerio elements to parse
   * @returns The parsed elements
   */
  private parseElements(elements: cheerio.Cheerio): ConfluenceElement[] {
    const parsedElements: ConfluenceElement[] = [];

    elements.each((_, element) => {
      const parsedElement = this.parseElement(this.$(element));
      if (parsedElement) {
        parsedElements.push(parsedElement);
      }
    });

    return parsedElements;
  }

  /**
   * Parses a single Confluence element
   *
   * @param element The cheerio element to parse
   * @returns The parsed element or null if the element should be skipped
   */
  private parseElement(element: cheerio.Cheerio): ConfluenceElement | null {
    const tagName = element.get(0)?.tagName?.toLowerCase();

    if (!tagName) {
      return null;
    }

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return this.parseHeading(element, parseInt(tagName.substring(1), 10));
      case 'p':
        return this.parseParagraph(element);
      case 'ul':
      case 'ol':
        return this.parseList(element, tagName === 'ol');
      case 'li':
        return this.parseListItem(element);
      case 'table':
        return this.parseTable(element);
      case 'tr':
        return this.parseTableRow(element);
      case 'td':
      case 'th':
        return this.parseTableCell(element, tagName === 'th');
      case 'a':
        return this.parseLink(element);
      case 'img':
        return this.parseImage(element);
      case 'code':
      case 'pre':
        return this.parseCode(element, tagName === 'pre');
      case 'ac:structured-macro':
        return this.parseMacro(element);
      case 'div':
        return this.parseDiv(element);
      case 'span':
        return this.parseSpan(element);
      default:
        // For other elements, parse their children
        const children = this.parseElements(element.children());
        if (children.length > 0) {
          return {
            type: ConfluenceElementType.UNKNOWN,
            children
          };
        }
        return null;
    }
  }

  /**
   * Parses a heading element
   *
   * @param element The heading element
   * @param level The heading level (1-6)
   * @returns The parsed heading element
   */
  private parseHeading(element: cheerio.Cheerio, level: number): ConfluenceElement {
    return {
      type: ConfluenceElementType.HEADING,
      content: element.text().trim(),
      attributes: {
        level,
        id: element.attr('id') || `heading-${level}-${Date.now()}`
      }
    };
  }

  /**
   * Parses a paragraph element
   *
   * @param element The paragraph element
   * @returns The parsed paragraph element
   */
  private parseParagraph(element: cheerio.Cheerio): ConfluenceElement {
    return {
      type: ConfluenceElementType.PARAGRAPH,
      content: element.text().trim(),
      children: this.parseElements(element.children())
    };
  }

  /**
   * Parses a list element
   *
   * @param element The list element
   * @param ordered Whether the list is ordered
   * @returns The parsed list element
   */
  private parseList(element: cheerio.Cheerio, ordered: boolean): ConfluenceElement {
    return {
      type: ConfluenceElementType.LIST,
      children: this.parseElements(element.children()),
      attributes: {
        ordered
      }
    };
  }

  /**
   * Parses a list item element
   *
   * @param element The list item element
   * @returns The parsed list item element
   */
  private parseListItem(element: cheerio.Cheerio): ConfluenceElement {
    return {
      type: ConfluenceElementType.LIST_ITEM,
      content: element.text().trim(),
      children: this.parseElements(element.children())
    };
  }

  /**
   * Parses a table element
   *
   * @param element The table element
   * @returns The parsed table element
   */
  private parseTable(element: cheerio.Cheerio): ConfluenceElement {
    return {
      type: ConfluenceElementType.TABLE,
      children: this.parseElements(element.children('tr'))
    };
  }

  /**
   * Parses a table row element
   *
   * @param element The table row element
   * @returns The parsed table row element
   */
  private parseTableRow(element: cheerio.Cheerio): ConfluenceElement {
    return {
      type: ConfluenceElementType.TABLE_ROW,
      children: this.parseElements(element.children('td, th'))
    };
  }

  /**
   * Parses a table cell element
   *
   * @param element The table cell element
   * @param isHeader Whether the cell is a header cell
   * @returns The parsed table cell element
   */
  private parseTableCell(element: cheerio.Cheerio, isHeader: boolean): ConfluenceElement {
    return {
      type: ConfluenceElementType.TABLE_CELL,
      content: element.text().trim(),
      children: this.parseElements(element.children()),
      attributes: {
        isHeader
      }
    };
  }

  /**
   * Parses a link element
   *
   * @param element The link element
   * @returns The parsed link element
   */
  private parseLink(element: cheerio.Cheerio): ConfluenceElement {
    return {
      type: ConfluenceElementType.LINK,
      content: element.text().trim(),
      attributes: {
        href: element.attr('href') || '',
        title: element.attr('title') || ''
      }
    };
  }

  /**
   * Parses an image element
   *
   * @param element The image element
   * @returns The parsed image element
   */
  private parseImage(element: cheerio.Cheerio): ConfluenceElement {
    return {
      type: ConfluenceElementType.IMAGE,
      attributes: {
        src: element.attr('src') || '',
        alt: element.attr('alt') || '',
        title: element.attr('title') || ''
      }
    };
  }

  /**
   * Parses a code element
   *
   * @param element The code element
   * @param isBlock Whether the code is a block (pre) or inline (code)
   * @returns The parsed code element
   */
  private parseCode(element: cheerio.Cheerio, isBlock: boolean): ConfluenceElement {
    return {
      type: ConfluenceElementType.CODE,
      content: element.text().trim(),
      attributes: {
        isBlock
      }
    };
  }

  /**
   * Parses a macro element
   *
   * @param element The macro element
   * @returns The parsed macro element
   */
  private parseMacro(element: cheerio.Cheerio): ConfluenceElement {
    const macroName = element.attr('ac:name') || '';
    const macroParams: Record<string, string> = {};

    // Extract macro parameters
    // Escape colons in CSS selectors for xml namespace prefixes
    element.find('ac\\:parameter').each((_, param) => {
      const $param = this.$(param);
      const name = $param.attr('ac:name') || '';
      const value = $param.text().trim();
      if (name) {
        macroParams[name] = value;
      }
    });

    // Extract macro content
    const macroContent = element.find('ac\\:rich-text-body').text().trim();

    return {
      type: ConfluenceElementType.MACRO,
      content: macroContent,
      attributes: {
        name: macroName,
        parameters: macroParams
      }
    };
  }

  /**
   * Parses a div element
   *
   * @param element The div element
   * @returns The parsed div element
   */
  private parseDiv(element: cheerio.Cheerio): ConfluenceElement {
    const children = this.parseElements(element.children());
    return {
      type: ConfluenceElementType.SECTION,
      children
    };
  }

  /**
   * Parses a span element
   *
   * @param element The span element
   * @returns The parsed span element
   */
  private parseSpan(element: cheerio.Cheerio): ConfluenceElement {
    const content = element.text().trim();
    return {
      type: ConfluenceElementType.TEXT,
      content: content || ''
    };
  }

  /**
   * Extracts sections from the document elements
   *
   * @param elements The document elements
   * @returns The extracted sections
   */
  private extractSections(elements: ConfluenceElement[]): ConfluenceSection[] {
    const sections: ConfluenceSection[] = [];
    let currentSection: ConfluenceSection | null = null;
    let sectionElements: ConfluenceElement[] = [];

    // Process elements to identify sections
    for (const element of elements) {
      if (element.type === ConfluenceElementType.HEADING) {
        // If we have a current section, finalize it
        if (currentSection) {
          currentSection.elements = sectionElements;
          sections.push(currentSection);
        }

        // Start a new section
        currentSection = {
          id: element.attributes?.id || `section-${Date.now()}`,
          title: element.content || '',
          level: element.attributes?.level || 1,
          elements: [],
          subsections: []
        };
        sectionElements = [];
      } else if (currentSection) {
        // Add element to current section
        sectionElements.push(element);
      }
    }

    // Finalize the last section
    if (currentSection) {
      currentSection.elements = sectionElements;
      sections.push(currentSection);
    }

    // Build section hierarchy
    return this.buildSectionHierarchy(sections);
  }

  /**
   * Builds a hierarchy of sections based on heading levels
   *
   * @param sections The flat list of sections
   * @returns The hierarchical sections
   */
  private buildSectionHierarchy(sections: ConfluenceSection[]): ConfluenceSection[] {
    const rootSections: ConfluenceSection[] = [];
    const sectionStack: ConfluenceSection[] = [];

    for (const section of sections) {
      // Pop sections from the stack until we find a parent section
      while (
        sectionStack.length > 0 &&
        sectionStack[sectionStack.length - 1].level >= section.level
      ) {
        sectionStack.pop();
      }

      if (sectionStack.length === 0) {
        // This is a root section
        rootSections.push(section);
      } else {
        // This is a subsection
        const parentSection = sectionStack[sectionStack.length - 1];
        section.parent = parentSection;
        parentSection.subsections.push(section);
      }

      sectionStack.push(section);
    }

    return rootSections;
  }

  /**
   * Extracts metadata from the document
   *
   * @returns The extracted metadata
   */
  private extractMetadata(): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Extract metadata from specific macros or elements
    // This is a placeholder for custom metadata extraction

    return metadata;
  }
}
