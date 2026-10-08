// Default high-quality student portrait photography for ST. MICHAEL'S SCHOOL
// If the user pastes an image link into the 'Candidate Photos' tab in Google Sheets,
// that Google Sheet URL will automatically take precedence!

const DEFAULT_PORTRAITS: Record<string, string> = {
  // Official ST. MICHAEL'S SCHOOL Google Forms Student Uniform Portraits
  'akua foriwaa': '/candidates/akua-foriwaa.png',
  'lydia appiagyei': '/candidates/lydia-appiagyei.png',
};

export function getCandidatePhoto(fullName: string, customUrl?: string): string {
  if (customUrl && customUrl.trim()) {
    return customUrl.trim();
  }
  const normalized = (fullName || '').toLowerCase().trim();
  return DEFAULT_PORTRAITS[normalized] || '';
}
