import JSZip from 'jszip';

export interface ZipValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
  fileCount?: number;
  extractedMetadata?: {
    name?: string;
    slug?: string;
    description?: string;
    author?: string;
    category?: string;
    version?: string;
    technologies?: string[];
  };
}

export async function validateZipBuffer(buffer: Buffer): Promise<ZipValidationResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    return {
      valid: false,
      error: 'Invalid or corrupted ZIP file.',
    };
  }

  const entries = Object.keys(zip.files);
  if (entries.length === 0) {
    return {
      valid: false,
      error: 'ZIP file contains no files.',
    };
  }

  // Count actual files (excluding directory entries)
  let fileCount = 0;
  let moduleJsonEntry: JSZip.JSZipObject | null = null;

  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      fileCount++;
      if (relativePath.endsWith('module.json') && (!moduleJsonEntry || relativePath === 'module.json')) {
        moduleJsonEntry = zipEntry;
      }
    }
  });

  if (fileCount === 0) {
    return {
      valid: false,
      error: 'ZIP file contains no files.',
    };
  }

  // Optional: Try parsing module.json if present to pre-fill metadata
  let extractedMetadata: ZipValidationResult['extractedMetadata'] = undefined;
  if (moduleJsonEntry) {
    try {
      const rawText = await (moduleJsonEntry as JSZip.JSZipObject).async('string');
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object') {
        extractedMetadata = {
          name: typeof parsed.name === 'string' ? parsed.name : undefined,
          slug: typeof parsed.slug === 'string' ? parsed.slug : undefined,
          description: typeof parsed.description === 'string' ? parsed.description : undefined,
          author: typeof parsed.author === 'string' ? parsed.author : undefined,
          category: typeof parsed.category === 'string' ? parsed.category : undefined,
          version: typeof parsed.version === 'string' ? parsed.version : undefined,
          technologies: Array.isArray(parsed.technologies) ? parsed.technologies : undefined,
        };
      }
    } catch (e) {
      // Ignore module.json parse errors since it's completely optional
    }
  }

  return {
    valid: true,
    message: 'ZIP file is valid',
    fileCount,
    extractedMetadata,
  };
}
