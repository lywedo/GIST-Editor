import { Gist, GistFile } from './githubService';
import { parseGistDescription } from './gistDescriptionParser';

type SearchSource = 'my' | 'starred';

export interface SearchFilters {
  language?: string;
  visibility?: 'public' | 'private';
  folder?: string;
  fileNamesOnly?: boolean;
  descriptionOnly?: boolean;
  contentOnly?: boolean;
}

export interface SearchResult {
  gistId: string;
  gistName: string;
  fileName?: string;
  matchType: 'name' | 'description' | 'filename' | 'content';
  preview: string;
  folderPath: string[];
  isPublic: boolean;
  lineNumber?: number;
  matchContext: string;
  score: number;
  gist: Gist;
  source?: SearchSource;
}

interface GistSearchData {
  gist: Gist;
  folderPath: string[];
  gistName: string;
  searchText: string; // Combined searchable text
  source?: SearchSource;
}

interface BaseResultContext {
  gist: Gist;
  gistId: string;
  gistName: string;
  folderPath: string[];
  isPublic: boolean;
  source?: SearchSource;
}

export class SearchProvider {
  private searchIndex: Map<string, GistSearchData> = new Map();

  /**
   * Build search index from gists
   */
  buildSearchIndex(
    gists: Gist[],
    gistSources: Map<string, SearchSource> = new Map()
  ): Map<string, GistSearchData> {
    this.searchIndex.clear();

    for (const gist of gists) {
      const parsed = parseGistDescription(gist.description);
      const gistName = parsed.displayName;
      const folderPath = parsed.folderPath;
      const source = gistSources.get(gist.id);

      // Combine all searchable text
      const fileNames = Object.keys(gist.files).join(' ');
      const fileContent = Object.values(gist.files)
        .map((f: GistFile) => f.content || '')
        .join(' ');

      const searchText = `${gistName} ${gist.description} ${fileNames} ${fileContent}`.toLowerCase();

      this.searchIndex.set(gist.id, {
        gist,
        folderPath,
        gistName,
        searchText,
        source,
      });
    }

    return this.searchIndex;
  }

  /**
   * Search gists based on query and filters
   */
  async searchGists(
    query: string,
    filters: SearchFilters = {}
  ): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const [, data] of this.searchIndex) {
      const { gist, folderPath, gistName } = data;
      const baseContext: BaseResultContext = {
        gist,
        gistId: gist.id,
        gistName,
        folderPath,
        isPublic: gist.public,
        source: data.source,
      };

      // Apply visibility filter
      if (filters.visibility && gist.public !== (filters.visibility === 'public')) {
        continue;
      }

      // Apply folder filter
      if (filters.folder) {
        const folderMatch = folderPath.some((f) =>
          f.toLowerCase().includes(filters.folder!.toLowerCase())
        );
        if (!folderMatch) {
          continue;
        }
      }

      // Apply language filter
      if (filters.language) {
        const hasLanguage = Object.values(gist.files).some((f: GistFile) => {
          const lang = f.language || '';
          return lang.toLowerCase().includes(filters.language!.toLowerCase());
        });
        if (!hasLanguage) {
          continue;
        }
      }

      // Search in different fields based on filters
      let matchResults: SearchResult[] = [];

      if (!filters.contentOnly && !filters.fileNamesOnly) {
        // Search gist name and description
        const nameMatch = this.searchInText(
          gistName,
          queryLower,
          'name',
          gistName,
          baseContext
        );
        const descMatch = this.searchInText(
          gist.description,
          queryLower,
          'description',
          gist.description,
          baseContext
        );
        matchResults.push(...nameMatch, ...descMatch);
      }

      if (!filters.descriptionOnly && !filters.contentOnly) {
        // Search file names
        for (const fileName of Object.keys(gist.files)) {
          const fileMatch = this.searchInText(
            fileName,
            queryLower,
            'filename',
            fileName,
            baseContext,
            fileName
          );
          matchResults.push(...fileMatch);
        }
      }

      if (!filters.descriptionOnly && !filters.fileNamesOnly) {
        // Search file content
        for (const [fileName, file] of Object.entries(gist.files)) {
          const content = (file as GistFile).content || '';
          const contentMatches = this.searchInContent(
            content,
            queryLower,
            fileName,
            baseContext
          );
          matchResults.push(...contentMatches);
        }
      }

      // Create unique results and add to main list
      const uniqueMatches = Array.from(
        new Map(
          matchResults.map((r) => [
            [r.gistId, r.matchType, r.fileName ?? '', r.lineNumber ?? ''].join('|'),
            r,
          ])
        ).values()
      );

      results.push(...uniqueMatches);
    }

    // Rank results by relevance
    const rankedResults = this.rankResults(results, queryLower);

    // Limit to top 50 results
    return rankedResults.slice(0, 50);
  }

  /**
   * Search in a single text field
   */
  private searchInText(
    text: string,
    query: string,
    matchType: 'name' | 'description' | 'filename',
    preview: string,
    base: BaseResultContext,
    fileName?: string
  ): SearchResult[] {
    if (!text || !text.toLowerCase().includes(query)) {
      return [];
    }

    // Find all matches in the text
    const textLower = text.toLowerCase();
    const matches: number[] = [];
    let index = 0;

    while ((index = textLower.indexOf(query, index)) !== -1) {
      matches.push(index);
      index += 1;
    }

    if (matches.length === 0) {
      return [];
    }

    // For now, return one result per match type per gist
    return [
      {
        gistId: base.gistId,
        gistName: base.gistName,
        gist: base.gist,
        source: base.source,
        matchType,
        preview: this.truncatePreview(preview),
        folderPath: base.folderPath,
        isPublic: base.isPublic,
        matchContext: preview,
        score: this.calculateScore(text, query, matchType),
        fileName,
      },
    ];
  }

  /**
   * Search in file content with line numbers
   */
  private searchInContent(
    content: string,
    query: string,
    fileName: string,
    base: BaseResultContext
  ): SearchResult[] {
    if (!content.toLowerCase().includes(query)) {
      return [];
    }

    const lines = content.split('\n');
    const results: SearchResult[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes(query)) {
        results.push({
          gistId: base.gistId,
          gistName: base.gistName,
          gist: base.gist,
          source: base.source,
          fileName,
          matchType: 'content',
          preview: this.truncatePreview(line),
          folderPath: base.folderPath,
          isPublic: base.isPublic,
          lineNumber: i + 1,
          matchContext: this.getContentContext(lines, i, query),
          score: this.calculateScore(line, query, 'content'),
        });
      }
    }

    return results;
  }

  /**
   * Get context around a match (line before, match line, line after)
   */
  private getContentContext(lines: string[], lineIndex: number, query: string): string {
    const context: string[] = [];
    if (lineIndex > 0) {
      context.push(lines[lineIndex - 1]);
    }
    context.push(lines[lineIndex]);
    if (lineIndex < lines.length - 1) {
      context.push(lines[lineIndex + 1]);
    }

    return context.join('\n');
  }

  /**
   * Calculate match score for ranking
   */
  private calculateScore(
    text: string,
    query: string,
    matchType: 'name' | 'description' | 'filename' | 'content'
  ): number {
    const textLower = text.toLowerCase();
    const exact = textLower === query ? 100 : 0;
    const startsWith = textLower.startsWith(query) ? 50 : 0;
    const contains = textLower.includes(query) ? 20 : 0;

    const typeScore = {
      name: 30,
      description: 20,
      filename: 25,
      content: 10,
    };

    return exact + startsWith + contains + typeScore[matchType];
  }

  /**
   * Rank results by relevance
   */
  private rankResults(results: SearchResult[], query: string): SearchResult[] {
    return results.sort((a, b) => {
      // Primary: exact match bonus
      const aExact =
        a.preview.toLowerCase() === query ||
        a.matchContext.toLowerCase().includes(query)
          ? 1000
          : 0;
      const bExact =
        b.preview.toLowerCase() === query ||
        b.matchContext.toLowerCase().includes(query)
          ? 1000
          : 0;

      if (aExact !== bExact) {
        return bExact - aExact;
      }

      // Secondary: match type priority
      const typePriority = { name: 100, description: 80, filename: 60, content: 40 };
      const aPriority = typePriority[a.matchType];
      const bPriority = typePriority[b.matchType];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Tertiary: score
      return b.score - a.score;
    });
  }

  /**
   * Truncate preview to reasonable length
   */
  private truncatePreview(text: string, maxLength: number = 100): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
}
