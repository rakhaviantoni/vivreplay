import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { user as loadProfile } from '@/lib/server/store';
import { getListingPolicy } from '@/lib/market/policy';

const baseUrl = (
  process.env.AZEKHA_AI_GATEWAY_URL ??
  process.env.AI_GATEWAY_URL ??
  process.env.OPENAI_BASE_URL ??
  process.env.SUMOPOD_BASE_URL ??
  'https://ai.sumopod.com/v1'
).replace(/\/$/, '');

const apiKey =
  process.env.AZEKHA_AI_GATEWAY_TOKEN ??
  process.env.AZEKHA_AI_GATEWAY_API_KEY ??
  process.env.AI_GATEWAY_INTERNAL_TOKEN ??
  process.env.OPENAI_API_KEY ??
  process.env.SUMOPOD_API_KEY ??
  process.env.ZAI_API_KEY;

const model =
  process.env.AZEKHA_AI_MODEL ??
  process.env.AI_GATEWAY_MODEL ??
  process.env.SUMOPOD_MODEL ??
  'glm-5.3-flash';

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const profile = await loadProfile().catch(() => null);
  if (!profile || getListingPolicy(profile.tier, profile.pro_billing_period).tier !== 'pro') {
    return NextResponse.json(
      {
        error: 'AI Captions is a Market Pro feature. Upgrade to Market Pro to generate captions with AI.',
        requiresPro: true,
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    caption?: string;
    style?: 'consign' | 'hype' | 'minimal' | 'story';
    locale?: 'ID' | 'EN';
    cardDetails?: {
      title?: string;
      price?: string;
      condition?: string;
      seller?: string;
      city?: string;
      link?: string;
      game?: string;
    };
  } | null;

  const current = body?.caption?.trim() || '';
  const style = body?.style || 'consign';
  const locale = body?.locale || 'ID';
  const details = body?.cardDetails ?? {};

  // If no AI key configured, use built-in smart template generation
  if (!apiKey) {
    let fallbackCaption = '';
    if (style === 'minimal') {
      fallbackCaption = `[AVAILABLE] ${details.title || 'TCG Card'}\nCondition: ${details.condition || 'Near Mint'}\nPrice: ${details.price || 'IDR'}\n\nVerified checkout & escrow via VivrePlay Market:\n${details.link || 'https://vivreplay.com'}`;
    } else if (style === 'hype') {
      fallbackCaption = `GRAIL ALERT! 🔥 Don't miss this drop!\n🃏 ${details.title || 'TCG Card'}\n✨ Grade/Condition: ${details.condition || 'Near Mint'}\n💰 ${details.price || 'IDR'}\n📍 ${details.city || 'Indonesia'} (by ${details.seller || 'Seller'})\n\nSecure purchase link:\n${details.link || 'https://vivreplay.com'}\n\n#VivrePlay #TCGCommunity #TradingCards`;
    } else {
      fallbackCaption = `[WTS / FOR SALE] 🔥\n🃏 ${details.title || 'TCG Card'}\n✨ Condition: ${details.condition || 'Near Mint'}\n💰 Price: ${details.price || 'IDR'}\n📍 ${details.city || 'Indonesia'} (${details.seller || 'Seller'})\n📦 Kurir: J&T / JNE / Lion Parcel\n\n🛒 Rekber resmi via VivrePlay Market:\n🔗 ${details.link || 'https://vivreplay.com'}\n\n#OnePieceTCG #PokemonTCG #VivrePlayMarket`;
    }
    return NextResponse.json({ caption: fallbackCaption });
  }

  const systemPrompt = `You are a professional social media manager specializing in trading card games (One Piece Card Game, Pokémon TCG) and high-end collectible consignment accounts on Instagram, X, and Threads in Indonesia and Southeast Asia.
Your job is to polish, refine, or generate high-converting, clean social media drops.

Rules:
1. Keep the format concise, clean, and engaging for card collectors.
2. Maintain placeholders like {{title}}, {{price}}, {{condition}}, {{link}}, etc. if the user is designing a template, or fill in actual card info if provided.
3. Include clear rekber / escrow purchase link to VivrePlay Market.
4. Add 4-6 highly relevant, targeted hashtags (e.g. #OnePieceCardGame, #PokemonTCG, #VivrePlayMarket).
5. Output ONLY the caption text. No chatty conversational introductions or markdown code fences.`;

  const userPrompt = `Please generate an improved ${style} social media drop caption in ${
    locale === 'ID' ? 'Indonesian' : 'English'
  }.
Current draft / template:
${current || '(None provided, generate from card details)'}

Card Details:
- Title: ${details.title || '{{title}}'}
- Price: ${details.price || '{{price}}'}
- Condition: ${details.condition || '{{condition}}'}
- City: ${details.city || '{{city}}'}
- Seller: ${details.seller || '{{seller}}'}
- Link: ${details.link || '{{link}}'}
- Game: ${details.game || 'One Piece / Pokémon'}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI error (${response.status})`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Empty AI response');
    }

    return NextResponse.json({ caption: content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI generation failed' },
      { status: 500 }
    );
  }
}
