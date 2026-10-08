import type {MetadataRoute} from 'next';

export default function robots():MetadataRoute.Robots{
  const privatePaths=['/admin/','/api/','/profile','/vault','/sign-in','/sign-up','/forgot-password','/reset-password','/verify-email','/decks/builder','/play/board','/play/table'];
  return {
    rules:[
      {userAgent:'*',allow:'/',disallow:privatePaths},
      ...['Googlebot','Google-Extended','GPTBot','OAI-SearchBot','ClaudeBot','Claude-SearchBot','PerplexityBot','Applebot-Extended'].map(userAgent=>({userAgent,allow:'/',disallow:privatePaths})),
    ],
    sitemap:'https://vivreplay.com/sitemap.xml',
  };
}
